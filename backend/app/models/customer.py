from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (CheckConstraint("customer_type IN ('RETAIL', 'VENDOR')", name="ck_customer_type"),)

    customer_type: Mapped[str] = mapped_column(String(10), default="RETAIL", server_default="RETAIL", nullable=False, index=True)
    shop_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str] = mapped_column(String(50), default="Tamil Nadu", nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    invoices = relationship("Invoice", back_populates="customer")
