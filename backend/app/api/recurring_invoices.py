from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal

from app.database import get_db
from app.models.user import User
from app.models.recurring_invoice import RecurringInvoice
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/recurring-invoices", tags=["recurring-invoices"])

VALID_INTERVALS = {"monthly", "quarterly", "yearly"}


class RecurringItemSchema(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: float = 1.0
    unit: str = "Stück"
    price_per_unit: float = 0.0


class RecurringInvoiceCreate(BaseModel):
    customer_id: int
    title: Optional[str] = None
    interval: str
    next_date: date
    tax_rate: float = 19.0
    discount_percent: float = 0.0
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: List[RecurringItemSchema]


class RecurringInvoiceUpdate(BaseModel):
    title: Optional[str] = None
    interval: Optional[str] = None
    next_date: Optional[date] = None
    active: Optional[bool] = None
    tax_rate: Optional[float] = None
    discount_percent: Optional[float] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[RecurringItemSchema]] = None


class RecurringInvoiceResponse(BaseModel):
    id: int
    customer_id: int
    title: Optional[str]
    interval: str
    next_date: date
    last_created_at: Optional[date]
    active: bool
    tax_rate: float
    discount_percent: float
    payment_terms: Optional[str]
    notes: Optional[str]
    items: list
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[RecurringInvoiceResponse])
async def list_recurring_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecurringInvoice)
        .where(RecurringInvoice.user_id == current_user.id)
        .order_by(RecurringInvoice.next_date)
    )
    return result.scalars().all()


@router.post("", response_model=RecurringInvoiceResponse, status_code=201)
async def create_recurring_invoice(
    data: RecurringInvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail="Ungültiges Intervall. Erlaubt: monthly, quarterly, yearly")

    ri = RecurringInvoice(
        user_id=current_user.id,
        customer_id=data.customer_id,
        title=data.title,
        interval=data.interval,
        next_date=data.next_date,
        tax_rate=Decimal(str(data.tax_rate)),
        discount_percent=Decimal(str(data.discount_percent)),
        payment_terms=data.payment_terms,
        notes=data.notes,
        items=[item.model_dump() for item in data.items],
    )
    db.add(ri)
    await db.commit()
    await db.refresh(ri)
    return ri


@router.put("/{ri_id}", response_model=RecurringInvoiceResponse)
async def update_recurring_invoice(
    ri_id: int,
    data: RecurringInvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecurringInvoice).where(
            RecurringInvoice.id == ri_id,
            RecurringInvoice.user_id == current_user.id,
        )
    )
    ri = result.scalar_one_or_none()
    if not ri:
        raise HTTPException(status_code=404, detail="Nicht gefunden")

    if data.interval is not None:
        if data.interval not in VALID_INTERVALS:
            raise HTTPException(status_code=400, detail="Ungültiges Intervall")
        ri.interval = data.interval
    if data.title is not None:
        ri.title = data.title
    if data.next_date is not None:
        ri.next_date = data.next_date
    if data.active is not None:
        ri.active = data.active
    if data.tax_rate is not None:
        ri.tax_rate = Decimal(str(data.tax_rate))
    if data.discount_percent is not None:
        ri.discount_percent = Decimal(str(data.discount_percent))
    if data.payment_terms is not None:
        ri.payment_terms = data.payment_terms
    if data.notes is not None:
        ri.notes = data.notes
    if data.items is not None:
        ri.items = [item.model_dump() for item in data.items]

    await db.commit()
    await db.refresh(ri)
    return ri


@router.delete("/{ri_id}", status_code=204)
async def delete_recurring_invoice(
    ri_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecurringInvoice).where(
            RecurringInvoice.id == ri_id,
            RecurringInvoice.user_id == current_user.id,
        )
    )
    ri = result.scalar_one_or_none()
    if not ri:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    await db.delete(ri)
    await db.commit()
