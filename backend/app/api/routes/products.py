import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.db import get_db
from app.models import Product, StockMovement, MovementType, UserRole
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut, ProductListOut
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductListOut)
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    category_id: int | None = None,
    is_low_stock: bool | None = None,
    is_active: bool | None = True,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Product)

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if is_low_stock:
        query = query.filter(Product.current_stock <= Product.reorder_level)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(s),
                Product.sku.ilike(s),
                Product.brand.ilike(s),
                Product.model.ilike(s),
                Product.hsn_code.ilike(s)
            )
        )

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    db_items = query.order_by(Product.name.asc()).offset(offset).limit(limit).all()

    items = []
    for p in db_items:
        p_dict = ProductOut.model_validate(p)
        p_dict.is_low_stock = p.current_stock <= p.reorder_level
        items.append(p_dict)

    return ProductListOut(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    p_dict = ProductOut.model_validate(product)
    p_dict.is_low_stock = product.current_stock <= product.reorder_level
    return p_dict


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER))
):
    # Check unique SKU
    existing = db.query(Product).filter(Product.sku.ilike(product_in.sku.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{product_in.sku}' already exists.")

    product = Product(
        name=product_in.name.strip(),
        sku=product_in.sku.strip().upper(),
        category_id=product_in.category_id,
        brand=product_in.brand.strip(),
        model=product_in.model.strip(),
        hsn_code=product_in.hsn_code.strip(),
        unit_price=product_in.unit_price,
        gst_rate=product_in.gst_rate,
        current_stock=product_in.current_stock,
        reorder_level=product_in.reorder_level,
        is_active=product_in.is_active,
        price_includes_gst=product_in.price_includes_gst
    )
    db.add(product)
    db.flush()

    if product.current_stock > 0:
        movement = StockMovement(
            product_id=product.id,
            type=MovementType.IN,
            quantity=product.current_stock,
            reference="Initial stock on product creation",
            created_by=current_user.id
        )
        db.add(movement)

    db.commit()
    db.refresh(product)
    p_out = ProductOut.model_validate(product)
    p_out.is_low_stock = product.current_stock <= product.reorder_level
    return p_out


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product_in.sku and product_in.sku.strip().upper() != product.sku:
        existing = db.query(Product).filter(Product.sku.ilike(product_in.sku.strip())).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"SKU '{product_in.sku}' is already in use.")
        product.sku = product_in.sku.strip().upper()

    if product_in.name is not None:
        product.name = product_in.name.strip()
    if product_in.category_id is not None:
        product.category_id = product_in.category_id
    if product_in.brand is not None:
        product.brand = product_in.brand.strip()
    if product_in.model is not None:
        product.model = product_in.model.strip()
    if product_in.hsn_code is not None:
        product.hsn_code = product_in.hsn_code.strip()
    if product_in.unit_price is not None:
        product.unit_price = product_in.unit_price
    if product_in.gst_rate is not None:
        product.gst_rate = product_in.gst_rate
    if product_in.reorder_level is not None:
        product.reorder_level = product_in.reorder_level
    if product_in.is_active is not None:
        product.is_active = product_in.is_active
    if product_in.price_includes_gst is not None:
        product.price_includes_gst = product_in.price_includes_gst

    db.commit()
    db.refresh(product)
    p_out = ProductOut.model_validate(product)
    p_out.is_low_stock = product.current_stock <= product.reorder_level
    return p_out


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete / deactivate
    product.is_active = False
    db.commit()
    return {"message": f"Product '{product.name}' deactivated successfully."}
