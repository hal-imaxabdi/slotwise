import pytest

from app.models import User
from app.security.passwords import hash_password

PW = "correct horse battery staple"
PW_HASH = hash_password(PW)  # hash once; argon2 is slow


def add_user(
    db, email: str, full_name: str, role: str = "customer", active: bool = True
) -> User:
    user = User(
        email=email,
        password_hash=PW_HASH,
        full_name=full_name,
        role=role,
        is_active=active,
    )
    db.add(user)
    db.commit()
    return user


def login(client, email: str) -> None:
    r = client.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200


def staff_client(client, db, role: str = "staff"):
    add_user(db, f"{role}@example.com", f"{role.title()} Person", role=role)
    login(client, f"{role}@example.com")
    return client


def emails(response) -> list[str]:
    return [item["email"] for item in response.json()]


def test_requires_login(client):
    r = client.get("/staff/customers")
    assert r.status_code == 401


def test_customer_role_is_403(client, db):
    add_user(db, "c@example.com", "Cust")
    login(client, "c@example.com")
    assert client.get("/staff/customers").status_code == 403


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_and_admin_allowed(client, db, role):
    staff_client(client, db, role)
    r = client.get("/staff/customers")
    assert r.status_code == 200
    assert r.json() == []


def test_only_active_customers_are_returned(client, db):
    add_user(db, "active@example.com", "Active Cust")
    add_user(db, "gone@example.com", "Gone Cust", active=False)
    add_user(db, "other-staff@example.com", "Other Staff", role="staff")
    staff_client(client, db, "admin")
    r = client.get("/staff/customers")
    assert r.status_code == 200
    assert emails(r) == ["active@example.com"]


def test_search_by_name_is_case_insensitive_and_trimmed(client, db):
    add_user(db, "alice@example.com", "Alice Wong")
    add_user(db, "bob@example.com", "Bob Stone")
    staff_client(client, db)
    r = client.get("/staff/customers", params={"q": "  ALI "})
    assert emails(r) == ["alice@example.com"]


def test_search_by_email(client, db):
    add_user(db, "bob@example.com", "Robert Stone")
    add_user(db, "carol@example.com", "Carol Diaz")
    staff_client(client, db)
    r = client.get("/staff/customers", params={"q": "bob@"})
    assert emails(r) == ["bob@example.com"]


def test_percent_is_literal_not_wildcard(client, db):
    add_user(db, "p1@example.com", "100% Cotton")
    add_user(db, "p2@example.com", "1000 Cotton")
    staff_client(client, db)
    r = client.get("/staff/customers", params={"q": "100%"})
    assert emails(r) == ["p1@example.com"]


def test_underscore_is_literal_not_wildcard(client, db):
    add_user(db, "u1@example.com", "a_c")
    add_user(db, "u2@example.com", "abc")
    staff_client(client, db)
    r = client.get("/staff/customers", params={"q": "a_c"})
    assert emails(r) == ["u1@example.com"]


def test_results_ordered_by_name_then_email(client, db):
    add_user(db, "z@example.com", "Same Name")
    add_user(db, "a@example.com", "Same Name")
    add_user(db, "m@example.com", "Aaron First")
    staff_client(client, db)
    r = client.get("/staff/customers")
    assert emails(r) == ["m@example.com", "a@example.com", "z@example.com"]


def test_limit_caps_results(client, db):
    for i in range(3):
        add_user(db, f"user{i}@example.com", f"User {i}")
    staff_client(client, db)
    r = client.get("/staff/customers", params={"limit": 2})
    assert len(r.json()) == 2


@pytest.mark.parametrize("limit", [0, 51])
def test_limit_out_of_range_is_422(client, db, limit):
    staff_client(client, db)
    assert client.get("/staff/customers", params={"limit": limit}).status_code == 422


def test_query_too_long_is_422(client, db):
    staff_client(client, db)
    r = client.get("/staff/customers", params={"q": "x" * 101})
    assert r.status_code == 422


def test_response_exposes_only_id_email_name(client, db):
    add_user(db, "only@example.com", "Only Fields")
    staff_client(client, db)
    item = client.get("/staff/customers").json()[0]
    assert set(item) == {"id", "email", "full_name"}
    