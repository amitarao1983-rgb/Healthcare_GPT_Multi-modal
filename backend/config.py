"""App configuration. API key and model settings from environment."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    healthcare_api_key: str = ""
    default_temperature: float = 0.6
    default_max_tokens: int = 2048
    default_model: str = "gpt-4o"


@lru_cache
def get_settings() -> Settings:
    return Settings()
