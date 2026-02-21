from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class DocumentItemCreate(BaseModel):
    position: int = 1
    name: str
    description: Optional[str] = None
    quantity: Decimal = Decimal("1")
    unit: Optional[str] = "Stück"
    price_per_unit: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")


class DocumentItemResponse(DocumentItemCreate):
    id: int
    document_id: int

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    customer_id: int
    type: str  # offer / invoice
    title: Optional[str] = None
    intro_text: Optional[str] = None
    closing_text: Optional[str] = None
    issue_date: date
    due_date: Optional[date] = None
    valid_until: Optional[date] = None
    discount_percent: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("19")
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: List[DocumentItemCreate] = []


class DocumentUpdate(BaseModel):
    customer_id: Optional[int] = None
    status: Optional[str] = None
    title: Optional[str] = None
    intro_text: Optional[str] = None
    closing_text: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    valid_until: Optional[date] = None
    discount_percent: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[DocumentItemCreate]] = None


class CustomerSummary(BaseModel):
    id: int
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    user_id: int
    customer_id: int
    customer: Optional[CustomerSummary] = None
    type: str
    document_number: str
    status: str
    title: Optional[str] = None
    intro_text: Optional[str] = None
    closing_text: Optional[str] = None
    issue_date: date
    due_date: Optional[date] = None
    valid_until: Optional[date] = None
    discount_percent: Decimal
    tax_rate: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    pdf_path: Optional[str] = None
    converted_from_id: Optional[int] = None
    items: List[DocumentItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PositionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    unit: Optional[str] = "Stück"
    price_per_unit: Decimal = Decimal("0")


class PositionUpdate(PositionCreate):
    pass


class PositionResponse(PositionCreate):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
