from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models import CompanySetting, UserRole
from app.schemas.company_setting import CompanySettingOut, CompanySettingUpdate
from app.api.deps import get_current_user, require_roles
from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/company", response_model=CompanySettingOut)
def get_company_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    setting = db.query(CompanySetting).first()
    if not setting:
        # Create default from settings
        setting = CompanySetting(
            company_name=settings.COMPANY_NAME,
            gstin=settings.COMPANY_GSTIN,
            phone=settings.COMPANY_PHONE,
            email=settings.COMPANY_EMAIL,
            address=settings.COMPANY_ADDRESS,
            state=settings.COMPANY_STATE,
            terms_and_conditions="1. Goods once sold will not be taken back without valid reason.\n2. Warranty is as per manufacturer terms."
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.put("/company", response_model=CompanySettingOut)
def update_company_settings(
    setting_in: CompanySettingUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles(UserRole.ADMIN))
):
    setting = db.query(CompanySetting).first()
    if not setting:
        setting = CompanySetting()
        db.add(setting)

    if setting_in.company_name is not None:
        setting.company_name = setting_in.company_name.strip()
    if setting_in.gstin is not None:
        setting.gstin = setting_in.gstin.strip().upper()
    if setting_in.phone is not None:
        setting.phone = setting_in.phone.strip()
    if setting_in.email is not None:
        setting.email = setting_in.email.strip()
    if setting_in.address is not None:
        setting.address = setting_in.address.strip()
    if setting_in.state is not None:
        setting.state = setting_in.state.strip()
    if setting_in.terms_and_conditions is not None:
        setting.terms_and_conditions = setting_in.terms_and_conditions

    db.commit()
    db.refresh(setting)
    return setting
