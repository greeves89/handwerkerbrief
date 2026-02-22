from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from decimal import Decimal
from datetime import date
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.time_entry import TimeEntry
from app.models.customer import Customer
from app.models.document import Document
from app.models.document_item import DocumentItem
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TimeEntryCreate(BaseModel):
    description: str
    date: date
    duration_minutes: int
    hourly_rate: Decimal = Decimal("0")
    customer_id: Optional[int] = None


class TimeEntryUpdate(BaseModel):
    description: Optional[str] = None
    date: Optional[date] = None
    duration_minutes: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    customer_id: Optional[int] = None


class CustomerRef(BaseModel):
    id: int
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        from_attributes = True


class TimeEntryResponse(BaseModel):
    id: int
    user_id: int
    customer_id: Optional[int] = None
    customer: Optional[CustomerRef] = None
    document_id: Optional[int] = None
    description: str
    date: date
    duration_minutes: int
    hourly_rate: Decimal
    total_amount: Decimal
    billed: bool

    class Config:
        from_attributes = True


class BillTimeEntriesRequest(BaseModel):
    entry_ids: List[int]
    customer_id: int
    invoice_id: Optional[int] = None  # vorhandene Rechnung oder neue erstellen


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_total(duration_minutes: int, hourly_rate: Decimal) -> Decimal:
    return (Decimal(duration_minutes) / Decimal(60)) * hourly_rate


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TimeEntryResponse])
async def list_time_entries(
    customer_id: Optional[int] = None,
    billed: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(TimeEntry)
        .options(selectinload(TimeEntry.customer))
        .where(TimeEntry.user_id == current_user.id)
        .order_by(TimeEntry.date.desc(), TimeEntry.id.desc())
    )
    if customer_id is not None:
        q = q.where(TimeEntry.customer_id == customer_id)
    if billed is not None:
        q = q.where(TimeEntry.billed == billed)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=TimeEntryResponse, status_code=201)
async def create_time_entry(
    data: TimeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = _calc_total(data.duration_minutes, data.hourly_rate)
    entry = TimeEntry(
        user_id=current_user.id,
        customer_id=data.customer_id,
        description=data.description,
        date=data.date,
        duration_minutes=data.duration_minutes,
        hourly_rate=data.hourly_rate,
        total_amount=total,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    result = await db.execute(
        select(TimeEntry).options(selectinload(TimeEntry.customer)).where(TimeEntry.id == entry.id)
    )
    return result.scalar_one()


@router.put("/{entry_id}", response_model=TimeEntryResponse)
async def update_time_entry(
    entry_id: int,
    data: TimeEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")
    if entry.billed:
        raise HTTPException(status_code=400, detail="Bereits abgerechnete Einträge können nicht bearbeitet werden")

    if data.description is not None:
        entry.description = data.description
    if data.date is not None:
        entry.date = data.date
    if data.duration_minutes is not None:
        entry.duration_minutes = data.duration_minutes
    if data.hourly_rate is not None:
        entry.hourly_rate = data.hourly_rate
    if data.customer_id is not None:
        entry.customer_id = data.customer_id

    entry.total_amount = _calc_total(entry.duration_minutes, entry.hourly_rate)
    await db.commit()

    result = await db.execute(
        select(TimeEntry).options(selectinload(TimeEntry.customer)).where(TimeEntry.id == entry_id)
    )
    return result.scalar_one()


@router.delete("/{entry_id}", status_code=204)
async def delete_time_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Zeiteintrag nicht gefunden")
    if entry.billed:
        raise HTTPException(status_code=400, detail="Bereits abgerechnete Einträge können nicht gelöscht werden")
    await db.delete(entry)
    await db.commit()


@router.post("/bill", response_model=dict)
async def bill_time_entries(
    data: BillTimeEntriesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Zeiteinträge als Positionen in eine Rechnung übernehmen."""
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.id.in_(data.entry_ids),
            TimeEntry.user_id == current_user.id,
            TimeEntry.billed == False,
        )
    )
    entries = result.scalars().all()
    if not entries:
        raise HTTPException(status_code=404, detail="Keine offenen Zeiteinträge gefunden")

    # Neue Rechnung anlegen
    counter = current_user.invoice_counter
    prefix = current_user.invoice_prefix or "RE-"
    doc_number = f"{prefix}{counter:04d}"
    current_user.invoice_counter = counter + 1

    from app.models.document import Document
    from app.models.document_item import DocumentItem
    from datetime import date as date_cls
    from decimal import Decimal as D

    # Summen berechnen
    subtotal = sum(e.total_amount for e in entries)
    tax_rate = D("19")
    tax_amount = subtotal * tax_rate / 100
    total = subtotal + tax_amount

    invoice = Document(
        user_id=current_user.id,
        customer_id=data.customer_id,
        type="invoice",
        document_number=doc_number,
        status="draft",
        title="Stundenabrechnung",
        issue_date=date_cls.today(),
        discount_percent=D("0"),
        tax_rate=tax_rate,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total,
    )
    db.add(invoice)
    await db.flush()

    for i, entry in enumerate(entries, 1):
        hours = Decimal(str(entry.duration_minutes)) / Decimal("60")
        item = DocumentItem(
            document_id=invoice.id,
            position=i,
            name=entry.description,
            description=f"{entry.duration_minutes} Min. × {entry.hourly_rate} €/Std.",
            quantity=hours.quantize(Decimal("0.01")),
            unit="Std.",
            price_per_unit=entry.hourly_rate,
            total_price=entry.total_amount,
        )
        db.add(item)
        entry.billed = True
        entry.document_id = invoice.id

    await db.commit()
    return {"invoice_id": invoice.id, "document_number": doc_number, "total_amount": float(total)}
