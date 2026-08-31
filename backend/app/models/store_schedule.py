import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
    UUID,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class StoreScheduleSetting(Base):
    __tablename__ = "store_schedule_settings"

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        primary_key=True,
    )

    timezone_name = Column(
        String(80),
        nullable=False,
        default="America/Argentina/Buenos_Aires",
        server_default="America/Argentina/Buenos_Aires",
    )

    online_order_mode = Column(
        String(30),
        nullable=False,
        default="ALWAYS",
        server_default="ALWAYS",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
    )


class StoreSchedulePeriod(Base):
    __tablename__ = "store_schedule_periods"

    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "period_type",
            "name",
            name="uq_store_schedule_period_store_type_name",
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

    period_type = Column(
        String(20),
        nullable=False,
    )

    name = Column(
        String(120),
        nullable=False,
    )

    valid_from = Column(
        Date,
        nullable=True,
    )

    valid_until = Column(
        Date,
        nullable=True,
    )

    recurs_annually = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
    )


class StoreScheduleInterval(Base):
    __tablename__ = "store_schedule_intervals"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    period_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_schedule_periods.id"),
        nullable=False,
        index=True,
    )

    weekday = Column(
        Integer,
        nullable=False,
    )

    opens_at = Column(
        Time,
        nullable=False,
    )

    closes_at = Column(
        Time,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class StoreScheduleException(Base):
    __tablename__ = "store_schedule_exceptions"

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

    start_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    end_date = Column(
        Date,
        nullable=False,
    )

    mode = Column(
        String(30),
        nullable=False,
    )

    label = Column(
        String(120),
        nullable=True,
    )

    public_message = Column(
        String(500),
        nullable=True,
    )

    online_order_override = Column(
        String(20),
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


class StoreScheduleExceptionInterval(Base):
    __tablename__ = "store_schedule_exception_intervals"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    exception_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_schedule_exceptions.id"),
        nullable=False,
        index=True,
    )

    opens_at = Column(
        Time,
        nullable=False,
    )

    closes_at = Column(
        Time,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
