from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, Date, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class RecurringInvoice(Base):
    __tablename__ = "recurring_invoices"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)

    title = Column(String(255), nullable=True)
    interval = Column(String(20), nullable=False)  # monthly / quarterly / yearly
    next_date = Column(Date, nullable=False)
    last_created_at = Column(Date, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    tax_rate = Column(Numeric(5, 2), nullable=False, default=19)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=0)
    payment_terms = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    # Items stored as JSON: [{"name": ..., "description": ..., "quantity": ..., "unit": ..., "price_per_unit": ...}]
    items = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="recurring_invoices")
    customer = relationship("Customer")
