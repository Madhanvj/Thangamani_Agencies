from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


class CompanySetting(Base):
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(150), nullable=False, default="Thangamani Agencies")
    gstin: Mapped[str] = mapped_column(String(20), nullable=False, default="33ABCDE1234F1Z5")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, default="+91 9500656805")
    email: Mapped[str] = mapped_column(String(100), nullable=False, default="madhansankar02@gmail.com")
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="15, Arumuga Achari St, Dharmapuri, Tamil Nadu 636701")
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="Tamil Nadu")
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True, default="1. Goods once sold will not be taken back without valid reason.\n2. Warranty is as per manufacturer terms.\n3. Subject to Coimbatore/Pollachi jurisdiction.")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
