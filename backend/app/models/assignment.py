from sqlalchemy import String, Integer, ForeignKey, Date, Time, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime, date, time
from typing import Optional
from app.database import Base


class WorkAssignment(Base):
    __tablename__ = "work_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Who does the work
    worker_name: Mapped[str] = mapped_column(String(255), nullable=False)  # employee/worker name
    # What job (optional link to customer)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # job title / task
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # When
    assignment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    # Status
    status: Mapped[str] = mapped_column(String(50), default="planned", nullable=False)  # planned/in_progress/done/cancelled
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # hex color for calendar
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="assignments")
    customer: Mapped[Optional["Customer"]] = relationship("Customer")
