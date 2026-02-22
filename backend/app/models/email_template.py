from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True)
    # type: reminder_level_1, reminder_level_2, reminder_level_3
    type = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    # Placeholders: {{customer_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{company_name}}
    body_html = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
