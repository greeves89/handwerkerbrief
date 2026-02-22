from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from typing import List, Optional
from datetime import date, time, datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.assignment import WorkAssignment
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    worker_name: str
    title: str
    assignment_date: date
    customer_id: Optional[int] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: str = "planned"
    color: Optional[str] = None
    notes: Optional[str] = None


class AssignmentUpdate(BaseModel):
    worker_name: Optional[str] = None
    title: Optional[str] = None
    assignment_date: Optional[date] = None
    customer_id: Optional[int] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: int
    user_id: int
    worker_name: str
    customer_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    assignment_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: str
    color: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_week_bounds(ref_date: date):
    """Return Monday and Sunday of the week containing ref_date."""
    monday = ref_date - timedelta(days=ref_date.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/week", response_model=List[AssignmentResponse])
async def get_week_assignments(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all assignments for the week containing 'date' (defaults to today)."""
    if date:
        from datetime import date as date_cls
        ref = date_cls.fromisoformat(date)
    else:
        from datetime import date as date_cls
        ref = date_cls.today()

    monday, sunday = _get_week_bounds(ref)

    q = (
        select(WorkAssignment)
        .where(
            WorkAssignment.user_id == current_user.id,
            WorkAssignment.assignment_date >= monday,
            WorkAssignment.assignment_date <= sunday,
        )
        .order_by(WorkAssignment.assignment_date, WorkAssignment.start_time, WorkAssignment.id)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/workers", response_model=List[str])
async def list_workers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct worker names for autocomplete."""
    q = (
        select(distinct(WorkAssignment.worker_name))
        .where(WorkAssignment.user_id == current_user.id)
        .order_by(WorkAssignment.worker_name)
    )
    result = await db.execute(q)
    return [row[0] for row in result.all()]


@router.get("", response_model=List[AssignmentResponse])
async def list_assignments(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List assignments, optionally filtered by date range."""
    q = (
        select(WorkAssignment)
        .where(WorkAssignment.user_id == current_user.id)
        .order_by(WorkAssignment.assignment_date, WorkAssignment.start_time, WorkAssignment.id)
    )
    if date_from:
        from datetime import date as date_cls
        q = q.where(WorkAssignment.assignment_date >= date_cls.fromisoformat(date_from))
    if date_to:
        from datetime import date as date_cls
        q = q.where(WorkAssignment.assignment_date <= date_cls.fromisoformat(date_to))

    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    data: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = WorkAssignment(
        user_id=current_user.id,
        worker_name=data.worker_name,
        customer_id=data.customer_id,
        title=data.title,
        description=data.description,
        location=data.location,
        assignment_date=data.assignment_date,
        start_time=data.start_time,
        end_time=data.end_time,
        status=data.status,
        color=data.color,
        notes=data.notes,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    data: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkAssignment).where(
            WorkAssignment.id == assignment_id,
            WorkAssignment.user_id == current_user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Einsatz nicht gefunden")

    if data.worker_name is not None:
        assignment.worker_name = data.worker_name
    if data.title is not None:
        assignment.title = data.title
    if data.assignment_date is not None:
        assignment.assignment_date = data.assignment_date
    if data.customer_id is not None:
        assignment.customer_id = data.customer_id
    if data.description is not None:
        assignment.description = data.description
    if data.location is not None:
        assignment.location = data.location
    if data.start_time is not None:
        assignment.start_time = data.start_time
    if data.end_time is not None:
        assignment.end_time = data.end_time
    if data.status is not None:
        assignment.status = data.status
    if data.color is not None:
        assignment.color = data.color
    if data.notes is not None:
        assignment.notes = data.notes

    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=204)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkAssignment).where(
            WorkAssignment.id == assignment_id,
            WorkAssignment.user_id == current_user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Einsatz nicht gefunden")
    await db.delete(assignment)
    await db.commit()
