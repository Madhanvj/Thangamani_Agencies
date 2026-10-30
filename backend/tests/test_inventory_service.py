from decimal import Decimal
import pytest
from app.models import Product, Category, MovementType, StockMovement
from app.services.inventory_service import adjust_stock


def test_stock_in_increases_stock(db):
    cat = Category(name="Test Category Inv", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Test TV",
        sku="TEST-SKU-001",
        category_id=cat.id,
        brand="BrandX",
        model="ModelX",
        hsn_code="8528",
        unit_price=Decimal("10000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=5,
        reorder_level=2
    )
    db.add(prod)
    db.flush()

    movement = adjust_stock(
        db=db,
        product_id=prod.id,
        type=MovementType.IN,
        quantity=3,
        reference="Purchase batch 101"
    )
    db.flush()

    assert prod.current_stock == 8
    assert movement.type == MovementType.IN
    assert movement.quantity == 3


def test_stock_out_reduces_stock(db):
    cat = Category(name="Test Category Inv 2", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Test Fridge",
        sku="TEST-SKU-002",
        category_id=cat.id,
        brand="BrandY",
        model="ModelY",
        hsn_code="8418",
        unit_price=Decimal("20000.00"),
        gst_rate=Decimal("18.00"),
        current_stock=10,
        reorder_level=3
    )
    db.add(prod)
    db.flush()

    movement = adjust_stock(
        db=db,
        product_id=prod.id,
        type=MovementType.OUT,
        quantity=4,
        reference="Damage adjustment"
    )
    db.flush()

    assert prod.current_stock == 6
    assert movement.type == MovementType.OUT
    assert movement.quantity == 4


def test_insufficient_stock_raises_error(db):
    cat = Category(name="Test Category Inv 3", description="Testing")
    db.add(cat)
    db.flush()

    prod = Product(
        name="Test AC",
        sku="TEST-SKU-003",
        category_id=cat.id,
        brand="BrandZ",
        model="ModelZ",
        hsn_code="8415",
        unit_price=Decimal("30000.00"),
        gst_rate=Decimal("28.00"),
        current_stock=2,
        reorder_level=1
    )
    db.add(prod)
    db.flush()

    # Attempt to deduct 5 when stock is only 2
    with pytest.raises(ValueError) as excinfo:
        adjust_stock(
            db=db,
            product_id=prod.id,
            type=MovementType.OUT,
            quantity=5,
            reference="Over-sale attempt"
        )

    assert "Insufficient stock" in str(excinfo.value)
    # Stock should remain unchanged
    assert prod.current_stock == 2
