from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import normalize_origin, settings

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def origin_allowed(origin: str, allowed: list[str]) -> bool:
    return normalize_origin(origin) in allowed


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Defence in depth next to SameSite=Lax and the CSRF token.

    A browser always sends Origin on cross-site unsafe requests, so a
    present-but-foreign Origin is rejected before any routing happens.
    A missing Origin (curl, tests, server-to-server) is allowed; the
    CSRF token still protects those routes.
    """

    async def dispatch(self, request, call_next):
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin")
            if origin is not None and not origin_allowed(origin, settings.allowed_origins_list):
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        return await call_next(request)
    