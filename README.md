# Contact Book

A personal contact book application with smart duplicate detection and merge capabilities.

## Features

- **CRUD contacts** - create, view, edit, and delete contacts with multiple phone numbers and emails
- **Smart search** - search by name (fuzzy), phone number, or email address
- **Duplicate detection** - automatically detects potential duplicate contacts using fuzzy name matching and shared phone/email
- **Contact merging** - merge two contacts with a visual preview, combining all phone numbers and emails
- **Dashboard** - stats overview showing total contacts, recent additions, and detected duplicates

## Tech Stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, PostgreSQL 16 (pg_trgm for fuzzy search)
- **Frontend:** Next.js 14, React, Tailwind CSS, SWR
- **Infrastructure:** Docker, Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed

### Run

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

### Development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Ensure PostgreSQL is running with database "contactbook"
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contacts | Create a contact |
| GET | /api/contacts | List contacts (paginated) |
| GET | /api/contacts/search?q= | Search contacts |
| GET | /api/contacts/duplicates | Get duplicate groups |
| GET | /api/contacts/stats | Dashboard stats |
| GET | /api/contacts/:id | Get contact |
| PUT | /api/contacts/:id | Update contact |
| DELETE | /api/contacts/:id | Delete contact |
| POST | /api/contacts/merge | Merge two contacts |

## Data Normalization

- **Phone numbers:** Normalized to E.164 format via python-phonenumbers
- **Email addresses:** Lowercased and trimmed
- **Uniqueness:** Each phone number and email address must be globally unique across all contacts

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for web-scale deployment design.
