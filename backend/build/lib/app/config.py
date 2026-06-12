from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/crm"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "secret"
    jwt_algorithm: str = "HS256"
    anthropic_api_key: str = "dummy"
    channel_stub_url: str = "http://localhost:8001"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env")
