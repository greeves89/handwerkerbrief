from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="member")
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Company details
    company_name = Column(String(255), nullable=True)
    address_street = Column(String(255), nullable=True)
    address_zip = Column(String(20), nullable=True)
    address_city = Column(String(100), nullable=True)
    address_country = Column(String(100), nullable=True, default="Deutschland")
    phone = Column(String(50), nullable=True)
    tax_number = Column(String(100), nullable=True)
    ustid = Column(String(50), nullable=True)

    # Banking
    iban = Column(String(50), nullable=True)
    bic = Column(String(20), nullable=True)
    bank_name = Column(String(100), nullable=True)

    # Document settings
    invoice_prefix = Column(String(20), nullable=True, default="RE-")
    offer_prefix = Column(String(20), nullable=True, default="AN-")
    invoice_counter = Column(Integer, nullable=False, default=1)
    offer_counter = Column(Integer, nullable=False, default=1)

    # Subscription
    subscription_tier = Column(String(20), nullable=False, default="free")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)

    # Logo
    logo_path = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customers = relationship("Customer", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="user", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")
