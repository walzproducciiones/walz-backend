import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, Text, UUID
from sqlalchemy.sql import func

from backend.app.database.session import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    name = Column(String(160), nullable=False)
    slug = Column(String(180), nullable=True, unique=True, index=True)
    logo_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)
    city = Column(String(120), nullable=True)
    address = Column(String(250), nullable=True)
    business_categories = Column(JSON, nullable=False, default=list)

    avanter_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )
    avanter_title = Column(String(160), nullable=True)
    avanter_text = Column(Text, nullable=True)
    avanter_image_url = Column(String(500), nullable=True)

    delivery_enabled = Column(Boolean, nullable=False, default=True, server_default="1")
    pickup_enabled = Column(Boolean, nullable=False, default=True, server_default="1")
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())