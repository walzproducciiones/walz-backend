from backend.app.models.order import OrderStatus


ALLOWED_ORDER_STATUS_TRANSITIONS = {
    OrderStatus.PENDING: {
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.CONFIRMED: {
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.SHIPPED: {
        OrderStatus.DELIVERED,
    },
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


def can_transition_order_status(
    current_status: OrderStatus,
    new_status: OrderStatus,
) -> bool:
    if current_status == new_status:
        return True

    allowed_statuses = ALLOWED_ORDER_STATUS_TRANSITIONS.get(
        current_status,
        set(),
    )

    return new_status in allowed_statuses