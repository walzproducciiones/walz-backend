import uuid
import enum

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    ForeignKey,
    UUID,
    Enum,
    DateTime,
    Date,
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.session import Base


class OrderStatus(str, enum.Enum):

    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):

    __tablename__ = "orders"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    buyer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    total_amount = Column(
        Float,
        nullable=False
    )

    status = Column(
        Enum(OrderStatus),
        default=OrderStatus.PENDING
    )

    shipping_address = Column(
        String(500),
        nullable=True
    )

    pickup_status = Column(String(30), nullable=True)
    pickup_ready_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_going_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_arrived_at = Column(DateTime(timezone=True), nullable=True)
    pickup_seller_handed_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_received_at = Column(DateTime(timezone=True), nullable=True)

    delivery_transport_type = Column(String(30), nullable=True)
    delivery_estimated_date = Column(Date, nullable=True)
    delivery_time_window = Column(String(60), nullable=True)
    delivery_scheduled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )

    buyer = relationship(
        "User",
        back_populates="orders"
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )


class OrderItem(Base):

    __tablename__ = "order_items"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False
    )

    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id"),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False,
        default=1
    )

    price_at_purchase = Column(
        Float,
        nullable=False
    )

    order = relationship(
        "Order",
        back_populates="items"
    )

    product = relationship(
        "Product"
    )