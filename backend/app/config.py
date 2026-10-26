from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the repo root, two levels above this file's folder
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    database_url: str

    # Auth / sessions
    session_cookie_name: str = "slotwise_session"
    session_ttl_hours: int = 168  # absolute lifetime: 7 days
    cookie_secure: bool = False  # MUST be true in production (HTTPS only)
    cookie_samesite: str = "lax"

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()
