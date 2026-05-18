"""
Extension-oriented authentication and session endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.app.core.dependencies import get_db, get_user_id
from backend.app.core.extension_auth import (
    device_auth_store,
    generate_extension_access_token,
)
from backend.app.models.user import User, UserCredentials

import bcrypt


router = APIRouter()


class DeviceStartRequest(BaseModel):
    email: EmailStr


class DeviceVerifyRequest(BaseModel):
    user_code: str
    email: EmailStr
    password: str


class DevicePollRequest(BaseModel):
    device_code: str


@router.post("/auth/device/start")
def start_device_auth(request: DeviceStartRequest):
    session = device_auth_store.create(email=request.email, ttl_seconds=600)
    return {
        **session,
        "verification_uri": "/api/v1/ext/auth/device/verify",
        "message": "Open verification URI in DEX web and approve this code.",
    }


@router.post("/auth/device/verify")
def verify_device_auth(request: DeviceVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_creds = db.query(UserCredentials).filter(UserCredentials.user_id == user.id).first()
    if not user_creds:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(
        request.password.encode("utf-8"),
        user_creds.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    approved = device_auth_store.approve(request.user_code, user.id)
    if not approved:
        raise HTTPException(status_code=400, detail="Invalid or expired user code")

    return {"status": "approved"}


@router.post("/auth/device/poll")
def poll_device_auth(request: DevicePollRequest):
    result = device_auth_store.poll(request.device_code)
    status = result.get("status")

    if status == "approved":
        user_id = result["user_id"]
        token = generate_extension_access_token(user_id=user_id, ttl_seconds=3600)
        return {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_id": user_id,
        }
    if status == "authorization_pending":
        raise HTTPException(status_code=428, detail="authorization_pending")
    if status == "expired_token":
        raise HTTPException(status_code=400, detail="expired_token")
    raise HTTPException(status_code=400, detail="invalid_device_code")


@router.get("/session/validate")
def validate_extension_session(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_active": user.is_active,
        }
    }
