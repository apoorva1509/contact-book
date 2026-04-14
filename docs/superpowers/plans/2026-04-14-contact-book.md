# Contact Book Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal contact book with CRUD, search, duplicate detection, and merge — deployed via Docker Compose.

**Architecture:** FastAPI REST API backed by PostgreSQL with pg_trgm for fuzzy search. Next.js frontend with Tailwind CSS renders a dashboard-style UI. Docker Compose orchestrates all three services.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, python-phonenumbers, PostgreSQL 16, Next.js 14, React, Tailwind CSS, SWR, Docker Compose

---

## File Structure

```
contact-book/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app, CORS, lifespan
│   │   ├── database.py      # SQLAlchemy async engine + session
│   │   ├── models.py        # SQLAlchemy Contact model
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── utils.py         # Phone/email normalization
│   │   ├── services.py      # Business logic (CRUD, search, dedup, merge)
│   │   └── routes.py        # API route handlers
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py       # Test fixtures, test DB
│   │   ├── test_utils.py
│   │   ├── test_services.py
│   │   └── test_routes.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── StatsBar.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── ContactList.tsx
│   │   │   ├── ContactCard.tsx
│   │   │   ├── ContactModal.tsx
│   │   │   ├── DuplicatePanel.tsx
│   │   │   └── MergePreview.tsx
│   │   └── lib/
│   │       ├── api.ts
│   │       └── types.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.js
│   └── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```

---

### Task 1: Backend — Database & Models

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
psycopg2-binary==2.9.9
python-phonenumbers==8.13.35
pydantic==2.7.1
alembic==1.13.1
httpx==0.27.0
pytest==8.2.1
pytest-asyncio==0.23.7
```

- [ ] **Step 2: Create `backend/app/__init__.py`**

Empty file.

- [ ] **Step 3: Create `backend/app/database.py`**

```python
import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/contactbook",
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(
            sqlalchemy.text("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        )
        await conn.run_sync(Base.metadata.create_all)


import sqlalchemy  # noqa: E402 — needed for init_db text()
```

- [ ] **Step 4: Create `backend/app/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, Index
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    phone_numbers = Column(ARRAY(String), default=list)
    email_addresses = Column(ARRAY(String), default=list)
    merged_from = Column(ARRAY(UUID(as_uuid=True)), default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_contacts_phones", "phone_numbers", postgresql_using="gin"),
        Index("ix_contacts_emails", "email_addresses", postgresql_using="gin"),
        Index(
            "ix_contacts_name_trgm",
            "first_name",
            "last_name",
            postgresql_using="gin",
            postgresql_ops={"first_name": "gin_trgm_ops", "last_name": "gin_trgm_ops"},
        ),
    )
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add database setup and Contact model"
```

---

### Task 2: Backend — Normalization Utilities

**Files:**
- Create: `backend/app/utils.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_utils.py`

- [ ] **Step 1: Write failing tests for phone normalization**

Create `backend/tests/__init__.py` (empty) and `backend/tests/test_utils.py`:

```python
import pytest
from app.utils import normalize_phone, normalize_email, InvalidPhoneError, InvalidEmailError


class TestNormalizePhone:
    def test_us_number_with_dashes(self):
        assert normalize_phone("555-123-4567", "US") == "+15551234567"

    def test_us_number_with_country_code(self):
        assert normalize_phone("+1 555 123 4567") == "+15551234567"

    def test_us_number_with_parens(self):
        assert normalize_phone("(555) 123-4567", "US") == "+15551234567"

    def test_international_number(self):
        assert normalize_phone("+44 20 7946 0958") == "+442079460958"

    def test_invalid_number_raises(self):
        with pytest.raises(InvalidPhoneError):
            normalize_phone("not-a-number")

    def test_empty_string_raises(self):
        with pytest.raises(InvalidPhoneError):
            normalize_phone("")


class TestNormalizeEmail:
    def test_lowercase(self):
        assert normalize_email("John@Example.COM") == "john@example.com"

    def test_strip_whitespace(self):
        assert normalize_email("  alice@test.com  ") == "alice@test.com"

    def test_invalid_email_raises(self):
        with pytest.raises(InvalidEmailError):
            normalize_email("not-an-email")

    def test_empty_string_raises(self):
        with pytest.raises(InvalidEmailError):
            normalize_email("")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_utils.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.utils'`

- [ ] **Step 3: Implement utils.py**

Create `backend/app/utils.py`:

```python
import re
import phonenumbers


class InvalidPhoneError(ValueError):
    pass


class InvalidEmailError(ValueError):
    pass


def normalize_phone(phone: str, default_region: str = None) -> str:
    if not phone or not phone.strip():
        raise InvalidPhoneError("Phone number cannot be empty")
    try:
        parsed = phonenumbers.parse(phone, default_region)
        if not phonenumbers.is_valid_number(parsed):
            raise InvalidPhoneError(f"Invalid phone number: {phone}")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException as e:
        raise InvalidPhoneError(f"Cannot parse phone number: {phone}") from e


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def normalize_email(email: str) -> str:
    if not email or not email.strip():
        raise InvalidEmailError("Email cannot be empty")
    cleaned = email.strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise InvalidEmailError(f"Invalid email: {email}")
    return cleaned
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_utils.py -v`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/utils.py backend/tests/
git commit -m "feat: add phone and email normalization utilities"
```

---

### Task 3: Backend — Pydantic Schemas

**Files:**
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Create schemas.py**

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ContactCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone_numbers: list[str] = Field(default_factory=list)
    email_addresses: list[str] = Field(default_factory=list)


class ContactUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone_numbers: list[str] | None = None
    email_addresses: list[str] | None = None


class ContactResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str | None
    phone_numbers: list[str]
    email_addresses: list[str]
    merged_from: list[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactListResponse(BaseModel):
    contacts: list[ContactResponse]
    total: int
    page: int
    limit: int


class MergeRequest(BaseModel):
    primary_id: UUID
    secondary_id: UUID


class DuplicateGroup(BaseModel):
    contacts: list[ContactResponse]
    reason: str
    similarity_score: float


class DuplicateResponse(BaseModel):
    duplicate_groups: list[DuplicateGroup]


class StatsResponse(BaseModel):
    total_contacts: int
    recent_contacts: int
    duplicate_groups: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic request/response schemas"
```

---

### Task 4: Backend — Services (Business Logic)

**Files:**
- Create: `backend/app/services.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_services.py`

- [ ] **Step 1: Create test fixtures in conftest.py**

```python
import asyncio
import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/contactbook_test"

from app.database import Base
from app.models import Contact  # noqa: F401 — registers model


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()
```

- [ ] **Step 2: Write failing tests for services**

Create `backend/tests/test_services.py`:

```python
import pytest
import pytest_asyncio
from uuid import uuid4

from app.services import (
    create_contact,
    get_contact,
    list_contacts,
    update_contact,
    delete_contact,
    search_contacts,
    find_duplicates,
    merge_contacts,
    ContactConflictError,
)
from app.schemas import ContactCreate, ContactUpdate, MergeRequest


@pytest.mark.asyncio
class TestCreateContact:
    async def test_create_basic_contact(self, db_session):
        data = ContactCreate(
            first_name="John",
            last_name="Doe",
            phone_numbers=["+1 555 123 4567"],
            email_addresses=["john@example.com"],
        )
        contact = await create_contact(db_session, data)
        assert contact.first_name == "John"
        assert contact.phone_numbers == ["+15551234567"]
        assert contact.email_addresses == ["john@example.com"]

    async def test_create_duplicate_phone_raises_conflict(self, db_session):
        data = ContactCreate(
            first_name="Alice",
            phone_numbers=["+15551234567"],
        )
        await create_contact(db_session, data)
        data2 = ContactCreate(
            first_name="Bob",
            phone_numbers=["+15551234567"],
        )
        with pytest.raises(ContactConflictError):
            await create_contact(db_session, data2)

    async def test_create_duplicate_email_raises_conflict(self, db_session):
        data = ContactCreate(
            first_name="Alice",
            email_addresses=["alice@test.com"],
        )
        await create_contact(db_session, data)
        data2 = ContactCreate(
            first_name="Bob",
            email_addresses=["alice@test.com"],
        )
        with pytest.raises(ContactConflictError):
            await create_contact(db_session, data2)


@pytest.mark.asyncio
class TestSearchContacts:
    async def test_search_by_name(self, db_session):
        await create_contact(db_session, ContactCreate(first_name="Jonathan", last_name="Smith"))
        results = await search_contacts(db_session, "jonathan")
        assert len(results) >= 1
        assert results[0].first_name == "Jonathan"

    async def test_search_by_email(self, db_session):
        await create_contact(
            db_session,
            ContactCreate(first_name="Test", email_addresses=["unique@search.com"]),
        )
        results = await search_contacts(db_session, "unique@search.com")
        assert len(results) == 1


@pytest.mark.asyncio
class TestMergeContacts:
    async def test_merge_unions_data(self, db_session):
        c1 = await create_contact(
            db_session,
            ContactCreate(first_name="John", last_name="Doe", phone_numbers=["+15551111111"]),
        )
        c2 = await create_contact(
            db_session,
            ContactCreate(first_name="Johnny", last_name="Doe", phone_numbers=["+15552222222"]),
        )
        merged = await merge_contacts(
            db_session,
            MergeRequest(primary_id=c1.id, secondary_id=c2.id),
        )
        assert "+15551111111" in merged.phone_numbers
        assert "+15552222222" in merged.phone_numbers
        assert c2.id in merged.merged_from

        deleted = await get_contact(db_session, c2.id)
        assert deleted is None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_services.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services'`

- [ ] **Step 4: Implement services.py**

```python
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, func, or_, text, any_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contact
from app.schemas import ContactCreate, ContactUpdate, MergeRequest
from app.utils import normalize_phone, normalize_email, InvalidPhoneError, InvalidEmailError


class ContactConflictError(Exception):
    def __init__(self, conflicting_contact_id: UUID, field: str, value: str):
        self.conflicting_contact_id = conflicting_contact_id
        self.field = field
        self.value = value
        super().__init__(f"Contact with {field} '{value}' already exists")


async def _check_uniqueness(
    session: AsyncSession,
    phones: list[str],
    emails: list[str],
    exclude_id: UUID | None = None,
):
    for phone in phones:
        stmt = select(Contact).where(Contact.phone_numbers.any(phone))
        if exclude_id:
            stmt = stmt.where(Contact.id != exclude_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise ContactConflictError(existing.id, "phone", phone)

    for email in emails:
        stmt = select(Contact).where(Contact.email_addresses.any(email))
        if exclude_id:
            stmt = stmt.where(Contact.id != exclude_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise ContactConflictError(existing.id, "email", email)


def _normalize_phones(phones: list[str]) -> list[str]:
    return [normalize_phone(p, "US") for p in phones]


def _normalize_emails(emails: list[str]) -> list[str]:
    return [normalize_email(e) for e in emails]


async def create_contact(session: AsyncSession, data: ContactCreate) -> Contact:
    phones = _normalize_phones(data.phone_numbers)
    emails = _normalize_emails(data.email_addresses)

    await _check_uniqueness(session, phones, emails)

    contact = Contact(
        first_name=data.first_name,
        last_name=data.last_name,
        phone_numbers=phones,
        email_addresses=emails,
    )
    session.add(contact)
    await session.commit()
    await session.refresh(contact)
    return contact


async def get_contact(session: AsyncSession, contact_id: UUID) -> Contact | None:
    result = await session.execute(select(Contact).where(Contact.id == contact_id))
    return result.scalar_one_or_none()


async def list_contacts(
    session: AsyncSession, page: int = 1, limit: int = 20
) -> tuple[list[Contact], int]:
    count_result = await session.execute(select(func.count(Contact.id)))
    total = count_result.scalar()

    offset = (page - 1) * limit
    result = await session.execute(
        select(Contact).order_by(Contact.first_name).offset(offset).limit(limit)
    )
    contacts = list(result.scalars().all())
    return contacts, total


async def update_contact(
    session: AsyncSession, contact_id: UUID, data: ContactUpdate
) -> Contact | None:
    contact = await get_contact(session, contact_id)
    if not contact:
        return None

    if data.phone_numbers is not None:
        phones = _normalize_phones(data.phone_numbers)
        await _check_uniqueness(session, phones, [], exclude_id=contact_id)
        contact.phone_numbers = phones

    if data.email_addresses is not None:
        emails = _normalize_emails(data.email_addresses)
        await _check_uniqueness(session, [], emails, exclude_id=contact_id)
        contact.email_addresses = emails

    if data.first_name is not None:
        contact.first_name = data.first_name
    if data.last_name is not None:
        contact.last_name = data.last_name

    contact.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(contact)
    return contact


async def delete_contact(session: AsyncSession, contact_id: UUID) -> bool:
    contact = await get_contact(session, contact_id)
    if not contact:
        return False
    await session.delete(contact)
    await session.commit()
    return True


async def search_contacts(session: AsyncSession, query: str) -> list[Contact]:
    q = query.strip()
    if not q:
        return []

    # Detect query type
    if "@" in q:
        # Email search
        normalized = normalize_email(q)
        stmt = select(Contact).where(Contact.email_addresses.any(normalized))
    elif q.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "").isdigit():
        # Phone search
        try:
            normalized = normalize_phone(q, "US")
            stmt = select(Contact).where(Contact.phone_numbers.any(normalized))
        except InvalidPhoneError:
            return []
    else:
        # Name search — fuzzy trigram match
        stmt = (
            select(Contact)
            .where(
                or_(
                    func.similarity(Contact.first_name, q) > 0.3,
                    func.similarity(Contact.last_name, q) > 0.3,
                )
            )
            .order_by(
                func.greatest(
                    func.similarity(Contact.first_name, q),
                    func.coalesce(func.similarity(Contact.last_name, q), 0),
                ).desc()
            )
        )

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def find_duplicates(session: AsyncSession) -> list[dict]:
    duplicate_groups = []

    # Get all contacts
    result = await session.execute(select(Contact))
    contacts = list(result.scalars().all())

    seen_pairs = set()

    for i, c1 in enumerate(contacts):
        for c2 in contacts[i + 1 :]:
            pair_key = tuple(sorted([str(c1.id), str(c2.id)]))
            if pair_key in seen_pairs:
                continue

            # Check shared phone
            shared_phones = set(c1.phone_numbers or []) & set(c2.phone_numbers or [])
            if shared_phones:
                seen_pairs.add(pair_key)
                duplicate_groups.append({
                    "contacts": [c1, c2],
                    "reason": "shared_phone",
                    "similarity_score": 1.0,
                })
                continue

            # Check shared email
            shared_emails = set(c1.email_addresses or []) & set(c2.email_addresses or [])
            if shared_emails:
                seen_pairs.add(pair_key)
                duplicate_groups.append({
                    "contacts": [c1, c2],
                    "reason": "shared_email",
                    "similarity_score": 1.0,
                })
                continue

    # Name similarity via SQL (trigram)
    stmt = text("""
        SELECT c1.id AS id1, c2.id AS id2,
               similarity(c1.first_name || ' ' || COALESCE(c1.last_name, ''),
                           c2.first_name || ' ' || COALESCE(c2.last_name, '')) AS sim
        FROM contacts c1
        JOIN contacts c2 ON c1.id < c2.id
        WHERE similarity(c1.first_name || ' ' || COALESCE(c1.last_name, ''),
                          c2.first_name || ' ' || COALESCE(c2.last_name, '')) > 0.3
    """)
    result = await session.execute(stmt)
    rows = result.fetchall()

    contact_map = {c.id: c for c in contacts}
    for row in rows:
        pair_key = tuple(sorted([str(row.id1), str(row.id2)]))
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)
        if row.id1 in contact_map and row.id2 in contact_map:
            duplicate_groups.append({
                "contacts": [contact_map[row.id1], contact_map[row.id2]],
                "reason": "similar_name",
                "similarity_score": float(row.sim),
            })

    return duplicate_groups


async def merge_contacts(
    session: AsyncSession, merge_req: MergeRequest
) -> Contact:
    primary = await get_contact(session, merge_req.primary_id)
    secondary = await get_contact(session, merge_req.secondary_id)

    if not primary or not secondary:
        raise ValueError("One or both contacts not found")

    # Union phone numbers (deduplicated)
    all_phones = list(dict.fromkeys((primary.phone_numbers or []) + (secondary.phone_numbers or [])))
    primary.phone_numbers = all_phones

    # Union email addresses (deduplicated)
    all_emails = list(dict.fromkeys((primary.email_addresses or []) + (secondary.email_addresses or [])))
    primary.email_addresses = all_emails

    # Track merge history
    merged_from = list(primary.merged_from or [])
    merged_from.append(secondary.id)
    primary.merged_from = merged_from

    primary.updated_at = datetime.utcnow()

    # Delete secondary
    await session.delete(secondary)
    await session.commit()
    await session.refresh(primary)
    return primary


async def get_stats(session: AsyncSession) -> dict:
    total_result = await session.execute(select(func.count(Contact.id)))
    total = total_result.scalar()

    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_result = await session.execute(
        select(func.count(Contact.id)).where(Contact.created_at >= week_ago)
    )
    recent = recent_result.scalar()

    duplicates = await find_duplicates(session)

    return {
        "total_contacts": total,
        "recent_contacts": recent,
        "duplicate_groups": len(duplicates),
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_services.py -v`
Expected: All tests PASS (requires running PostgreSQL with test database)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services.py backend/tests/
git commit -m "feat: add contact services with CRUD, search, dedup, and merge"
```

---

### Task 5: Backend — API Routes

**Files:**
- Create: `backend/app/routes.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create routes.py**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactListResponse,
    MergeRequest,
    DuplicateGroup,
    DuplicateResponse,
    StatsResponse,
)
from app.services import (
    create_contact,
    get_contact,
    list_contacts,
    update_contact,
    delete_contact,
    search_contacts,
    find_duplicates,
    merge_contacts,
    get_stats,
    ContactConflictError,
)
from app.utils import InvalidPhoneError, InvalidEmailError

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.post("", response_model=ContactResponse, status_code=201)
async def create(data: ContactCreate, db: AsyncSession = Depends(get_db)):
    try:
        contact = await create_contact(db, data)
        return contact
    except ContactConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(e),
                "conflicting_contact_id": str(e.conflicting_contact_id),
                "field": e.field,
                "value": e.value,
            },
        )
    except (InvalidPhoneError, InvalidEmailError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=ContactListResponse)
async def list_all(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    contacts, total = await list_contacts(db, page, limit)
    return ContactListResponse(contacts=contacts, total=total, page=page, limit=limit)


@router.get("/search", response_model=list[ContactResponse])
async def search(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    return await search_contacts(db, q)


@router.get("/duplicates", response_model=DuplicateResponse)
async def duplicates(db: AsyncSession = Depends(get_db)):
    groups = await find_duplicates(db)
    return DuplicateResponse(
        duplicate_groups=[
            DuplicateGroup(
                contacts=g["contacts"],
                reason=g["reason"],
                similarity_score=g["similarity_score"],
            )
            for g in groups
        ]
    )


@router.get("/stats", response_model=StatsResponse)
async def stats(db: AsyncSession = Depends(get_db)):
    return await get_stats(db)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_one(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update(
    contact_id: UUID, data: ContactUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        contact = await update_contact(db, contact_id, data)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return contact
    except ContactConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(e),
                "conflicting_contact_id": str(e.conflicting_contact_id),
            },
        )
    except (InvalidPhoneError, InvalidEmailError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{contact_id}", status_code=204)
async def delete(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    deleted = await delete_contact(db, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")


@router.post("/merge", response_model=ContactResponse)
async def merge(data: MergeRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await merge_contacts(db, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

- [ ] **Step 2: Create main.py**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Contact Book API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes.py backend/app/main.py
git commit -m "feat: add API routes and FastAPI app entry point"
```

---

### Task 6: Backend — Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: add backend Dockerfile"
```

---

### Task 7: Frontend — Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/next.config.js`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Initialize Next.js project**

Run: `cd frontend && npx create-next-app@14 . --typescript --tailwind --app --src-dir --no-eslint --no-import-alias`

If the scaffolding tool is unavailable, create files manually (see steps below).

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install swr react-hot-toast`

- [ ] **Step 3: Create `frontend/src/lib/types.ts`**

```typescript
export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_numbers: string[];
  email_addresses: string[];
  merged_from: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}

export interface ContactCreate {
  first_name: string;
  last_name?: string;
  phone_numbers: string[];
  email_addresses: string[];
}

export interface ContactUpdate {
  first_name?: string;
  last_name?: string;
  phone_numbers?: string[];
  email_addresses?: string[];
}

export interface MergeRequest {
  primary_id: string;
  secondary_id: string;
}

export interface DuplicateGroup {
  contacts: Contact[];
  reason: string;
  similarity_score: number;
}

export interface DuplicateResponse {
  duplicate_groups: DuplicateGroup[];
}

export interface Stats {
  total_contacts: number;
  recent_contacts: number;
  duplicate_groups: number;
}
```

- [ ] **Step 4: Create `frontend/src/lib/api.ts`**

```typescript
import type {
  Contact,
  ContactCreate,
  ContactUpdate,
  ContactListResponse,
  DuplicateResponse,
  MergeRequest,
  Stats,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listContacts: (page = 1, limit = 20) =>
    request<ContactListResponse>(`/api/contacts?page=${page}&limit=${limit}`),

  getContact: (id: string) => request<Contact>(`/api/contacts/${id}`),

  createContact: (data: ContactCreate) =>
    request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) }),

  updateContact: (id: string, data: ContactUpdate) =>
    request<Contact>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteContact: (id: string) =>
    request<void>(`/api/contacts/${id}`, { method: "DELETE" }),

  searchContacts: (q: string) => request<Contact[]>(`/api/contacts/search?q=${encodeURIComponent(q)}`),

  getDuplicates: () => request<DuplicateResponse>("/api/contacts/duplicates"),

  mergeContacts: (data: MergeRequest) =>
    request<Contact>("/api/contacts/merge", { method: "POST", body: JSON.stringify(data) }),

  getStats: () => request<Stats>("/api/contacts/stats"),
};
```

- [ ] **Step 5: Update `frontend/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contact Book",
  description: "Personal contact book with smart duplicate detection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend with API client and types"
```

---

### Task 8: Frontend — StatsBar & SearchBar Components

**Files:**
- Create: `frontend/src/components/StatsBar.tsx`
- Create: `frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: Create StatsBar.tsx**

```tsx
import type { Stats } from "@/lib/types";

interface StatsBarProps {
  stats: Stats | undefined;
  onDuplicatesClick: () => void;
}

export default function StatsBar({ stats, onDuplicatesClick }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <p className="text-3xl font-bold text-blue-600">{stats?.total_contacts ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Total Contacts</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <p className="text-3xl font-bold text-green-600">{stats?.recent_contacts ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Added This Week</p>
      </div>
      <button
        onClick={onDuplicatesClick}
        className="bg-white rounded-lg shadow p-4 text-center hover:ring-2 hover:ring-orange-300 transition"
      >
        <p className="text-3xl font-bold text-orange-600">{stats?.duplicate_groups ?? "—"}</p>
        <p className="text-sm text-gray-500 mt-1">Duplicates Found</p>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create SearchBar.tsx**

```tsx
import { useEffect, useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onAdd: () => void;
}

export default function SearchBar({ onSearch, onAdd }: SearchBarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="flex gap-3 mb-6">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, phone, or email..."
        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      />
      <button
        onClick={onAdd}
        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
      >
        + Add Contact
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatsBar.tsx frontend/src/components/SearchBar.tsx
git commit -m "feat: add StatsBar and SearchBar components"
```

---

### Task 9: Frontend — ContactCard & ContactList Components

**Files:**
- Create: `frontend/src/components/ContactCard.tsx`
- Create: `frontend/src/components/ContactList.tsx`

- [ ] **Step 1: Create ContactCard.tsx**

```tsx
import type { Contact } from "@/lib/types";

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

export default function ContactCard({
  contact,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: ContactCardProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 border-2 transition ${
        selected ? "border-blue-500" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(contact.id)}
            className="mt-1 h-4 w-4 accent-blue-600"
          />
          <div>
            <h3 className="font-semibold text-lg">{fullName}</h3>
            {contact.phone_numbers.map((p) => (
              <p key={p} className="text-sm text-gray-600">{p}</p>
            ))}
            {contact.email_addresses.map((e) => (
              <p key={e} className="text-sm text-gray-500">{e}</p>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(contact)}
            className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
          >
            Delete
          </button>
        </div>
      </div>
      {contact.merged_from.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Merged from {contact.merged_from.length} contact(s)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ContactList.tsx**

```tsx
import type { Contact } from "@/lib/types";
import ContactCard from "./ContactCard";

interface ContactListProps {
  contacts: Contact[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onMerge: () => void;
}

export default function ContactList({
  contacts,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
  onMerge,
}: ContactListProps) {
  return (
    <div>
      {selectedIds.size === 2 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-700">2 contacts selected</span>
          <button
            onClick={onMerge}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            Merge Selected
          </button>
        </div>
      )}
      <div className="grid gap-3">
        {contacts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No contacts found</p>
        ) : (
          contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              selected={selectedIds.has(c.id)}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ContactCard.tsx frontend/src/components/ContactList.tsx
git commit -m "feat: add ContactCard and ContactList components"
```

---

### Task 10: Frontend — ContactModal Component

**Files:**
- Create: `frontend/src/components/ContactModal.tsx`

- [ ] **Step 1: Create ContactModal.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import type { Contact, ContactCreate, ContactUpdate } from "@/lib/types";

interface ContactModalProps {
  contact: Contact | null;  // null = create mode
  onSave: (data: ContactCreate | ContactUpdate) => void;
  onClose: () => void;
}

export default function ContactModal({ contact, onSave, onClose }: ContactModalProps) {
  const [firstName, setFirstName] = useState(contact?.first_name ?? "");
  const [lastName, setLastName] = useState(contact?.last_name ?? "");
  const [phones, setPhones] = useState<string[]>(contact?.phone_numbers ?? [""]);
  const [emails, setEmails] = useState<string[]>(contact?.email_addresses ?? [""]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      first_name: firstName,
      last_name: lastName || undefined,
      phone_numbers: phones.filter((p) => p.trim()),
      email_addresses: emails.filter((e) => e.trim()),
    };
    onSave(data);
  };

  const addField = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const updateField = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const removeField = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {contact ? "Edit Contact" : "Add Contact"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Numbers
            </label>
            {phones.map((phone, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={phone}
                  onChange={(e) => updateField(i, e.target.value, setPhones)}
                  placeholder="+1 555 123 4567"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeField(i, setPhones)}
                    className="text-red-500 hover:text-red-700 px-2"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addField(setPhones)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add phone
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Addresses
            </label>
            {emails.map((email, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={email}
                  onChange={(e) => updateField(i, e.target.value, setEmails)}
                  placeholder="john@example.com"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeField(i, setEmails)}
                    className="text-red-500 hover:text-red-700 px-2"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addField(setEmails)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add email
            </button>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {contact ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ContactModal.tsx
git commit -m "feat: add ContactModal component for create/edit"
```

---

### Task 11: Frontend — DuplicatePanel & MergePreview Components

**Files:**
- Create: `frontend/src/components/DuplicatePanel.tsx`
- Create: `frontend/src/components/MergePreview.tsx`

- [ ] **Step 1: Create MergePreview.tsx**

```tsx
import type { Contact } from "@/lib/types";

interface MergePreviewProps {
  primary: Contact;
  secondary: Contact;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MergePreview({
  primary,
  secondary,
  onConfirm,
  onCancel,
}: MergePreviewProps) {
  const mergedPhones = [...new Set([...primary.phone_numbers, ...secondary.phone_numbers])];
  const mergedEmails = [...new Set([...primary.email_addresses, ...secondary.email_addresses])];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Merge Preview</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs font-semibold text-green-700 mb-1">PRIMARY (kept)</p>
            <p className="font-medium">{primary.first_name} {primary.last_name}</p>
            {primary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
            {primary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs font-semibold text-red-700 mb-1">SECONDARY (deleted)</p>
            <p className="font-medium">{secondary.first_name} {secondary.last_name}</p>
            {secondary.phone_numbers.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
            {secondary.email_addresses.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
          </div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">MERGED RESULT</p>
          <p className="font-medium">{primary.first_name} {primary.last_name}</p>
          {mergedPhones.map((p) => <p key={p} className="text-sm text-gray-600">{p}</p>)}
          {mergedEmails.map((e) => <p key={e} className="text-sm text-gray-500">{e}</p>)}
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Confirm Merge
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DuplicatePanel.tsx**

```tsx
"use client";

import type { DuplicateGroup, Contact } from "@/lib/types";
import { useState } from "react";
import MergePreview from "./MergePreview";

interface DuplicatePanelProps {
  groups: DuplicateGroup[];
  onMerge: (primaryId: string, secondaryId: string) => void;
  onClose: () => void;
}

export default function DuplicatePanel({ groups, onMerge, onClose }: DuplicatePanelProps) {
  const [merging, setMerging] = useState<{ primary: Contact; secondary: Contact } | null>(null);

  const reasonLabel = (reason: string, score: number) => {
    if (reason === "similar_name") return `Similar name (${Math.round(score * 100)}% match)`;
    if (reason === "shared_phone") return "Shared phone number";
    if (reason === "shared_email") return "Shared email address";
    return reason;
  };

  if (merging) {
    return (
      <MergePreview
        primary={merging.primary}
        secondary={merging.secondary}
        onConfirm={() => {
          onMerge(merging.primary.id, merging.secondary.id);
          setMerging(null);
        }}
        onCancel={() => setMerging(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Potential Duplicates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            x
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No duplicates detected</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group, i) => (
              <div key={i} className="border rounded-lg p-4">
                <p className="text-xs font-medium text-orange-600 mb-2">
                  {reasonLabel(group.reason, group.similarity_score)}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {group.contacts.map((c) => (
                    <div key={c.id} className="text-sm">
                      <p className="font-medium">{c.first_name} {c.last_name}</p>
                      {c.phone_numbers.map((p) => <p key={p} className="text-gray-600">{p}</p>)}
                      {c.email_addresses.map((e) => <p key={e} className="text-gray-500">{e}</p>)}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setMerging({ primary: group.contacts[0], secondary: group.contacts[1] })
                  }
                  className="w-full py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
                >
                  Review & Merge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DuplicatePanel.tsx frontend/src/components/MergePreview.tsx
git commit -m "feat: add DuplicatePanel and MergePreview components"
```

---

### Task 12: Frontend — Main Dashboard Page

**Files:**
- Create: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create page.tsx**

```tsx
"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { Contact, ContactCreate, ContactUpdate } from "@/lib/types";
import StatsBar from "@/components/StatsBar";
import SearchBar from "@/components/SearchBar";
import ContactList from "@/components/ContactList";
import ContactModal from "@/components/ContactModal";
import DuplicatePanel from "@/components/DuplicatePanel";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<Contact | null | "new">(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const { data: contactsData, mutate: mutateContacts } = useSWR(
    searchQuery ? null : "contacts",
    () => api.listContacts(1, 100)
  );

  const { data: searchResults, mutate: mutateSearch } = useSWR(
    searchQuery ? `search-${searchQuery}` : null,
    () => api.searchContacts(searchQuery)
  );

  const { data: stats, mutate: mutateStats } = useSWR("stats", api.getStats);

  const { data: duplicates, mutate: mutateDuplicates } = useSWR(
    showDuplicates ? "duplicates" : null,
    api.getDuplicates
  );

  const contacts = searchQuery
    ? searchResults ?? []
    : contactsData?.contacts ?? [];

  const refreshAll = useCallback(() => {
    mutateContacts();
    mutateSearch();
    mutateStats();
    mutateDuplicates();
  }, [mutateContacts, mutateSearch, mutateStats, mutateDuplicates]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSave = async (data: ContactCreate | ContactUpdate) => {
    try {
      if (editingContact && editingContact !== "new") {
        await api.updateContact(editingContact.id, data as ContactUpdate);
        toast.success("Contact updated");
      } else {
        await api.createContact(data as ContactCreate);
        toast.success("Contact created");
      }
      setEditingContact(null);
      refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save contact");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await api.deleteContact(id);
      toast.success("Contact deleted");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refreshAll();
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const handleMerge = async (primaryId?: string, secondaryId?: string) => {
    const ids = primaryId && secondaryId
      ? [primaryId, secondaryId]
      : Array.from(selectedIds);
    if (ids.length !== 2) return;

    try {
      await api.mergeContacts({ primary_id: ids[0], secondary_id: ids[1] });
      toast.success("Contacts merged");
      setSelectedIds(new Set());
      setShowDuplicates(false);
      refreshAll();
    } catch {
      toast.error("Failed to merge contacts");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Contact Book</h1>
      <StatsBar stats={stats} onDuplicatesClick={() => setShowDuplicates(true)} />
      <SearchBar onSearch={handleSearch} onAdd={() => setEditingContact("new")} />
      <ContactList
        contacts={contacts}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onEdit={setEditingContact}
        onDelete={handleDelete}
        onMerge={() => handleMerge()}
      />

      {editingContact !== null && (
        <ContactModal
          contact={editingContact === "new" ? null : editingContact}
          onSave={handleSave}
          onClose={() => setEditingContact(null)}
        />
      )}

      {showDuplicates && (
        <DuplicatePanel
          groups={duplicates?.duplicate_groups ?? []}
          onMerge={(p, s) => handleMerge(p, s)}
          onClose={() => setShowDuplicates(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: add main dashboard page with full contact management"
```

---

### Task 13: Frontend — Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat: add frontend Dockerfile"
```

---

### Task 14: Docker Compose & README

**Files:**
- Create: `docker-compose.yml`
- Modify: `README.md`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: contactbook
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/contactbook
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - api

volumes:
  pgdata:
```

- [ ] **Step 2: Create README.md**

```markdown
# Contact Book

A personal contact book application with smart duplicate detection and merge capabilities.

## Features

- **CRUD contacts** — create, view, edit, and delete contacts with multiple phone numbers and emails
- **Smart search** — search by name (fuzzy), phone number, or email address
- **Duplicate detection** — automatically detects potential duplicate contacts using fuzzy name matching and shared phone/email
- **Contact merging** — merge two contacts with a visual preview, combining all phone numbers and emails
- **Dashboard** — stats overview showing total contacts, recent additions, and detected duplicates

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
- **API Docs:** http://localhost:8000/docs

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
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml README.md
git commit -m "feat: add Docker Compose setup and README"
```

---

### Task 15: Architecture Document

**Files:**
- Create: `ARCHITECTURE.md`

- [ ] **Step 1: Create ARCHITECTURE.md**

````markdown
# Architecture: Web-Scale Contact Book

This document describes the architectural changes needed to deploy the Contact Book as a production web application serving thousands of concurrent users.

## Current Architecture (Local)

```
┌──────────┐    ┌──────────┐    ┌────────────┐
│ Next.js  │───>│ FastAPI   │───>│ PostgreSQL │
│ :3000    │    │ :8000     │    │ :5432      │
└──────────┘    └──────────┘    └────────────┘
     Docker Compose (single host)
```

## Production Architecture

```
                    ┌─────────────┐
                    │   CDN       │
                    │ CloudFront  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Load        │
                    │ Balancer    │
                    │ (ALB/NLB)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
       │ API Pod │  │ API Pod │  │ API Pod │
       │ FastAPI │  │ FastAPI │  │ FastAPI │
       └────┬────┘  └────┬────┘  └────┬────┘
            │             │            │
            └─────────┬───┘────────────┘
                      │
              ┌───────▼───────┐
              │  PgBouncer    │
              │  Connection   │
              │  Pool         │
              └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         │                         │
  ┌──────▼──────┐          ┌──────▼──────┐
  │ PostgreSQL  │          │ PostgreSQL  │
  │ Primary     │─────────>│ Read        │
  │ (writes)    │ streaming│ Replica     │
  └──────┬──────┘ replica  └─────────────┘
         │
  ┌──────▼──────┐          ┌─────────────┐
  │ Redis       │          │ Elasticsearch│
  │ Cache       │          │ Search      │
  └─────────────┘          └─────────────┘
```

## 1. Authentication & Authorization

### Current State
No authentication — single-user local application.

### Production Design

**JWT + OAuth2 flow:**
- Users authenticate via OAuth2 providers (Google, GitHub) or email/password
- Server issues short-lived JWT access tokens (15 min) and long-lived refresh tokens (7 days)
- Refresh tokens stored in HttpOnly cookies; access tokens in memory
- Each API request includes `Authorization: Bearer <token>` header

**Implementation:**
- FastAPI middleware validates JWT on every request
- User model with `id`, `email`, `password_hash`, `oauth_provider`, `oauth_id`
- Role-based access: `admin` (manage all users), `user` (manage own contacts)
- Rate limiting per user identity, not just IP

**Libraries:** `python-jose` for JWT, `passlib` for password hashing, `authlib` for OAuth2

## 2. Multi-Tenancy

### Data Isolation

**Row-Level Security (RLS):**
- Add `user_id` foreign key to `contacts` table
- PostgreSQL RLS policies ensure users can only query their own contacts
- API middleware sets `current_user_id` session variable for RLS enforcement

```sql
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_isolation ON contacts
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

**Benefits:** Single database, no schema duplication, transparent to application code.

### Scaling Path
For enterprise (10k+ users per tenant), consider schema-per-tenant or database-per-tenant for stronger isolation and independent scaling.

## 3. Rate Limiting

### API Gateway Level
- **Token bucket algorithm** at the load balancer (e.g., AWS WAF, Kong, nginx)
- Limits: 100 requests/minute per authenticated user, 20 requests/minute for unauthenticated
- Separate limits for write operations (20/min) vs read operations (100/min)

### Application Level
- FastAPI middleware with Redis-backed rate limiter (`slowapi`)
- Endpoint-specific limits: search (30/min), merge (10/min), bulk operations (5/min)

### Response
- Return `429 Too Many Requests` with `Retry-After` header
- Include rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 4. Caching Layer

### Redis Cache Strategy

**Cached data:**
- Individual contact lookups: `contact:{id}` — TTL 5 min
- Contact list for user: `user:{id}:contacts:page:{n}` — TTL 2 min
- Stats: `user:{id}:stats` — TTL 1 min
- Search results: `search:{user_id}:{hash(query)}` — TTL 1 min

**Invalidation:**
- Write-through: invalidate relevant cache keys on create/update/delete
- Pattern-based invalidation: `SCAN` for `user:{id}:*` on contact changes
- Stats cache invalidated on any write operation

**Cache aside pattern:**
1. Check Redis for cached result
2. On miss, query PostgreSQL
3. Store result in Redis with TTL
4. Return result

## 5. Search at Scale

### Current: pg_trgm
Works well up to ~100k contacts. Trigram indexes handle fuzzy name matching with acceptable latency.

### Production: Elasticsearch

**When to migrate:** When search latency exceeds 200ms or contact count exceeds 500k per tenant.

**Architecture:**
- Elasticsearch cluster (3 nodes minimum) with dedicated search indices per tenant
- Async indexing via message queue (RabbitMQ/SQS): contact changes publish events, a worker consumes and updates ES
- API search endpoint queries ES instead of PostgreSQL
- Fallback to PostgreSQL if ES is unavailable

**Features unlocked:**
- Full-text search across all fields simultaneously
- Phonetic matching (Soundex/Metaphone) for name search
- Autocomplete suggestions
- Search result highlighting
- Relevance scoring tuning

## 6. Database Scaling

### Connection Pooling
- **PgBouncer** in front of PostgreSQL in transaction mode
- Pool size: 20 connections per API pod, max 100 total connections
- Eliminates connection overhead for short-lived async requests

### Read Replicas
- Streaming replication to 1-2 read replicas
- Route read-heavy queries (search, list, stats, duplicates) to replicas
- Write queries (create, update, delete, merge) to primary
- SQLAlchemy `bind` configuration for read/write splitting

### Partitioning
- Range partition `contacts` table by `created_at` (monthly partitions)
- Or hash partition by `user_id` for even distribution across partitions
- Enables efficient data archival and per-partition maintenance

### Backup
- Continuous WAL archiving to S3
- Daily base backups with point-in-time recovery
- Cross-region replication for disaster recovery

## 7. Frontend Deployment

### Static Export
- Next.js static export (`next build && next export`) to S3/CloudFront
- CDN edge caching for global low-latency access
- Cache-busting via content hashing in filenames

### Alternatively: Vercel
- Deploy to Vercel for automatic edge network, preview deployments, and zero-config
- Environment variables for API URL per environment (staging/production)

### Performance
- Code splitting per route (automatic with Next.js App Router)
- Image optimization (if contact avatars are added later)
- Service worker for offline access to cached contact list

## 8. Container Orchestration (Kubernetes)

### Deployment
```yaml
# API Deployment
replicas: 3
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits: { cpu: 500m, memory: 512Mi }
strategy:
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

### Horizontal Pod Autoscaler
- Scale API pods on CPU utilization (target: 70%) and request latency (target: 200ms p95)
- Min replicas: 2, Max replicas: 10

### Health Checks
- Liveness probe: `GET /health` — restarts pod on failure
- Readiness probe: `GET /health` with DB connectivity check — removes from load balancer if unhealthy
- Startup probe: 30s timeout for initial DB connection and migration

### Namespaces
- `production`, `staging`, `development` namespaces with resource quotas
- Network policies restricting cross-namespace traffic

## 9. CI/CD Pipeline

### GitHub Actions Workflow

```
Push to main
  ├── Lint (ruff, eslint)
  ├── Type Check (mypy, tsc)
  ├── Unit Tests (pytest, jest)
  ├── Integration Tests (testcontainers + PostgreSQL)
  ├── Build Docker Images
  ├── Push to ECR
  ├── Deploy to Staging
  ├── Run E2E Tests (Playwright)
  └── Promote to Production (manual approval)
```

### Feature Branch Flow
- PR created → lint + test + build
- Passing checks required for merge
- Preview deployments for frontend (Vercel/Netlify)
- Database migration dry-run on staging

### Release Strategy
- Semantic versioning with automated changelog
- Blue-green deployments: new version runs alongside old, traffic switched after health check
- Instant rollback: revert to previous container image tag

## 10. Observability

### Structured Logging
- JSON log format with correlation IDs
- Log levels: DEBUG (dev), INFO (staging), WARN (production)
- Log aggregation: ELK stack (Elasticsearch, Logstash, Kibana) or Datadog
- Request/response logging with PII redaction (mask phone numbers, emails in logs)

### Metrics (Prometheus + Grafana)
- **API metrics:** request count, latency (p50/p95/p99), error rate per endpoint
- **Business metrics:** contacts created/day, merges/day, duplicate detection rate
- **Infrastructure:** CPU, memory, disk, network per pod
- **Database:** query latency, connection pool usage, replication lag

### Distributed Tracing (OpenTelemetry)
- Trace requests across API → database → cache → search
- Identify slow queries and bottlenecks
- Jaeger or Tempo as trace backend

### Alerting
- PagerDuty integration for critical alerts
- Alert conditions: error rate > 5%, p99 latency > 2s, replication lag > 30s
- Runbooks linked to each alert for fast incident response

## 11. Security Hardening

- **HTTPS everywhere** — TLS 1.3 termination at load balancer
- **CORS** — restrict to known frontend domains
- **Input validation** — Pydantic models with strict type checking (already in place)
- **SQL injection** — SQLAlchemy parameterized queries (already in place)
- **Dependency scanning** — Dependabot + Snyk for vulnerability detection
- **Secrets management** — AWS Secrets Manager or HashiCorp Vault, never in env vars or code
- **Audit logging** — log all data modifications with user ID, timestamp, before/after values
````

- [ ] **Step 2: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: add web-scale architecture document"
```

---

## Self-Review

**Spec coverage:**
- CRUD contacts: Tasks 4, 5 (backend), 9, 10, 12 (frontend)
- Search by name/phone/email: Task 4 (services), Task 5 (routes), Task 8 (SearchBar), Task 12 (page)
- Delete contact: Task 4 (services), Task 5 (routes), Task 12 (page)
- Merge contacts: Task 4 (services), Task 5 (routes), Task 11 (DuplicatePanel/MergePreview), Task 12 (page)
- Duplicate detection: Task 4 (services), Task 5 (routes), Task 8 (StatsBar), Task 11 (DuplicatePanel)
- Architecture doc: Task 15
- Docker Compose: Task 14
- README with run instructions: Task 14

**Placeholder scan:** No TBDs, TODOs, or vague instructions found.

**Type consistency:** `Contact`, `ContactCreate`, `ContactUpdate`, `MergeRequest`, `DuplicateGroup`, `DuplicateResponse`, `Stats`/`StatsResponse` — consistent between backend schemas, frontend types, and API client.
