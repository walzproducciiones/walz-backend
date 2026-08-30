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
    UniqueConstraint,
)
from sqlalchemy.sql import func

from backend.app.database.session import Base


class EconomicLedgerEntryType(str, enum.Enum):
    PLATFORM_FEE_ACCRUED = "platform_fee_accrued"
    PLATFORM_FEE_REVERSAL = "platform_fee_reversal"


class EconomicLedgerEntry(Base):
    __tablename__ = "economic_ledger_entries"

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "entry_type",
            name="uq_economic_ledger_order_entry_type",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # El pedido es la identidad economica principal.
    # Un mismo pedido puede tener varios intentos de pago,
    # pero una sola comision devengada.
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
    )

    # Pago aprobado que completo la condicion economica.
    # Puede ser NULL en movimientos futuros que no nazcan
    # directamente de un pago.
    payment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payments.id"),
        nullable=True,
        index=True,
    )

    # Snapshot de pertenencia economica para consultas
    # historicas y separacion multivendedor.
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True,
    )

    seller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    entry_type = Column(
        SqlEnum(
            EconomicLedgerEntryType,
            name="economicledgerentrytype",
        ),
        nullable=False,
        index=True,
    )

    # Importe firmado del movimiento para WalZ One.
    # Comision devengada: positivo.
    # Reverso futuro: negativo.
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

    # Copia del snapshot economico del pedido.
    # Nunca se recalcula usando una configuracion posterior.
    platform_fee_rate = Column(
        Numeric(7, 4),
        nullable=False,
    )

    platform_fee_base = Column(
        Numeric(14, 2),
        nullable=False,
    )

    seller_net_amount = Column(
        Numeric(14, 2),
        nullable=False,
    )

    # Permite vincular un reverso futuro con el asiento
    # original sin modificar destructivamente aquel registro.
    reverses_entry_id = Column(
        UUID(as_uuid=True),
        ForeignKey("economic_ledger_entries.id"),
        nullable=True,
        unique=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
