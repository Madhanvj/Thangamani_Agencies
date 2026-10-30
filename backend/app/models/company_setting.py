from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


class CompanySetting(Base):
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(150), nullable=False, default="Thangamani Agencies")
    gstin: Mapped[str] = mapped_column(String(20), nullable=False, default="33ABCDE1234F1Z5")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, default="+91 98765 43210")
    email: Mapped[str] = mapped_column(String(100), nullable=False, default="contact@thangamaniagencies.com")
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="124, Netaji Road, Pollachi, Tamil Nadu - 642001")
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="Tamil Nadu")
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True, default="1. Goods once sold will not be taken back without valid reason.\n2. Warranty is as per manufacturer terms.\n3. Subject to Coimbatore/Pollachi jurisdiction.")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
