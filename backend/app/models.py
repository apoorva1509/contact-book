import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Index
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    phone_numbers = Column(ARRAY(String), default=list)
    email_addresses = Column(ARRAY(String), default=list)
    avatar_url = Column(String(500), nullable=True)
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
