from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    ustid: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None
    invoice_prefix: Optional[str] = None
    offer_prefix: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    is_verified: bool = False
    company_name: Optional[str] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    ustid: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None
    invoice_prefix: Optional[str] = None
    offer_prefix: Optional[str] = None
    invoice_counter: int
    offer_counter: int
    subscription_tier: str
    subscription_expires_at: Optional[datetime] = None
    logo_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfile(UserResponse):
    pass
