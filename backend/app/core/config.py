from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    FRONTEND_PORT: int = Field(default=5173, ge=1, le=65535)
    BACKEND_PORT: int = Field(default=8001, ge=1, le=65535)
    DATABASE_URL: str = "postgresql://postgres:1234@localhost:5432/thangamani_agencies"
    SECRET_KEY: str = "thangamani-secret-key-change-in-production-2026-super-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    COMPANY_STATE: str = "Tamil Nadu"
    COMPANY_NAME: str = "Thangamani Agencies"
    COMPANY_GSTIN: str = "33ABCDE1234F1Z5"
    COMPANY_PHONE: str = "+91 9500656805"
    COMPANY_EMAIL: str = "madhansankar02@gmail.com"
    COMPANY_ADDRESS: str = "15, Arumuga Achari St, Dharmapuri, Tamil Nadu 636701"

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[3] / '.env',
                  Path(__file__).resolve().parents[2] / '.env'),
        extra="ignore"
    )


settings = Settings()
