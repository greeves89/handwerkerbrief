from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.get("", response_model=List[FeedbackResponse])
async def list_my_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Feedback)
        .where(Feedback.user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fb = Feedback(user_id=current_user.id, **data.model_dump())
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Feedback).where(Feedback.id == feedback_id, Feedback.user_id == current_user.id)
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback nicht gefunden")
    return fb
