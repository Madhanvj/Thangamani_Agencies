import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from app.models import Invoice, CompanySetting

_FONT_REGISTERED = False


def _ensure_unicode_font() -> tuple[str, str]:
    """Register a TrueType font that supports the Indian Rupee (₹) symbol (U+20B9)."""
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return 'AppFont', 'AppFont-Bold'

    regular_path = None
    bold_path = None

    # 1. Project bundled fonts in app/static/fonts/
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(curr_dir)
    bundled_reg = os.path.join(app_dir, 'static', 'fonts', 'AppFont-Regular.ttf')
    bundled_bld = os.path.join(app_dir, 'static', 'fonts', 'AppFont-Bold.ttf')

    if os.path.exists(bundled_reg):
        regular_path = bundled_reg
        bold_path = bundled_bld if os.path.exists(bundled_bld) else bundled_reg

    # 2. Windows system fonts
    if not regular_path:
        for reg, bld in [
            (r'C:\Windows\Fonts\segoeui.ttf', r'C:\Windows\Fonts\segoeuib.ttf'),
            (r'C:\Windows\Fonts\arial.ttf', r'C:\Windows\Fonts\arialbd.ttf'),
            (r'C:\Windows\Fonts\calibri.ttf', r'C:\Windows\Fonts\calibrib.ttf'),
        ]:
            if os.path.exists(reg):
                regular_path = reg
                bold_path = bld if os.path.exists(bld) else reg
                break

    # 3. Linux system fonts
    if not regular_path:
        for reg, bld in [
            ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
            ('/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'),
        ]:
            if os.path.exists(reg):
                regular_path = reg
                bold_path = bld if os.path.exists(bld) else reg
                break

    if regular_path:
        try:
            pdfmetrics.registerFont(TTFont('AppFont', regular_path))
            pdfmetrics.registerFont(TTFont('AppFont-Bold', bold_path or regular_path))
            pdfmetrics.registerFontFamily('AppFont', normal='AppFont', bold='AppFont-Bold', italic='AppFont', boldItalic='AppFont-Bold')
            _FONT_REGISTERED = True
            return 'AppFont', 'AppFont-Bold'
        except Exception:
            pass

    return 'Helvetica', 'Helvetica-Bold'


def generate_invoice_pdf(invoice: Invoice, company_setting: CompanySetting | None = None) -> bytes:
    font_reg, font_bold = _ensure_unicode_font()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm
    )

    story = []
    styles = getSampleStyleSheet()
    styles['Normal'].fontName = font_reg
    styles['Heading1'].fontName = font_bold

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=18,
        textColor=colors.HexColor('#1e293b'),
        alignment=1, # Center
        fontName=font_bold
    )
    company_style = ParagraphStyle(
        'CompanyHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        alignment=1,
        fontName=font_reg,
        textColor=colors.HexColor('#475569')
    )
    meta_bold = ParagraphStyle(
        'MetaBold',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        fontName=font_bold,
        textColor=colors.HexColor('#1e293b')
    )
    meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        fontName=font_reg,
        textColor=colors.HexColor('#334155')
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName=font_bold,
        textColor=colors.white
    )
    cell_text = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName=font_reg,
        textColor=colors.HexColor('#1e293b')
    )
    cell_right = ParagraphStyle(
        'CellRight',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        alignment=2, # Right
        fontName=font_reg,
        textColor=colors.HexColor('#1e293b')
    )

    comp_name = company_setting.company_name if company_setting else "Thangamani Agencies"
    comp_gstin = company_setting.gstin if company_setting else "33ABCDE1234F1Z5"
    comp_phone = company_setting.phone if company_setting else "+91 98765 43210"
    comp_email = company_setting.email if company_setting else "contact@thangamaniagencies.com"
    comp_address = company_setting.address if company_setting else "124, Netaji Road, Pollachi, Tamil Nadu - 642001"

    # Header
    story.append(Paragraph("TAX INVOICE", title_style))
    story.append(Spacer(1, 1 * mm))
    story.append(Paragraph(f"<b>{comp_name}</b><br/>{comp_address}<br/><b>GSTIN:</b> {comp_gstin} | <b>Phone:</b> {comp_phone} | <b>Email:</b> {comp_email}", company_style))
    story.append(Spacer(1, 4 * mm))

    # Invoice and Customer Meta box
    inv_date_str = invoice.invoice_date.strftime("%d-%b-%Y %I:%M %p")
    cust_name = invoice.customer.name if invoice.customer else "Walk-in Customer"
    cust_phone = invoice.customer.phone if invoice.customer else "-"
    cust_addr = invoice.customer.address or "-" if invoice.customer else "-"
    cust_state = invoice.customer.state if invoice.customer else invoice.customer_state
    cust_gstin = invoice.customer.gstin or "Unregistered" if invoice.customer else "Unregistered"

    meta_table_data = [
        [
            Paragraph("<b>Invoice No:</b>", meta_bold),
            Paragraph(f"<b>{invoice.invoice_number}</b>", meta_bold),
            Paragraph("<b>Customer Details:</b>", meta_bold),
            Paragraph(f"<b>{cust_name}</b>", meta_bold)
        ],
        [
            Paragraph("<b>Date:</b>", meta_bold),
            Paragraph(inv_date_str, meta_val),
            Paragraph("<b>Phone:</b>", meta_bold),
            Paragraph(cust_phone, meta_val)
        ],
        [
            Paragraph("<b>Payment Mode:</b>", meta_bold),
            Paragraph(f"{invoice.payment_mode.value}", meta_val),
            Paragraph("<b>Address:</b>", meta_bold),
            Paragraph(cust_addr, meta_val)
        ],
        [
            Paragraph("<b>Status:</b>", meta_bold),
            Paragraph(f"<b>{invoice.status.value}</b>", meta_bold),
            Paragraph("<b>State / GSTIN:</b>", meta_bold),
            Paragraph(f"{cust_state} | GSTIN: {cust_gstin}", meta_val)
        ]
    ]

    meta_table = Table(meta_table_data, colWidths=[28 * mm, 62 * mm, 32 * mm, 68 * mm])
    meta_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4 * mm))

    # Items table
    # Items table
    # Columns: #, Item Description, HSN, Qty, MRP/Rate, Taxable, GST %, CGST, SGST (or IGST), Total
    if invoice.is_interstate:
        headers = [
            Paragraph("#", cell_bold),
            Paragraph("Item Description", cell_bold),
            Paragraph("HSN", cell_bold),
            Paragraph("Qty", cell_bold),
            Paragraph("MRP/Rate (₹)", cell_bold),
            Paragraph("Taxable (₹)", cell_bold),
            Paragraph("GST %", cell_bold),
            Paragraph("IGST (₹)", cell_bold),
            Paragraph("Total (₹)", cell_bold),
        ]
        col_widths = [6 * mm, 54 * mm, 16 * mm, 10 * mm, 20 * mm, 22 * mm, 16 * mm, 20 * mm, 26 * mm]
    else:
        headers = [
            Paragraph("#", cell_bold),
            Paragraph("Item Description", cell_bold),
            Paragraph("HSN", cell_bold),
            Paragraph("Qty", cell_bold),
            Paragraph("MRP/Rate (₹)", cell_bold),
            Paragraph("Taxable (₹)", cell_bold),
            Paragraph("GST %", cell_bold),
            Paragraph("CGST (₹)", cell_bold),
            Paragraph("SGST (₹)", cell_bold),
            Paragraph("Total (₹)", cell_bold),
        ]
        col_widths = [6 * mm, 46 * mm, 14 * mm, 10 * mm, 18 * mm, 18 * mm, 14 * mm, 18 * mm, 18 * mm, 28 * mm]

    items_data = [headers]

    for idx, itm in enumerate(invoice.items, start=1):
        pricing_mode = "Incl. GST" if getattr(itm, 'price_includes_gst', True) else "Excl. GST"
        desc_text = f"<b>{itm.product_name}</b><br/><font color='#64748b' size=6.5>SKU: {itm.sku} • {pricing_mode}</font>"

        if invoice.is_interstate:
            items_data.append([
                Paragraph(str(idx), cell_text),
                Paragraph(desc_text, cell_text),
                Paragraph(itm.hsn_code, cell_text),
                Paragraph(str(itm.quantity), cell_right),
                Paragraph(f"{itm.unit_price:,.2f}", cell_right),
                Paragraph(f"{itm.taxable_value:,.2f}", cell_right),
                Paragraph(f"{itm.gst_rate}%", cell_text),
                Paragraph(f"{itm.igst_amount:,.2f}", cell_right),
                Paragraph(f"<b>{itm.line_total:,.2f}</b>", cell_right),
            ])
        else:
            items_data.append([
                Paragraph(str(idx), cell_text),
                Paragraph(desc_text, cell_text),
                Paragraph(itm.hsn_code, cell_text),
                Paragraph(str(itm.quantity), cell_right),
                Paragraph(f"{itm.unit_price:,.2f}", cell_right),
                Paragraph(f"{itm.taxable_value:,.2f}", cell_right),
                Paragraph(f"{itm.gst_rate}%", cell_text),
                Paragraph(f"{itm.cgst_amount:,.2f}", cell_right),
                Paragraph(f"{itm.sgst_amount:,.2f}", cell_right),
                Paragraph(f"<b>{itm.line_total:,.2f}</b>", cell_right),
            ])

    items_table = Table(items_data, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 3 * mm))

    # Dedicated Tax Summary Table grouped by GST rate
    story.append(Paragraph("<b>GST Tax Summary (Grouped by Rate):</b>", meta_bold))
    story.append(Spacer(1, 1 * mm))

    if invoice.is_interstate:
        tax_hdr = [
            Paragraph("GST Rate", cell_bold),
            Paragraph("Taxable Value (₹)", cell_bold),
            Paragraph("IGST Amount (₹)", cell_bold),
            Paragraph("Total Tax (₹)", cell_bold),
        ]
        tax_widths = [45 * mm, 50 * mm, 50 * mm, 45 * mm]
        tax_rows = [tax_hdr]
        for grp in invoice.tax_summary:
            tax_rows.append([
                Paragraph(f"{grp['gst_rate']}%", cell_text),
                Paragraph(f"{grp['taxable_value']:,.2f}", cell_right),
                Paragraph(f"{grp['igst_amount']:,.2f}", cell_right),
                Paragraph(f"<b>{grp['total_tax']:,.2f}</b>", cell_right),
            ])
    else:
        tax_hdr = [
            Paragraph("GST Rate", cell_bold),
            Paragraph("Taxable Value (₹)", cell_bold),
            Paragraph("CGST Amount (₹)", cell_bold),
            Paragraph("SGST Amount (₹)", cell_bold),
            Paragraph("Total Tax (₹)", cell_bold),
        ]
        tax_widths = [35 * mm, 45 * mm, 38 * mm, 38 * mm, 34 * mm]
        tax_rows = [tax_hdr]
        for grp in invoice.tax_summary:
            tax_rows.append([
                Paragraph(f"{grp['gst_rate']}%", cell_text),
                Paragraph(f"{grp['taxable_value']:,.2f}", cell_right),
                Paragraph(f"{grp['cgst_amount']:,.2f}", cell_right),
                Paragraph(f"{grp['sgst_amount']:,.2f}", cell_right),
                Paragraph(f"<b>{grp['total_tax']:,.2f}</b>", cell_right),
            ])

    tax_tbl = Table(tax_rows, colWidths=tax_widths)
    tax_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(tax_tbl)
    story.append(Spacer(1, 3 * mm))

    # Summary and Totals Table
    tax_summary_text = (
        f"<b>Invoice Breakdown:</b><br/>"
        f"Taxable Subtotal: ₹{invoice.total_taxable:,.2f}<br/>"
    )
    if invoice.is_interstate:
        tax_summary_text += f"Total IGST: ₹{invoice.total_igst:,.2f}<br/>"
    else:
        tax_summary_text += (
            f"Total CGST: ₹{invoice.total_cgst:,.2f}<br/>"
            f"Total SGST: ₹{invoice.total_sgst:,.2f}<br/>"
        )
    tax_summary_text += f"Total Tax: ₹{(invoice.total_cgst + invoice.total_sgst + invoice.total_igst):,.2f}<br/>"
    tax_summary_text += f"<br/><b>Amount in Words:</b><br/>{invoice.grand_total_words}"

    totals_box_data = [
        [Paragraph(tax_summary_text, meta_val), Paragraph("<b>Subtotal (Taxable):</b>", meta_bold), Paragraph(f"₹{invoice.total_taxable:,.2f}", cell_right)],
        ["", Paragraph("<b>Total Tax:</b>", meta_bold), Paragraph(f"₹{(invoice.total_cgst + invoice.total_sgst + invoice.total_igst):,.2f}", cell_right)],
        ["", Paragraph("<b>Round Off:</b>", meta_bold), Paragraph(f"₹{invoice.round_off:+,.2f}", cell_right)],
        ["", Paragraph("<b>Grand Total:</b>", meta_bold), Paragraph(f"<b><font size=10 color='#0f172a'>₹{invoice.grand_total:,.2f}</font></b>", cell_right)],
        ["", Paragraph("<b>Amount Paid:</b>", meta_bold), Paragraph(f"₹{invoice.amount_paid:,.2f}", cell_right)],
        ["", Paragraph("<b>Balance Due:</b>", meta_bold), Paragraph(f"<b><font color='#dc2626'>₹{invoice.balance_due:,.2f}</font></b>", cell_right)],
    ]

    totals_table = Table(totals_box_data, colWidths=[100 * mm, 45 * mm, 45 * mm])
    totals_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, -1)),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94a3b8')),
        ('INNERGRID', (1, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f8fafc')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 4 * mm))

    # Terms and Signatures
    terms = company_setting.terms_and_conditions if company_setting and company_setting.terms_and_conditions else (
        "1. Goods once sold will not be taken back without valid reason.\n"
        "2. Warranty is as per manufacturer terms."
    )
    terms_formatted = terms.replace("\n", "<br/>")

    footer_data = [
        [
            Paragraph(f"<b>Terms & Conditions:</b><br/>{terms_formatted}", ParagraphStyle('Terms', parent=styles['Normal'], fontName=font_reg, fontSize=7.5, leading=9.5, textColor=colors.HexColor('#475569'))),
            Paragraph(f"For <b>{comp_name}</b><br/><br/><br/><br/><b>Authorized Signatory</b>", ParagraphStyle('Sign', parent=styles['Normal'], fontName=font_reg, fontSize=8.5, leading=11, alignment=1, textColor=colors.HexColor('#1e293b')))
        ]
    ]
    footer_table = Table(footer_data, colWidths=[120 * mm, 70 * mm])
    footer_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(footer_table)

    doc.build(story)
    return buffer.getvalue()
