from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AnnotationRect(BaseModel):
    x: float
    y: float
    width: float
    height: float


class AnnotationSelection(BaseModel):
    pageNumber: int = Field(ge=1)
    rects: list[AnnotationRect] = Field(min_length=1)
    selectedText: str = ""


class AnnotationCreate(BaseModel):
    content: str = ""
    color: str = Field(default="#FFFF00", pattern=r"^#[0-9A-Fa-f]{6}$")
    selection: AnnotationSelection


class AnnotationUpdate(BaseModel):
    content: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class AnnotationResponse(BaseModel):
    uid: UUID
    paper_id: UUID
    content: str
    selection: dict[str, Any]
    color: str
    created_at: datetime
    updated_at: datetime | None
