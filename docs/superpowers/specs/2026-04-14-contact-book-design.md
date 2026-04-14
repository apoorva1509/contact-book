# Contact Book Application — Design Spec

## Overview

A personal contact book application with smart duplicate detection and merge capabilities. Built with FastAPI + PostgreSQL backend, Next.js frontend, deployed via Docker Compose.

## Tech Stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy, python-phonenumbers, PostgreSQL 16 with pg_trgm
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, SWR
- **Infrastructure:** Docker, Docker Compose (3 services: api, frontend, postgres)

## Data Model

### contacts table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| first_name | VARCHAR(100) | NOT NULL |
| last_name | VARCHAR(100) | nullable |
| phone_numbers | VARCHAR[] | each element globally unique |
| email_addresses | VARCHAR[] | each element globally unique |
| created_at | TIMESTAMP | default now() |
| updated_at | TIMESTAMP | default now(), auto-update |
| merged_from | UUID[] | audit trail of merged contact IDs |

### Indexes

- GIN index on `phone_numbers` and `email_addresses` for array element lookups
- GIN index with `pg_trgm` on `first_name` and `last_name` for fuzzy search

### Normalization Rules

- **Phone numbers:** Parsed and formatted to E.164 via `python-phonenumbers`. Invalid numbers rejected with 422.
- **Email addresses:** Lowercased, whitespace trimmed. Basic format validation.
- **Uniqueness:** Enforced at API layer before insert/update. If a phone or email already exists on another contact, return 409 Conflict with the conflicting contact ID (suggests merge).

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contacts | Create a contact |
| GET | /api/contacts | List contacts (paginated, ?page=&limit=) |
| GET | /api/contacts/:id | Get single contact |
| PUT | /api/contacts/:id | Update a contact |
| DELETE | /api/contacts/:id | Delete a contact |
| GET | /api/contacts/search?q= | Search by name, phone, or email |
| GET | /api/contacts/duplicates | Get potential duplicate groups |
| POST | /api/contacts/merge | Merge two contacts |

### Search Behavior

Single `q` parameter. Backend auto-detects query type:
- Looks like phone number (digits, +, -, spaces) → normalize and match against `phone_numbers` array
- Looks like email (contains @) → normalize and match against `email_addresses` array
- Otherwise → fuzzy trigram match against `first_name` and `last_name`, ordered by similarity score
- Priority: phone match > email match > name match (if query could be ambiguous)

### Duplicate Detection

`GET /api/contacts/duplicates` returns groups of contacts that are potential duplicates based on:
1. Trigram similarity on `first_name || last_name` with threshold > 0.3
2. Any overlapping normalized phone number or email address

Response format:
```json
{
  "duplicate_groups": [
    {
      "contacts": [contact1, contact2],
      "reason": "similar_name" | "shared_phone" | "shared_email",
      "similarity_score": 0.85
    }
  ]
}
```

### Merge Behavior

`POST /api/contacts/merge` with body `{ "primary_id": UUID, "secondary_id": UUID }`:
1. Union phone numbers and email addresses onto primary contact (deduplicated)
2. Keep primary contact's name
3. Append secondary's ID to primary's `merged_from` array
4. Delete secondary contact
5. Return the merged contact

### Validation & Error Handling

- 422: Invalid phone number format, missing required fields, invalid email format
- 409: Phone/email uniqueness conflict (includes conflicting contact ID)
- 404: Contact not found

## Frontend Design

### Layout: Dashboard-style single page

**Top stats bar:**
- Total contacts count
- Recently added (last 7 days) count
- Duplicates found count (clickable, opens duplicate panel)

**Search bar:**
- Debounced (300ms) real-time search
- Single input, searches across name/phone/email

**Contact list:**
- Card-based grid layout
- Each card shows: full name, phone numbers, email addresses
- Actions per card: Edit (inline modal), Delete (with confirmation)
- Checkbox selection for manual merge (select 2 → "Merge" button appears)

**Add contact modal:**
- Fields: first name, last name
- Dynamic phone number fields (add/remove multiple)
- Dynamic email fields (add/remove multiple)
- Validation feedback inline

**Duplicate detection panel:**
- Triggered from stats bar badge or automatic notification
- Shows duplicate pairs with reason ("Similar name: 85% match" / "Shared email: john@example.com")
- Side-by-side comparison
- "Merge" button with preview of merged result
- Confirm/cancel

### Tech Details
- Next.js App Router
- Tailwind CSS for styling
- SWR for data fetching with optimistic updates
- react-hot-toast for notifications

## Architecture Document (Web-Scale Deployment)

A separate `ARCHITECTURE.md` document covering:

1. **Authentication & Authorization:** JWT access tokens + refresh tokens, OAuth2 (Google/GitHub), role-based access (admin/user)
2. **Multi-tenancy:** Row-level security with tenant_id, or schema-per-tenant for larger deployments
3. **Rate Limiting:** Token bucket at API gateway (e.g., Kong/nginx), per-user limits
4. **Caching:** Redis for frequently accessed contacts, search result caching with TTL, cache invalidation on write
5. **Search at Scale:** Elasticsearch/OpenSearch for full-text search replacing pg_trgm at scale, async indexing via message queue
6. **Database Scaling:** Read replicas for search queries, connection pooling (PgBouncer), partitioning by tenant
7. **Frontend Deployment:** Static export to CDN (Vercel/CloudFront), edge caching
8. **Container Orchestration:** Kubernetes with horizontal pod autoscaling, health checks, rolling deployments
9. **CI/CD:** GitHub Actions pipeline — lint, test, build, deploy to staging, promote to production
10. **Observability:** Structured logging (JSON), Prometheus metrics, distributed tracing (OpenTelemetry), alerting (PagerDuty)
11. **System Architecture Diagram:** ASCII or described diagram showing all components and data flow

## Docker Compose Setup

Three services:
- `postgres`: PostgreSQL 16 with pg_trgm extension, persistent volume, health check
- `api`: FastAPI app, depends on postgres, exposes port 8000
- `frontend`: Next.js app, depends on api, exposes port 3000

Single command to run: `docker compose up --build`

## Project Structure

```
contact-book/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── routes.py        # API endpoints
│   │   ├── services.py      # Business logic (normalize, dedup, merge)
│   │   ├── database.py      # DB connection setup
│   │   └── utils.py         # Phone/email normalization
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx          # Dashboard page
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Tailwind base
│   ├── src/components/
│   │   ├── StatsBar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ContactList.tsx
│   │   ├── ContactCard.tsx
│   │   ├── ContactModal.tsx
│   │   ├── DuplicatePanel.tsx
│   │   └── MergePreview.tsx
│   ├── src/lib/
│   │   ├── api.ts            # API client
│   │   └── types.ts          # TypeScript types
│   ├── package.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```
