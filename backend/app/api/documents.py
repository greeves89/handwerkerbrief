from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from decimal import Decimal
import os
from datetime import date

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.document import Document
from app.models.document_item import DocumentItem
from app.models.payment_reminder import PaymentReminder
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.core.auth import get_current_user
from app.services.pdf_service import generate_pdf
from app.config import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])

FREE_TIER_MONTHLY_LIMIT = 3


async def check_monthly_limit(user: User, doc_type: str, db: AsyncSession):
    if user.subscription_tier == "premium":
        return
    from datetime import datetime
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    result = await db.execute(
        select(func.count(Document.id)).where(
            Document.user_id == user.id,
            Document.type == doc_type,
            Document.created_at >= month_start,
        )
    )
    count = result.scalar()
    if count >= FREE_TIER_MONTHLY_LIMIT:
        doc_label = "Angebote" if doc_type == "offer" else "Rechnungen"
        raise HTTPException(
            status_code=402,
            detail=f"Kostenloses Limit von {FREE_TIER_MONTHLY_LIMIT} {doc_label} pro Monat erreicht. Upgrade auf Premium!"
        )


def calculate_totals(items: list, tax_rate: Decimal, discount_percent: Decimal):
    subtotal = sum(item.quantity * item.price_per_unit for item in items)
    discount_amount = subtotal * discount_percent / 100
    subtotal_after_discount = subtotal - discount_amount
    tax_amount = subtotal_after_discount * tax_rate / 100
    total = subtotal_after_discount + tax_amount
    return subtotal, tax_amount, total


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.user_id == current_user.id)
    )
    if type:
        query = query.where(Document.type == type)
    if status:
        query = query.where(Document.status == status)
    if customer_id:
        query = query.where(Document.customer_id == customer_id)
    query = query.offset(skip).limit(limit).order_by(Document.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_monthly_limit(current_user, data.type, db)

    # Verify customer belongs to user
    cust_result = await db.execute(
        select(Customer).where(Customer.id == data.customer_id, Customer.user_id == current_user.id)
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    # Generate document number
    if data.type == "invoice":
        counter = current_user.invoice_counter
        prefix = current_user.invoice_prefix or "RE-"
        doc_number = f"{prefix}{counter:04d}"
        current_user.invoice_counter = counter + 1
    else:
        counter = current_user.offer_counter
        prefix = current_user.offer_prefix or "AN-"
        doc_number = f"{prefix}{counter:04d}"
        current_user.offer_counter = counter + 1

    doc = Document(
        user_id=current_user.id,
        customer_id=data.customer_id,
        type=data.type,
        document_number=doc_number,
        status="draft",
        title=data.title,
        intro_text=data.intro_text,
        closing_text=data.closing_text,
        issue_date=data.issue_date,
        due_date=data.due_date,
        valid_until=data.valid_until,
        discount_percent=data.discount_percent,
        tax_rate=data.tax_rate,
        payment_terms=data.payment_terms,
        notes=data.notes,
    )
    db.add(doc)
    await db.flush()

    # Add items
    items = []
    for i, item_data in enumerate(data.items, 1):
        total = item_data.quantity * item_data.price_per_unit
        item = DocumentItem(
            document_id=doc.id,
            position=item_data.position or i,
            name=item_data.name,
            description=item_data.description,
            quantity=item_data.quantity,
            unit=item_data.unit,
            price_per_unit=item_data.price_per_unit,
            total_price=total,
        )
        db.add(item)
        items.append(item)

    # Calculate totals
    subtotal, tax_amount, total_amount = calculate_totals(
        [type('Item', (), {'quantity': i.quantity, 'price_per_unit': i.price_per_unit})() for i in data.items],
        data.tax_rate, data.discount_percent
    )
    doc.subtotal = subtotal
    doc.tax_amount = tax_amount
    doc.total_amount = total_amount

    await db.commit()
    await db.refresh(doc)

    # Reload with relationships
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == doc.id)
    )
    return result.scalar_one()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    return doc


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)

    for field, value in update_data.items():
        setattr(doc, field, value)

    if items_data is not None:
        # Delete existing items
        for item in doc.items:
            await db.delete(item)
        await db.flush()

        # Add new items
        new_items = []
        for i, item_data in enumerate(items_data, 1):
            total = item_data["quantity"] * item_data["price_per_unit"]
            item = DocumentItem(
                document_id=doc.id,
                position=item_data.get("position", i),
                name=item_data["name"],
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit=item_data.get("unit", "Stück"),
                price_per_unit=item_data["price_per_unit"],
                total_price=total,
            )
            db.add(item)
            new_items.append(type('Item', (), {'quantity': Decimal(str(item_data["quantity"])), 'price_per_unit': Decimal(str(item_data["price_per_unit"]))})())

        # Recalculate totals
        tax_rate = data.tax_rate or doc.tax_rate
        discount_percent = data.discount_percent or doc.discount_percent
        subtotal, tax_amount, total_amount = calculate_totals(new_items, tax_rate, discount_percent)
        doc.subtotal = subtotal
        doc.tax_amount = tax_amount
        doc.total_amount = total_amount

    await db.commit()
    await db.refresh(doc)

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == doc.id)
    )
    return result.scalar_one()


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    await db.delete(doc)
    await db.commit()


@router.post("/{document_id}/generate-pdf")
async def generate_document_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    customer = doc.customer
    pdf_path = await generate_pdf(doc, current_user, customer)
    doc.pdf_path = pdf_path
    await db.commit()

    return {"pdf_url": f"/uploads/{pdf_path}"}


@router.get("/{document_id}/pdf")
async def download_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    # Generate if not exists
    if not doc.pdf_path or not os.path.exists(os.path.join(settings.UPLOAD_DIR, doc.pdf_path)):
        customer = doc.customer
        pdf_path = await generate_pdf(doc, current_user, customer)
        doc.pdf_path = pdf_path
        await db.commit()

    full_path = os.path.join(settings.UPLOAD_DIR, doc.pdf_path)
    return FileResponse(
        full_path,
        media_type="application/pdf",
        filename=f"{doc.document_number}.pdf",
    )


@router.post("/{document_id}/convert-to-invoice", response_model=DocumentResponse)
async def convert_to_invoice(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items))
        .where(Document.id == document_id, Document.user_id == current_user.id, Document.type == "offer")
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

    await check_monthly_limit(current_user, "invoice", db)

    counter = current_user.invoice_counter
    prefix = current_user.invoice_prefix or "RE-"
    doc_number = f"{prefix}{counter:04d}"
    current_user.invoice_counter = counter + 1

    invoice = Document(
        user_id=current_user.id,
        customer_id=offer.customer_id,
        type="invoice",
        document_number=doc_number,
        status="draft",
        title=offer.title,
        intro_text=offer.intro_text,
        closing_text=offer.closing_text,
        issue_date=date.today(),
        discount_percent=offer.discount_percent,
        tax_rate=offer.tax_rate,
        subtotal=offer.subtotal,
        tax_amount=offer.tax_amount,
        total_amount=offer.total_amount,
        payment_terms=offer.payment_terms,
        notes=offer.notes,
        converted_from_id=offer.id,
    )
    db.add(invoice)
    await db.flush()

    for item in offer.items:
        new_item = DocumentItem(
            document_id=invoice.id,
            position=item.position,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            price_per_unit=item.price_per_unit,
            total_price=item.total_price,
        )
        db.add(new_item)

    offer.status = "accepted"
    await db.commit()
    await db.refresh(invoice)

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == invoice.id)
    )
    return result.scalar_one()


@router.post("/{document_id}/convert-to-order-confirmation", response_model=DocumentResponse)
async def convert_to_order_confirmation(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items))
        .where(Document.id == document_id, Document.user_id == current_user.id, Document.type == "offer")
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

    counter = current_user.offer_counter
    prefix = current_user.offer_prefix or "AB-"
    doc_number = f"AB-{counter:04d}"
    current_user.offer_counter = counter + 1

    confirmation = Document(
        user_id=current_user.id,
        customer_id=offer.customer_id,
        type="order_confirmation",
        document_number=doc_number,
        status="draft",
        title=offer.title,
        intro_text=offer.intro_text,
        closing_text=offer.closing_text,
        issue_date=date.today(),
        discount_percent=offer.discount_percent,
        tax_rate=offer.tax_rate,
        subtotal=offer.subtotal,
        tax_amount=offer.tax_amount,
        total_amount=offer.total_amount,
        payment_terms=offer.payment_terms,
        notes=offer.notes,
        converted_from_id=offer.id,
    )
    db.add(confirmation)
    await db.flush()

    for item in offer.items:
        new_item = DocumentItem(
            document_id=confirmation.id,
            position=item.position,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            price_per_unit=item.price_per_unit,
            total_price=item.total_price,
        )
        db.add(new_item)

    offer.status = "accepted"
    await db.commit()
    await db.refresh(confirmation)

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == confirmation.id)
    )
    return result.scalar_one()


@router.post("/{document_id}/convert-to-delivery-note", response_model=DocumentResponse)
async def convert_to_delivery_note(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items))
        .where(
            Document.id == document_id,
            Document.user_id == current_user.id,
            Document.type.in_(["invoice", "order_confirmation"]),
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Rechnung oder Auftragsbestätigung nicht gefunden")

    counter = current_user.offer_counter
    doc_number = f"LS-{counter:04d}"
    current_user.offer_counter = counter + 1

    delivery = Document(
        user_id=current_user.id,
        customer_id=source.customer_id,
        type="delivery_note",
        document_number=doc_number,
        status="draft",
        title=source.title,
        intro_text=source.intro_text,
        closing_text=source.closing_text,
        issue_date=date.today(),
        discount_percent=Decimal("0"),
        tax_rate=Decimal("0"),
        subtotal=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("0"),
        notes=source.notes,
        converted_from_id=source.id,
    )
    db.add(delivery)
    await db.flush()

    for item in source.items:
        new_item = DocumentItem(
            document_id=delivery.id,
            position=item.position,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            price_per_unit=Decimal("0"),
            total_price=Decimal("0"),
        )
        db.add(new_item)

    await db.commit()
    await db.refresh(delivery)

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.items), selectinload(Document.customer))
        .where(Document.id == delivery.id)
    )
    return result.scalar_one()


@router.post("/{document_id}/send-reminder")
async def send_payment_reminder(
    document_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.email_service import send_payment_reminder as send_reminder_email

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.customer))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    if doc.type != "invoice":
        raise HTTPException(status_code=400, detail="Zahlungserinnerungen nur für Rechnungen")

    customer = doc.customer
    if not customer.email:
        raise HTTPException(status_code=400, detail="Kunde hat keine E-Mail-Adresse")

    level = data.get("level", 1)
    from datetime import datetime
    reminder = PaymentReminder(
        document_id=doc.id,
        level=level,
        amount=doc.total_amount,
        status="sent",
        sent_at=datetime.utcnow(),
    )
    db.add(reminder)

    company_name = current_user.company_name or current_user.name
    customer_name = customer.company_name or f"{customer.first_name} {customer.last_name}"
    due_date_str = doc.due_date.strftime("%d.%m.%Y") if doc.due_date else "sofort"

    # Fetch custom email template from DB if available
    from app.models.email_template import EmailTemplate
    template_type = f"reminder_level_{level}"
    tmpl_result = await db.execute(select(EmailTemplate).where(EmailTemplate.type == template_type))
    db_template = tmpl_result.scalar_one_or_none()

    await send_reminder_email(
        recipient=customer.email,
        customer_name=customer_name,
        invoice_number=doc.document_number,
        amount=float(doc.total_amount),
        due_date=due_date_str,
        level=level,
        company_name=company_name,
        subject_template=db_template.subject if db_template else None,
        body_template=db_template.body_html if db_template else None,
    )

    await db.commit()
    return {"message": f"Mahnung Level {level} gesendet"}


@router.get("/export/datev")
async def export_datev(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.subscription_tier != "premium":
        raise HTTPException(status_code=402, detail="DATEV-Export nur für Premium-Nutzer")

    import csv
    import io
    from fastapi.responses import StreamingResponse

    result = await db.execute(
        select(Document)
        .options(selectinload(Document.customer))
        .where(Document.user_id == current_user.id, Document.type == "invoice")
        .order_by(Document.issue_date)
    )
    docs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Rechnungsnummer", "Datum", "Fälligkeitsdatum", "Kundennummer",
        "Kundenname", "Nettobetrag", "MwSt-Satz", "MwSt-Betrag",
        "Bruttobetrag", "Status"
    ])

    for doc in docs:
        customer = doc.customer
        customer_name = customer.company_name or f"{customer.first_name} {customer.last_name}"
        writer.writerow([
            doc.document_number,
            doc.issue_date.strftime("%d.%m.%Y"),
            doc.due_date.strftime("%d.%m.%Y") if doc.due_date else "",
            customer.customer_number or "",
            customer_name,
            str(doc.subtotal).replace(".", ","),
            str(doc.tax_rate).replace(".", ","),
            str(doc.tax_amount).replace(".", ","),
            str(doc.total_amount).replace(".", ","),
            doc.status,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=datev_export.csv"},
    )
