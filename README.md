# HandwerkerBrief

A production-ready SaaS invoicing and offer management application for German solo craftsmen (Handwerker).

## Features

- **Kundenverwaltung** - Full customer management
- **Angebote** - Offer/quote creation with PDF export
- **Rechnungen** - Invoice management with PDF export
- **Mahnwesen** - Automated dunning (Level 1/2/3)
- **Zahlungserinnerungen** - Payment reminders via email
- **DATEV Export** - CSV export for accountants
- **DSGVO compliant** - Data export and deletion endpoints
- **Multi-user** - Admin + member roles
- **Subscription tiers** - Free (3/month) and Premium (€0.99/month)

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + Radix UI
- **PDF**: ReportLab
- **Auth**: JWT (httpOnly cookies + refresh tokens)
- **Proxy**: nginx (only public-facing service)

## Quick Start

```bash
cp .env.example .env
# Edit .env with your values

docker compose up -d
```

The app will be available at http://localhost

The first registered user automatically becomes admin.

## Development

### Backend
```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Architecture

- PostgreSQL is **not** exposed externally (internal Docker network only)
- nginx is the **only** public-facing service
- All API routes are under `/api/`
- Frontend served from `/`

## Environment Variables

See `.env.example` for all configuration options.

## License

Proprietary
