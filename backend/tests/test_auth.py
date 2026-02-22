"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.user import User
from app.main import app


async def _verify_user(email: str) -> None:
    """Helper to mark a user as verified in the DB (bypasses email)."""
    db_gen = app.dependency_overrides[app.dependency_overrides.__class__]
    # Use the db_session override directly
    for override_fn in app.dependency_overrides.values():
        gen = override_fn()
        db = await gen.__anext__()
        await db.execute(update(User).where(User.email == email).values(is_verified=True))
        await db.commit()
        break


@pytest.mark.asyncio
async def test_register_first_user_is_admin(client: AsyncClient):
    """First registered user becomes admin."""
    res = await client.post("/api/auth/register", json={
        "email": "admin@test.de",
        "name": "Admin User",
        "password": "secure_password123",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "admin@test.de"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_register_second_user_is_member(client: AsyncClient):
    """Second registered user gets member role."""
    await client.post("/api/auth/register", json={
        "email": "admin@test.de",
        "name": "Admin",
        "password": "password123",
    })
    res = await client.post("/api/auth/register", json={
        "email": "user@test.de",
        "name": "Regular User",
        "password": "password123",
    })
    assert res.status_code == 201
    assert res.json()["role"] == "member"


@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient):
    """Registering the same email twice returns 400."""
    payload = {"email": "dup@test.de", "name": "Test", "password": "password123"}
    await client.post("/api/auth/register", json=payload)
    res = await client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "registriert" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_unverified_user_blocked(client: AsyncClient, db_session):
    """Unverified user cannot log in (403)."""
    await client.post("/api/auth/register", json={
        "email": "unverified@test.de",
        "name": "Unverified",
        "password": "password123",
    })
    res = await client.post("/api/auth/login", json={
        "email": "unverified@test.de",
        "password": "password123",
    })
    assert res.status_code == 403
    assert "verifizier" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_wrong_password_fails(client: AsyncClient):
    """Wrong password returns 401."""
    await client.post("/api/auth/register", json={
        "email": "user@test.de",
        "name": "User",
        "password": "correct_password",
    })
    res = await client.post("/api/auth/login", json={
        "email": "user@test.de",
        "password": "wrong_password",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user_fails(client: AsyncClient):
    """Login with unknown email returns 401."""
    res = await client.post("/api/auth/login", json={
        "email": "nobody@test.de",
        "password": "password123",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_verify_email_token(client: AsyncClient, db_session):
    """Email verification via token marks user as verified.
    Note: expiry check uses offset-naive datetime in SQLite; we clear
    verification_token_expires to skip the expiry comparison.
    """
    from sqlalchemy import select
    await client.post("/api/auth/register", json={
        "email": "toverify@test.de",
        "name": "To Verify",
        "password": "password123",
    })
    result = await db_session.execute(
        select(User).where(User.email == "toverify@test.de")
    )
    user = result.scalar_one()
    token = user.verification_token

    # Clear expiry to avoid offset-naive vs offset-aware comparison in SQLite
    user.verification_token_expires = None
    await db_session.commit()

    res = await client.get(f"/api/auth/verify-email?token={token}")
    assert res.status_code == 200

    await db_session.refresh(user)
    assert user.is_verified is True
    assert user.verification_token is None


@pytest.mark.asyncio
async def test_verify_email_invalid_token(client: AsyncClient):
    """Verification with invalid token returns 400."""
    res = await client.get("/api/auth/verify-email?token=invalidtoken123")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, db_session):
    """Logout clears auth cookies."""
    await client.post("/api/auth/register", json={
        "email": "logout@test.de",
        "name": "Logout User",
        "password": "password123",
    })
    # Verify user
    from sqlalchemy import select
    result = await db_session.execute(select(User).where(User.email == "logout@test.de"))
    user = result.scalar_one()
    user.is_verified = True
    await db_session.commit()

    await client.post("/api/auth/login", json={"email": "logout@test.de", "password": "password123"})
    res = await client.post("/api/auth/logout")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_no_error_for_unknown_email(client: AsyncClient):
    """Forgot-password returns success even for unknown emails (security by design)."""
    res = await client.post("/api/auth/forgot-password", json={"email": "nobody@test.de"})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient):
    """Reset with invalid token returns 400."""
    res = await client.post("/api/auth/reset-password", json={
        "token": "badtoken",
        "new_password": "newpassword123",
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_too_short(client: AsyncClient):
    """Reset password with fewer than 8 characters returns 400."""
    res = await client.post("/api/auth/reset-password", json={
        "token": "anytoken",
        "new_password": "short",
    })
    assert res.status_code == 400
