from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Payment amount")
    payment_mode: str = "Cash"
    reference_number: str | None = None
    notes: str | None = None


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    payment_date: datetime
    amount: Decimal
    payment_mode: str
    reference_number: str | None = None
    notes: str | None = None
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
