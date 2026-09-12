from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.db.models import ChatRole


class SessionCreatePayload(BaseModel):
    paper_id: UUID


class SessionUpdatePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SessionResponse(BaseModel):
    uid: UUID
    title: str
    paper_id: UUID
    created_at: datetime


class SessionListItem(BaseModel):
    uid: UUID
    title: str
    paper_id: UUID
    paper_title: str
    created_at: datetime


class MessageCreatePayload(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessageResponse(BaseModel):
    uid: UUID
    content: str
    role: ChatRole
    citations: dict
    created_at: datetime


class SessionDetailResponse(BaseModel):
    uid: UUID
    title: str
    paper_id: UUID
    created_at: datetime
    messages: list[MessageResponse]
