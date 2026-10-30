from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models import UserRole
from app.schemas.stock import StockAdjustmentCreate, StockMovementOut, InventoryReportOut
from app.schemas.product import ProductOut
from app.services.inventory_service import (
    adjust_stock, get_low_stock_products, get_inventory_report, get_stock_movements_for_product
)
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.post("/adjust", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED)
def perform_stock_adjustment(
    adjustment_in: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER))
):
    try:
        movement = adjust_stock(
            db=db,
            product_id=adjustment_in.product_id,
            type=adjustment_in.type,
            quantity=adjustment_in.quantity,
            reference=adjustment_in.reference,
            user_id=current_user.id
        )
        db.commit()
        db.refresh(movement)
        return StockMovementOut(
            id=movement.id,
            product_id=movement.product_id,
            product_name=movement.product.name if movement.product else None,
            sku=movement.product.sku if movement.product else None,
            type=movement.type,
            quantity=movement.quantity,
            reference=movement.reference,
            date=movement.date,
            created_by=movement.created_by,
            created_by_name=movement.creator.full_name if movement.creator else None,
            created_at=movement.created_at
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/low-stock", response_model=list[ProductOut])
def list_low_stock_products(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    offset = (page - 1) * limit
    items, total = get_low_stock_products(db, skip=offset, limit=limit)
    out = []
    for p in items:
        p_dict = ProductOut.model_validate(p)
        p_dict.is_low_stock = True
        out.append(p_dict)
    return out


@router.get("/report", response_model=InventoryReportOut)
def inventory_summary_report(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_inventory_report(db)


@router.get("/movements/{product_id}", response_model=list[StockMovementOut])
def get_product_movements(
    product_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    movements = get_stock_movements_for_product(db, product_id, limit=limit)
    out = []
    for m in movements:
        out.append(
            StockMovementOut(
                id=m.id,
                product_id=m.product_id,
                product_name=m.product.name if m.product else None,
                sku=m.product.sku if m.product else None,
                type=m.type,
                quantity=m.quantity,
                reference=m.reference,
                date=m.date,
                created_by=m.created_by,
                created_by_name=m.creator.full_name if m.creator else None,
                created_at=m.created_at
            )
        )
    return out
