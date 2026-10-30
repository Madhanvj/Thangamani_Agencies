import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:1234@localhost:5432/thangamani_agencies"
    SECRET_KEY: str = "thangamani-secret-key-change-in-production-2026-super-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    COMPANY_STATE: str = "Tamil Nadu"
    COMPANY_NAME: str = "Thangamani Agencies"
    COMPANY_GSTIN: str = "33ABCDE1234F1Z5"
    COMPANY_PHONE: str = "+91 9500656805"
    COMPANY_EMAIL: str = "madhansankar02@gmail.com"
    COMPANY_ADDRESS: str = "15, Arumuga Achari St, Dharmapuri - 636701"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
    )


settings = Settings()
