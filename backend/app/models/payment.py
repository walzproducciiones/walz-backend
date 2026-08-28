import enum
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Numeric,
    String,
    UUID,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    REPORTED = "reported"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
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

    status = Column(
        SqlEnum(
            PaymentStatus,
            name="paymentstatus",
        ),
        nullable=False,
        default=PaymentStatus.PENDING,
        index=True,
    )

    amount = Column(
        Numeric(14, 2),
        nullable=False,
    )

    currency = Column(
        String(3),
        nullable=False,
        default="ARS",
        server_default="ARS",
    )

    external_reference = Column(
        String(255),
        nullable=True,
        index=True,
    )

    provider_payment_id = Column(
        String(255),
        nullable=True,
        index=True,
    )

    reported_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    approved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    rejected_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
