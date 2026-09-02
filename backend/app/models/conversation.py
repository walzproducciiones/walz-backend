import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UUID, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True
    )

    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id"),
        nullable=True,
        index=True
    )

    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=True,
        index=True
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    subject = Column(
        String(200),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False,
        default="OPEN",
        server_default="OPEN",
        index=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )

    store = relationship("Store")
    product = relationship("Product")
    order = relationship("Order")
    creator = relationship("User")
    participants = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan"
    )
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan"
    )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "user_id",
            name="uq_conversation_participant_user"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id"),
        nullable=False,
        index=True
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    role = Column(String(20), nullable=False, default="MEMBER", server_default="MEMBER")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_read_at = Column(DateTime(timezone=True), nullable=True)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")

    @property
    def display_name(self):
        if self.user is None:
            return "Participante"

        full_name = " ".join(filter(None, [
            str(self.user.first_name or "").strip(),
            str(self.user.last_name or "").strip(),
        ])).strip()
        return full_name or "Participante"

    @property
    def avatar_url(self):
        return self.user.avatar if self.user is not None else None


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id"),
        nullable=False,
        index=True
    )
    sender_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    message_type = Column(
        String(20),
        nullable=False,
        default="TEXT",
        server_default="TEXT"
    )
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")
