import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.core.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/create-checkout-session")
async def create_checkout_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe nicht konfiguriert")

    if current_user.subscription_tier == "premium":
        raise HTTPException(status_code=400, detail="Bereits Premium-Mitglied")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price": settings.STRIPE_PRICE_ID,
                "quantity": 1,
            }],
            customer_email=current_user.email,
            metadata={"user_id": str(current_user.id)},
            success_url=settings.STRIPE_SUCCESS_URL,
            cancel_url=settings.STRIPE_CANCEL_URL,
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook nicht konfiguriert")

    payload = await request.body()
    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Ungültige Signatur")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        subscription_id = session.get("subscription")

        if user_id:
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.subscription_tier = "premium"
                user.stripe_subscription_id = subscription_id
                user.stripe_customer_id = session.get("customer")
                from datetime import timedelta
                user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
                await db.commit()

    elif event["type"] in ["customer.subscription.deleted", "customer.subscription.paused"]:
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user:
            user.subscription_tier = "free"
            user.subscription_expires_at = None
            await db.commit()

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        status = subscription.get("status")

        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user:
            if status == "active":
                user.subscription_tier = "premium"
            else:
                user.subscription_tier = "free"
            await db.commit()

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")

        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user:
            user.subscription_tier = "free"
            await db.commit()

    return {"status": "ok"}


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe nicht konfiguriert")

    if current_user.subscription_tier != "premium":
        raise HTTPException(status_code=400, detail="Kein aktives Abonnement")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        if current_user.stripe_subscription_id:
            stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                cancel_at_period_end=True
            )

        return {"message": "Abonnement wird am Ende der Laufzeit gekündigt"}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription-status")
async def subscription_status(current_user: User = Depends(get_current_user)):
    return {
        "tier": current_user.subscription_tier,
        "is_premium": current_user.subscription_tier == "premium",
        "expires_at": current_user.subscription_expires_at,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }
