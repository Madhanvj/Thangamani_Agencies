from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class CustomerBase(BaseModel):
    name: str
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    state: str = "Tamil Nadu"
    gstin: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    state: str | None = None
    gstin: str | None = None


class CustomerOut(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    total_invoices: int = 0
    total_spent: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class CustomerListOut(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    limit: int
    pages: int
