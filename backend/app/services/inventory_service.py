from decimal import Decimal
from sqlalchemy.orm import Session
from app.models import Product, StockMovement, MovementType
from app.schemas.stock import InventoryReportOut, InventoryReportItem


def adjust_stock(
    db: Session,
    product_id: int,
    type: MovementType,
    quantity: int,
    reference: str | None = None,
    user_id: int | None = None
) -> StockMovement:
    """Adjust stock with row-level locking (SELECT ... FOR UPDATE) and record movement."""
    if quantity <= 0:
        raise ValueError("Adjustment quantity must be greater than zero.")

    # Row-level lock on product
    product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
    if not product:
        raise ValueError(f"Product with ID {product_id} not found.")

    if type == MovementType.OUT:
        if product.current_stock < quantity:
            raise ValueError(
                f"Insufficient stock for '{product.name}' (SKU: {product.sku}). "
                f"Requested: {quantity}, Available: {product.current_stock}."
            )
        product.current_stock -= quantity
    elif type == MovementType.IN:
        product.current_stock += quantity
    else:
        raise ValueError(f"Unknown movement type: {type}")

    movement = StockMovement(
        product_id=product.id,
        type=type,
        quantity=quantity,
        reference=reference,
        created_by=user_id
    )
    db.add(movement)
    return movement


def get_low_stock_products(db: Session, skip: int = 0, limit: int = 50) -> tuple[list[Product], int]:
    """Retrieve products where stock <= reorder_level."""
    query = db.query(Product).filter(
        Product.is_active == True,
        Product.current_stock <= Product.reorder_level
    )
    total = query.count()
    items = query.order_by(Product.current_stock.asc()).offset(skip).limit(limit).all()
    return items, total


def get_inventory_report(db: Session) -> InventoryReportOut:
    """Generate aggregate inventory statistics and per-product inventory status."""
    products = db.query(Product).filter(Product.is_active == True).order_by(Product.name.asc()).all()

    total_products = len(products)
    total_stock_units = 0
    total_stock_value = Decimal("0.00")
    low_stock_count = 0
    items: list[InventoryReportItem] = []

    for p in products:
        total_stock_units += p.current_stock
        stock_val = Decimal(p.current_stock) * p.unit_price
        total_stock_value += stock_val
        is_low = p.current_stock <= p.reorder_level
        if is_low:
            low_stock_count += 1

        recent_count = db.query(StockMovement).filter(StockMovement.product_id == p.id).count()

        items.append(
            InventoryReportItem(
                product_id=p.id,
                name=p.name,
                sku=p.sku,
                category_name=p.category.name if p.category else "Uncategorized",
                brand=p.brand,
                unit_price=p.unit_price,
                current_stock=p.current_stock,
                reorder_level=p.reorder_level,
                is_low_stock=is_low,
                stock_value=stock_val,
                recent_movements_count=recent_count
            )
        )

    return InventoryReportOut(
        total_products=total_products,
        total_stock_units=total_stock_units,
        total_stock_value=total_stock_value,
        low_stock_count=low_stock_count,
        items=items
    )


def get_stock_movements_for_product(db: Session, product_id: int, limit: int = 100) -> list[StockMovement]:
    return (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
        .all()
    )
