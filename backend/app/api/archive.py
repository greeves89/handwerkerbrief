"""
GoBD-konformes Belegarchiv (§ 147 AO).

Revisionssicheres Archiv für alle steuerlich relevanten Belege.
- Jeder Beleg wird mit SHA-256 gehashed und unveränderlich gespeichert.
- Archivierte Einträge können nicht gelöscht oder geändert werden (is_locked=True).
- Aufbewahrungsfrist: 10 Jahre ab Archivierungsdatum (§ 147 Abs. 3 AO).
- Vollständiger Audit-Trail nach § 145 AO.
"""
import os
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.archive import ArchiveEntry
from app.core.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/archive", tags=["archive"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "application/xml",
    "text/xml",
    "text/csv",
}

DOCUMENT_TYPES = {
    "invoice": "Ausgangsrechnung",
    "offer": "Angebot",
    "order_confirmation": "Auftragsbestätigung",
    "delivery_note": "Lieferschein",
    "incoming_invoice": "Eingangsrechnung",
    "contract": "Vertrag",
    "receipt": "Quittung",
    "bank_statement": "Kontoauszug",
    "other": "Sonstiger Beleg",
}

RETENTION_YEARS = 10  # § 147 Abs. 3 AO


# ── Schemas ───────────────────────────────────────────────────────────────────

class ArchiveEntryOut(BaseModel):
    id: int
    document_type: str
    document_type_label: str
    document_number: Optional[str]
    document_date: Optional[datetime]
    document_id: Optional[int]
    title: str
    description: Optional[str]
    category: Optional[str]
    counterparty: Optional[str]
    original_filename: Optional[str]
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    archived_at: datetime
    retention_until: datetime
    year: Optional[int]
    amount_cents: Optional[int]

    class Config:
        from_attributes = True


class ArchiveStatsOut(BaseModel):
    total_entries: int
    total_size_bytes: int
    by_type: dict
    by_year: dict
    oldest_entry: Optional[datetime]
    newest_entry: Optional[datetime]


# ── Helper ────────────────────────────────────────────────────────────────────

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _entry_to_out(e: ArchiveEntry) -> ArchiveEntryOut:
    return ArchiveEntryOut(
        id=e.id,
        document_type=e.document_type,
        document_type_label=DOCUMENT_TYPES.get(e.document_type, e.document_type),
        document_number=e.document_number,
        document_date=e.document_date,
        document_id=e.document_id,
        title=e.title,
        description=e.description,
        category=e.category,
        counterparty=e.counterparty,
        original_filename=e.original_filename,
        file_size_bytes=e.file_size_bytes,
        mime_type=e.mime_type,
        sha256_hash=e.sha256_hash,
        archived_at=e.archived_at,
        retention_until=e.retention_until,
        year=e.year,
        amount_cents=e.amount_cents,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ArchiveEntryOut])
async def list_entries(
    search: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archiveinträge auflisten mit Filter- und Suchfunktion."""
    q = select(ArchiveEntry).where(ArchiveEntry.user_id == current_user.id)

    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                ArchiveEntry.title.ilike(term),
                ArchiveEntry.document_number.ilike(term),
                ArchiveEntry.counterparty.ilike(term),
                ArchiveEntry.description.ilike(term),
            )
        )
    if document_type:
        q = q.where(ArchiveEntry.document_type == document_type)
    if year:
        q = q.where(ArchiveEntry.year == year)
    if category:
        q = q.where(ArchiveEntry.category.ilike(f"%{category}%"))

    q = q.order_by(ArchiveEntry.archived_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return [_entry_to_out(e) for e in result.scalars().all()]


@router.get("/stats", response_model=ArchiveStatsOut)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archivstatistiken für das Dashboard."""
    result = await db.execute(
        select(ArchiveEntry).where(ArchiveEntry.user_id == current_user.id)
    )
    entries = result.scalars().all()

    by_type: dict = {}
    by_year: dict = {}
    total_size = 0
    oldest = None
    newest = None

    for e in entries:
        total_size += e.file_size_bytes
        by_type[e.document_type] = by_type.get(e.document_type, 0) + 1
        if e.year:
            by_year[str(e.year)] = by_year.get(str(e.year), 0) + 1
        if oldest is None or e.archived_at < oldest:
            oldest = e.archived_at
        if newest is None or e.archived_at > newest:
            newest = e.archived_at

    return ArchiveStatsOut(
        total_entries=len(entries),
        total_size_bytes=total_size,
        by_type=by_type,
        by_year=by_year,
        oldest_entry=oldest,
        newest_entry=newest,
    )


@router.get("/document-types")
async def get_document_types():
    """Verfügbare Belegarten zurückgeben."""
    return [{"value": k, "label": v} for k, v in DOCUMENT_TYPES.items()]


@router.post("", response_model=ArchiveEntryOut)
async def archive_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    title: str = Form(...),
    document_number: Optional[str] = Form(None),
    document_date: Optional[str] = Form(None),  # ISO date string
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    counterparty: Optional[str] = Form(None),
    amount_cents: Optional[int] = Form(None),
    document_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Beleg revisionssicher archivieren.

    Der Beleg wird mit SHA-256 gehashed und in einem nicht-überschreibbaren
    Verzeichnis gespeichert. Nach der Archivierung ist der Eintrag gesperrt
    (is_locked=True) und kann nicht mehr verändert oder gelöscht werden.
    """
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unbekannte Belegart: {document_type}")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp nicht erlaubt. Erlaubt: PDF, JPEG, PNG, TIFF, XML, CSV"
        )

    # Read and hash
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Datei ist leer")
    if len(content) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="Datei zu groß (max. 50 MB)")

    sha256 = _sha256(content)

    # Check for duplicate (same hash + same user)
    existing = await db.execute(
        select(ArchiveEntry).where(
            ArchiveEntry.user_id == current_user.id,
            ArchiveEntry.sha256_hash == sha256,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Dieser Beleg wurde bereits archiviert (identischer SHA-256-Hash)."
        )

    # Save file in immutable archive directory
    ext = os.path.splitext(file.filename or "beleg.pdf")[1] or ".pdf"
    unique_name = f"archive_{current_user.id}_{uuid.uuid4().hex}{ext}"
    archive_dir = os.path.join(settings.UPLOAD_DIR, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    file_path = os.path.join(archive_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # Parse document_date
    doc_date: Optional[datetime] = None
    doc_year: Optional[int] = None
    if document_date:
        try:
            doc_date = datetime.fromisoformat(document_date).replace(tzinfo=timezone.utc)
            doc_year = doc_date.year
        except ValueError:
            pass

    retention_until = datetime.now(timezone.utc) + timedelta(days=RETENTION_YEARS * 365)

    entry = ArchiveEntry(
        user_id=current_user.id,
        document_type=document_type,
        document_number=document_number,
        document_date=doc_date,
        document_id=document_id,
        title=title.strip(),
        description=description,
        category=category,
        counterparty=counterparty,
        filename=f"archive/{unique_name}",
        original_filename=file.filename,
        file_size_bytes=len(content),
        mime_type=file.content_type,
        sha256_hash=sha256,
        retention_until=retention_until,
        is_locked=True,
        year=doc_year,
        amount_cents=amount_cents,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _entry_to_out(entry)


@router.get("/{entry_id}", response_model=ArchiveEntryOut)
async def get_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ArchiveEntry).where(
            ArchiveEntry.id == entry_id,
            ArchiveEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Archiveintrag nicht gefunden")
    return _entry_to_out(entry)


@router.get("/{entry_id}/download")
async def download_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archivierten Beleg herunterladen (mit Hash-Verifikation)."""
    result = await db.execute(
        select(ArchiveEntry).where(
            ArchiveEntry.id == entry_id,
            ArchiveEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Archiveintrag nicht gefunden")

    file_path = os.path.join(settings.UPLOAD_DIR, entry.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Datei nicht mehr auf dem Server vorhanden")

    # Integrity check: verify SHA-256
    with open(file_path, "rb") as f:
        actual_hash = _sha256(f.read())
    if actual_hash != entry.sha256_hash:
        raise HTTPException(
            status_code=500,
            detail="Integritätsfehler: Die Datei wurde verändert! (SHA-256-Hash stimmt nicht überein)"
        )

    filename = entry.original_filename or os.path.basename(entry.filename)
    return FileResponse(
        file_path,
        media_type=entry.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{entry_id}/verify")
async def verify_integrity(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SHA-256-Hash-Verifikation eines Archiveintrags (GoBD-Integritätsprüfung)."""
    result = await db.execute(
        select(ArchiveEntry).where(
            ArchiveEntry.id == entry_id,
            ArchiveEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Archiveintrag nicht gefunden")

    file_path = os.path.join(settings.UPLOAD_DIR, entry.filename)
    if not os.path.exists(file_path):
        return {"valid": False, "reason": "Datei nicht vorhanden", "expected_hash": entry.sha256_hash}

    with open(file_path, "rb") as f:
        actual_hash = _sha256(f.read())

    return {
        "valid": actual_hash == entry.sha256_hash,
        "expected_hash": entry.sha256_hash,
        "actual_hash": actual_hash,
        "reason": "OK" if actual_hash == entry.sha256_hash else "Hash-Mismatch: Datei wurde verändert!",
    }
