from __future__ import annotations

from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle

from app.core.config import get_settings
from app.models.proforma import Proforma

LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "flycatch-logo.png"

# Template accent (dark teal / forest green) and light table wash
ACCENT = colors.Color(0.05, 0.35, 0.32)
TABLE_HEADER_BG = colors.Color(0.85, 0.93, 0.95)
BORDER = colors.Color(0.7, 0.7, 0.7)


def _amount_display(proforma: Proforma, *, can_view_financials: bool) -> str:
    if not can_view_financials:
        return "Restricted"
    if proforma.estimated_amount:
        return f"{proforma.estimated_amount}"
    return "—"


def _format_date(iso_or_date: str) -> str:
    parts = iso_or_date.split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return iso_or_date


def _draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, font: str, size: int) -> float:
    c.setFont(font, size)
    words = (text or "").split()
    if not words:
        return y
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    for line in lines:
        c.drawString(x, y, line)
        y -= size + 2
    return y


def build_proforma_pdf(proforma: Proforma, *, can_view_financials: bool) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter, pageCompression=0)
    width, height = letter
    left = 0.6 * inch
    right = width - 0.6 * inch
    settings = get_settings()

    y = height - 0.55 * inch

    # Logo + company brand
    if LOGO_PATH.is_file():
        c.drawImage(
            str(LOGO_PATH),
            left,
            y - 0.45 * inch,
            width=0.55 * inch,
            height=0.55 * inch,
            mask="auto",
            preserveAspectRatio=True,
        )
    entity_name = proforma.entity.name if proforma.entity else ""
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.black)
    c.drawString(left + 0.7 * inch, y, entity_name or "FlyAccounts")
    y -= 0.35 * inch

    # Company Information (left) and Client box (right)
    company_top = y
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left, company_top, "Company Information")
    company_y = company_top - 14
    c.setFont("Helvetica", 8)
    company_lines = [
        entity_name,
        settings.proforma_company_address_line1,
        settings.proforma_company_address_line2,
        ", ".join(
            part
            for part in [
                settings.proforma_company_city,
                settings.proforma_company_state,
                settings.proforma_company_postal_code,
            ]
            if part
        ),
        settings.proforma_company_country,
        settings.proforma_company_phone,
        settings.proforma_company_email,
    ]
    for line in company_lines:
        if line:
            c.drawString(left, company_y, line[:70])
            company_y -= 11

    client_left = width / 2 + 0.15 * inch
    client_width = right - client_left
    client_lines = [
        proforma.client_name or "",
        proforma.client_address or "",
        proforma.client_email or "",
    ]
    client_content_height = 18 + max(1, sum(1 for line in client_lines if line)) * 11 + 10
    client_box_bottom = company_top - client_content_height
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.8)
    c.rect(client_left, client_box_bottom, client_width, company_top - client_box_bottom + 6, stroke=1, fill=0)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(client_left + 8, company_top - 4, "Client")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 8)
    cy = company_top - 18
    for line in client_lines:
        if line:
            cy = _draw_wrapped(c, line, client_left + 8, cy, client_width - 16, "Helvetica", 8)
            cy -= 2

    y = min(company_y, client_box_bottom) - 0.25 * inch

    # Accent divider
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2.5)
    c.line(left, y, right, y)
    y -= 0.35 * inch

    # Title
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 16)
    title = "PROFORMA INVOICE"
    c.drawString((width - c.stringWidth(title, "Helvetica-Bold", 16)) / 2, y, title)
    y -= 0.35 * inch

    # Meta fields
    c.setFillColor(colors.black)
    invoice_date = _format_date(proforma.created_at.date().isoformat())
    valid_until = _format_date(proforma.valid_until.isoformat())
    contract_ref = proforma.contract.reference if proforma.contract else ""
    meta = [
        ("Invoice Number", proforma.code),
        ("Invoice Date", invoice_date),
        ("Valid Until", valid_until),
        ("Project / Reference", contract_ref),
    ]
    for label, value in meta:
        c.setFont("Helvetica", 9)
        c.drawString(left, y, f"{label}:")
        c.setFont("Helvetica", 9)
        c.drawString(left + 1.45 * inch, y, value or "")
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.4)
        c.line(left + 1.4 * inch, y - 2, left + 3.8 * inch, y - 2)
        y -= 16

    y -= 0.15 * inch

    # Line-item table
    currency = proforma.currency or ""
    amount = _amount_display(proforma, can_view_financials=can_view_financials)
    description = f"Services — {contract_ref}" if contract_ref else "Services"
    header = [
        "No.",
        "Item Description",
        "Quantity",
        f"Unit Price ({currency})",
        f"Amount ({currency})",
    ]
    row = ["1", description, "1", amount, amount]
    data = [header, row]
    col_widths = [0.45 * inch, 3.0 * inch, 0.85 * inch, 1.35 * inch, 1.35 * inch]
    table = Table(data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("ALIGN", (0, 1), (0, -1), "CENTER"),
                ("ALIGN", (2, 1), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    tw, th = table.wrap(0, 0)
    table.drawOn(c, left, y - th)
    y = y - th - 0.05 * inch

    # Totals (right-aligned under table)
    totals = [
        ("Subtotal", amount),
        ("Total", amount),
        ("Total Amount", amount),
    ]
    totals_width = 2.7 * inch
    totals_left = right - totals_width
    for label, value in totals:
        row_h = 16
        c.setFillColor(TABLE_HEADER_BG)
        c.rect(totals_left, y - row_h, 1.35 * inch, row_h, stroke=0, fill=1)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(totals_left, y - row_h, totals_width, row_h, stroke=1, fill=0)
        c.line(totals_left + 1.35 * inch, y, totals_left + 1.35 * inch, y - row_h)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold" if label == "Total Amount" else "Helvetica", 8)
        c.drawString(totals_left + 6, y - 11, label)
        c.setFont("Helvetica", 8)
        c.drawRightString(right - 6, y - 11, value)
        y -= row_h

    y -= 0.35 * inch

    # Account Details
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, y, "ACCOUNT DETAILS")
    y -= 0.22 * inch
    c.setFillColor(colors.black)
    account_rows = [
        ("Account Name", settings.proforma_account_name),
        ("Account Number", settings.proforma_account_number),
        ("IBAN", settings.proforma_iban),
        ("Bank Name", settings.proforma_bank_name),
        ("Bank Address", settings.proforma_bank_address),
    ]
    for label, value in account_rows:
        c.setFont("Helvetica", 9)
        c.drawString(left, y, f"{label}:")
        c.drawString(left + 1.45 * inch, y, (value or "")[:70])
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.4)
        c.line(left + 1.4 * inch, y - 2, left + 4.5 * inch, y - 2)
        y -= 15

    c.showPage()
    c.save()
    return buffer.getvalue()
