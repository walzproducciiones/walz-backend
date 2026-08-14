from enum import Enum
from typing import Optional


class PaymentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


PAYMENTS_ENABLED = False
PAYMENT_PROVIDER: Optional[str] = None


def get_payment_configuration():
    return {
        "enabled": PAYMENTS_ENABLED,
        "provider": PAYMENT_PROVIDER,
        "stores_card_data": False,
        "message": "Los pagos online todavia no estan habilitados.",
    }