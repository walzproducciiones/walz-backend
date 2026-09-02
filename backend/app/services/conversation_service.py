from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.conversation import (
    Conversation,
    ConversationMessage,
    ConversationParticipant,
)
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.store import Store
from backend.app.models.user import User
from backend.app.schemas.conversation import ConversationCreate


def _normalize_subject(value) -> str:
    subject = " ".join(str(value or "").strip().split())

    if len(subject) < 2:
        raise ValueError(
            "El asunto debe tener al menos 2 caracteres."
        )

    if len(subject) > 200:
        raise ValueError(
            "El asunto puede tener hasta 200 caracteres."
        )

    return subject


def _is_admin(user: User) -> bool:
    return str(user.role or "").strip().upper() == "ADMIN"


def _normalize_message_body(value) -> str:
    body = str(value or "").strip()

    if not body:
        raise ValueError("El mensaje no puede estar vacio.")

    if len(body) > 4000:
        raise ValueError("El mensaje puede tener hasta 4000 caracteres.")

    return body


def _participant_role(
    conversation: Conversation,
    user: User,
) -> str:
    if _is_admin(user):
        return "ADMIN"

    if conversation.store.owner_id == user.id:
        return "SELLER"

    if conversation.order is not None and conversation.order.buyer_id == user.id:
        return "BUYER"

    if conversation.created_by == user.id:
        return "BUYER"

    return "MEMBER"


def _get_participant(
    db: Session,
    conversation_id: UUID,
    user_id: UUID,
):
    return (
        db.query(ConversationParticipant)
        .options(joinedload(ConversationParticipant.user))
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .first()
    )


def _ensure_active_participant(
    db: Session,
    conversation: Conversation,
    user: User,
):
    participant = _get_participant(
        db,
        conversation.id,
        user.id,
    )

    if participant is not None:
        if not participant.is_active and not _is_admin(user):
            raise ValueError("No tenes permiso para esta conversacion.")

        if not participant.is_active:
            participant.is_active = True

        return participant

    participant = ConversationParticipant(
        conversation_id=conversation.id,
        user_id=user.id,
        role=_participant_role(conversation, user),
        is_active=True,
    )
    db.add(participant)
    return participant


def _accessible_conversations_query(
    db: Session,
    user: User,
):
    query = (
        db.query(Conversation)
        .join(
            Store,
            Conversation.store_id == Store.id,
        )
        .outerjoin(
            Order,
            Conversation.order_id == Order.id,
        )
    )

    if _is_admin(user):
        return query

    query = query.outerjoin(
        ConversationParticipant,
        and_(
            ConversationParticipant.conversation_id == Conversation.id,
            ConversationParticipant.user_id == user.id,
        ),
    )

    inferred_access = or_(
        Conversation.created_by == user.id,
        Store.owner_id == user.id,
        Order.buyer_id == user.id,
    )

    return query.filter(or_(
        ConversationParticipant.is_active.is_(True),
        and_(
            ConversationParticipant.id.is_(None),
            inferred_access,
        ),
    ))


def create_conversation(
    db: Session,
    user: User,
    data: ConversationCreate,
):
    store = (
        db.query(Store)
        .filter(
            Store.id == data.store_id,
            Store.is_active.is_(True),
        )
        .first()
    )

    if not store:
        raise ValueError("Tienda no encontrada.")

    product = None

    if data.product_id is not None:
        product = (
            db.query(Product)
            .filter(
                Product.id == data.product_id,
                Product.is_active.is_(True),
                Product.is_deleted.is_(False),
            )
            .first()
        )

        if not product:
            raise ValueError("Producto no encontrado.")

        if product.seller_id != store.owner_id:
            raise ValueError(
                "El producto no pertenece a la tienda seleccionada."
            )

    order = None

    if data.order_id is not None:
        order = (
            db.query(Order)
            .filter(Order.id == data.order_id)
            .first()
        )

        if not order:
            raise ValueError("Pedido no encontrado.")

        if order.store_id != store.id:
            raise ValueError(
                "El pedido no pertenece a la tienda seleccionada."
            )

        can_use_order = (
            _is_admin(user)
            or order.buyer_id == user.id
            or store.owner_id == user.id
        )

        if not can_use_order:
            raise ValueError(
                "No tenes permiso para asociar ese pedido."
            )

        if product is not None:
            product_in_order = (
                db.query(OrderItem)
                .filter(
                    OrderItem.order_id == order.id,
                    OrderItem.product_id == product.id,
                )
                .first()
            )

            if not product_in_order:
                raise ValueError(
                    "El producto no forma parte del pedido seleccionado."
                )

    conversation = Conversation(
        store_id=store.id,
        product_id=(
            product.id
            if product is not None
            else None
        ),
        order_id=(
            order.id
            if order is not None
            else None
        ),
        created_by=user.id,
        subject=_normalize_subject(data.subject),
        status="OPEN",
    )

    participant_roles = {}
    if order is not None:
        participant_roles[order.buyer_id] = "BUYER"

    participant_roles[user.id] = "BUYER"
    participant_roles[store.owner_id] = "SELLER"

    if _is_admin(user):
        participant_roles[user.id] = "ADMIN"

    for user_id, role in participant_roles.items():
        conversation.participants.append(
            ConversationParticipant(
                user_id=user_id,
                role=role,
                is_active=True,
            )
        )

    try:
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        return conversation

    except Exception:
        db.rollback()
        raise


def list_conversations_for_user(
    db: Session,
    user: User,
    *,
    conversation_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    query = _accessible_conversations_query(
        db,
        user,
    )

    if conversation_status is not None:
        query = query.filter(
            Conversation.status == conversation_status
        )

    return (
        query
        .order_by(
            func.coalesce(
                Conversation.updated_at,
                Conversation.created_at,
            ).desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_conversation_for_user(
    db: Session,
    conversation_id: UUID,
    user: User,
):
    return (
        _accessible_conversations_query(db, user)
        .filter(Conversation.id == conversation_id)
        .first()
    )


def list_conversation_participants(
    db: Session,
    conversation_id: UUID,
    user: User,
):
    conversation = get_conversation_for_user(
        db,
        conversation_id,
        user,
    )

    if conversation is None:
        return None

    return (
        db.query(ConversationParticipant)
        .options(joinedload(ConversationParticipant.user))
        .filter(
            ConversationParticipant.conversation_id == conversation.id,
        )
        .order_by(ConversationParticipant.joined_at.asc())
        .all()
    )


def send_message(
    db: Session,
    conversation_id: UUID,
    user: User,
    body: str,
):
    conversation = get_conversation_for_user(
        db,
        conversation_id,
        user,
    )

    if conversation is None:
        raise ValueError("Conversacion no encontrada.")

    if conversation.status != "OPEN":
        raise ValueError("La conversacion no esta abierta.")

    participant = _ensure_active_participant(
        db,
        conversation,
        user,
    )
    sent_at = datetime.now(timezone.utc)
    message = ConversationMessage(
        conversation_id=conversation.id,
        sender_id=user.id,
        message_type="TEXT",
        body=_normalize_message_body(body),
        created_at=sent_at,
    )
    participant.last_read_at = sent_at
    conversation.updated_at = sent_at

    try:
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
    except Exception:
        db.rollback()
        raise


def list_conversation_messages(
    db: Session,
    conversation_id: UUID,
    user: User,
    *,
    limit: int = 100,
    offset: int = 0,
):
    conversation = get_conversation_for_user(
        db,
        conversation_id,
        user,
    )

    if conversation is None:
        return None

    return (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.conversation_id == conversation.id,
        )
        .order_by(ConversationMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def mark_conversation_read(
    db: Session,
    conversation_id: UUID,
    user: User,
):
    conversation = get_conversation_for_user(
        db,
        conversation_id,
        user,
    )

    if conversation is None:
        raise ValueError("Conversacion no encontrada.")

    participant = _ensure_active_participant(
        db,
        conversation,
        user,
    )
    participant.last_read_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(participant)
        return participant
    except Exception:
        db.rollback()
        raise


def update_conversation_status(
    db: Session,
    conversation_id: UUID,
    user: User,
    status: str,
):
    normalized_status = str(status or "").strip().upper()

    if normalized_status not in {"OPEN", "CLOSED", "ARCHIVED"}:
        raise ValueError("Estado de conversacion no valido.")

    conversation = get_conversation_for_user(
        db,
        conversation_id,
        user,
    )

    if conversation is None:
        raise ValueError("Conversacion no encontrada.")

    archive_transition = (
        conversation.status == "ARCHIVED"
        or normalized_status == "ARCHIVED"
    )
    can_manage_archive = (
        _is_admin(user)
        or conversation.store.owner_id == user.id
    )

    if archive_transition and not can_manage_archive:
        raise ValueError(
            "Solo el vendedor o WalZ One Central pueden archivar o recuperar esta conversacion."
        )

    if conversation.status == normalized_status:
        return conversation

    conversation.status = normalized_status
    conversation.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(conversation)
        return conversation
    except Exception:
        db.rollback()
        raise


def get_unread_conversation_count(
    db: Session,
    user: User,
) -> int:
    accessible_conversations = (
        _accessible_conversations_query(db, user)
        .with_entities(
            Conversation.id.label("conversation_id")
        )
        .subquery()
    )

    count = (
        db.query(func.count(ConversationMessage.id))
        .join(
            accessible_conversations,
            ConversationMessage.conversation_id
            == accessible_conversations.c.conversation_id,
        )
        .outerjoin(
            ConversationParticipant,
            and_(
                ConversationParticipant.conversation_id
                == ConversationMessage.conversation_id,
                ConversationParticipant.user_id == user.id,
            ),
        )
        .filter(
            ConversationMessage.sender_id != user.id,
            or_(
                ConversationParticipant.id.is_(None),
                ConversationParticipant.last_read_at.is_(None),
                ConversationMessage.created_at
                > ConversationParticipant.last_read_at,
            ),
        )
        .scalar()
    )

    return int(count or 0)
