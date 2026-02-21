from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.api import auth, users, customers, documents, positions, feedback, admin, gdpr
from app.api import stripe_api

app = FastAPI(
    title="HandwerkerBrief API",
    description="Invoicing and offer management for German craftsmen",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
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

# Serve uploaded files (logos, PDFs) - in production, nginx handles this
upload_dir = settings.UPLOAD_DIR
os.makedirs(upload_dir, exist_ok=True)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "HandwerkerBrief API"}


@app.get("/api")
async def api_root():
    return {"message": "HandwerkerBrief API v1.0.0"}
