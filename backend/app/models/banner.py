import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UUID
from sqlalchemy.sql import func

from backend.app.database.session import Base


class Banner(Base):
    __tablename__ = "banners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(160), nullable=False)
    subtitle = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=False)
    link_url = Column(String(500), nullable=True)
    button_text = Column(String(60), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    display_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())