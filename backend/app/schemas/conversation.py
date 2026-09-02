from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


ConversationStatus = Literal["OPEN", "CLOSED", "ARCHIVED"]
ParticipantRole = Literal["BUYER", "SELLER", "ADMIN", "MEMBER"]
MessageType = Literal["TEXT", "SYSTEM"]


class ConversationCreate(BaseModel):
    store_id: UUID
    product_id: UUID | None = None
    order_id: UUID | None = None
    subject: str = Field(..., min_length=2, max_length=200)


class ConversationStatusUpdate(BaseModel):
    status: ConversationStatus


class ConversationResponse(BaseModel):
    id: UUID
    store_id: UUID
    product_id: UUID | None = None
    order_id: UUID | None = None
    created_by: UUID
    subject: str
    status: ConversationStatus
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ParticipantResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    user_id: UUID
    role: ParticipantRole
    is_active: bool
    joined_at: datetime
    last_read_at: datetime | None = None
    display_name: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    message_type: MessageType
    body: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ReadResponse(BaseModel):
    conversation_id: UUID
    user_id: UUID
    last_read_at: datetime


class UnreadCountResponse(BaseModel):
    count: int = Field(..., ge=0)
