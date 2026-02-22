from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class BankTransaction(Base):
    """
    Importierter Kontoauszug-Eintrag (CSV-Import aus Online-Banking).

    matched_document_id: Rechnungs-ID, der dieser Zahlung zugeordnet wurde.
    match_confidence: 0-100 (0=manuell, >0=automatisch durch Betrag/Verwendungszweck).
    """
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Raw CSV fields
    booking_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=True)
    counterparty = Column(String(255), nullable=True)   # Auftraggeber/Empfänger
    iban = Column(String(40), nullable=True)
    purpose = Column(Text, nullable=True)               # Verwendungszweck
    amount = Column(Numeric(12, 2), nullable=False)     # negative = Ausgabe
    currency = Column(String(10), nullable=False, default="EUR")
    # Match state
    matched_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    match_confidence = Column(Integer, nullable=False, default=0)   # 0-100
    is_manually_matched = Column(Boolean, nullable=False, default=False)
    is_ignored = Column(Boolean, nullable=False, default=False)
    # Meta
    import_batch = Column(String(64), nullable=True)    # UUID of the import batch
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    matched_document = relationship("Document", foreign_keys=[matched_document_id])
