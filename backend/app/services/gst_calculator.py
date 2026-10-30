from decimal import Decimal, ROUND_HALF_UP
from num2words import num2words
from app.models.invoice import DiscountType


def quantize_2dec(val: Decimal) -> Decimal:
    """Round half-up to exactly 2 decimal places."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantize_int(val: Decimal) -> Decimal:
    """Round half-up to nearest whole integer."""
    return val.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def calculate_line_item(
    unit_price: Decimal,
    quantity: int,
    gst_rate: Decimal,
    discount_type: DiscountType,
    discount_value: Decimal,
    is_interstate: bool,
    price_includes_gst: bool = True
) -> dict:
    """
    Calculate taxable value, GST split, and line total.
    
    If price_includes_gst = TRUE:
      line_gross       = unit_price × quantity
      line_after_disc  = line_gross − discount          (discount applied on GST-inclusive amount)
      taxable_value    = line_after_disc ÷ (1 + gst_rate/100) -> round to 2 decimals
      total_gst        = line_after_disc − taxable_value      (derived by subtraction, no drift)
      line_total       = line_after_disc                      (customer pays exactly this)

    If price_includes_gst = FALSE:
      taxable_value    = (unit_price × quantity) − discount
      total_gst        = taxable_value × gst_rate/100         -> round to 2 decimals
      line_total       = taxable_value + total_gst

    GST split:
      If same state (not is_interstate):
        CGST = total_gst ÷ 2 (round to 2 decimals)
        SGST = total_gst − CGST (ensures exact match, zero 1-paisa drift)
      Else:
        IGST = total_gst; CGST and SGST = 0
    """
    raw_subtotal = quantize_2dec(unit_price * quantity)

    # Calculate discount
    if discount_type == DiscountType.PERCENTAGE:
        discount_amount = quantize_2dec(raw_subtotal * (discount_value / Decimal("100.00")))
    else:
        discount_amount = quantize_2dec(min(discount_value, raw_subtotal))

    if price_includes_gst:
        line_after_disc = raw_subtotal - discount_amount
        if line_after_disc < Decimal("0.00"):
            line_after_disc = Decimal("0.00")
        
        divisor = Decimal("1.00") + (gst_rate / Decimal("100.00"))
        taxable_value = quantize_2dec(line_after_disc / divisor)
        total_gst = line_after_disc - taxable_value
        line_total = line_after_disc
    else:
        taxable_value = quantize_2dec(raw_subtotal - discount_amount)
        if taxable_value < Decimal("0.00"):
            taxable_value = Decimal("0.00")
        
        total_gst = quantize_2dec(taxable_value * (gst_rate / Decimal("100.00")))
        line_total = quantize_2dec(taxable_value + total_gst)

    # GST split
    if is_interstate:
        cgst_rate = Decimal("0.00")
        cgst_amount = Decimal("0.00")
        sgst_rate = Decimal("0.00")
        sgst_amount = Decimal("0.00")
        igst_rate = gst_rate
        igst_amount = total_gst
    else:
        cgst_rate = quantize_2dec(gst_rate / Decimal("2.00"))
        sgst_rate = quantize_2dec(gst_rate / Decimal("2.00"))
        cgst_amount = quantize_2dec(total_gst / Decimal("2.00"))
        sgst_amount = total_gst - cgst_amount  # Guarantees CGST + SGST == total_gst
        igst_rate = Decimal("0.00")
        igst_amount = Decimal("0.00")

    return {
        "raw_subtotal": raw_subtotal,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "discount_amount": discount_amount,
        "taxable_value": taxable_value,
        "total_gst": total_gst,
        "gst_rate": gst_rate,
        "cgst_rate": cgst_rate,
        "cgst_amount": cgst_amount,
        "sgst_rate": sgst_rate,
        "sgst_amount": sgst_amount,
        "igst_rate": igst_rate,
        "igst_amount": igst_amount,
        "line_total": line_total,
        "price_includes_gst": price_includes_gst
    }


def calculate_invoice_totals(line_results: list[dict]) -> dict:
    """Calculate invoice-level totals and tax summary grouped by GST rate."""
    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_taxable = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")
    tax_groups: dict[Decimal, dict] = {}

    for item in line_results:
        subtotal += item["raw_subtotal"]
        total_discount += item["discount_amount"]
        total_taxable += item["taxable_value"]
        total_cgst += item["cgst_amount"]
        total_sgst += item["sgst_amount"]
        total_igst += item["igst_amount"]

        rate = item["gst_rate"]
        if rate not in tax_groups:
            tax_groups[rate] = {
                "gst_rate": rate,
                "taxable_value": Decimal("0.00"),
                "cgst_amount": Decimal("0.00"),
                "sgst_amount": Decimal("0.00"),
                "igst_amount": Decimal("0.00"),
                "total_tax": Decimal("0.00")
            }
        tax_groups[rate]["taxable_value"] += item["taxable_value"]
        tax_groups[rate]["cgst_amount"] += item["cgst_amount"]
        tax_groups[rate]["sgst_amount"] += item["sgst_amount"]
        tax_groups[rate]["igst_amount"] += item["igst_amount"]
        tax_groups[rate]["total_tax"] += item["total_gst"]

    # Tax summary grouped by GST rate
    tax_summary = [
        {
            "gst_rate": r,
            "taxable_value": quantize_2dec(grp["taxable_value"]),
            "cgst_amount": quantize_2dec(grp["cgst_amount"]),
            "sgst_amount": quantize_2dec(grp["sgst_amount"]),
            "igst_amount": quantize_2dec(grp["igst_amount"]),
            "total_tax": quantize_2dec(grp["total_tax"])
        }
        for r, grp in sorted(tax_groups.items(), key=lambda x: x[0])
    ]

    subtotal = quantize_2dec(subtotal)
    total_discount = quantize_2dec(total_discount)
    total_taxable = quantize_2dec(total_taxable)
    total_cgst = quantize_2dec(total_cgst)
    total_sgst = quantize_2dec(total_sgst)
    total_igst = quantize_2dec(total_igst)

    exact_grand_total = total_taxable + total_cgst + total_sgst + total_igst
    rounded_grand_total = quantize_int(exact_grand_total).quantize(Decimal("0.01"))
    round_off = quantize_2dec(rounded_grand_total - exact_grand_total)

    words = convert_amount_to_words(rounded_grand_total)

    return {
        "subtotal": subtotal,
        "total_discount": total_discount,
        "total_taxable": total_taxable,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_igst": total_igst,
        "round_off": round_off,
        "grand_total": rounded_grand_total,
        "grand_total_words": words,
        "tax_summary": tax_summary
    }


def convert_amount_to_words(amount: Decimal) -> str:
    """Convert amount to Indian Currency words string, e.g. 'Rupees Twelve Thousand Five Hundred Only'"""
    try:
        total_int = int(amount)
        paise = int(round((amount - total_int) * 100))
        
        words = num2words(total_int, lang='en_IN').replace("-", " ").title()
        res = f"Rupees {words}"
        if paise > 0:
            paise_words = num2words(paise, lang='en_IN').replace("-", " ").title()
            res += f" and {paise_words} Paise"
        res += " Only"
        return res
    except Exception:
        words = num2words(int(amount)).replace("-", " ").title()
        return f"Rupees {words} Only"
