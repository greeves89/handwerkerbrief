"""Tests for customer management endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.models.user import User
from app.main import app


async def _make_verified_client(client: AsyncClient, db_session, email: str = "admin@test.de") -> AsyncClient:
    """Register, verify, and log in a user; return the client ready to use."""
    await client.post("/api/auth/register", json={
        "email": email,
        "name": "Test Admin",
        "password": "password123",
    })
    await db_session.execute(update(User).where(User.email == email).values(is_verified=True))
    await db_session.commit()
    login_res = await client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert login_res.status_code == 200
    return client


@pytest.mark.asyncio
async def test_create_customer(client: AsyncClient, db_session):
    """Creating a customer returns 201 with auto-generated customer number."""
    await _make_verified_client(client, db_session)

    res = await client.post("/api/customers", json={
        "company_name": "Mustermann GmbH",
        "first_name": "Max",
        "last_name": "Mustermann",
        "email": "max@mustermann.de",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["company_name"] == "Mustermann GmbH"
    assert data["customer_number"] == "KD-0001"


@pytest.mark.asyncio
async def test_list_customers_empty(client: AsyncClient, db_session):
    """Listing customers when none exist returns empty list."""
    await _make_verified_client(client, db_session)

    res = await client.get("/api/customers")
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_list_customers(client: AsyncClient, db_session):
    """Listing customers returns only own customers."""
    await _make_verified_client(client, db_session)

    await client.post("/api/customers", json={"company_name": "Kunde A"})
    await client.post("/api/customers", json={"company_name": "Kunde B"})

    res = await client.get("/api/customers")
    assert res.status_code == 200
    names = {c["company_name"] for c in res.json()}
    assert names == {"Kunde A", "Kunde B"}


@pytest.mark.asyncio
async def test_get_customer(client: AsyncClient, db_session):
    """Getting a specific customer by ID returns correct data."""
    await _make_verified_client(client, db_session)

    create_res = await client.post("/api/customers", json={
        "company_name": "Spezifischer Kunde",
        "email": "spezifisch@test.de",
    })
    customer_id = create_res.json()["id"]

    res = await client.get(f"/api/customers/{customer_id}")
    assert res.status_code == 200
    assert res.json()["company_name"] == "Spezifischer Kunde"


@pytest.mark.asyncio
async def test_get_customer_not_found(client: AsyncClient, db_session):
    """Getting a nonexistent customer returns 404."""
    await _make_verified_client(client, db_session)

    res = await client.get("/api/customers/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_update_customer(client: AsyncClient, db_session):
    """Updating a customer changes the specified fields."""
    await _make_verified_client(client, db_session)

    create_res = await client.post("/api/customers", json={"company_name": "Alt GmbH"})
    customer_id = create_res.json()["id"]

    res = await client.put(f"/api/customers/{customer_id}", json={"company_name": "Neu GmbH"})
    assert res.status_code == 200
    assert res.json()["company_name"] == "Neu GmbH"


@pytest.mark.asyncio
async def test_delete_customer(client: AsyncClient, db_session):
    """Deleting a customer returns 204 and customer is gone."""
    await _make_verified_client(client, db_session)

    create_res = await client.post("/api/customers", json={"company_name": "Zu löschen"})
    customer_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/customers/{customer_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/customers/{customer_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_customer_number_increments(client: AsyncClient, db_session):
    """Customer numbers increment sequentially per user."""
    await _make_verified_client(client, db_session)

    res1 = await client.post("/api/customers", json={"company_name": "Erster"})
    res2 = await client.post("/api/customers", json={"company_name": "Zweiter"})
    res3 = await client.post("/api/customers", json={"company_name": "Dritter"})

    assert res1.json()["customer_number"] == "KD-0001"
    assert res2.json()["customer_number"] == "KD-0002"
    assert res3.json()["customer_number"] == "KD-0003"


@pytest.mark.asyncio
async def test_search_customers(client: AsyncClient, db_session):
    """Search filters customers by company name."""
    await _make_verified_client(client, db_session)

    await client.post("/api/customers", json={"company_name": "Alpha GmbH"})
    await client.post("/api/customers", json={"company_name": "Beta GmbH"})

    res = await client.get("/api/customers?search=alpha")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["company_name"] == "Alpha GmbH"


@pytest.mark.asyncio
async def test_unauthenticated_customer_list_fails(client: AsyncClient):
    """Listing customers without auth returns 401."""
    res = await client.get("/api/customers")
    assert res.status_code == 401
