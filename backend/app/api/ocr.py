"""
Belegscanner / OCR für Eingangsrechnungen.

Verarbeitet hochgeladene PDFs und Bilder, extrahiert automatisch:
- Lieferant / Absender
- Rechnungsnummer
- Rechnungsdatum
- Betrag (Brutto, Netto, MwSt)
- IBAN (wenn vorhanden)

Für PDFs: Text-Extraktion via pypdf (funktioniert für text-based PDFs).
Für gescannte/Bild-PDFs und Images: Hinweis für manuelle Eingabe.
"""
import io
import os
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.core.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/tiff"}


def extract_text_from_pdf(content: bytes) -> str:
    """Extracts text from a PDF file. Returns empty string if not a text-based PDF."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        texts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t)
        return "\n".join(texts)
    except Exception:
        return ""


def parse_german_amount(raw: str) -> Optional[float]:
    """Parses German-formatted number like 1.234,56 or 1234,56 or 1234.56."""
    raw = raw.strip()
    # Remove thousands separator (dot before comma)
    if re.match(r"^\d{1,3}(\.\d{3})+(,\d{1,2})?$", raw):
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def extract_fields(text: str) -> dict:
    """
    Uses regex heuristics to extract invoice fields from extracted PDF text.
    Returns a dict with optional keys: lieferant, rechnungsnummer, datum, brutto, netto, mwst, iban.
    """
    result: dict = {}

    # Rechnungsnummer – common patterns
    rn_match = re.search(
        r"(?:Rechnungs(?:nummer|nr\.?|no\.?)|Invoice\s*(?:No\.?|Number)|RE[-–]?\s*Nr\.?|Belegnummer)\s*[:\s#]*([A-Z0-9][A-Z0-9/_\-]{2,30})",
        text,
        re.IGNORECASE,
    )
    if rn_match:
        result["rechnungsnummer"] = rn_match.group(1).strip()

    # Datum – various formats
    date_match = re.search(
        r"(?:Rechnungs(?:datum|date)|Datum|Invoice Date|Ausstellungsdatum|Belegdatum)\s*[:\s]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})",
        text,
        re.IGNORECASE,
    )
    if date_match:
        raw_date = date_match.group(1)
        # Normalize to DD.MM.YYYY
        parts = re.split(r"[.\-/]", raw_date)
        if len(parts) == 3:
            d, m, y = parts
            if len(y) == 2:
                y = "20" + y
            result["datum"] = f"{d.zfill(2)}.{m.zfill(2)}.{y}"
    else:
        # Fallback: first date-looking string in text
        fallback_date = re.search(r"(\d{1,2}\.\d{1,2}\.\d{4})", text)
        if fallback_date:
            result["datum"] = fallback_date.group(1)

    # Brutto / Gesamtbetrag
    brutto_match = re.search(
        r"(?:Gesamt(?:betrag)?|Bruttobetrag|Rechnungsbetrag|Total|Zu zahlen|Zahlbar|Amount Due|Gesamtsumme)\s*[:\s]*(?:EUR|€)?\s*(\d[\d.,]+)",
        text,
        re.IGNORECASE,
    )
    if brutto_match:
        val = parse_german_amount(brutto_match.group(1))
        if val is not None:
            result["brutto"] = val

    # Nettobetrag
    netto_match = re.search(
        r"(?:Nettobetrag|Netto|Net(?:tobetrag)?|Zwischensumme)\s*[:\s]*(?:EUR|€)?\s*(\d[\d.,]+)",
        text,
        re.IGNORECASE,
    )
    if netto_match:
        val = parse_german_amount(netto_match.group(1))
        if val is not None:
            result["netto"] = val

    # MwSt / USt
    mwst_match = re.search(
        r"(?:MwSt\.?|USt\.?|VAT|Umsatzsteuer)\s*(?:\d{1,2}\s*%\s*)?[:\s]*(?:EUR|€)?\s*(\d[\d.,]+)",
        text,
        re.IGNORECASE,
    )
    if mwst_match:
        val = parse_german_amount(mwst_match.group(1))
        if val is not None:
            result["mwst"] = val

    # IBAN
    iban_match = re.search(r"\b(DE\d{2}[\s\d]{15,27})\b", text, re.IGNORECASE)
    if iban_match:
        result["iban"] = re.sub(r"\s", "", iban_match.group(1))

    # Lieferant – try to find company name after "Von:" or "Absender:" or first line
    lieferant_match = re.search(
        r"(?:Von|Absender|Lieferant|Firma|Company|Rechnungssteller)[:\s]+([^\n]{3,60})",
        text,
        re.IGNORECASE,
    )
    if lieferant_match:
        result["lieferant"] = lieferant_match.group(1).strip()
    elif text:
        # Heuristic: first non-empty line is often the company name
        first_lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 3]
        if first_lines:
            result["lieferant"] = first_lines[0][:80]

    return result


@router.post("/scan")
async def scan_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scannt ein hochgeladenes Dokument (PDF oder Bild) und extrahiert automatisch Rechnungsfelder.

    Returns extracted fields + whether OCR was successful (text_found=True/False).
    For image-only PDFs or pure image uploads, text_found=False and manual input is needed.
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Nicht unterstützter Dateityp: {content_type}. Erlaubt: PDF, JPEG, PNG, TIFF")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=413, detail="Datei zu groß. Maximum: 20 MB")

    text = ""
    text_found = False

    if content_type == "application/pdf":
        text = extract_text_from_pdf(content)
        text_found = bool(text.strip())

    fields = extract_fields(text) if text_found else {}

    # Save uploaded file for reference
    upload_subdir = os.path.join(settings.UPLOAD_DIR, "ocr_uploads", str(current_user.id))
    os.makedirs(upload_subdir, exist_ok=True)
    ext = ".pdf" if content_type == "application/pdf" else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_subdir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    relative_path = os.path.join("ocr_uploads", str(current_user.id), filename)

    return {
        "text_found": text_found,
        "file_path": relative_path,
        "original_filename": file.filename,
        "extracted": fields,
        "hint": (
            None if text_found
            else "Das Dokument enthält keinen extrahierbaren Text (gescanntes Bild). Bitte Felder manuell ausfüllen."
        ),
    }
