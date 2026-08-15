import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UUID
from sqlalchemy.sql import func

from backend.app.database.session import Base


class SellerApplication(Base):
    __tablename__ = "seller_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    business_name = Column(String(160), nullable=False)
    city = Column(String(120), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    admin_note = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())