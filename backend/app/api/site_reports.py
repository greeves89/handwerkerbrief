"""
Foto-Dokumentation & digitale Baustellenabnahme.
Handwerker können Fotos am Objekt aufnehmen, Mängel dokumentieren
und eine Abnahme mit digitaler Kundenunterschrift durchführen.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.site_report import SiteReport, SiteReportPhoto
from app.core.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/site-reports", tags=["site-reports"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class DefectItem(BaseModel):
    description: str
    severity: str = "medium"  # low / medium / high
    resolved: bool = False


class SiteReportCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    customer_id: Optional[int] = None
    document_id: Optional[int] = None
    defects: Optional[List[Dict[str, Any]]] = None


class SiteReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    customer_id: Optional[int] = None
    document_id: Optional[int] = None
    status: Optional[str] = None
    defects: Optional[List[Dict[str, Any]]] = None


class SignaturePayload(BaseModel):
    customer_name: str
    signature: str  # base64 data URL


class PhotoOut(BaseModel):
    id: int
    filename: str
    original_name: Optional[str]
    caption: Optional[str]
    url: str
    created_at: datetime

    class Config:
        from_attributes = True


class SiteReportOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    location: Optional[str]
    customer_id: Optional[int]
    document_id: Optional[int]
    status: str
    report_date: datetime
    customer_name: Optional[str]
    signed_at: Optional[datetime]
    defects: Optional[List[Dict[str, Any]]]
    photos: List[PhotoOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _photo_url(filename: str) -> str:
    return f"/api/uploads/{filename}"


def _report_to_out(report: SiteReport) -> dict:
    photos = [
        PhotoOut(
            id=p.id,
            filename=p.filename,
            original_name=p.original_name,
            caption=p.caption,
            url=_photo_url(p.filename),
            created_at=p.created_at,
        )
        for p in (report.photos or [])
    ]
    return SiteReportOut(
        id=report.id,
        title=report.title,
        description=report.description,
        location=report.location,
        customer_id=report.customer_id,
        document_id=report.document_id,
        status=report.status,
        report_date=report.report_date,
        customer_name=report.customer_name,
        signed_at=report.signed_at,
        defects=report.defects or [],
        photos=photos,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SiteReportOut])
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReport)
        .where(SiteReport.user_id == current_user.id)
        .order_by(SiteReport.report_date.desc())
    )
    reports = result.scalars().unique().all()
    return [_report_to_out(r) for r in reports]


@router.post("", response_model=SiteReportOut)
async def create_report(
    payload: SiteReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = SiteReport(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        customer_id=payload.customer_id,
        document_id=payload.document_id,
        defects=payload.defects or [],
        status="draft",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return _report_to_out(report)


@router.get("/{report_id}", response_model=SiteReportOut)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReport).where(
            SiteReport.id == report_id,
            SiteReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    return _report_to_out(report)


@router.patch("/{report_id}", response_model=SiteReportOut)
async def update_report(
    report_id: int,
    payload: SiteReportUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReport).where(
            SiteReport.id == report_id,
            SiteReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(report, field, val)
    report.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return _report_to_out(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReport).where(
            SiteReport.id == report_id,
            SiteReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    await db.delete(report)
    await db.commit()


@router.post("/{report_id}/sign", response_model=SiteReportOut)
async def sign_report(
    report_id: int,
    payload: SignaturePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Digitale Kundenunterschrift hinterlegen und Bericht abschließen."""
    result = await db.execute(
        select(SiteReport).where(
            SiteReport.id == report_id,
            SiteReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")

    if not payload.customer_name.strip():
        raise HTTPException(status_code=400, detail="Kundenname darf nicht leer sein")

    report.customer_signature = payload.signature
    report.customer_name = payload.customer_name.strip()
    report.signed_at = datetime.now(timezone.utc)
    report.status = "signed"
    report.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return _report_to_out(report)


@router.post("/{report_id}/photos", response_model=PhotoOut)
async def upload_photo(
    report_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foto hochladen und dem Bericht hinzufügen."""
    result = await db.execute(
        select(SiteReport).where(
            SiteReport.id == report_id,
            SiteReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Nur Bilder (JPEG, PNG, WebP) sind erlaubt")

    # Save file
    ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    unique_name = f"site_{report_id}_{uuid.uuid4().hex}{ext}"
    upload_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    with open(upload_path, "wb") as f:
        f.write(content)

    photo = SiteReportPhoto(
        report_id=report_id,
        user_id=current_user.id,
        filename=unique_name,
        original_name=file.filename,
        caption=caption,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return PhotoOut(
        id=photo.id,
        filename=photo.filename,
        original_name=photo.original_name,
        caption=photo.caption,
        url=_photo_url(photo.filename),
        created_at=photo.created_at,
    )


@router.delete("/{report_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    report_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReportPhoto).where(
            SiteReportPhoto.id == photo_id,
            SiteReportPhoto.report_id == report_id,
            SiteReportPhoto.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto nicht gefunden")

    # Remove file from disk
    file_path = os.path.join(settings.UPLOAD_DIR, photo.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    await db.delete(photo)
    await db.commit()


@router.patch("/{report_id}/photos/{photo_id}", response_model=PhotoOut)
async def update_photo_caption(
    report_id: int,
    photo_id: int,
    caption: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteReportPhoto).where(
            SiteReportPhoto.id == photo_id,
            SiteReportPhoto.report_id == report_id,
            SiteReportPhoto.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto nicht gefunden")

    photo.caption = caption
    await db.commit()
    await db.refresh(photo)

    return PhotoOut(
        id=photo.id,
        filename=photo.filename,
        original_name=photo.original_name,
        caption=photo.caption,
        url=_photo_url(photo.filename),
        created_at=photo.created_at,
    )
