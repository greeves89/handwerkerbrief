import os
import uuid
from decimal import Decimal
from typing import Optional
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.config import settings


def format_currency(amount) -> str:
    return f"{float(amount):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def format_date(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return d.strftime("%d.%m.%Y")
    return str(d)


async def generate_pdf(document, user, customer) -> str:
    """Generate a PDF for an invoice or offer and return the file path."""
    pdf_dir = os.path.join(settings.UPLOAD_DIR, "pdfs")
    os.makedirs(pdf_dir, exist_ok=True)

    filename = f"{document.document_number.replace('/', '-')}_{uuid.uuid4().hex[:8]}.pdf"
    filepath = os.path.join(pdf_dir, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#2563eb")
    text_color = colors.HexColor("#1e293b")
    muted_color = colors.HexColor("#64748b")
    border_color = colors.HexColor("#e2e8f0")

    style_normal = ParagraphStyle(
        "Normal", fontSize=9, textColor=text_color, leading=14
    )
    style_small = ParagraphStyle(
        "Small", fontSize=8, textColor=muted_color, leading=12
    )
    style_heading = ParagraphStyle(
        "Heading", fontSize=18, textColor=primary_color, fontName="Helvetica-Bold", leading=24
    )
    style_subheading = ParagraphStyle(
        "SubHeading", fontSize=11, textColor=text_color, fontName="Helvetica-Bold", leading=16
    )
    style_right = ParagraphStyle(
        "Right", fontSize=9, textColor=text_color, alignment=TA_RIGHT, leading=14
    )

    story = []

    # Header: Logo + Company Info
    company_name = user.company_name or user.name
    company_lines = [company_name]
    if user.address_street:
        company_lines.append(user.address_street)
    if user.address_zip and user.address_city:
        company_lines.append(f"{user.address_zip} {user.address_city}")
    if user.phone:
        company_lines.append(f"Tel: {user.phone}")
    if user.tax_number:
        company_lines.append(f"St.-Nr.: {user.tax_number}")
    if user.ustid:
        company_lines.append(f"USt-IdNr.: {user.ustid}")

    header_data = []
    # Logo handling
    logo_cell = ""
    if user.logo_path:
        logo_full = os.path.join(settings.UPLOAD_DIR, user.logo_path)
        if os.path.exists(logo_full):
            try:
                img = Image(logo_full, width=40*mm, height=20*mm, kind='proportional')
                logo_cell = img
            except Exception:
                logo_cell = Paragraph(company_name, style_heading)
        else:
            logo_cell = Paragraph(company_name, style_heading)
    else:
        logo_cell = Paragraph(company_name, style_heading)

    company_info = "\n".join(company_lines[1:]) if len(company_lines) > 1 else ""
    header_table = Table(
        [[logo_cell, Paragraph(company_info, style_small)]],
        colWidths=[90*mm, 80*mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color))
    story.append(Spacer(1, 6*mm))

    # Recipient address
    customer_name_parts = []
    if customer.company_name:
        customer_name_parts.append(customer.company_name)
    full_name = " ".join(filter(None, [customer.first_name, customer.last_name]))
    if full_name:
        customer_name_parts.append(full_name)

    recipient_lines = customer_name_parts[:]
    if customer.address_street:
        recipient_lines.append(customer.address_street)
    if customer.address_zip and customer.address_city:
        recipient_lines.append(f"{customer.address_zip} {customer.address_city}")
    if customer.address_country and customer.address_country != "Deutschland":
        recipient_lines.append(customer.address_country)

    recipient_text = "<br/>".join(recipient_lines)
    story.append(Paragraph(recipient_text, style_normal))
    story.append(Spacer(1, 10*mm))

    # Document type header
    if document.type == "invoice":
        doc_type_text = "RECHNUNG"
    elif document.type == "order_confirmation":
        doc_type_text = "AUFTRAGSBESTÄTIGUNG"
    else:
        doc_type_text = "ANGEBOT"
    story.append(Paragraph(doc_type_text, style_heading))
    story.append(Spacer(1, 4*mm))

    # Document metadata table
    if document.type == "invoice":
        num_label = "Rechnungsnummer:"
    elif document.type == "order_confirmation":
        num_label = "Auftragsnummer:"
    else:
        num_label = "Angebotsnummer:"
    meta_rows = [
        [num_label, document.document_number],
        ["Datum:", format_date(document.issue_date)],
    ]
    if document.due_date:
        meta_rows.append(["Zahlungsziel:", format_date(document.due_date)])
    if document.valid_until:
        meta_rows.append(["Gültig bis:", format_date(document.valid_until)])

    meta_table = Table(meta_rows, colWidths=[45*mm, 100*mm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), muted_color),
        ("TEXTCOLOR", (1, 0), (1, -1), text_color),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8*mm))

    # Title and intro
    if document.title:
        story.append(Paragraph(document.title, style_subheading))
        story.append(Spacer(1, 4*mm))
    if document.intro_text:
        story.append(Paragraph(document.intro_text, style_normal))
        story.append(Spacer(1, 6*mm))

    # Line items table
    item_headers = ["Pos.", "Bezeichnung", "Menge", "Einheit", "Einzelpreis", "Gesamt"]
    item_data = [item_headers]

    for item in document.items:
        item_data.append([
            str(item.position),
            Paragraph(f"<b>{item.name}</b>" + (f"<br/><font size=8 color='#64748b'>{item.description}</font>" if item.description else ""), style_normal),
            str(float(item.quantity)).rstrip("0").rstrip(".") if "." in str(float(item.quantity)) else str(int(float(item.quantity))),
            item.unit or "Stück",
            format_currency(item.price_per_unit),
            format_currency(item.total_price),
        ])

    items_table = Table(
        item_data,
        colWidths=[12*mm, 75*mm, 17*mm, 17*mm, 27*mm, 22*mm],
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6*mm))

    # Totals
    discount_amount = float(document.subtotal) * float(document.discount_percent) / 100 if document.discount_percent else 0
    totals_rows = []
    totals_rows.append(["Zwischensumme (netto):", format_currency(document.subtotal)])
    if discount_amount > 0:
        totals_rows.append([f"Rabatt ({document.discount_percent}%):", f"-{format_currency(discount_amount)}"])
    totals_rows.append([f"MwSt. ({document.tax_rate}%):", format_currency(document.tax_amount)])
    totals_rows.append(["Gesamtbetrag (brutto):", format_currency(document.total_amount)])

    totals_table = Table(totals_rows, colWidths=[120*mm, 30*mm])
    style_list = [
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 1, primary_color),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), primary_color),
        ("FONTSIZE", (0, -1), (-1, -1), 11),
    ]
    totals_table.setStyle(TableStyle(style_list))
    story.append(totals_table)
    story.append(Spacer(1, 8*mm))

    # Payment info
    if document.type == "invoice" and (user.iban or user.payment_terms or document.payment_terms):
        story.append(HRFlowable(width="100%", thickness=0.5, color=border_color))
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("<b>Zahlungsinformationen</b>", style_subheading))
        story.append(Spacer(1, 3*mm))
        payment_lines = []
        if document.payment_terms or user.invoice_prefix:
            terms = document.payment_terms or "Zahlbar sofort ohne Abzug."
            payment_lines.append(terms)
        if user.iban:
            payment_lines.append(f"IBAN: {user.iban}")
        if user.bic:
            payment_lines.append(f"BIC: {user.bic}")
        if user.bank_name:
            payment_lines.append(f"Bank: {user.bank_name}")
        story.append(Paragraph("<br/>".join(payment_lines), style_normal))
        story.append(Spacer(1, 6*mm))

    # Closing text
    if document.closing_text:
        story.append(Paragraph(document.closing_text, style_normal))
        story.append(Spacer(1, 6*mm))

    # Notes
    if document.notes:
        story.append(Paragraph(f"<i>Hinweis: {document.notes}</i>", style_small))

    doc.build(story)
    return f"pdfs/{filename}"
