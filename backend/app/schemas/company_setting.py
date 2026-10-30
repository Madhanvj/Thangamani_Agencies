from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CompanySettingBase(BaseModel):
    company_name: str
    gstin: str
    phone: str
    email: str
    address: str
    state: str = "Tamil Nadu"
    terms_and_conditions: str | None = None


class CompanySettingUpdate(BaseModel):
    company_name: str | None = None
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    state: str | None = None
    terms_and_conditions: str | None = None


class CompanySettingOut(CompanySettingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
