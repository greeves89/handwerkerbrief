from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timezone, timedelta
import secrets

from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserCreate, UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.auth import get_current_user
from app.config import settings
from app.services.email_service import (
    send_email, build_welcome_email, build_verification_email,
    build_password_reset_email,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_SETTINGS = {
    "httponly": True,
    "samesite": "lax",
    "secure": settings.ENVIRONMENT == "production",
}


def _set_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        "hb_access_token", access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **COOKIE_SETTINGS,
    )
    response.set_cookie(
        "hb_refresh_token", refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **COOKIE_SETTINGS,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")

    count_result = await db.execute(select(func.count(User.id)))
    user_count = count_result.scalar()
    role = "admin" if user_count == 0 else "member"

    verification_token = secrets.token_urlsafe(32)
    user = User(
        email=data.email.lower(),
        name=data.name,
        password_hash=get_password_hash(data.password),
        role=role,
        is_verified=False,
        verification_token=verification_token,
        verification_token_expires=datetime.now(timezone.utc) + timedelta(hours=48),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    verify_url = f"{settings.APP_URL}/verify-email?token={verification_token}"
    try:
        html, text = build_verification_email(user.name, verify_url)
        await send_email(user.email, "E-Mail verifizieren – HandwerkerBrief", html, text)
    except Exception:
        pass

    # Auto-login after registration (verified check skipped on first login)
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    _set_cookies(response, access_token, refresh_token)

    return user


@router.post("/login", response_model=UserResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Ungültige E-Mail oder Passwort")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Konto deaktiviert")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Bitte verifizieren Sie zuerst Ihre E-Mail-Adresse")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    _set_cookies(response, access_token, refresh_token)

    return user


@router.post("/refresh")
async def refresh_token(
    response: Response,
    hb_refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if not hb_refresh_token:
        raise HTTPException(status_code=401, detail="Kein Refresh-Token")

    payload = decode_token(hb_refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Ungültiger Refresh-Token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    _set_cookies(response, access_token, new_refresh)

    return {"message": "Token erneuert"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("hb_access_token")
    response.delete_cookie("hb_refresh_token")
    return {"message": "Erfolgreich abgemeldet"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Ungültiger Verifizierungslink")

    if user.verification_token_expires and user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verifizierungslink abgelaufen – bitte neu anfordern")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    await db.commit()

    return {"message": "E-Mail erfolgreich verifiziert"}


@router.post("/resend-verification")
async def resend_verification(data: dict, db: AsyncSession = Depends(get_db)):
    email = data.get("email", "").lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and not user.is_verified and user.is_active:
        token = secrets.token_urlsafe(32)
        user.verification_token = token
        user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=48)
        await db.commit()

        verify_url = f"{settings.APP_URL}/verify-email?token={token}"
        try:
            html, text = build_verification_email(user.name, verify_url)
            await send_email(user.email, "E-Mail verifizieren – HandwerkerBrief", html, text)
        except Exception:
            pass

    return {"message": "Falls ein unverifiziertes Konto existiert, wurde die E-Mail erneut gesendet."}


@router.post("/forgot-password")
async def forgot_password(data: dict, db: AsyncSession = Depends(get_db)):
    email = data.get("email", "").lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()

        reset_url = f"{settings.APP_URL}/reset-password?token={token}"
        try:
            html, text = build_password_reset_email(user.name, reset_url)
            await send_email(user.email, "Passwort zurücksetzen – HandwerkerBrief", html, text)
        except Exception:
            pass

    return {"message": "Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet."}


@router.post("/reset-password")
async def reset_password(data: dict, db: AsyncSession = Depends(get_db)):
    token = data.get("token", "")
    new_password = data.get("new_password", "")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen lang sein")

    result = await db.execute(select(User).where(User.reset_token == token))
    user = result.scalar_one_or_none()

    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Ungültiger oder abgelaufener Token")

    if user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token abgelaufen – bitte erneut anfordern")

    user.password_hash = get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()

    return {"message": "Passwort erfolgreich geändert"}


@router.post("/change-password")
async def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Neues Passwort muss mindestens 8 Zeichen lang sein")

    current_user.password_hash = get_password_hash(new_password)
    await db.commit()

    return {"message": "Passwort erfolgreich geändert"}
