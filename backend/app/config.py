from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://handwerker:changeme@postgres:5432/handwerkerbrief"

    # Security
    SECRET_KEY: str = "supersecretkey-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@handwerkerbrief.de"

    # App
    UPLOAD_DIR: str = "/app/uploads"
    APP_URL: str = "http://localhost"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""
    STRIPE_SUCCESS_URL: str = "http://localhost/dashboard?upgraded=true"
    STRIPE_CANCEL_URL: str = "http://localhost/settings?cancelled=true"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
