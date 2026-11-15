from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class CustomerBase(BaseModel):
    customer_type: Literal['RETAIL', 'VENDOR'] = 'RETAIL'
    shop_name: str | None = None
    credit_limit: Decimal | None = Field(None, ge=0)
    name: str
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    state: str = "Tamil Nadu"
    gstin: str | None = None


class CustomerCreate(CustomerBase):
    opening_balance: Decimal = Field(default=Decimal('0.00'), ge=0, max_digits=12, decimal_places=2)


class CustomerUpdate(BaseModel):
    customer_type: Literal['RETAIL', 'VENDOR'] | None = None
    shop_name: str | None = None
    credit_limit: Decimal | None = Field(None, ge=0)
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    state: str | None = None
    gstin: str | None = None


class CustomerOut(CustomerBase):
    opening_balance: Decimal = Decimal('0.00')
    id: int
    created_at: datetime
    updated_at: datetime
    total_invoices: int = 0
    total_spent: float = 0.0
    total_billed: Decimal = Decimal('0')
    total_paid: Decimal = Decimal('0')
    balance_due: Decimal = Decimal('0')

    model_config = ConfigDict(from_attributes=True)


class CustomerListOut(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    limit: int
    pages: int

