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
