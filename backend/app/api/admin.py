from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.customer import Customer
from app.models.feedback import Feedback
from app.schemas.user import UserResponse
from app.schemas.feedback import FeedbackResponse, FeedbackUpdate
from app.core.auth import get_current_admin
from app.services.email_service import send_feedback_response

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # Total users
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    premium_users = (await db.execute(
        select(func.count(User.id)).where(User.subscription_tier == "premium")
    )).scalar()
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar()

    # Documents
    total_invoices = (await db.execute(
        select(func.count(Document.id)).where(Document.type == "invoice")
    )).scalar()
    total_offers = (await db.execute(
        select(func.count(Document.id)).where(Document.type == "offer")
    )).scalar()
    total_revenue = (await db.execute(
        select(func.sum(Document.total_amount)).where(
            Document.type == "invoice", Document.status == "paid"
        )
    )).scalar() or 0

    # Feedback
    pending_feedback = (await db.execute(
        select(func.count(Feedback.id)).where(Feedback.status == "pending")
    )).scalar()

    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "active_users": active_users,
        "total_invoices": total_invoices,
        "total_offers": total_offers,
        "total_revenue": float(total_revenue),
        "pending_feedback": pending_feedback,
    }


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(User)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (User.email.ilike(search_term)) | (User.name.ilike(search_term))
        )
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return user


@router.put("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht deaktiviert werden")

    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/subscription", response_model=UserResponse)
async def update_subscription(
    user_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    tier = data.get("tier", "free")
    if tier not in ["free", "premium"]:
        raise HTTPException(status_code=400, detail="Ungültiger Tier")

    user.subscription_tier = tier
    if tier == "premium":
        months = data.get("months", 1)
        user.subscription_expires_at = datetime.utcnow() + timedelta(days=30 * months)
    else:
        user.subscription_expires_at = None

    await db.commit()
    await db.refresh(user)
    return user


@router.get("/feedback", response_model=List[FeedbackResponse])
async def list_all_feedback(
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(Feedback)
    if status:
        query = query.where(Feedback.status == status)
    query = query.offset(skip).limit(limit).order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/feedback/{feedback_id}", response_model=FeedbackResponse)
async def respond_to_feedback(
    feedback_id: int,
    data: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.user)).where(Feedback.id == feedback_id)
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback nicht gefunden")

    if data.status:
        fb.status = data.status
    if data.admin_response:
        fb.admin_response = data.admin_response

    await db.commit()
    await db.refresh(fb)

    # Send email notification
    if data.admin_response and fb.user.email:
        await send_feedback_response(
            recipient=fb.user.email,
            user_name=fb.user.name,
            feedback_title=fb.title,
            admin_response=data.admin_response,
            status=fb.status,
        )

    return fb


@router.post("/smtp/test")
async def test_smtp(
    data: dict,
    admin: User = Depends(get_current_admin),
):
    from app.services.email_service import send_email
    recipient = data.get("email", admin.email)
    success = await send_email(
        recipient=recipient,
        subject="HandwerkerBrief SMTP Test",
        body_html="<p>SMTP-Konfiguration funktioniert!</p>",
        body_text="SMTP-Konfiguration funktioniert!",
    )
    if success:
        return {"message": f"Test-E-Mail gesendet an {recipient}"}
    else:
        raise HTTPException(status_code=500, detail="SMTP-Konfiguration fehlerhaft")
