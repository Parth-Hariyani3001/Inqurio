from uuid import UUID

from pydantic import BaseModel

from src.db.models import Status


class OpenAlexWork(BaseModel):
    id: str
    doi: str | None
    display_name: str
    publication_year: int | None
    cited_by_count: int
    is_oa: bool
    authors: list[str]
    tags: list[str]
    venue: str | None


class OpenAlexWorkDetail(OpenAlexWork):
    abstract: str | None
    publication_date: str | None
    type: str | None
    language: str | None
    is_retracted: bool
    oa_url: str | None
    institutions: list[str]
    topics: list[str]
    in_database: bool
    paper_id: UUID | None
    ingest_status: Status | None


class OpenAlexWorksMeta(BaseModel):
    count: int
    per_page: int
    next_cursor: str | None


class OpenAlexWorksResponse(BaseModel):
    meta: OpenAlexWorksMeta
    results: list[OpenAlexWork]
