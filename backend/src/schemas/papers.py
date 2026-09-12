from datetime import datetime
from pydantic import BaseModel
from uuid import UUID

from src.db.models import Status


class PaperCreatePayload(BaseModel):
    openalex_id: str


class PaperProcess(BaseModel):
    openalex_id: str
    paper_id: UUID
    user_id: UUID
    urls: list[str]
    authors: list[str]


class PaperCreate(BaseModel):
    title: str
    authors: list[str]
    openalex_id: str
    doi: str | None
    uploaded_by: UUID


class PaperIngestResult(BaseModel):
    paper_id: UUID
    status: Status
    ready: bool
    already_existed: bool
    message: str

class PaperResponse(BaseModel):
    uid: UUID
    title: str
    authors: list[str]
    openalex_id: str
    doi: str | None
    status: Status
    abstract: str | None = None
    already_added: bool


class PaperPdfUrlResponse(BaseModel):
    url: str
    expires_in: int
    paper: PaperResponse


class UserPaperResponse(BaseModel):
    uid: UUID
    title: str
    authors: list[str]
    openalex_id: str
    doi: str | None
    status: Status
    abstract: str | None = None
    added_at: datetime
    custom_tags: list[str]