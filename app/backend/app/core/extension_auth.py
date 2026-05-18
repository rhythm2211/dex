"""
Extension authentication utilities.

Provides:
- OAuth device-code style temporary flow
- Signed access tokens for extension API calls
"""
import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from typing import Any, Dict, Optional

from backend.app.core.config import settings


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("utf-8"))


def _get_secret() -> str:
    # Dedicated extension secret is preferred; fallback avoids hard-fail in dev.
    return getattr(settings, "EXTENSION_AUTH_SECRET", "") or settings.POSTGRES_PASSWORD or "dex-extension-dev-secret"


def generate_extension_access_token(user_id: str, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + ttl_seconds,
        "scope": "dex:extension",
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_encoded = _b64url_encode(payload_json)
    signature = hmac.new(
        _get_secret().encode("utf-8"),
        payload_encoded.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"dex_ext_{payload_encoded}.{_b64url_encode(signature)}"


def validate_extension_access_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not token.startswith("dex_ext_"):
        return None
    try:
        encoded = token[len("dex_ext_"):]
        payload_b64, sig_b64 = encoded.split(".", 1)
        expected_sig = hmac.new(
            _get_secret().encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if payload.get("scope") != "dex:extension":
            return None
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        return payload
    except Exception:
        return None


class DeviceAuthStore:
    """In-memory store for device auth sessions."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, email: str, ttl_seconds: int = 600) -> Dict[str, Any]:
        now = int(time.time())
        device_code = secrets.token_urlsafe(32)
        user_code = secrets.token_hex(4).upper()
        with self._lock:
            self._sessions[device_code] = {
                "device_code": device_code,
                "user_code": user_code,
                "email": email.strip().lower(),
                "created_at": now,
                "expires_at": now + ttl_seconds,
                "status": "pending",
                "user_id": None,
            }
        return {
            "device_code": device_code,
            "user_code": user_code,
            "expires_in": ttl_seconds,
            "interval": 5,
        }

    def approve(self, user_code: str, user_id: str) -> bool:
        code = user_code.strip().upper()
        with self._lock:
            for session in self._sessions.values():
                if session["user_code"] == code and session["status"] == "pending":
                    if session["expires_at"] <= int(time.time()):
                        session["status"] = "expired"
                        return False
                    session["status"] = "approved"
                    session["user_id"] = user_id
                    return True
        return False

    def poll(self, device_code: str) -> Dict[str, Any]:
        with self._lock:
            session = self._sessions.get(device_code)
            if not session:
                return {"status": "invalid_device_code"}
            if session["expires_at"] <= int(time.time()):
                session["status"] = "expired"
                return {"status": "expired_token"}
            if session["status"] == "approved":
                return {"status": "approved", "user_id": session["user_id"]}
            return {"status": "authorization_pending"}


device_auth_store = DeviceAuthStore()
