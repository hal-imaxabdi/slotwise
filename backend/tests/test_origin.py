import pytest

from app.config import Settings, settings

LOGIN = {"email": "ghost@example.com", "password": "whatever-password"}


def post_login(client, origin=None):
    headers = {"Origin": origin} if origin is not None else {}
    return client.post("/auth/login", json=LOGIN, headers=headers)


def test_no_origin_header_is_allowed(client):
    # Reaches the handler: unknown user -> 401, not the middleware's 403.
    assert post_login(client).status_code == 401


def test_allowed_origin_passes(client):
    assert post_login(client, "http://localhost:5173").status_code == 401


def test_foreign_origin_is_blocked_on_login(client):
    r = post_login(client, "https://evil.example")
    assert r.status_code == 403
    assert r.json() == {"detail": "Origin not allowed"}


def test_null_origin_is_blocked(client):
    assert post_login(client, "null").status_code == 403


def test_configured_origin_is_normalized(client, monkeypatch):
    monkeypatch.setattr(settings, "allowed_origins", " HTTPS://App.Example.com/ ")
    assert post_login(client, "https://app.example.com").status_code == 401
    assert post_login(client, "http://localhost:5173").status_code == 403


def test_safe_methods_are_never_blocked(client):
    r = client.get("/health", headers={"Origin": "https://evil.example"})
    assert r.status_code == 200


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_all_unsafe_methods_are_checked(client, method):
    r = client.request(method, "/appointments", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    assert r.json() == {"detail": "Origin not allowed"}


def test_allowed_origins_list_parsing():
    s = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://u:p@localhost:5432/x",
        allowed_origins=" HTTP://A.com/ ,, http://b.com ",
    )
    assert s.allowed_origins_list == ["http://a.com", "http://b.com"]
    