from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class SiteReport(Base):
    """Baustellenabnahme / Foto-Dokumentation"""
    __tablename__ = "site_reports"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(500), nullable=True)
    report_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Status: draft, completed, signed
    status = Column(String(30), nullable=False, default="draft")

    # Customer signature (base64 encoded SVG/PNG)
    customer_signature = Column(Text, nullable=True)
    customer_name = Column(String(255), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)

    # Defects/notes list stored as JSON
    defects = Column(JSON, nullable=True)  # [{description, severity, resolved}]

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")
    customer = relationship("Customer")
    photos = relationship("SiteReportPhoto", back_populates="report", cascade="all, delete-orphan", order_by="SiteReportPhoto.created_at")


class SiteReportPhoto(Base):
    """Foto zu einem Bericht"""
    __tablename__ = "site_report_photos"

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("site_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_name = Column(String(255), nullable=True)
    caption = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    report = relationship("SiteReport", back_populates="photos")
