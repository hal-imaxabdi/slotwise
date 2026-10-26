from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

MAX_PASSWORD_LENGTH = 128

_hasher = PasswordHasher()  # argon2id with library defaults

# Hash of a throwaway password, computed once at import. Used only to
# burn the same CPU time when the email is unknown.
_DUMMY_HASH = _hasher.hash("dummy-password-for-timing-only")


def hash_password(password: str) -> str:
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError("password too long")
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """True only if the password matches. Never raises on bad input."""
    if len(password) > MAX_PASSWORD_LENGTH:
        return False
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        # VerifyMismatchError is a subclass of VerificationError.
        # InvalidHashError covers garbage and the seed marker.
        return False


def needs_rehash(stored_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return False


def dummy_verify(password: str) -> None:
    """Spend roughly the time of a real verify. Result is ignored."""
    verify_password(password, _DUMMY_HASH)
    