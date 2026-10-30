from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.category import CategoryOut


class ProductBase(BaseModel):
    name: str
    sku: str
    category_id: int
    brand: str
    model: str
    hsn_code: str
    unit_price: Decimal = Field(..., ge=Decimal("0.00"), description="Selling price / MRP")
    gst_rate: Decimal = Field(..., ge=Decimal("0.00"), description="GST rate percentage (0, 5, 12, 18, 28)")
    current_stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=5, ge=0)
    is_active: bool = True
    price_includes_gst: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category_id: int | None = None
    brand: str | None = None
    model: str | None = None
    hsn_code: str | None = None
    unit_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    gst_rate: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    reorder_level: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    price_includes_gst: bool | None = None


class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: CategoryOut | None = None
    is_low_stock: bool = False

    model_config = ConfigDict(from_attributes=True)


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    limit: int
    pages: int
