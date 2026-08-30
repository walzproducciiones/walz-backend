import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    UUID,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class StorePaymentMethod(Base):
    __tablename__ = "store_payment_methods"

    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "method",
            name="uq_store_payment_methods_store_method",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True,
    )

    method = Column(
        String(40),
        nullable=False,
    )

    provider = Column(
        String(60),
        nullable=False,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    allow_pay_on_pickup = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    account_holder = Column(
        String(160),
        nullable=True,
    )

    account_alias = Column(
        String(120),
        nullable=True,
    )

    account_cbu_cvu = Column(
        String(40),
        nullable=True,
    )

    bank_name = Column(
        String(120),
        nullable=True,
    )

    instructions = Column(
        String(500),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
    )
