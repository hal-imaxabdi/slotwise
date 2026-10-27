from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the repo root, two levels above this file's folder
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def normalize_origin(value: str) -> str:
    return value.strip().rstrip("/").lower()


class Settings(BaseSettings):
    database_url: str

    # Deployment environment. Anything but "production" is lenient.
    environment: Literal["development", "test", "production"] = "development"

    # Auth / sessions
    session_cookie_name: str = "slotwise_session"
    session_ttl_hours: int = 168  # absolute lifetime: 7 days
    cookie_secure: bool = False  # MUST be true in production (HTTPS only)
    cookie_samesite: str = "lax"

    # Browser origins allowed to make state-changing requests (comma-separated).
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        parts = (normalize_origin(p) for p in self.allowed_origins.split(","))
        return [p for p in parts if p]

    @model_validator(mode="after")
    def _refuse_insecure_production(self) -> "Settings":
        if self.environment == "production" and not self.cookie_secure:
            raise ValueError("cookie_secure must be true when environment is production")
        return self


settings = Settings()
