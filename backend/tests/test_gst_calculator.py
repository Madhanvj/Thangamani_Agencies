from decimal import Decimal
import random
import pytest
from app.models.invoice import DiscountType
from app.services.gst_calculator import (
    calculate_line_item, calculate_invoice_totals, convert_amount_to_words, quantize_2dec
)


def test_mandatory_case_1_tv_inclusive_same_state():
    """
    Mandatory Test Case 1:
    TV, price 12,500, qty 1, GST 18%, price_includes_gst = TRUE, same state:
    taxable_value = 10,593.22 | total_gst = 1,906.78 | CGST = 953.39 | SGST = 953.39 | line_total = 12,500.00
    """
    res = calculate_line_item(
        unit_price=Decimal("12500.00"),
        quantity=1,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    assert res["taxable_value"] == Decimal("10593.22")
    assert res["total_gst"] == Decimal("1906.78")
    assert res["cgst_amount"] == Decimal("953.39")
    assert res["sgst_amount"] == Decimal("953.39")
    assert res["igst_amount"] == Decimal("0.00")
    assert res["line_total"] == Decimal("12500.00")


def test_mandatory_case_2_tv_inclusive_different_state():
    """
    Mandatory Test Case 2:
    Same product, different state:
    taxable_value = 10,593.22 | IGST = 1,906.78 | CGST = 0 | SGST = 0 | line_total = 12,500.00
    """
    res = calculate_line_item(
        unit_price=Decimal("12500.00"),
        quantity=1,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=True,
        price_includes_gst=True
    )
    assert res["taxable_value"] == Decimal("10593.22")
    assert res["total_gst"] == Decimal("1906.78")
    assert res["igst_amount"] == Decimal("1906.78")
    assert res["cgst_amount"] == Decimal("0.00")
    assert res["sgst_amount"] == Decimal("0.00")
    assert res["line_total"] == Decimal("12500.00")


def test_mandatory_case_3_tv_exclusive_same_state():
    """
    Mandatory Test Case 3:
    Same TV, price_includes_gst = FALSE, same state:
    taxable_value = 12,500.00 | CGST = 1,125.00 | SGST = 1,125.00 | line_total = 14,750.00
    """
    res = calculate_line_item(
        unit_price=Decimal("12500.00"),
        quantity=1,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=False
    )
    assert res["taxable_value"] == Decimal("12500.00")
    assert res["total_gst"] == Decimal("2250.00")
    assert res["cgst_amount"] == Decimal("1125.00")
    assert res["sgst_amount"] == Decimal("1125.00")
    assert res["line_total"] == Decimal("14750.00")


def test_mandatory_case_4_qty_3_inclusive():
    """
    Mandatory Test Case 4:
    Quantity 3 at 12,500 inclusive, 18% GST:
    gross = 37,500.00 | taxable_value = 31,779.66 | total_gst = 5,720.34 | CGST = 2,860.17 | SGST = 2,860.17
    """
    res = calculate_line_item(
        unit_price=Decimal("12500.00"),
        quantity=3,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    assert res["raw_subtotal"] == Decimal("37500.00")
    assert res["taxable_value"] == Decimal("31779.66")
    assert res["total_gst"] == Decimal("5720.34")
    assert res["cgst_amount"] == Decimal("2860.17")
    assert res["sgst_amount"] == Decimal("2860.17")
    assert res["line_total"] == Decimal("37500.00")


def test_mandatory_case_5_inclusive_with_discount():
    """
    Mandatory Test Case 5:
    Inclusive price with a discount of 500 on qty 1 (12,500):
    amount after discount = 12,000.00 | taxable_value = 10,169.49 | total_gst = 1,830.51
    """
    res = calculate_line_item(
        unit_price=Decimal("12500.00"),
        quantity=1,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.AMOUNT,
        discount_value=Decimal("500.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    assert res["line_total"] == Decimal("12000.00")
    assert res["taxable_value"] == Decimal("10169.49")
    assert res["total_gst"] == Decimal("1830.51")
    assert res["cgst_amount"] + res["sgst_amount"] == res["total_gst"]


def test_mandatory_case_6_odd_paisa_no_mismatch_loop():
    """
    Mandatory Test Case 6:
    Odd paisa case: ensure CGST + SGST == total_gst exactly in every test
    (assert this in a loop over many random prices and rates).
    """
    rates = [Decimal("0.00"), Decimal("5.00"), Decimal("12.00"), Decimal("18.00"), Decimal("28.00")]
    rng = random.Random(42)

    for _ in range(200):
        price = Decimal(str(round(rng.uniform(1.0, 150000.0), 2)))
        qty = rng.randint(1, 10)
        rate = rng.choice(rates)
        inc_gst = rng.choice([True, False])
        disc_val = Decimal(str(round(rng.uniform(0.0, 500.0), 2))) if rng.choice([True, False]) else Decimal("0.00")

        res = calculate_line_item(
            unit_price=price,
            quantity=qty,
            gst_rate=rate,
            discount_type=DiscountType.AMOUNT,
            discount_value=disc_val,
            is_interstate=False,
            price_includes_gst=inc_gst
        )

        assert res["cgst_amount"] + res["sgst_amount"] == res["total_gst"], (
            f"Mismatch: CGST ({res['cgst_amount']}) + SGST ({res['sgst_amount']}) != Total GST ({res['total_gst']})"
        )


def test_mandatory_case_7_mixed_invoice_tax_summary():
    """
    Mandatory Test Case 7:
    Mixed invoice with items at 5%, 18% and 28%: tax summary groups correctly by rate.
    """
    item1 = calculate_line_item(
        unit_price=Decimal("1050.00"),
        quantity=1,
        gst_rate=Decimal("5.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    # 1050 / 1.05 = 1000.00 taxable, 50.00 tax (25 CGST + 25 SGST)

    item2 = calculate_line_item(
        unit_price=Decimal("11800.00"),
        quantity=1,
        gst_rate=Decimal("18.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    # 11800 / 1.18 = 10000.00 taxable, 1800.00 tax (900 CGST + 900 SGST)

    item3 = calculate_line_item(
        unit_price=Decimal("12800.00"),
        quantity=1,
        gst_rate=Decimal("28.00"),
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("0.00"),
        is_interstate=False,
        price_includes_gst=True
    )
    # 12800 / 1.28 = 10000.00 taxable, 2800.00 tax (1400 CGST + 1400 SGST)

    totals = calculate_invoice_totals([item1, item2, item3])

    summary = totals["tax_summary"]
    assert len(summary) == 3

    assert summary[0]["gst_rate"] == Decimal("5.00")
    assert summary[0]["taxable_value"] == Decimal("1000.00")
    assert summary[0]["total_tax"] == Decimal("50.00")
    assert summary[0]["cgst_amount"] == Decimal("25.00")
    assert summary[0]["sgst_amount"] == Decimal("25.00")

    assert summary[1]["gst_rate"] == Decimal("18.00")
    assert summary[1]["taxable_value"] == Decimal("10000.00")
    assert summary[1]["total_tax"] == Decimal("1800.00")

    assert summary[2]["gst_rate"] == Decimal("28.00")
    assert summary[2]["taxable_value"] == Decimal("10000.00")
    assert summary[2]["total_tax"] == Decimal("2800.00")

    assert totals["total_taxable"] == Decimal("21000.00")
    assert totals["grand_total"] == Decimal("25650.00")
