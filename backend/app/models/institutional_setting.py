import uuid

from sqlalchemy import Column, DateTime, String, Text, UUID
from sqlalchemy.sql import func

from backend.app.database.session import Base


class InstitutionalSetting(Base):
    __tablename__ = "institutional_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    institutional_name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)

    email = Column(String(250), nullable=True)
    phone = Column(String(60), nullable=True)
    whatsapp = Column(String(60), nullable=True)

    city = Column(String(120), nullable=True)
    address = Column(String(250), nullable=True)

    website_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
