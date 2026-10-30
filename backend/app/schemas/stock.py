from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from app.models.stock_movement import MovementType


class StockAdjustmentCreate(BaseModel):
    product_id: int
    type: MovementType
    quantity: int = Field(..., gt=0, description="Quantity to add or remove")
    reference: str | None = Field(None, description="Reason / supplier / reference note")


class StockMovementOut(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    sku: str | None = None
    type: MovementType
    quantity: int
    reference: str | None = None
    date: datetime
    created_by: int | None = None
    created_by_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryReportItem(BaseModel):
    product_id: int
    name: str
    sku: str
    category_name: str
    brand: str
    unit_price: Decimal
    current_stock: int
    reorder_level: int
    is_low_stock: bool
    stock_value: Decimal  # current_stock * unit_price
    recent_movements_count: int


class InventoryReportOut(BaseModel):
    total_products: int
    total_stock_units: int
    total_stock_value: Decimal
    low_stock_count: int
    items: list[InventoryReportItem]
