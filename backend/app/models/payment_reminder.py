from sqlalchemy import Column, Integer, String, DateTime, Date, Numeric, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class PaymentReminder(Base):
    __tablename__ = "payment_reminders"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, nullable=False, default=1)  # 1, 2, 3
    sent_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(Date, nullable=True)
    amount = Column(Numeric(12, 2), nullable=True)
    fee = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("Document", back_populates="payment_reminders")
