from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentItem(Base):
    __tablename__ = "document_items"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=1)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Numeric(10, 3), nullable=False, default=1)
    unit = Column(String(50), nullable=True, default="Stück")
    price_per_unit = Column(Numeric(12, 2), nullable=False, default=0)
    total_price = Column(Numeric(12, 2), nullable=False, default=0)

    document = relationship("Document", back_populates="items")
