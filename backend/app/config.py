from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/crm"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "super-secret-key-for-dev"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    gemini_api_key: str = "dummy"
    channel_stub_url: str = "http://localhost:8001"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env")
