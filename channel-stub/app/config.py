from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/1"
    crm_receipt_url: str = "http://localhost:8000/api/receipts"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
