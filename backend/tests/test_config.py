import pytest
from pydantic import ValidationError

from app.config import Settings

DB_URL = "postgresql+psycopg://u:p@localhost:5432/x"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    # Stop real environment variables leaking into these tests.
    for name in ("ENVIRONMENT", "COOKIE_SECURE", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)


def make(**kwargs) -> Settings:
    # _env_file=None: ignore the real repo-root .env.
    return Settings(_env_file=None, database_url=DB_URL, **kwargs)


def test_default_environment_is_development():
    s = make()
    assert s.environment == "development"
    assert s.cookie_secure is False


def test_production_with_insecure_cookie_is_refused():
    with pytest.raises(ValidationError, match="cookie_secure must be true"):
        make(environment="production", cookie_secure=False)


def test_production_with_secure_cookie_is_accepted():
    s = make(environment="production", cookie_secure=True)
    assert s.environment == "production"


@pytest.mark.parametrize("env", ["development", "test"])
def test_non_production_allows_insecure_cookie(env):
    assert make(environment=env, cookie_secure=False).cookie_secure is False


def test_unknown_environment_is_rejected():
    with pytest.raises(ValidationError):
        make(environment="prod")


def test_environment_variable_is_read_and_validated(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValidationError, match="cookie_secure must be true"):
        make()


def test_production_via_env_vars_passes_with_secure_cookie(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    assert make().environment == "production"
    