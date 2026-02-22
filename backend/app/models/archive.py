"""
GoBD-konformes Belegarchiv.
GoBD = Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern,
Aufzeichnungen und Unterlagen in elektronischer Form sowie zum Datenzugriff
(§ 147 AO / BMF-Schreiben vom 28.11.2019)

Revisionssichere Archivierung: Belege werden mit SHA-256-Hash gespeichert.
Einmal archiviert, können Einträge nicht mehr geändert oder gelöscht werden.
Aufbewahrungspflicht: 10 Jahre für Buchungsbelege (§ 147 Abs. 3 AO).
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class ArchiveEntry(Base):
    """Ein archivierter Beleg nach GoBD-Standard."""
    __tablename__ = "archive_entries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Belegart
    document_type = Column(String(50), nullable=False)  # invoice, offer, order_confirmation, receipt, other
    document_number = Column(String(100), nullable=True, index=True)
    document_date = Column(DateTime(timezone=True), nullable=True)

    # Verknüpfung zu Originaldokument
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)

    # Beschreibung und Kategorie
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # z.B. "Eingangsrechnung", "Ausgangsrechnung"
    counterparty = Column(String(255), nullable=True)  # Lieferant / Kunde

    # Datei
    filename = Column(String(500), nullable=False)          # gespeicherter Dateiname auf Disk
    original_filename = Column(String(255), nullable=True)  # ursprünglicher Dateiname
    file_size_bytes = Column(BigInteger, nullable=False, default=0)
    mime_type = Column(String(100), nullable=False, default="application/pdf")

    # Integritätssicherung (GoBD-Anforderung)
    sha256_hash = Column(String(64), nullable=False)  # SHA-256-Hash der Datei

    # GoBD-Metadaten
    archived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    retention_until = Column(DateTime(timezone=True), nullable=False)  # Aufbewahrungsfrist (10 Jahre)
    is_locked = Column(Boolean, nullable=False, default=True)  # Einmal gesperrt = unveränderlich

    # Indexierungsfelder für Zugriff (§ 147 Abs. 2 AO)
    year = Column(Integer, nullable=True, index=True)    # Belegjahr
    amount_cents = Column(BigInteger, nullable=True)     # Betrag in Cent für Suche

    user = relationship("User")
