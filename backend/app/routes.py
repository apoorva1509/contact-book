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
