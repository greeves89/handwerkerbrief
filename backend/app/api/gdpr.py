import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import io

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.document import Document
from app.models.feedback import Feedback
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/gdpr", tags=["gdpr"])


@router.get("/export")
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """DSGVO Art. 20 - Datenportabilität"""
    # Collect all user data
    user_data = {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "company_name": current_user.company_name,
        "address_street": current_user.address_street,
        "address_zip": current_user.address_zip,
        "address_city": current_user.address_city,
        "phone": current_user.phone,
        "tax_number": current_user.tax_number,
        "created_at": str(current_user.created_at),
    }

    # Customers
    cust_result = await db.execute(
        select(Customer).where(Customer.user_id == current_user.id)
    )
    customers = []
    for c in cust_result.scalars().all():
        customers.append({
            "id": c.id,
            "customer_number": c.customer_number,
            "company_name": c.company_name,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "phone": c.phone,
            "address_street": c.address_street,
            "address_zip": c.address_zip,
            "address_city": c.address_city,
        })

    # Documents
    doc_result = await db.execute(
        select(Document)
        .options(selectinload(Document.items))
        .where(Document.user_id == current_user.id)
    )
    documents = []
    for d in doc_result.scalars().all():
        documents.append({
            "id": d.id,
            "type": d.type,
            "document_number": d.document_number,
            "status": d.status,
            "issue_date": str(d.issue_date),
            "total_amount": str(d.total_amount),
            "items": [
                {
                    "name": item.name,
                    "quantity": str(item.quantity),
                    "price_per_unit": str(item.price_per_unit),
                    "total_price": str(item.total_price),
                }
                for item in d.items
            ],
        })

    # Feedback
    fb_result = await db.execute(
        select(Feedback).where(Feedback.user_id == current_user.id)
    )
    feedbacks = [
        {
            "id": f.id,
            "type": f.type,
            "title": f.title,
            "message": f.message,
            "status": f.status,
            "created_at": str(f.created_at),
        }
        for f in fb_result.scalars().all()
    ]

    export_data = {
        "user": user_data,
        "customers": customers,
        "documents": documents,
        "feedback": feedbacks,
        "exported_at": str(__import__("datetime").datetime.utcnow()),
    }

    json_bytes = json.dumps(export_data, ensure_ascii=False, indent=2).encode("utf-8")
    return StreamingResponse(
        iter([json_bytes]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=meine_daten.json"},
    )


@router.delete("/delete-account")
async def delete_my_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """DSGVO Art. 17 - Recht auf Vergessenwerden"""
    if current_user.role == "admin":
        raise HTTPException(
            status_code=400,
            detail="Admin-Konto kann nicht gelöscht werden. Bitte zuerst Admin-Rolle übertragen."
        )

    await db.delete(current_user)
    await db.commit()

    from fastapi import Response
    response = JSONResponse({"message": "Ihr Konto wurde vollständig gelöscht"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response
