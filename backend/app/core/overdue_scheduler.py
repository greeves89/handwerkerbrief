"""Background scheduler that marks overdue invoices automatically."""
import asyncio
import logging
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.document import Document

logger = logging.getLogger(__name__)

# Run every 6 hours
INTERVAL_SECONDS = 6 * 60 * 60


async def mark_overdue_invoices():
    """Set status='overdue' on sent invoices whose due_date has passed."""
    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            result = await db.execute(
                update(Document)
                .where(
                    Document.type == "invoice",
                    Document.status == "sent",
                    Document.due_date < today,
                )
                .values(status="overdue")
                .returning(Document.id)
            )
            updated_ids = result.scalars().all()
            await db.commit()
            if updated_ids:
                logger.info(
                    "Overdue scheduler: marked %d invoice(s) as overdue: %s",
                    len(updated_ids),
                    updated_ids,
                )
        except Exception:
            logger.exception("Overdue scheduler: error marking invoices")
            await db.rollback()


async def overdue_scheduler_loop():
    """Run overdue check immediately on startup, then every INTERVAL_SECONDS."""
    while True:
        await mark_overdue_invoices()
        await asyncio.sleep(INTERVAL_SECONDS)
