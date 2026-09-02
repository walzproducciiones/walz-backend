from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationStatus,
    ConversationStatusUpdate,
    MessageCreate,
    MessageResponse,
    ParticipantResponse,
    ReadResponse,
    UnreadCountResponse,
)
from backend.app.services.conversation_service import (
    create_conversation,
    get_unread_conversation_count,
    get_conversation_for_user,
    list_conversation_messages,
    list_conversation_participants,
    list_conversations_for_user,
    mark_conversation_read,
    send_message,
    update_conversation_status,
)


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def _raise_conversation_error(error: ValueError):
    message = str(error)

    if message == "Conversacion no encontrada.":
        raise HTTPException(status_code=404, detail=message)

    if message == "No tenes permiso para esta conversacion.":
        raise HTTPException(status_code=403, detail=message)

    if message == (
        "Solo el vendedor o WalZ One Central pueden archivar o recuperar esta conversacion."
    ):
        raise HTTPException(status_code=403, detail=message)

    if message == "La conversacion no esta abierta.":
        raise HTTPException(status_code=409, detail=message)

    raise HTTPException(status_code=400, detail=message)


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=201,
)
def create_my_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_conversation(
            db,
            current_user,
            data,
        )
    except ValueError as error:
        message = str(error)

        if message in {
            "Tienda no encontrada.",
            "Producto no encontrado.",
            "Pedido no encontrado.",
        }:
            raise HTTPException(
                status_code=404,
                detail=message,
            )

        if message == "No tenes permiso para asociar ese pedido.":
            raise HTTPException(
                status_code=403,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )


@router.get(
    "",
    response_model=list[ConversationResponse],
)
def get_my_conversations(
    conversation_status: ConversationStatus | None = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_conversations_for_user(
        db,
        current_user,
        conversation_status=conversation_status,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/unread/count",
    response_model=UnreadCountResponse,
)
def get_my_unread_conversation_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "count": get_unread_conversation_count(
            db,
            current_user,
        )
    }


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
)
def get_my_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(
        db,
        conversation_id,
        current_user,
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversacion no encontrada.",
        )

    return conversation


@router.patch(
    "/{conversation_id}/status",
    response_model=ConversationResponse,
)
def update_my_conversation_status(
    conversation_id: UUID,
    data: ConversationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_conversation_status(
            db,
            conversation_id,
            current_user,
            data.status,
        )
    except ValueError as error:
        _raise_conversation_error(error)


@router.get(
    "/{conversation_id}/participants",
    response_model=list[ParticipantResponse],
)
def get_my_conversation_participants(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participants = list_conversation_participants(
        db,
        conversation_id,
        current_user,
    )

    if participants is None:
        raise HTTPException(
            status_code=404,
            detail="Conversacion no encontrada.",
        )

    return participants


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
def send_my_conversation_message(
    conversation_id: UUID,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return send_message(
            db,
            conversation_id,
            current_user,
            data.body,
        )
    except ValueError as error:
        _raise_conversation_error(error)


@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def get_my_conversation_messages(
    conversation_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = list_conversation_messages(
        db,
        conversation_id,
        current_user,
        limit=limit,
        offset=offset,
    )

    if messages is None:
        raise HTTPException(
            status_code=404,
            detail="Conversacion no encontrada.",
        )

    return messages


@router.patch(
    "/{conversation_id}/read",
    response_model=ReadResponse,
)
def mark_my_conversation_read(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return mark_conversation_read(
            db,
            conversation_id,
            current_user,
        )
    except ValueError as error:
        _raise_conversation_error(error)
