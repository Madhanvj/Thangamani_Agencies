from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from app.models.invoice import InvoiceStatus, PaymentMode, DiscountType
from app.schemas.customer import CustomerOut


class InvoiceItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: Decimal | None = Field(None, ge=Decimal("0.00"), description="Optional override of selling price")
    price_includes_gst: bool | None = None
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))


class InvoiceItemOut(BaseModel):
    id: int
    invoice_id: int
    product_id: int
    product_name: str
    sku: str
    hsn_code: str
    quantity: int
    unit_price: Decimal
    price_includes_gst: bool = True
    discount_type: DiscountType
    discount_value: Decimal
    discount_amount: Decimal
    taxable_value: Decimal
    gst_rate: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class CustomerInlineCreate(BaseModel):
    id: int | None = None
    name: str
    phone: str
    email: str | None = None
    address: str | None = None
    state: str = "Tamil Nadu"
    gstin: str | None = None


class InvoiceCreate(BaseModel):
    customer: CustomerInlineCreate
    items: list[InvoiceItemCreate] = Field(..., min_length=1)
    payment_mode: PaymentMode = PaymentMode.CASH
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    notes: str | None = None


class InvoicePreviewRequest(BaseModel):
    customer_state: str = "Tamil Nadu"
    items: list[InvoiceItemCreate]


class InvoicePreviewOut(BaseModel):
    subtotal: Decimal
    total_discount: Decimal
    total_taxable: Decimal
    is_interstate: bool
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    round_off: Decimal
    grand_total: Decimal
    grand_total_words: str
    items: list[dict]
    tax_summary: list[dict] = []


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    invoice_date: datetime
    status: InvoiceStatus
    payment_mode: PaymentMode
    company_state: str
    customer_state: str
    is_interstate: bool
    subtotal: Decimal
    total_discount: Decimal
    total_taxable: Decimal
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    round_off: Decimal
    grand_total: Decimal
    grand_total_words: str
    amount_paid: Decimal
    balance_due: Decimal
    notes: str | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime

    customer: CustomerOut | None = None
    items: list[InvoiceItemOut] = []
    tax_summary: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


class InvoiceListOut(BaseModel):
    items: list[InvoiceOut]
    total: int
    page: int
    limit: int
    pages: int
