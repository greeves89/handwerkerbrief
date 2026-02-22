"""Background scheduler that auto-creates recurring invoices."""
import asyncio
import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.recurring_invoice import RecurringInvoice
from app.models.document import Document
from app.models.document_item import DocumentItem
from app.models.user import User

logger = logging.getLogger(__name__)

# Run daily
INTERVAL_SECONDS = 24 * 60 * 60


def _next_date(current: date, interval: str) -> date:
    if interval == "monthly":
        month = current.month + 1
        year = current.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        # Clamp to last day of month
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(current.day, last_day))
    elif interval == "quarterly":
        month = current.month + 3
        year = current.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(current.day, last_day))
    else:  # yearly
        try:
            return date(current.year + 1, current.month, current.day)
        except ValueError:
            return date(current.year + 1, current.month, 28)


async def create_due_recurring_invoices():
    """Create invoices for all active recurring templates whose next_date <= today."""
    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            result = await db.execute(
                select(RecurringInvoice)
                .where(
                    RecurringInvoice.active == True,
                    RecurringInvoice.next_date <= today,
                )
                .options(selectinload(RecurringInvoice.user))
            )
            due = result.scalars().all()

            for ri in due:
                user = ri.user
                # Build document number
                prefix = user.invoice_prefix or "RE-"
                counter = user.invoice_counter
                doc_number = f"{prefix}{counter:04d}"
                user.invoice_counter = counter + 1

                doc = Document(
                    user_id=user.id,
                    customer_id=ri.customer_id,
                    type="invoice",
                    document_number=doc_number,
                    status="draft",
                    title=ri.title,
                    issue_date=today,
                    tax_rate=ri.tax_rate,
                    discount_percent=ri.discount_percent,
                    payment_terms=ri.payment_terms,
                    notes=ri.notes,
                )

                # Calculate totals
                subtotal = Decimal("0")
                items_to_add = []
                for pos, item in enumerate(ri.items, 1):
                    qty = Decimal(str(item.get("quantity", 1)))
                    price = Decimal(str(item.get("price_per_unit", 0)))
                    total = qty * price
                    subtotal += total
                    items_to_add.append(DocumentItem(
                        position=pos,
                        name=item.get("name", ""),
                        description=item.get("description"),
                        quantity=qty,
                        unit=item.get("unit", "Stück"),
                        price_per_unit=price,
                        total_price=total,
                    ))

                discount_amount = subtotal * ri.discount_percent / 100
                subtotal_after = subtotal - discount_amount
                tax_amount = subtotal_after * ri.tax_rate / 100
                total_amount = subtotal_after + tax_amount

                doc.subtotal = subtotal_after
                doc.tax_amount = tax_amount
                doc.total_amount = total_amount

                db.add(doc)
                await db.flush()

                for item in items_to_add:
                    item.document_id = doc.id
                    db.add(item)

                # Update recurring template
                ri.last_created_at = today
                ri.next_date = _next_date(today, ri.interval)

                logger.info(
                    "Recurring scheduler: created invoice %s for recurring template %d",
                    doc_number,
                    ri.id,
                )

            await db.commit()
        except Exception:
            logger.exception("Recurring scheduler error")
            await db.rollback()


async def recurring_scheduler_loop():
    """Run recurring invoice check on startup, then daily."""
    while True:
        await create_due_recurring_invoices()
        await asyncio.sleep(INTERVAL_SECONDS)
