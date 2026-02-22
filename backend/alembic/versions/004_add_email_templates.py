"""Add email_templates table

Revision ID: 004
Revises: 003
Create Date: 2026-02-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None

# Default reminder templates
DEFAULT_TEMPLATES = [
    {
        "type": "reminder_level_1",
        "name": "Zahlungserinnerung (freundlich)",
        "subject": "Zahlungserinnerung: Rechnung {{invoice_number}} – {{company_name}}",
        "body_html": """<p>Sehr geehrte/r <strong>{{customer_name}}</strong>,</p>
<p>wir möchten Sie freundlich darauf hinweisen, dass folgende Rechnung noch nicht beglichen wurde:</p>
<ul>
  <li><strong>Rechnungsnummer:</strong> {{invoice_number}}</li>
  <li><strong>Offener Betrag:</strong> {{amount}} €</li>
  <li><strong>Fälligkeitsdatum:</strong> {{due_date}}</li>
</ul>
<p>Bitte überweisen Sie den ausstehenden Betrag umgehend auf unser Konto. Falls Sie bereits gezahlt haben, bitten wir Sie, diese E-Mail zu ignorieren.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{company_name}}</strong></p>""",
    },
    {
        "type": "reminder_level_2",
        "name": "1. Mahnung",
        "subject": "1. Mahnung: Rechnung {{invoice_number}} – {{company_name}}",
        "body_html": """<p>Sehr geehrte/r <strong>{{customer_name}}</strong>,</p>
<p>leider haben wir bis heute keinen Zahlungseingang für folgende Rechnung feststellen können:</p>
<ul>
  <li><strong>Rechnungsnummer:</strong> {{invoice_number}}</li>
  <li><strong>Offener Betrag:</strong> {{amount}} €</li>
  <li><strong>Fälligkeitsdatum:</strong> {{due_date}}</li>
</ul>
<p>Wir bitten Sie, den ausstehenden Betrag unverzüglich zu begleichen, um weitere Mahngebühren zu vermeiden.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{company_name}}</strong></p>""",
    },
    {
        "type": "reminder_level_3",
        "name": "2. Mahnung – Letzte Aufforderung",
        "subject": "2. Mahnung – Letzte Aufforderung: Rechnung {{invoice_number}} – {{company_name}}",
        "body_html": """<p>Sehr geehrte/r <strong>{{customer_name}}</strong>,</p>
<p>trotz unserer bisherigen Mahnungen ist der folgende Betrag noch immer offen:</p>
<ul>
  <li><strong>Rechnungsnummer:</strong> {{invoice_number}}</li>
  <li><strong>Offener Betrag:</strong> {{amount}} €</li>
  <li><strong>Fälligkeitsdatum:</strong> {{due_date}}</li>
</ul>
<p>Dies ist unsere letzte Zahlungsaufforderung. Falls wir innerhalb von 7 Tagen keine Zahlung erhalten, sind wir gezwungen, rechtliche Schritte einzuleiten.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{company_name}}</strong></p>""",
    },
]


def upgrade() -> None:
    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_templates_type"), "email_templates", ["type"], unique=True)

    # Insert default templates
    op.bulk_insert(
        sa.table(
            "email_templates",
            sa.column("type", sa.String),
            sa.column("name", sa.String),
            sa.column("subject", sa.String),
            sa.column("body_html", sa.Text),
        ),
        DEFAULT_TEMPLATES,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_email_templates_type"), table_name="email_templates")
    op.drop_table("email_templates")
