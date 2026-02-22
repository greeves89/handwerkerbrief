"""
Kundenportal – öffentliche Endpunkte für Kunden, die Rechnungen einsehen und PDF herunterladen können.
Zugang erfolgt über einen signierten portal_token (kein Login erforderlich).
"""
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.core.auth import get_current_user
from app.services.pdf_service import generate_pdf
from app.config import settings

router = APIRouter(prefix="/api/portal", tags=["portal"])


# ── Handwerker-seitig: Portal-Link erzeugen / abrufen ────────────────────────

@router.post("/documents/{document_id}/generate-link")
async def generate_portal_link(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Erzeugt (oder gibt bestehenden) Portal-Token für das Dokument zurück.
    Nur der Besitzer kann diesen Endpoint aufrufen.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    if not doc.portal_token:
        doc.portal_token = secrets.token_urlsafe(32)
        await db.commit()
        await db.refresh(doc)

    portal_url = f"{settings.APP_URL}/portal/{doc.portal_token}"
    return {"portal_token": doc.portal_token, "portal_url": portal_url}


@router.delete("/documents/{document_id}/revoke-link")
async def revoke_portal_link(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Widerruft den Portal-Zugang für das Dokument."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    doc.portal_token = None
    await db.commit()
    return {"message": "Portal-Zugang widerrufen"}


# ── Kunden-seitig: öffentliche Endpunkte (kein Login) ────────────────────────

@router.get("/view/{token}")
async def get_portal_document(token: str, db: AsyncSession = Depends(get_db)):
    """
    Gibt Dokumentdaten (ohne sensible Felder) zurück.
    Kunden können damit ihre Rechnung oder ihr Angebot einsehen.
    """
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.items),
            selectinload(Document.customer),
            selectinload(Document.user),
        )
        .where(Document.portal_token == token)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder Link ungültig")

    customer = doc.customer
    user = doc.user

    customer_name = customer.company_name or f"{customer.first_name or ''} {customer.last_name or ''}".strip()
    company_name = user.company_name or user.name

    items_data = [
        {
            "position": item.position,
            "name": item.name,
            "description": item.description,
            "quantity": float(item.quantity),
            "unit": item.unit,
            "price_per_unit": float(item.price_per_unit),
            "total_price": float(item.total_price),
        }
        for item in doc.items
    ]

    return {
        "document_number": doc.document_number,
        "type": doc.type,
        "status": doc.status,
        "title": doc.title,
        "intro_text": doc.intro_text,
        "closing_text": doc.closing_text,
        "issue_date": doc.issue_date.isoformat() if doc.issue_date else None,
        "due_date": doc.due_date.isoformat() if doc.due_date else None,
        "valid_until": doc.valid_until.isoformat() if doc.valid_until else None,
        "subtotal": float(doc.subtotal),
        "tax_rate": float(doc.tax_rate),
        "tax_amount": float(doc.tax_amount),
        "total_amount": float(doc.total_amount),
        "discount_percent": float(doc.discount_percent),
        "payment_terms": doc.payment_terms,
        "notes": doc.notes,
        "items": items_data,
        "customer": {
            "name": customer_name,
            "address_street": customer.address_street,
            "address_zip": customer.address_zip,
            "address_city": customer.address_city,
        },
        "company": {
            "name": company_name,
            "email": user.email,
        },
    }


@router.get("/view/{token}/pdf")
async def download_portal_pdf(token: str, db: AsyncSession = Depends(get_db)):
    """
    Gibt das PDF für das Dokument zurück. Generiert es bei Bedarf.
    Kein Login erforderlich – nur der Portal-Token ist nötig.
    """
    result = await db.execute(
        select(Document)
        .options(
            selectinload(Document.items),
            selectinload(Document.customer),
            selectinload(Document.user),
        )
        .where(Document.portal_token == token)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder Link ungültig")

    user = doc.user
    customer = doc.customer

    if not doc.pdf_path or not os.path.exists(os.path.join(settings.UPLOAD_DIR, doc.pdf_path)):
        pdf_path = await generate_pdf(doc, user, customer)
        doc.pdf_path = pdf_path
        await db.commit()

    full_path = os.path.join(settings.UPLOAD_DIR, doc.pdf_path)
    return FileResponse(
        full_path,
        media_type="application/pdf",
        filename=f"{doc.document_number}.pdf",
    )
