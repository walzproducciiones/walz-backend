import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Numeric,
    UUID,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class PlatformEconomySetting(Base):
    __tablename__ = "platform_economy_settings"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Interruptor general de la economia transaccional de WalZ One.
    # Debe comenzar desactivado para no generar cargos por accidente.
    economy_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Porcentaje de comision por defecto.
    # Ejemplo: 5.0000 representa una comision del 5 %.
    default_commission_rate = Column(
        Numeric(7, 4),
        nullable=False,
        default=0,
        server_default="0",
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
