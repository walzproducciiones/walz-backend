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
    placement = Column(
        String(40),
        nullable=False,
        default="CENTRAL_MARKETPLACE",
        server_default="CENTRAL_MARKETPLACE",
    )
    audience = Column(
        String(40),
        nullable=False,
        default="PUBLIC",
        server_default="PUBLIC",
    )
    style_variant = Column(
        String(40),
        nullable=False,
        default="STANDARD",
        server_default="STANDARD",
    )
    motion_variant = Column(
        String(40),
        nullable=False,
        default="STATIC",
        server_default="STATIC",
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    approval_status = Column(String(20), nullable=False, default="approved", server_default="approved")
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
