from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import String, DateTime, Integer, Numeric, Boolean, ForeignKey, Enum, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base


class InvoiceStatus(str, enum.Enum):
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    UNPAID = "UNPAID"
    CANCELLED = "CANCELLED"


class PaymentMode(str, enum.Enum):
    CASH = "Cash"
    UPI = "UPI"
    CARD = "Card"
    BANK_TRANSFER = "Bank Transfer"
    CREDIT = "Credit"


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    AMOUNT = "amount"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    invoice_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID, nullable=False, index=True)
    payment_mode: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), default=PaymentMode.CASH, nullable=False)

    company_state: Mapped[str] = mapped_column(String(50), default="Tamil Nadu", nullable=False)
    customer_state: Mapped[str] = mapped_column(String(50), default="Tamil Nadu", nullable=False)
    is_interstate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_taxable: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_cgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_sgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_igst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    round_off: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    grand_total_words: Mapped[str] = mapped_column(String(500), nullable=False)

    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    balance_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="invoices")
    creator = relationship("User", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    @property
    def tax_summary(self) -> list[dict]:
        tax_groups: dict[Decimal, dict] = {}
        for itm in self.items:
            rate = itm.gst_rate
            if rate not in tax_groups:
                tax_groups[rate] = {
                    "gst_rate": rate,
                    "taxable_value": Decimal("0.00"),
                    "cgst_amount": Decimal("0.00"),
                    "sgst_amount": Decimal("0.00"),
                    "igst_amount": Decimal("0.00"),
                    "total_tax": Decimal("0.00")
                }
            tax_groups[rate]["taxable_value"] += itm.taxable_value
            tax_groups[rate]["cgst_amount"] += itm.cgst_amount
            tax_groups[rate]["sgst_amount"] += itm.sgst_amount
            tax_groups[rate]["igst_amount"] += itm.igst_amount
            tax_groups[rate]["total_tax"] += (itm.cgst_amount + itm.sgst_amount + itm.igst_amount)

        return [
            {
                "gst_rate": r,
                "taxable_value": grp["taxable_value"],
                "cgst_amount": grp["cgst_amount"],
                "sgst_amount": grp["sgst_amount"],
                "igst_amount": grp["igst_amount"],
                "total_tax": grp["total_tax"]
            }
            for r, grp in sorted(tax_groups.items(), key=lambda x: x[0])
        ]


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_item_unit_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

    # Snapshot fields at time of sale
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    price_includes_gst: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    discount_type: Mapped[DiscountType] = mapped_column(Enum(DiscountType), default=DiscountType.PERCENTAGE, nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    taxable_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    igst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")
