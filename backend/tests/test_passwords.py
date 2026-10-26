import pytest
from argon2 import PasswordHasher

from app.security.passwords import (
    MAX_PASSWORD_LENGTH,
    hash_password,
    needs_rehash,
    verify_password,
)

PW = "correct horse battery staple"


def test_hash_then_verify():
    assert verify_password(PW, hash_password(PW)) is True


def test_wrong_password_is_false():
    assert verify_password("wrong", hash_password(PW)) is False


def test_hash_is_argon2id_and_salted():
    h1, h2 = hash_password(PW), hash_password(PW)
    assert h1.startswith("$argon2id$")
    assert h1 != h2


def test_seed_marker_never_verifies():
    assert verify_password(PW, "!unusable-until-auth-milestone") is False


def test_garbage_hash_is_false_not_error():
    assert verify_password(PW, "not-a-hash") is False


def test_too_long_password_rejected():
    long_pw = "a" * (MAX_PASSWORD_LENGTH + 1)
    with pytest.raises(ValueError):
        hash_password(long_pw)
    assert verify_password(long_pw, hash_password(PW)) is False


def test_needs_rehash_true_for_weaker_params():
    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(PW)
    assert needs_rehash(weak) is True


def test_needs_rehash_false_for_current_params():
    assert needs_rehash(hash_password(PW)) is False


def test_needs_rehash_false_for_invalid_hash():
    assert needs_rehash("!unusable-until-auth-milestone") is False
    