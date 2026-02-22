"""Team management - invite team members to collaborate."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
import secrets
import logging

from app.database import get_db
from app.models.user import User
from app.models.team_invite import TeamInvite
from app.core.auth import get_current_user
from app.services.email_service import send_email, _email_wrapper, _btn, _divider, PRIMARY, TEXT, TEXT_MUTED, BORDER
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/team", tags=["team"])

ROLES = {"member": "Mitarbeiter", "admin": "Administrator"}


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"


class InviteResponse(BaseModel):
    id: int
    email: str
    role: str
    accepted: bool
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


@router.get("/invites", response_model=List[InviteResponse])
async def list_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.owner_id == current_user.id)
        .order_by(TeamInvite.created_at.desc())
    )
    return result.scalars().all()


@router.post("/invite", response_model=InviteResponse, status_code=201)
async def create_invite(
    data: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail="Ungueltige Rolle")

    # Check for existing pending invite
    existing = await db.execute(
        select(TeamInvite).where(
            TeamInvite.owner_id == current_user.id,
            TeamInvite.email == data.email,
            TeamInvite.accepted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Einladung fuer diese E-Mail-Adresse bereits ausstehend",
        )

    token = secrets.token_urlsafe(32)
    invite = TeamInvite(
        owner_id=current_user.id,
        email=data.email,
        role=data.role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    # Send invite email (best-effort, don't fail if email fails)
    try:
        org = current_user.company_name or current_user.name or "HandwerkerBrief"
        invite_url = f"{settings.APP_URL}/register?invite_token={token}"
        role_label = ROLES[data.role]

        content = f"""
<div style="text-align:center;margin-bottom:24px;">
  <div style="display:inline-block;background:#eff6ff;border-radius:50%;width:60px;height:60px;line-height:60px;font-size:26px;">👥</div>
</div>

<h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:{TEXT};text-align:center;letter-spacing:-0.3px;">Sie wurden eingeladen!</h1>
<p style="margin:0 0 28px;color:{TEXT_MUTED};font-size:13px;text-align:center;">HandwerkerBrief &middot; Team-Einladung</p>

<p style="margin:0 0 16px;color:{TEXT};font-size:15px;line-height:1.7;">Hallo,</p>
<p style="margin:0 0 24px;color:{TEXT_MUTED};font-size:15px;line-height:1.7;">
  <strong>{org}</strong> laedt Sie ein, HandwerkerBrief als <strong>{role_label}</strong> zu nutzen.
  Erstellen Sie jetzt Ihr kostenloses Konto und arbeiten Sie gemeinsam an Rechnungen und Angeboten.
</p>

{_btn(invite_url, "Einladung annehmen >")}

<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin:0 0 24px;">
  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
    Diese Einladung ist <strong>7 Tage gueltig</strong>.<br>
    Falls Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.
  </p>
</div>

{_divider()}

<p style="margin:0;color:{TEXT_MUTED};font-size:12px;line-height:1.6;">
  Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
  <a href="{invite_url}" style="color:{PRIMARY};word-break:break-all;">{invite_url}</a>
</p>"""

        html = _email_wrapper(content)
        text = (
            f"Hallo,\n\n"
            f"{org} laedt Sie ein, HandwerkerBrief als {role_label} zu nutzen.\n\n"
            f"Klicken Sie hier, um Ihr Konto zu erstellen:\n{invite_url}\n\n"
            f"Diese Einladung ist 7 Tage gueltig.\n\n"
            f"Mit freundlichen Gruessen,\n{org}"
        )
        await send_email(
            recipient=data.email,
            subject=f"Einladung zu {org} auf HandwerkerBrief",
            body_html=html,
            body_text=text,
        )
    except Exception as exc:
        logger.warning(f"Failed to send invite email to {data.email}: {exc}")

    return invite


@router.delete("/invites/{invite_id}", status_code=204)
async def delete_invite(
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamInvite).where(
            TeamInvite.id == invite_id,
            TeamInvite.owner_id == current_user.id,
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Einladung nicht gefunden")
    await db.delete(invite)
    await db.commit()
