from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, func, or_, text
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

    if "@" in q:
        normalized = normalize_email(q)
        stmt = select(Contact).where(Contact.email_addresses.any(normalized))
    elif q.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "").isdigit():
        try:
            normalized = normalize_phone(q, "US")
            stmt = select(Contact).where(Contact.phone_numbers.any(normalized))
        except InvalidPhoneError:
            return []
    else:
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

    result = await session.execute(select(Contact))
    contacts = list(result.scalars().all())

    seen_pairs = set()

    for i, c1 in enumerate(contacts):
        for c2 in contacts[i + 1:]:
            pair_key = tuple(sorted([str(c1.id), str(c2.id)]))
            if pair_key in seen_pairs:
                continue

            shared_phones = set(c1.phone_numbers or []) & set(c2.phone_numbers or [])
            if shared_phones:
                seen_pairs.add(pair_key)
                duplicate_groups.append({
                    "contacts": [c1, c2],
                    "reason": "shared_phone",
                    "similarity_score": 1.0,
                })
                continue

            shared_emails = set(c1.email_addresses or []) & set(c2.email_addresses or [])
            if shared_emails:
                seen_pairs.add(pair_key)
                duplicate_groups.append({
                    "contacts": [c1, c2],
                    "reason": "shared_email",
                    "similarity_score": 1.0,
                })
                continue

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


async def merge_contacts(session: AsyncSession, merge_req: MergeRequest) -> Contact:
    primary = await get_contact(session, merge_req.primary_id)
    secondary = await get_contact(session, merge_req.secondary_id)

    if not primary or not secondary:
        raise ValueError("One or both contacts not found")

    all_phones = list(dict.fromkeys((primary.phone_numbers or []) + (secondary.phone_numbers or [])))
    primary.phone_numbers = all_phones

    all_emails = list(dict.fromkeys((primary.email_addresses or []) + (secondary.email_addresses or [])))
    primary.email_addresses = all_emails

    merged_from = list(primary.merged_from or [])
    merged_from.append(secondary.id)
    primary.merged_from = merged_from

    primary.updated_at = datetime.utcnow()

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
