from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from backend.app.models.platform_economy_setting import (
    PlatformEconomySetting,
)


MONEY_QUANTUM = Decimal("0.01")
RATE_QUANTUM = Decimal("0.0001")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(
        MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )


def _rate(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(
        RATE_QUANTUM,
        rounding=ROUND_HALF_UP,
    )


def get_platform_economy_setting(
    db: Session,
):
    return (
        db.query(PlatformEconomySetting)
        .order_by(
            PlatformEconomySetting.created_at.asc(),
            PlatformEconomySetting.id.asc(),
        )
        .first()
    )


def calculate_order_economy_snapshot(
    db: Session,
    *,
    items_subtotal,
    discount_amount,
    payable_amount,
):
    setting = get_platform_economy_setting(db)

    economy_enabled = bool(
        setting
        and setting.economy_enabled
    )

    commission_rate = (
        _rate(setting.default_commission_rate)
        if economy_enabled
        else Decimal("0.0000")
    )

    if commission_rate < Decimal("0.0000"):
        raise ValueError(
            "La comision de WalZ One no puede ser negativa."
        )

    if commission_rate > Decimal("100.0000"):
        raise ValueError(
            "La comision de WalZ One no puede superar el 100 %."
        )

    merchandise_base = max(
        _money(items_subtotal)
        - _money(discount_amount),
        Decimal("0.00"),
    ).quantize(
        MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )

    platform_fee_amount = (
        merchandise_base
        * commission_rate
        / Decimal("100")
    ).quantize(
        MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )

    seller_net_amount = (
        _money(payable_amount)
        - platform_fee_amount
    ).quantize(
        MONEY_QUANTUM,
        rounding=ROUND_HALF_UP,
    )

    if seller_net_amount < Decimal("0.00"):
        raise ValueError(
            "El neto economico del vendedor no puede ser negativo."
        )

    return {
        "economy_enabled_snapshot": economy_enabled,
        "platform_fee_rate": commission_rate,
        "platform_fee_base": merchandise_base,
        "platform_fee_amount": platform_fee_amount,
        "seller_net_amount": seller_net_amount,
    }
