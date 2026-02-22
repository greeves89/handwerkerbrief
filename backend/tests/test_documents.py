"""Tests for document (invoice/offer) management endpoints."""
import pytest
from decimal import Decimal
from datetime import date
from httpx import AsyncClient
from sqlalchemy import update

from app.models.user import User
from app.api.documents import calculate_totals


async def _setup_user_and_customer(client: AsyncClient, db_session) -> int:
    """Register+verify+login a user, create a customer, return customer_id."""
    await client.post("/api/auth/register", json={
        "email": "craftsman@test.de",
        "name": "Handwerker",
        "password": "password123",
    })
    await db_session.execute(
        update(User).where(User.email == "craftsman@test.de").values(is_verified=True)
    )
    await db_session.commit()
    login_res = await client.post("/api/auth/login", json={
        "email": "craftsman@test.de",
        "password": "password123",
    })
    assert login_res.status_code == 200

    cust_res = await client.post("/api/customers", json={
        "company_name": "Test Kunde GmbH",
        "email": "kunde@test.de",
    })
    assert cust_res.status_code == 201
    return cust_res.json()["id"]


def make_document_payload(customer_id: int, doc_type: str = "invoice") -> dict:
    return {
        "customer_id": customer_id,
        "type": doc_type,
        "title": "Testrechnung",
        "issue_date": str(date.today()),
        "due_date": str(date.today()),
        "tax_rate": "19.00",
        "discount_percent": "0.00",
        "items": [
            {
                "name": "Arbeitsleistung",
                "quantity": "2.00",
                "price_per_unit": "50.00",
                "unit": "Stunde",
            }
        ],
    }


# ─── Unit tests for business logic ────────────────────────────────────────────

def test_calculate_totals_no_discount():
    """Totals with 19% tax and no discount."""
    items = [
        type("Item", (), {"quantity": Decimal("2"), "price_per_unit": Decimal("50")})(),
    ]
    subtotal, tax, total = calculate_totals(items, Decimal("19"), Decimal("0"))
    assert subtotal == Decimal("100")
    assert tax == Decimal("19")
    assert total == Decimal("119")


def test_calculate_totals_with_discount():
    """10% discount reduces subtotal before tax."""
    items = [
        type("Item", (), {"quantity": Decimal("1"), "price_per_unit": Decimal("100")})(),
    ]
    subtotal, tax, total = calculate_totals(items, Decimal("19"), Decimal("10"))
    assert subtotal == Decimal("100")
    assert tax == Decimal("17.1")
    assert total == Decimal("107.1")


def test_calculate_totals_zero_tax():
    """0% tax rate (e.g. Kleinunternehmer)."""
    items = [
        type("Item", (), {"quantity": Decimal("5"), "price_per_unit": Decimal("20")})(),
    ]
    subtotal, tax, total = calculate_totals(items, Decimal("0"), Decimal("0"))
    assert subtotal == Decimal("100")
    assert tax == Decimal("0")
    assert total == Decimal("100")


def test_calculate_totals_multiple_items():
    """Multiple items are summed correctly."""
    items = [
        type("Item", (), {"quantity": Decimal("2"), "price_per_unit": Decimal("30")})(),
        type("Item", (), {"quantity": Decimal("1"), "price_per_unit": Decimal("40")})(),
    ]
    subtotal, tax, total = calculate_totals(items, Decimal("19"), Decimal("0"))
    assert subtotal == Decimal("100")
    assert tax == Decimal("19")
    assert total == Decimal("119")


# ─── API tests ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_invoice(client: AsyncClient, db_session):
    """Creating an invoice returns 201 with document number RE-0001."""
    customer_id = await _setup_user_and_customer(client, db_session)
    res = await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "invoice"
    assert data["document_number"] == "RE-0001"
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_create_offer(client: AsyncClient, db_session):
    """Creating an offer returns 201 with document number AN-0001."""
    customer_id = await _setup_user_and_customer(client, db_session)
    res = await client.post("/api/documents", json=make_document_payload(customer_id, "offer"))
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "offer"
    assert data["document_number"] == "AN-0001"


@pytest.mark.asyncio
async def test_document_numbers_increment(client: AsyncClient, db_session):
    """Invoice document numbers increment per user."""
    customer_id = await _setup_user_and_customer(client, db_session)
    res1 = await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    res2 = await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    assert res1.json()["document_number"] == "RE-0001"
    assert res2.json()["document_number"] == "RE-0002"


@pytest.mark.asyncio
async def test_create_document_with_wrong_customer_fails(client: AsyncClient, db_session):
    """Creating a document with a nonexistent customer returns 404."""
    await _setup_user_and_customer(client, db_session)
    res = await client.post("/api/documents", json=make_document_payload(99999, "invoice"))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_documents(client: AsyncClient, db_session):
    """Listing documents returns created documents."""
    customer_id = await _setup_user_and_customer(client, db_session)
    await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    await client.post("/api/documents", json=make_document_payload(customer_id, "offer"))

    res = await client.get("/api/documents")
    assert res.status_code == 200
    assert len(res.json()) == 2


@pytest.mark.asyncio
async def test_list_documents_filtered_by_type(client: AsyncClient, db_session):
    """Filtering by type returns only matching documents."""
    customer_id = await _setup_user_and_customer(client, db_session)
    await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    await client.post("/api/documents", json=make_document_payload(customer_id, "offer"))

    res = await client.get("/api/documents?type=invoice")
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 1
    assert docs[0]["type"] == "invoice"


@pytest.mark.asyncio
async def test_get_document(client: AsyncClient, db_session):
    """Fetching a specific document by ID returns correct data."""
    customer_id = await _setup_user_and_customer(client, db_session)
    create_res = await client.post("/api/documents", json=make_document_payload(customer_id))
    doc_id = create_res.json()["id"]

    res = await client.get(f"/api/documents/{doc_id}")
    assert res.status_code == 200
    assert res.json()["id"] == doc_id


@pytest.mark.asyncio
async def test_get_document_not_found(client: AsyncClient, db_session):
    """Getting a nonexistent document returns 404."""
    await _setup_user_and_customer(client, db_session)
    res = await client.get("/api/documents/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_update_document_status(client: AsyncClient, db_session):
    """Updating document status from draft to sent."""
    customer_id = await _setup_user_and_customer(client, db_session)
    create_res = await client.post("/api/documents", json=make_document_payload(customer_id))
    doc_id = create_res.json()["id"]

    res = await client.put(f"/api/documents/{doc_id}", json={"status": "sent"})
    assert res.status_code == 200
    assert res.json()["status"] == "sent"


@pytest.mark.asyncio
async def test_delete_document(client: AsyncClient, db_session):
    """Deleting a document returns 204 and the document is gone."""
    customer_id = await _setup_user_and_customer(client, db_session)
    create_res = await client.post("/api/documents", json=make_document_payload(customer_id))
    doc_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/documents/{doc_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_convert_offer_to_invoice(client: AsyncClient, db_session):
    """Converting an offer to an invoice creates an invoice and marks offer as accepted."""
    customer_id = await _setup_user_and_customer(client, db_session)
    offer_res = await client.post("/api/documents", json=make_document_payload(customer_id, "offer"))
    offer_id = offer_res.json()["id"]

    res = await client.post(f"/api/documents/{offer_id}/convert-to-invoice")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "invoice"
    assert data["document_number"] == "RE-0001"

    # Original offer should be accepted
    offer_check = await client.get(f"/api/documents/{offer_id}")
    assert offer_check.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_free_tier_monthly_limit(client: AsyncClient, db_session):
    """Free tier users cannot create more than 3 invoices per month."""
    customer_id = await _setup_user_and_customer(client, db_session)

    # Create 3 invoices (limit)
    for _ in range(3):
        res = await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
        assert res.status_code == 201

    # 4th should be rejected
    res = await client.post("/api/documents", json=make_document_payload(customer_id, "invoice"))
    assert res.status_code == 402
    assert "limit" in res.json()["detail"].lower() or "premium" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unauthenticated_document_list_fails(client: AsyncClient):
    """Listing documents without auth returns 401."""
    res = await client.get("/api/documents")
    assert res.status_code == 401
