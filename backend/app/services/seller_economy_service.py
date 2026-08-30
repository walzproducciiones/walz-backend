from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.models.economic_ledger_entry import (
    EconomicLedgerEntry,
    EconomicLedgerEntryType,
)
from backend.app.models.seller_fee_settlement import (
    SellerFeeSettlement,
    SellerFeeSettlementStatus,
)
from backend.app.models.store import Store
from backend.app.models.user import User


ZERO = Decimal("0.00")


def _decimal(value) -> Decimal:
    return Decimal(str(value or ZERO)).quantize(Decimal("0.01"))


def _get_seller_and_store(
    db: Session,
    seller_id: UUID,
):
    seller = (
        db.query(User)
        .filter(User.id == seller_id)
        .first()
    )

    if not seller:
        raise ValueError("Vendedor no encontrado.")

    store = (
        db.query(Store)
        .filter(Store.owner_id == seller_id)
        .first()
    )

    if not store:
        raise ValueError(
            "El vendedor no tiene una tienda asociada."
        )

    return seller, store


def get_seller_economic_account(
    db: Session,
    seller_id: UUID,
):
    seller, store = _get_seller_and_store(
        db,
        seller_id,
    )

    accrued_amount = (
        db.query(
            func.coalesce(
                func.sum(EconomicLedgerEntry.amount),
                0,
            )
        )
        .filter(
            EconomicLedgerEntry.seller_id == seller_id,
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_ACCRUED,
        )
        .scalar()
        or ZERO
    )

    reversal_amount = (
        db.query(
            func.coalesce(
                func.sum(EconomicLedgerEntry.amount),
                0,
            )
        )
        .filter(
            EconomicLedgerEntry.seller_id == seller_id,
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_REVERSAL,
        )
        .scalar()
        or ZERO
    )

    net_fee_amount = (
        db.query(
            func.coalesce(
                func.sum(EconomicLedgerEntry.amount),
                0,
            )
        )
        .filter(
            EconomicLedgerEntry.seller_id == seller_id,
        )
        .scalar()
        or ZERO
    )

    settled_amount = (
        db.query(
            func.coalesce(
                func.sum(SellerFeeSettlement.amount),
                0,
            )
        )
        .filter(
            SellerFeeSettlement.seller_id == seller_id,
            SellerFeeSettlement.status
            == SellerFeeSettlementStatus.RECORDED,
        )
        .scalar()
        or ZERO
    )

    accrued_amount = _decimal(accrued_amount)
    reversal_amount = _decimal(reversal_amount)
    net_fee_amount = _decimal(net_fee_amount)
    settled_amount = _decimal(settled_amount)

    pending_amount = _decimal(
        net_fee_amount - settled_amount
    )

    seller_name = " ".join(
        part
        for part in (
            getattr(seller, "first_name", None),
            getattr(seller, "last_name", None),
        )
        if part
    ).strip()

    return {
        "seller_id": seller.id,
        "seller_name": seller_name or seller.email,
        "seller_email": seller.email,
        "store_id": store.id,
        "store_name": store.name,
        "store_slug": store.slug,
        "accrued_amount": accrued_amount,
        "reversal_amount": reversal_amount,
        "net_fee_amount": net_fee_amount,
        "settled_amount": settled_amount,
        "pending_amount": pending_amount,
        "currency": "ARS",
    }


def get_seller_economic_accounts_for_admin(
    db: Session,
):
    seller_ids = [
        row[0]
        for row in (
            db.query(Store.owner_id)
            .filter(Store.owner_id.isnot(None))
            .distinct()
            .all()
        )
        if row[0] is not None
    ]

    return [
        get_seller_economic_account(
            db,
            seller_id,
        )
        for seller_id in sorted(
            set(seller_ids),
            key=str,
        )
    ]


def create_seller_fee_settlement(
    db: Session,
    *,
    seller_id: UUID,
    amount: Decimal,
    admin_id: UUID,
    method: str | None = None,
    reference: str | None = None,
    notes: str | None = None,
):
    try:
        seller, store = _get_seller_and_store(
            db,
            seller_id,
        )

        normalized_amount = _decimal(amount)

        if normalized_amount <= ZERO:
            raise ValueError(
                "El importe debe ser mayor que cero."
            )

        account = get_seller_economic_account(
            db,
            seller.id,
        )

        pending_amount = _decimal(
            account["pending_amount"]
        )

        if normalized_amount > pending_amount:
            raise ValueError(
                "El importe supera el saldo pendiente "
                "del vendedor con WalZ One."
            )

        settlement = SellerFeeSettlement(
            seller_id=seller.id,
            store_id=store.id,
            created_by_admin_id=admin_id,
            status=SellerFeeSettlementStatus.RECORDED,
            amount=normalized_amount,
            currency="ARS",
            method=(method or "").strip() or None,
            reference=(reference or "").strip() or None,
            notes=(notes or "").strip() or None,
        )

        db.add(settlement)
        db.commit()
        db.refresh(settlement)

        return settlement

    except Exception:
        db.rollback()
        raise


def cancel_seller_fee_settlement(
    db: Session,
    settlement_id: UUID,
):
    try:
        settlement = (
            db.query(SellerFeeSettlement)
            .filter(
                SellerFeeSettlement.id
                == settlement_id
            )
            .with_for_update()
            .first()
        )

        if not settlement:
            raise ValueError(
                "Liquidacion de comision no encontrada."
            )

        if (
            settlement.status
            == SellerFeeSettlementStatus.CANCELLED
        ):
            return settlement

        settlement.status = (
            SellerFeeSettlementStatus.CANCELLED
        )
        settlement.cancelled_at = datetime.now(
            timezone.utc
        )

        db.commit()
        db.refresh(settlement)

        return settlement

    except Exception:
        db.rollback()
        raise


def get_seller_fee_settlements_for_admin(
    db: Session,
    *,
    seller_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
):
    query = db.query(SellerFeeSettlement)

    if seller_id is not None:
        query = query.filter(
            SellerFeeSettlement.seller_id
            == seller_id
        )

    return (
        query
        .order_by(
            SellerFeeSettlement.settled_at.desc(),
            SellerFeeSettlement.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
