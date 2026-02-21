import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.core.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/logo", response_model=UserResponse)
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Nur JPEG, PNG oder WebP erlaubt")

    logo_dir = os.path.join(settings.UPLOAD_DIR, "logos")
    os.makedirs(logo_dir, exist_ok=True)

    # Remove old logo
    if current_user.logo_path:
        old_path = os.path.join(settings.UPLOAD_DIR, current_user.logo_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"user_{current_user.id}_logo.{ext}"
    filepath = os.path.join(logo_dir, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    current_user.logo_path = f"logos/{filename}"
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me/password")
async def change_password(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.security import verify_password, get_password_hash
    if not verify_password(data.get("current_password", ""), current_user.password_hash):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort falsch")

    new_password = data.get("new_password", "")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 8 Zeichen haben")

    current_user.password_hash = get_password_hash(new_password)
    await db.commit()
    return {"message": "Passwort geändert"}
