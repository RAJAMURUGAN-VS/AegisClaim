from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # Application Environment
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "dev"

    # PostgreSQL Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_DB: str = "aegisclaim"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: PostgresDsn | None = None

    def __init__(self, **values):
        super().__init__(**values)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017/aegisclaim"

    # Redis
    REDIS_URL: RedisDsn = "redis://localhost:6379/0"

    # AWS Credentials (optional when using open-source OCR)
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET_NAME: Optional[str] = None

    # JWT Authentication
    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # AI/Business Logic Settings
    OCR_CONFIDENCE_THRESHOLD: float = 0.7
    SCORE_AUTO_APPROVE_THRESHOLD: int = 85
    SCORE_HUMAN_REVIEW_MIN_THRESHOLD: int = 60

    # Perplexity Sonar API (allows fallback from VITE_SONAR_API in existing env files)
    SONAR_API_KEY: Optional[str] = None
    VITE_SONAR_API: Optional[str] = None
    SONAR_MODEL: str = "sonar"


settings = Settings()
