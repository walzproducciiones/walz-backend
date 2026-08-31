import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UUID,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Puede estar vinculada a una tienda WalZ One o ser una farmacia externa.
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=True,
        unique=True,
        index=True,
    )

    name = Column(String(160), nullable=False)
    phone = Column(String(40), nullable=True)
    whatsapp = Column(String(40), nullable=True)
    email = Column(String(200), nullable=True)
    address = Column(String(250), nullable=True)

    locality = Column(String(120), nullable=True)
    region = Column(String(120), nullable=True)
    country_code = Column(String(2), nullable=True)
    timezone = Column(
        String(64),
        nullable=False,
        default="America/Argentina/Buenos_Aires",
        server_default="America/Argentina/Buenos_Aires",
    )

    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )


class PharmacyDutyArea(Base):
    __tablename__ = "pharmacy_duty_areas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(160), nullable=False)
    locality = Column(String(120), nullable=True)
    region = Column(String(120), nullable=True)
    country_code = Column(String(2), nullable=True)

    timezone = Column(
        String(64),
        nullable=False,
        default="America/Argentina/Buenos_Aires",
        server_default="America/Argentina/Buenos_Aires",
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )


class PharmacyDutyAssignment(Base):
    __tablename__ = "pharmacy_duty_assignments"

    __table_args__ = (
        CheckConstraint(
            "ends_at > starts_at",
            name="ck_pharmacy_duty_assignment_dates",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    pharmacy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pharmacies.id"),
        nullable=False,
        index=True,
    )

    area_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pharmacy_duty_areas.id"),
        nullable=False,
        index=True,
    )

    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)

    status = Column(
        String(30),
        nullable=False,
        default="SCHEDULED",
        server_default="SCHEDULED",
    )

    public_note = Column(Text, nullable=True)

    published_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )


class PharmacyDutyReplacement(Base):
    __tablename__ = "pharmacy_duty_replacements"

    __table_args__ = (
        CheckConstraint(
            "ends_at > starts_at",
            name="ck_pharmacy_duty_replacement_dates",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pharmacy_duty_assignments.id"),
        nullable=False,
        index=True,
    )

    replacement_pharmacy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pharmacies.id"),
        nullable=False,
        index=True,
    )

    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)

    status = Column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    reason = Column(String(250), nullable=True)
    public_note = Column(Text, nullable=True)

    published_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )
