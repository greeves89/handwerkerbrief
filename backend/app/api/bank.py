"""
Bankintegration: Kontoauszug-Import (CSV) & automatischer Zahlungsabgleich.

Unterstützte CSV-Formate:
- DKB (Girokonto-Export)
- Sparkasse / VR-Bank (MT940-CSV, CAMT.053-CSV)
- Comdirect
- Generisch (Spaltenauswahl)

Matching-Logik:
1. Exakter Betrag + Rechnungsnummer im Verwendungszweck (confidence 95)
2. Exakter Betrag + Kundenname im Verwendungszweck (confidence 75)
3. Exakter Betrag + Datum innerhalb 60 Tage (confidence 50)
"""
import csv
import io
import re
import uuid
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from pydantic import BaseModel
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.bank_transaction import BankTransaction
from app.models.customer import Customer
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/bank", tags=["bank"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TransactionOut(BaseModel):
    id: int
    booking_date: str
    counterparty: Optional[str]
    purpose: Optional[str]
    amount: float
    currency: str
    matched_document_id: Optional[int]
    matched_document_number: Optional[str]
    match_confidence: int
    is_manually_matched: bool
    is_ignored: bool

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    auto_matched: int
    batch_id: str
    transactions: list[TransactionOut]


class MatchRequest(BaseModel):
    document_id: Optional[int]  # None = remove match


class StatsOut(BaseModel):
    total: int
    matched: int
    unmatched: int
    ignored: int
    total_income: float
    total_expense: float


# ── CSV Parsing ───────────────────────────────────────────────────────────────

def _parse_german_decimal(value: str) -> Optional[Decimal]:
    """Parse German-formatted decimal: 1.234,56 or 1234,56 or 1234.56"""
    if not value:
        return None
    v = value.strip().replace("\xa0", "").replace(" ", "")
    # Remove currency symbols
    v = re.sub(r"[€$£]", "", v)
    # German format: 1.234,56
    if re.match(r"^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$", v):
        v = v.replace(".", "").replace(",", ".")
    elif "," in v and "." not in v:
        v = v.replace(",", ".")
    elif "," in v and "." in v and v.index(",") > v.index("."):
        # 1,234.56 format
        v = v.replace(",", "")
    elif "," in v:
        v = v.replace(".", "").replace(",", ".")
    try:
        return Decimal(v)
    except InvalidOperation:
        return None


def _parse_date(value: str) -> Optional[date]:
    """Parse German date DD.MM.YYYY or ISO YYYY-MM-DD."""
    if not value:
        return None
    value = value.strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _detect_columns(header: list[str]) -> dict:
    """
    Auto-detect column mapping from header row.
    Returns dict with keys: date, value_date, counterparty, iban, purpose, amount, currency, debit, credit
    Values are column indices or None.
    """
    h = [c.lower().strip() for c in header]

    def find(*candidates) -> Optional[int]:
        for cand in candidates:
            for i, col in enumerate(h):
                if cand in col:
                    return i
        return None

    return {
        "date": find("buchungstag", "buchungsdatum", "datum", "date", "valuta", "wertstellung"),
        "value_date": find("wertstellung", "valutadatum", "value date"),
        "counterparty": find("auftraggeber", "empfänger", "beguenstigter", "begünstigter", "name", "counterparty", "zahlungsempfänger"),
        "iban": find("iban", "konto", "account"),
        "purpose": find("verwendungszweck", "buchungstext", "purpose", "betreff", "reference", "description"),
        "amount": find("betrag", "amount", "umsatz", "betrag (eur)", "soll/haben"),
        "currency": find("währung", "currency", "waehrung"),
        "debit": find("soll", "debit", "ausgabe", "belastung"),
        "credit": find("haben", "credit", "eingang", "gutschrift"),
    }


def _parse_csv(content: bytes) -> list[dict]:
    """Parse a bank CSV file and return list of transaction dicts."""
    # Try different encodings
    text = None
    for enc in ("utf-8-sig", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("CSV-Datei konnte nicht gelesen werden (Encoding-Fehler).")

    # DKB has metadata rows at the top — skip until we find the header row
    lines = text.splitlines()
    start_idx = 0
    for i, line in enumerate(lines):
        if re.search(r"(buchungstag|datum|date|buchung)", line, re.IGNORECASE):
            start_idx = i
            break

    dialect = csv.Sniffer().sniff(lines[start_idx], delimiters=";,\t")
    reader = csv.reader(lines[start_idx:], dialect=dialect)
    rows = list(reader)
    if not rows:
        return []

    header = rows[0]
    cols = _detect_columns(header)
    transactions = []

    for row in rows[1:]:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        if len(row) <= max(c for c in cols.values() if c is not None):
            continue

        def get(idx: Optional[int]) -> str:
            if idx is None or idx >= len(row):
                return ""
            return row[idx].strip()

        booking_date = _parse_date(get(cols["date"]))
        if booking_date is None:
            continue

        # Amount: prefer combined amount column, fallback to debit/credit
        amount: Optional[Decimal] = None
        if cols["amount"] is not None:
            raw = get(cols["amount"])
            # Some banks add '+'/'-' suffix instead of prefix
            raw = raw.replace("+", "").strip()
            amount = _parse_german_decimal(raw)

        if amount is None and cols["debit"] is not None and cols["credit"] is not None:
            debit = _parse_german_decimal(get(cols["debit"]))
            credit = _parse_german_decimal(get(cols["credit"]))
            if credit and credit > 0:
                amount = credit
            elif debit and debit > 0:
                amount = -debit

        if amount is None:
            continue

        transactions.append({
            "booking_date": booking_date,
            "value_date": _parse_date(get(cols["value_date"])),
            "counterparty": get(cols["counterparty"]) or None,
            "iban": get(cols["iban"]) or None,
            "purpose": get(cols["purpose"]) or None,
            "amount": amount,
            "currency": get(cols["currency"]) or "EUR",
        })

    return transactions


# ── Auto-Matching ─────────────────────────────────────────────────────────────

async def _auto_match(
    txn: BankTransaction,
    user_id: int,
    db: AsyncSession,
) -> tuple[Optional[int], int]:
    """
    Try to auto-match a transaction to an invoice.
    Returns (document_id, confidence) or (None, 0).
    Only matches income (positive amounts) to open/sent invoices.
    """
    if txn.amount <= 0:
        return None, 0   # Only income transactions

    amount = txn.amount
    purpose = (txn.purpose or "").lower()
    counterparty = (txn.counterparty or "").lower()

    # Fetch candidate invoices: open or sent, same user, amount matches
    result = await db.execute(
        select(Document, Customer)
        .join(Customer, Document.customer_id == Customer.id)
        .where(
            and_(
                Document.user_id == user_id,
                Document.type == "invoice",
                Document.status.in_(["sent", "overdue"]),
                Document.total_amount == amount,
            )
        )
    )
    candidates = result.all()

    for doc, customer in candidates:
        doc_num = doc.document_number.lower()
        cust_name = customer.name.lower()

        # Level 1: invoice number in purpose
        if doc_num and doc_num in purpose:
            return doc.id, 95

        # Level 2: customer name in purpose or counterparty
        if len(cust_name) >= 4 and (cust_name in purpose or cust_name in counterparty):
            return doc.id, 75

    # Level 3: amount match + date within 60 days
    for doc, customer in candidates:
        if doc.issue_date:
            diff = abs((txn.booking_date - doc.issue_date).days)
            if diff <= 60:
                return doc.id, 50

    return None, 0


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/import", response_model=ImportResult)
async def import_bank_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a bank statement CSV and auto-match transactions to invoices."""
    content_type = file.content_type or ""
    if not (content_type in ("text/csv", "text/plain", "application/octet-stream")
            or (file.filename or "").lower().endswith(".csv")):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien werden unterstützt.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Datei zu groß. Maximum: 5 MB")

    try:
        raw_txns = _parse_csv(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not raw_txns:
        raise HTTPException(status_code=422, detail="Keine Buchungen in der CSV-Datei gefunden. Bitte Format prüfen.")

    batch_id = str(uuid.uuid4())
    imported = 0
    skipped = 0
    auto_matched = 0
    result_txns: list[BankTransaction] = []

    for raw in raw_txns:
        # Dedup: same user, same date, same amount, same purpose
        existing = await db.execute(
            select(BankTransaction).where(
                and_(
                    BankTransaction.user_id == current_user.id,
                    BankTransaction.booking_date == raw["booking_date"],
                    BankTransaction.amount == raw["amount"],
                    BankTransaction.purpose == raw["purpose"],
                )
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        txn = BankTransaction(
            user_id=current_user.id,
            booking_date=raw["booking_date"],
            value_date=raw["value_date"],
            counterparty=raw["counterparty"],
            iban=raw["iban"],
            purpose=raw["purpose"],
            amount=raw["amount"],
            currency=raw["currency"],
            import_batch=batch_id,
        )
        db.add(txn)
        await db.flush()  # get txn.id

        doc_id, confidence = await _auto_match(txn, current_user.id, db)
        if doc_id:
            txn.matched_document_id = doc_id
            txn.match_confidence = confidence
            auto_matched += 1

            # Mark invoice as paid if high-confidence match
            if confidence >= 75:
                doc_result = await db.execute(select(Document).where(Document.id == doc_id))
                doc = doc_result.scalar_one_or_none()
                if doc and doc.status in ("sent", "overdue"):
                    doc.status = "paid"

        result_txns.append(txn)
        imported += 1

    await db.commit()

    # Refresh to get relationships
    out = []
    for txn in result_txns:
        await db.refresh(txn)
        doc_num = None
        if txn.matched_document_id:
            doc_res = await db.execute(select(Document).where(Document.id == txn.matched_document_id))
            doc = doc_res.scalar_one_or_none()
            doc_num = doc.document_number if doc else None
        out.append(TransactionOut(
            id=txn.id,
            booking_date=str(txn.booking_date),
            counterparty=txn.counterparty,
            purpose=txn.purpose,
            amount=float(txn.amount),
            currency=txn.currency,
            matched_document_id=txn.matched_document_id,
            matched_document_number=doc_num,
            match_confidence=txn.match_confidence,
            is_manually_matched=txn.is_manually_matched,
            is_ignored=txn.is_ignored,
        ))

    return ImportResult(
        imported=imported,
        skipped_duplicates=skipped,
        auto_matched=auto_matched,
        batch_id=batch_id,
        transactions=out,
    )


@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    skip: int = 0,
    limit: int = 100,
    unmatched_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bank transactions, optionally filtered to unmatched ones."""
    q = select(BankTransaction).where(BankTransaction.user_id == current_user.id)
    if unmatched_only:
        q = q.where(
            and_(
                BankTransaction.matched_document_id.is_(None),
                BankTransaction.is_ignored.is_(False),
                BankTransaction.amount > 0,
            )
        )
    q = q.order_by(BankTransaction.booking_date.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    txns = result.scalars().all()

    out = []
    for txn in txns:
        doc_num = None
        if txn.matched_document_id:
            doc_res = await db.execute(select(Document).where(Document.id == txn.matched_document_id))
            doc = doc_res.scalar_one_or_none()
            doc_num = doc.document_number if doc else None
        out.append(TransactionOut(
            id=txn.id,
            booking_date=str(txn.booking_date),
            counterparty=txn.counterparty,
            purpose=txn.purpose,
            amount=float(txn.amount),
            currency=txn.currency,
            matched_document_id=txn.matched_document_id,
            matched_document_number=doc_num,
            match_confidence=txn.match_confidence,
            is_manually_matched=txn.is_manually_matched,
            is_ignored=txn.is_ignored,
        ))
    return out


@router.patch("/transactions/{txn_id}/match")
async def match_transaction(
    txn_id: int,
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually assign or remove a match between a transaction and an invoice."""
    result = await db.execute(
        select(BankTransaction).where(
            and_(BankTransaction.id == txn_id, BankTransaction.user_id == current_user.id)
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden.")

    if body.document_id is not None:
        # Verify document belongs to user
        doc_res = await db.execute(
            select(Document).where(and_(Document.id == body.document_id, Document.user_id == current_user.id))
        )
        doc = doc_res.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden.")
        txn.matched_document_id = body.document_id
        txn.match_confidence = 0
        txn.is_manually_matched = True
        # Mark invoice as paid
        if doc.status in ("sent", "overdue"):
            doc.status = "paid"
    else:
        txn.matched_document_id = None
        txn.match_confidence = 0
        txn.is_manually_matched = False

    await db.commit()
    return {"ok": True}


@router.patch("/transactions/{txn_id}/ignore")
async def ignore_transaction(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a transaction as ignored (no match needed)."""
    result = await db.execute(
        select(BankTransaction).where(
            and_(BankTransaction.id == txn_id, BankTransaction.user_id == current_user.id)
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden.")
    txn.is_ignored = not txn.is_ignored
    await db.commit()
    return {"ok": True, "is_ignored": txn.is_ignored}


@router.get("/stats", response_model=StatsOut)
async def bank_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summary statistics for bank transactions."""
    base = select(BankTransaction).where(BankTransaction.user_id == current_user.id)

    total_r = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_r.scalar() or 0

    matched_r = await db.execute(
        select(func.count()).select_from(
            base.where(BankTransaction.matched_document_id.isnot(None)).subquery()
        )
    )
    matched = matched_r.scalar() or 0

    ignored_r = await db.execute(
        select(func.count()).select_from(
            base.where(BankTransaction.is_ignored.is_(True)).subquery()
        )
    )
    ignored = ignored_r.scalar() or 0

    income_r = await db.execute(
        select(func.sum(BankTransaction.amount)).where(
            and_(BankTransaction.user_id == current_user.id, BankTransaction.amount > 0)
        )
    )
    total_income = float(income_r.scalar() or 0)

    expense_r = await db.execute(
        select(func.sum(BankTransaction.amount)).where(
            and_(BankTransaction.user_id == current_user.id, BankTransaction.amount < 0)
        )
    )
    total_expense = float(expense_r.scalar() or 0)

    return StatsOut(
        total=total,
        matched=matched,
        unmatched=total - matched - ignored,
        ignored=ignored,
        total_income=total_income,
        total_expense=abs(total_expense),
    )


@router.get("/open-invoices")
async def open_invoices_for_matching(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return open invoices available for manual matching."""
    result = await db.execute(
        select(Document, Customer)
        .join(Customer, Document.customer_id == Customer.id)
        .where(
            and_(
                Document.user_id == current_user.id,
                Document.type == "invoice",
                Document.status.in_(["sent", "overdue"]),
            )
        )
        .order_by(Document.issue_date.desc())
    )
    rows = result.all()
    return [
        {
            "id": doc.id,
            "document_number": doc.document_number,
            "customer_name": customer.name,
            "total_amount": float(doc.total_amount),
            "issue_date": str(doc.issue_date),
            "status": doc.status,
        }
        for doc, customer in rows
    ]
