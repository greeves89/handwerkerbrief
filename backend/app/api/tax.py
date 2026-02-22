"""
Umsatzsteuervoranmeldung (UStVA) – ELSTER-kompatibler XML-Export.

Generiert die UStVA als XML nach dem ELSTER-Standard (§ 18 UStG).
Das XML kann direkt über das ELSTER Online Portal (www.elster.de) hochgeladen
oder mit einem lokalen ELSTER-Client übertragen werden.

Unterstützte Voranmeldezeiträume:
  - Monatlich: Monatsvoranmeldung (01-12)
  - Quartalsweise: Quartalsvoranmeldung (41=Q1, 42=Q2, 43=Q3, 44=Q4)

Hinweis: Für die direkte ERiC-Übertragung wird das ERiC SDK benötigt
(kostenpflichtig, Lizenz beim Finanzamt). Dieser Endpoint erzeugt das
korrekte XML, das manuell hochgeladen werden kann.
"""
import io
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/tax", tags=["tax"])

# ELSTER Zeiträume
PERIOD_LABELS = {
    "01": "Januar", "02": "Februar", "03": "März", "04": "April",
    "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
    "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
    "41": "Q1 (Jan–Mrz)", "42": "Q2 (Apr–Jun)", "43": "Q3 (Jul–Sep)", "44": "Q4 (Okt–Dez)",
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class UStVAFormData(BaseModel):
    year: int
    period: str              # "01"-"12" = Monat, "41"-"44" = Quartal
    steuernummer: str        # Format: 00/000/00000
    finanzamt_nr: str        # 4-stellige Finanzamtnummer
    name: str
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None

    # Steuerangaben (in Cent, werden in EUR umgerechnet)
    # Zeile 26: Lieferungen 19% Netto
    kz81_netto: Optional[int] = None
    # Zeile 26: Steuer 19%
    kz83_steuer: Optional[int] = None
    # Zeile 35: Lieferungen 7% Netto
    kz86_netto: Optional[int] = None
    # Zeile 36: Steuer 7%
    kz36_steuer: Optional[int] = None
    # Zeile 66: Vorsteuer aus Rechnungen (Eingangsumsatz)
    kz66_vorsteuer: Optional[int] = None
    # Zeile 69: Vorsteuer (andere)
    kz61_vorsteuer: Optional[int] = None

    # Override: Falls manuell eingetragen (überschreibt berechnete Werte)
    use_manual: bool = False


class UStVASummary(BaseModel):
    year: int
    period: str
    period_label: str
    invoices_count: int
    total_netto_19: int   # in Cent
    total_steuer_19: int
    total_netto_7: int
    total_steuer_7: int
    total_netto_0: int
    total_revenue_gross: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cents(amount) -> int:
    """Decimal/float/None → int Cent"""
    if amount is None:
        return 0
    return int(Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)


def _eur(cents: int) -> str:
    """Cent → '1234,56' ELSTER format"""
    return f"{cents // 100},{cents % 100:02d}"


def _period_to_months(period: str):
    """Returns list of month numbers (1-based) for the period."""
    if period in [f"{m:02d}" for m in range(1, 13)]:
        return [int(period)]
    quarter_map = {"41": [1, 2, 3], "42": [4, 5, 6], "43": [7, 8, 9], "44": [10, 11, 12]}
    return quarter_map.get(period, [])


def _generate_elster_xml(data: UStVAFormData, summary: UStVASummary) -> str:
    """
    Generiert ELSTER-kompatibles UStVA-XML nach dem Elster-Datenschema
    (Transferheader Version 11, Datenlieferant Typ 0).
    """
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d%H%M%S")

    root = ET.Element("Elster", xmlns="http://www.elster.de/elsterxml/schema/v11")

    # TransferHeader
    th = ET.SubElement(root, "TransferHeader", version="11")
    ET.SubElement(th, "Verfahren").text = "ElsterAnmeldung"
    ET.SubElement(th, "DatenArt").text = "UStVA"
    ET.SubElement(th, "Vorgang").text = "send-NoSig"
    ET.SubElement(th, "Testmerker").text = "0"
    ET.SubElement(th, "HerstellerID").text = "74931"
    ET.SubElement(th, "DatenLieferant")
    ET.SubElement(th, "Datei")
    dt = ET.SubElement(th, "DatumErstellung")
    dt.text = timestamp
    vn = ET.SubElement(th, "Verschluesselung").text = "PKCS#7v1.5"
    vc = ET.SubElement(th, "Kompression").text = "GZIP"

    # Nutzerdaten
    nd = ET.SubElement(root, "DatenTeil")
    lieferung = ET.SubElement(nd, "Nutzdatenblock")

    # Nutzdatenheader
    ndh = ET.SubElement(lieferung, "NutzdatenHeader", version="11")
    ET.SubElement(ndh, "NutzdatenTicket").text = timestamp
    emp = ET.SubElement(ndh, "Empfaenger", id="F")
    emp.text = data.finanzamt_nr

    # Nutzdaten – UStVA
    nutzdaten = ET.SubElement(lieferung, "Nutzdaten")
    anmeldung = ET.SubElement(nutzdaten, "Anmeldungssteuern", art="UStVA", version="202401")

    jahr = ET.SubElement(anmeldung, "Steuerfall")
    ET.SubElement(jahr, "Steuerjahr").text = str(data.year)
    ET.SubElement(jahr, "Zeitraum").text = data.period

    # Steuerpflichtiger
    stpfl = ET.SubElement(anmeldung, "Steuerpflichtiger")
    ET.SubElement(stpfl, "Steuernummer").text = data.steuernummer.replace("/", "").replace(" ", "")
    ET.SubElement(stpfl, "Finanzamtsnummer").text = data.finanzamt_nr

    anschrift = ET.SubElement(stpfl, "Anschrift")
    ET.SubElement(anschrift, "Name").text = data.name
    if data.strasse:
        ET.SubElement(anschrift, "Strasse").text = data.strasse
    if data.plz:
        ET.SubElement(anschrift, "PLZ").text = data.plz
    if data.ort:
        ET.SubElement(anschrift, "Ort").text = data.ort

    # Steuerangaben
    kz = ET.SubElement(anmeldung, "Steueranmeldung")

    # Kennzahl 81: Steuerpflichtige Umsätze 19%
    netto_19 = data.kz81_netto if data.kz81_netto is not None else summary.total_netto_19
    steuer_19 = data.kz83_steuer if data.kz83_steuer is not None else summary.total_steuer_19

    # Kennzahl 86/36: 7%
    netto_7 = data.kz86_netto if data.kz86_netto is not None else summary.total_netto_7
    steuer_7 = data.kz36_steuer if data.kz36_steuer is not None else summary.total_steuer_7

    # Vorsteuer
    vorsteuer = data.kz66_vorsteuer or 0

    # Zahllast = Gesamtsteuer - Vorsteuer
    gesamtsteuer = steuer_19 + steuer_7
    zahllast = gesamtsteuer - vorsteuer

    if netto_19 > 0:
        ET.SubElement(kz, "Kz81").text = _eur(netto_19)
        ET.SubElement(kz, "Kz83").text = _eur(steuer_19)
    if netto_7 > 0:
        ET.SubElement(kz, "Kz86").text = _eur(netto_7)
        ET.SubElement(kz, "Kz36").text = _eur(steuer_7)
    if vorsteuer > 0:
        ET.SubElement(kz, "Kz66").text = _eur(vorsteuer)

    ET.SubElement(kz, "Kz83_sum").text = _eur(gesamtsteuer)
    ET.SubElement(kz, "Kz65").text = _eur(vorsteuer)
    ET.SubElement(kz, "Kz69").text = _eur(max(0, zahllast))  # Zahllast

    ET.SubElement(anmeldung, "Erstellungsdatum").text = now.strftime("%d.%m.%Y")

    # Serialize
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ustv/summary", response_model=UStVASummary)
async def get_ustv_summary(
    year: int = Query(...),
    period: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Berechnet die UStVA-Kennzahlen aus den Rechnungen des Zeitraums.
    Gibt Umsätze getrennt nach Steuersatz (19%, 7%, 0%) zurück.
    """
    if period not in PERIOD_LABELS:
        raise HTTPException(status_code=400, detail=f"Ungültiger Zeitraum: {period}")

    months = _period_to_months(period)
    if not months:
        raise HTTPException(status_code=400, detail="Ungültiger Zeitraum")

    # Fetch paid/sent invoices for the period
    result = await db.execute(
        select(Document).where(
            Document.user_id == current_user.id,
            Document.type == "invoice",
            Document.status.in_(["paid", "sent", "overdue"]),
        )
    )
    invoices = result.scalars().all()

    # Filter by year/month
    def in_period(doc: Document) -> bool:
        d = doc.issue_date
        if not d:
            return False
        if d.year != year:
            return False
        return d.month in months

    period_invoices = [inv for inv in invoices if in_period(inv)]

    netto_19 = 0
    steuer_19 = 0
    netto_7 = 0
    steuer_7 = 0
    netto_0 = 0
    gross_total = 0

    for inv in period_invoices:
        tr = float(inv.tax_rate or 19)
        netto = _cents(inv.subtotal)
        steuer = _cents(inv.tax_amount)
        gross_total += _cents(inv.total_amount)

        if abs(tr - 19.0) < 0.01:
            netto_19 += netto
            steuer_19 += steuer
        elif abs(tr - 7.0) < 0.01:
            netto_7 += netto
            steuer_7 += steuer
        else:
            netto_0 += netto

    return UStVASummary(
        year=year,
        period=period,
        period_label=PERIOD_LABELS[period],
        invoices_count=len(period_invoices),
        total_netto_19=netto_19,
        total_steuer_19=steuer_19,
        total_netto_7=netto_7,
        total_steuer_7=steuer_7,
        total_netto_0=netto_0,
        total_revenue_gross=gross_total,
    )


@router.post("/ustv/export-xml")
async def export_ustv_xml(
    data: UStVAFormData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generiert das ELSTER-XML für die UStVA zum Download.
    Das XML kann über das ELSTER Online Portal (www.elster.de/eportal) hochgeladen werden.
    """
    if data.period not in PERIOD_LABELS:
        raise HTTPException(status_code=400, detail=f"Ungültiger Zeitraum: {data.period}")

    if not data.steuernummer.strip():
        raise HTTPException(status_code=400, detail="Steuernummer ist erforderlich")

    if not data.finanzamt_nr.strip() or len(data.finanzamt_nr.strip()) != 4:
        raise HTTPException(status_code=400, detail="Finanzamtnummer muss 4-stellig sein")

    # Get computed summary
    months = _period_to_months(data.period)
    result = await db.execute(
        select(Document).where(
            Document.user_id == current_user.id,
            Document.type == "invoice",
            Document.status.in_(["paid", "sent", "overdue"]),
        )
    )
    invoices = result.scalars().all()

    def in_period(doc: Document) -> bool:
        d = doc.issue_date
        return d and d.year == data.year and d.month in months

    period_invoices = [inv for inv in invoices if in_period(inv)]

    netto_19 = sum(_cents(inv.subtotal) for inv in period_invoices if abs(float(inv.tax_rate or 19) - 19) < 0.01)
    steuer_19 = sum(_cents(inv.tax_amount) for inv in period_invoices if abs(float(inv.tax_rate or 19) - 19) < 0.01)
    netto_7 = sum(_cents(inv.subtotal) for inv in period_invoices if abs(float(inv.tax_rate or 7) - 7) < 0.01)
    steuer_7 = sum(_cents(inv.tax_amount) for inv in period_invoices if abs(float(inv.tax_rate or 7) - 7) < 0.01)

    summary = UStVASummary(
        year=data.year, period=data.period, period_label=PERIOD_LABELS[data.period],
        invoices_count=len(period_invoices),
        total_netto_19=netto_19, total_steuer_19=steuer_19,
        total_netto_7=netto_7, total_steuer_7=steuer_7,
        total_netto_0=0, total_revenue_gross=0,
    )

    xml_str = _generate_elster_xml(data, summary)
    filename = f"UStVA_{data.year}_{data.period}.xml"

    return Response(
        content=xml_str.encode("utf-8"),
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/periods")
async def list_periods():
    """Verfügbare UStVA-Zeiträume."""
    months = [{"value": f"{m:02d}", "label": PERIOD_LABELS[f"{m:02d}"], "type": "monthly"} for m in range(1, 13)]
    quarters = [{"value": k, "label": v, "type": "quarterly"} for k, v in PERIOD_LABELS.items() if k.startswith("4")]
    return {"months": months, "quarters": quarters}
