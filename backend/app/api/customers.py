from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.document import Document
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Customer).where(Customer.user_id == current_user.id)
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Customer.company_name.ilike(search_term)) |
            (Customer.first_name.ilike(search_term)) |
            (Customer.last_name.ilike(search_term)) |
            (Customer.email.ilike(search_term))
        )
    query = query.offset(skip).limit(limit).order_by(Customer.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Generate customer number
    count_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.user_id == current_user.id)
    )
    count = count_result.scalar() + 1
    customer_number = f"KD-{count:04d}"

    customer = Customer(
        user_id=current_user.id,
        customer_number=customer_number,
        **data.model_dump(),
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.user_id == current_user.id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.user_id == current_user.id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.user_id == current_user.id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    await db.delete(customer)
    await db.commit()


@router.get("/{customer_id}/invoice-summary")
async def get_customer_invoice_summary(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns invoice payment history and outstanding amounts for a customer."""
    customer_result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.user_id == current_user.id,
        )
    )
    customer = customer_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    docs_result = await db.execute(
        select(Document).where(
            Document.customer_id == customer_id,
            Document.user_id == current_user.id,
            Document.type == "invoice",
        ).order_by(Document.issue_date.desc())
    )
    invoices = docs_result.scalars().all()

    today = date.today()
    invoice_list = []
    total_invoiced = 0.0
    total_paid = 0.0
    total_outstanding = 0.0
    total_overdue = 0.0

    for inv in invoices:
        amount = float(inv.total_amount)
        is_paid = inv.status == "paid"
        is_overdue = not is_paid and inv.due_date and inv.due_date < today
        outstanding = 0.0 if is_paid else amount

        total_invoiced += amount
        if is_paid:
            total_paid += amount
        else:
            total_outstanding += outstanding
            if is_overdue:
                total_overdue += outstanding

        invoice_list.append({
            "id": inv.id,
            "document_number": inv.document_number,
            "title": inv.title,
            "status": inv.status,
            "issue_date": str(inv.issue_date) if inv.issue_date else None,
            "due_date": str(inv.due_date) if inv.due_date else None,
            "total_amount": amount,
            "is_overdue": bool(is_overdue),
        })

    return {
        "customer_id": customer_id,
        "invoice_count": len(invoices),
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "invoices": invoice_list,
    }
