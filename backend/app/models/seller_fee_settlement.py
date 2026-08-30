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


class SellerFeeSettlementStatus(str, enum.Enum):
    RECORDED = "recorded"
    CANCELLED = "cancelled"


class SellerFeeSettlement(Base):
    __tablename__ = "seller_fee_settlements"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Vendedor cuya deuda/comision con WalZ One se cancela.
    seller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Tienda asociada al vendedor en el momento del registro.
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True,
    )

    # Administrador que registro el pago/liquidacion.
    created_by_admin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    status = Column(
        SqlEnum(
            SellerFeeSettlementStatus,
            name="sellerfeesettlementstatus",
        ),
        nullable=False,
        default=SellerFeeSettlementStatus.RECORDED,
        index=True,
    )

    # Importe abonado por el vendedor a WalZ One.
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

    # Medio informado del pago. No ejecuta cobros automaticos.
    method = Column(
        String(60),
        nullable=True,
    )

    # Referencia externa opcional: transferencia, comprobante, etc.
    reference = Column(
        String(160),
        nullable=True,
    )

    notes = Column(
        String(500),
        nullable=True,
    )

    settled_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
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
