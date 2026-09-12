from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.main import get_session
from src.errors.exceptions import BadRequestError
from src.schemas.openalex import OpenAlexWorkDetail, OpenAlexWorksResponse
from src.services.papers import PaperService
from src.utils.clerk import validate_user_session
from src.utils.open_alex import OpenAlex

open_alex_router = APIRouter(
    prefix="/openalex",
    tags=["openalex"],
    dependencies=[Depends(validate_user_session)],
)

paper_service = PaperService()

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@open_alex_router.get("/works")
async def search_works(
    search: Annotated[str | None, Query(max_length=500)] = None,
    open_access: Annotated[Literal["any", "open", "closed"], Query()] = "any",
    from_year: Annotated[int | None, Query(ge=1000, le=9999)] = None,
    to_year: Annotated[int | None, Query(ge=1000, le=9999)] = None,
    sort: Annotated[Literal[
        "relevance_score:desc",
        "cited_by_count:desc",
        "publication_date:desc",
        "publication_date:asc",
    ], Query()] = "relevance_score:desc",
    per_page: Annotated[int, Query(ge=1, le=50)] = 25,
    cursor: Annotated[str, Query(min_length=1)] = "*",
) -> OpenAlexWorksResponse:
    if from_year is not None and to_year is not None and from_year > to_year:
        raise BadRequestError("from_year cannot be greater than to_year")

    return await OpenAlex.search_works(
        search=search,
        open_access=open_access,
        from_year=from_year,
        to_year=to_year,
        sort=sort,
        per_page=per_page,
        cursor=cursor,
    )


@open_alex_router.get("/works/{work_id}")
async def get_work_details(
    work_id: Annotated[str, Path(min_length=1)],
    session: SessionDep,
) -> OpenAlexWorkDetail:
    details = await OpenAlex.get_work_details(work_id)
    paper = await paper_service.get_paper_by_openalex_id(details.id, session)

    if paper is None:
        return details

    details.in_database = True
    details.paper_id = paper.uid
    details.ingest_status = paper.status
    return details
