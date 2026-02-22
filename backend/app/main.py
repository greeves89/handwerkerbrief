from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import os

from app.config import settings
from app.api import auth, users, customers, documents, positions, feedback, admin, gdpr
from app.api import stripe_api
from app.api import time_entries
from app.api import recurring_invoices
from app.api import scheduling
from app.api import site_reports
from app.api import archive
from app.core.overdue_scheduler import overdue_scheduler_loop
from app.core.recurring_scheduler import recurring_scheduler_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    task1 = asyncio.create_task(overdue_scheduler_loop())
    task2 = asyncio.create_task(recurring_scheduler_loop())
    yield
    task1.cancel()
    task2.cancel()


app = FastAPI(
    title="HandwerkerBrief API",
    description="Invoicing and offer management for German craftsmen",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS - only needed for development; in production nginx handles this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(customers.router)
app.include_router(documents.router)
app.include_router(positions.router)
app.include_router(feedback.router)
app.include_router(admin.router)
app.include_router(gdpr.router)
app.include_router(stripe_api.router)
app.include_router(time_entries.router)
app.include_router(recurring_invoices.router)
app.include_router(scheduling.router)
app.include_router(site_reports.router)
app.include_router(archive.router)

# Serve uploaded files (logos, PDFs) - in production, nginx handles this
upload_dir = settings.UPLOAD_DIR
os.makedirs(upload_dir, exist_ok=True)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "HandwerkerBrief API"}


@app.get("/api")
async def api_root():
    return {"message": "HandwerkerBrief API v1.0.0"}
