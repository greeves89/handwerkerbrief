from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    type = Column(String(20), nullable=False, index=True)  # offer / invoice
    document_number = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="draft")
    title = Column(String(255), nullable=True)
    intro_text = Column(Text, nullable=True)
    closing_text = Column(Text, nullable=True)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=0)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=19)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    payment_terms = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    pdf_path = Column(String(500), nullable=True)
    converted_from_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="documents")
    customer = relationship("Customer", back_populates="documents")
    items = relationship("DocumentItem", back_populates="document", cascade="all, delete-orphan", order_by="DocumentItem.position")
    payment_reminders = relationship("PaymentReminder", back_populates="document", cascade="all, delete-orphan")
    converted_from = relationship("Document", remote_side="Document.id", foreign_keys=[converted_from_id])
