from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.position import Position
from app.schemas.document import PositionCreate, PositionUpdate, PositionResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/positions", tags=["positions"])


@router.get("", response_model=List[PositionResponse])
async def list_positions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Position)
        .where(Position.user_id == current_user.id)
        .order_by(Position.name)
    )
    return result.scalars().all()


@router.post("", response_model=PositionResponse, status_code=201)
async def create_position(
    data: PositionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    position = Position(user_id=current_user.id, **data.model_dump())
    db.add(position)
    await db.commit()
    await db.refresh(position)
    return position


@router.get("/{position_id}", response_model=PositionResponse)
async def get_position(
    position_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Position).where(Position.id == position_id, Position.user_id == current_user.id)
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    return position


@router.put("/{position_id}", response_model=PositionResponse)
async def update_position(
    position_id: int,
    data: PositionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Position).where(Position.id == position_id, Position.user_id == current_user.id)
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(position, field, value)

    await db.commit()
    await db.refresh(position)
    return position


@router.delete("/{position_id}", status_code=204)
async def delete_position(
    position_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Position).where(Position.id == position_id, Position.user_id == current_user.id)
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")

    await db.delete(position)
    await db.commit()
