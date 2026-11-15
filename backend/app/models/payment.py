from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint(
        "(invoice_id IS NOT NULL AND customer_id IS NULL) OR (invoice_id IS NULL AND customer_id IS NOT NULL)",
        name="ck_payment_account"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(50), default="Cash", nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    opening_customer = relationship("Customer", back_populates="opening_payments")
    creator = relationship("User", back_populates="payments")
