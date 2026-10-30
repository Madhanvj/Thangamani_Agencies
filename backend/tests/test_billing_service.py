from decimal import Decimal
import uuid
import pytest
from app.models import Product, Category, Invoice, InvoiceStatus, MovementType, StockMovement
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate, CustomerInlineCreate
from app.models.invoice import PaymentMode, DiscountType
from app.services.billing_service import create_invoice, cancel_invoice, generate_invoice_number


def test_create_invoice_deducts_stock_and_creates_invoice_inclusive(db):
    uid = uuid.uuid4().hex[:6]
    cat = Category(name=f"Test Cat {uid}", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Billing Test Washing Machine",
        sku=f"TEST-WM-{uid}",
        category_id=cat.id,
        brand="BrandW",
        model="ModelW",
        hsn_code="8450",
        unit_price=Decimal("15000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=10,
        reorder_level=2,
        price_includes_gst=True
    )
    db.add(prod)
    db.flush()

    invoice_in = InvoiceCreate(
        customer=CustomerInlineCreate(
            name="Ravi Kumar",
            phone=f"98765{uid[:5]}",
            address="Pollachi Main Road",
            state="Tamil Nadu"
        ),
        items=[
            InvoiceItemCreate(
                product_id=prod.id,
                quantity=3,
                discount_type=DiscountType.PERCENTAGE,
                discount_value=Decimal("0.00")
            )
        ],
        payment_mode=PaymentMode.CASH,
        amount_paid=Decimal("45000.00")  # 15000 * 3 inclusive = 45000.00
    )

    inv = create_invoice(db=db, invoice_in=invoice_in)

    # 1. Verify invoice details
    assert inv.id is not None
    assert inv.status == InvoiceStatus.PAID
    assert inv.subtotal == Decimal("45000.00")
    # 45000 / 1.18 = 38135.59 taxable
    assert inv.total_taxable == Decimal("38135.59")
    # 45000 - 38135.59 = 6864.41 total tax (3432.21 CGST + 3432.20 SGST)
    assert inv.total_cgst + inv.total_sgst == Decimal("6864.41")
    assert inv.grand_total == Decimal("45000.00")
    assert inv.balance_due == Decimal("0.00")

    # 2. Verify snapshot on item
    assert inv.items[0].price_includes_gst is True

    # 3. Verify stock deduction
    db.refresh(prod)
    assert prod.current_stock == 7  # 10 - 3

    # 4. Verify stock movement was recorded
    movement = db.query(StockMovement).filter(
        StockMovement.product_id == prod.id,
        StockMovement.type == MovementType.OUT
    ).first()
    assert movement is not None
    assert movement.quantity == 3
    assert inv.invoice_number in movement.reference


def test_create_invoice_deducts_stock_and_creates_invoice_exclusive(db):
    uid = uuid.uuid4().hex[:6]
    cat = Category(name=f"Test Cat Excl {uid}", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Billing Test Microwave",
        sku=f"TEST-MW-{uid}",
        category_id=cat.id,
        brand="BrandMW",
        model="ModelMW",
        hsn_code="8516",
        unit_price=Decimal("10000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=10,
        reorder_level=2,
        price_includes_gst=False
    )
    db.add(prod)
    db.flush()

    invoice_in = InvoiceCreate(
        customer=CustomerInlineCreate(
            name="Exclusive Customer",
            phone=f"98765{uid[:5]}",
            state="Tamil Nadu"
        ),
        items=[
            InvoiceItemCreate(
                product_id=prod.id,
                quantity=1
            )
        ],
        payment_mode=PaymentMode.CASH,
        amount_paid=Decimal("11800.00")  # 10000 + 18% = 11800.00
    )

    inv = create_invoice(db=db, invoice_in=invoice_in)
    assert inv.total_taxable == Decimal("10000.00")
    assert inv.total_cgst == Decimal("900.00")
    assert inv.total_sgst == Decimal("900.00")
    assert inv.grand_total == Decimal("11800.00")
    assert inv.items[0].price_includes_gst is False


def test_create_invoice_insufficient_stock_fails(db):
    uid = uuid.uuid4().hex[:6]
    cat = Category(name=f"Test Cat Insuff {uid}", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Billing Test Mixer",
        sku=f"TEST-MG-{uid}",
        category_id=cat.id,
        brand="BrandM",
        model="ModelM",
        hsn_code="8509",
        unit_price=Decimal("3000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=2,
        reorder_level=1,
        price_includes_gst=True
    )
    db.add(prod)
    db.commit()
    prod_id = prod.id

    invoice_in = InvoiceCreate(
        customer=CustomerInlineCreate(
            name="Suresh",
            phone=f"98765{uid[:5]}",
            state="Tamil Nadu"
        ),
        items=[
            InvoiceItemCreate(
                product_id=prod_id,
                quantity=5  # Exceeds current stock 2!
            )
        ],
        payment_mode=PaymentMode.CASH,
        amount_paid=Decimal("0.00")
    )

    with pytest.raises(ValueError) as excinfo:
        create_invoice(db=db, invoice_in=invoice_in)

    assert "Insufficient stock" in str(excinfo.value)

    # Stock should remain 2
    rechecked_prod = db.query(Product).filter(Product.id == prod_id).first()
    assert rechecked_prod.current_stock == 2


def test_cancel_invoice_restores_stock(db):
    uid = uuid.uuid4().hex[:6]
    cat = Category(name=f"Test Cat Cancel {uid}", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Cancel Test TV",
        sku=f"TEST-TV-{uid}",
        category_id=cat.id,
        brand="BrandT",
        model="ModelT",
        hsn_code="8528",
        unit_price=Decimal("25000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=5,
        reorder_level=1,
        price_includes_gst=True
    )
    db.add(prod)
    db.flush()

    invoice_in = InvoiceCreate(
        customer=CustomerInlineCreate(
            name="Anand",
            phone=f"98765{uid[:5]}",
            state="Tamil Nadu"
        ),
        items=[
            InvoiceItemCreate(
                product_id=prod.id,
                quantity=2
            )
        ],
        payment_mode=PaymentMode.CASH,
        amount_paid=Decimal("50000.00")
    )

    inv = create_invoice(db=db, invoice_in=invoice_in)
    db.refresh(prod)
    assert prod.current_stock == 3  # Reduced from 5 to 3

    # Cancel invoice
    cancelled_inv = cancel_invoice(db=db, invoice_id=inv.id)
    assert cancelled_inv.status == InvoiceStatus.CANCELLED

    # Stock restored back to 5
    db.refresh(prod)
    assert prod.current_stock == 5

    # Check RESTORE movement entry
    restore_mov = db.query(StockMovement).filter(
        StockMovement.product_id == prod.id,
        StockMovement.type == MovementType.IN
    ).order_by(StockMovement.id.desc()).first()
    assert restore_mov is not None
    assert restore_mov.quantity == 2
    assert "Cancelled Invoice" in restore_mov.reference
