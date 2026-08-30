from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.economic_ledger_entry import (
    EconomicLedgerEntry,
    EconomicLedgerEntryType,
)
from backend.app.models.order import Order, OrderStatus
from backend.app.models.payment import Payment, PaymentStatus
from backend.app.models.store import Store


def consolidate_order_economy(
    db: Session,
    order_id: UUID,
):
    order = (
        db.query(Order)
        .filter(Order.id == order_id)
        .with_for_update()
        .first()
    )

    if not order:
        return None

    if order.status != OrderStatus.DELIVERED:
        return None

    if not bool(order.economy_enabled_snapshot):
        return None

    if order.platform_fee_amount is None:
        raise ValueError(
            "El pedido no tiene importe de comision economica."
        )

    if order.platform_fee_rate is None:
        raise ValueError(
            "El pedido no tiene porcentaje de comision economica."
        )

    if order.platform_fee_base is None:
        raise ValueError(
            "El pedido no tiene base de comision economica."
        )

    if order.seller_net_amount is None:
        raise ValueError(
            "El pedido no tiene neto economico del vendedor."
        )

    if not order.store_id:
        raise ValueError(
            "El pedido no tiene tienda asociada."
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.status == PaymentStatus.APPROVED,
        )
        .order_by(
            Payment.approved_at.desc(),
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
        .with_for_update()
        .first()
    )

    if not payment:
        return None

    existing_entry = (
        db.query(EconomicLedgerEntry)
        .filter(
            EconomicLedgerEntry.order_id == order.id,
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_ACCRUED,
        )
        .with_for_update()
        .first()
    )

    if existing_entry:
        return existing_entry

    store = (
        db.query(Store)
        .filter(Store.id == order.store_id)
        .first()
    )

    if not store:
        raise ValueError(
            "La tienda economica del pedido no existe."
        )

    fee_amount = Decimal(
        str(order.platform_fee_amount)
    ).quantize(
        Decimal("0.01")
    )

    if fee_amount < Decimal("0.00"):
        raise ValueError(
            "La comision economica no puede ser negativa."
        )

    if fee_amount == Decimal("0.00"):
        return None

    entry = EconomicLedgerEntry(
        order_id=order.id,
        payment_id=payment.id,
        store_id=order.store_id,
        seller_id=store.owner_id,
        entry_type=(
            EconomicLedgerEntryType.PLATFORM_FEE_ACCRUED
        ),
        amount=fee_amount,
        currency=order.currency or "ARS",
        platform_fee_rate=order.platform_fee_rate,
        platform_fee_base=order.platform_fee_base,
        seller_net_amount=order.seller_net_amount,
    )

    db.add(entry)
    db.flush()

    return entry
