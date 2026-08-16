import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UUID
from sqlalchemy.sql import func
from backend.app.database.session import Base

class EmailChangeToken(Base):
    __tablename__ = "email_change_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    new_email = Column(String(150), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)