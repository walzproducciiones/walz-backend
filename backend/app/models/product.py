import uuid

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    ForeignKey,
    UUID,
    Text,
    DateTime,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from backend.app.database.session import Base


class Product(Base):

    __tablename__ = "products"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    seller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    name = Column(
        String(200),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    price = Column(
        Float,
        nullable=False
    )

    offer_price = Column(
        Float,
        nullable=True
    )

    offer_active = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    commercial_type = Column(
        String(50),
        nullable=True
    )

    commercial_text = Column(
        String(200),
        nullable=True
    )

    commercial_active = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    commercial_started_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    stock = Column(
        Integer,
        default=0
    )

    category = Column(
        String(100),
        nullable=True
    )

    subcategory = Column(
        String(100),
        nullable=True
    )

    brand = Column(
        String(100),
        nullable=True
    )

    avanter_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    image_url = Column(
        String(500),
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True
    )

    publication_status = Column(
        String(20),
        nullable=False,
        default="PUBLISHED",
        server_default="PUBLISHED"
    )

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )

    seller = relationship(
        "User",
        back_populates="products"
    )
