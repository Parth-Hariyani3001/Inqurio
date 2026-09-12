from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from src.schemas.papers import PaperCreatePayload, PaperPdfUrlResponse, PaperResponse
from src.utils.clerk import validate_user_session
from src.services.papers import PaperService
from src.services.users import UserService
from src.db.main import get_session
from src.utils.object_store import get_pdf_object, get_pdf_url
from src.errors.exceptions import NotFoundError
from uuid import UUID

papers_router = APIRouter(prefix='/papers', tags=["papers"])

paper_service = PaperService()
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@papers_router.get('/{paper_id}/pdf')
async def stream_paper_pdf(
    paper_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
):
    paper = await paper_service.get_paper_by_id(paper_id, session)
    if not paper:
        raise NotFoundError(message="Paper not found")

    if not paper.s3_key:
        raise NotFoundError(message="PDF not found")

    try:
        obj = get_pdf_object(paper.s3_key)
    except FileNotFoundError:
        raise NotFoundError(message="PDF not found")

    body = obj["Body"]
    headers = {
        "Content-Disposition": 'inline; filename="paper.pdf"',
        "Cache-Control": "private, max-age=300",
    }
    length = obj.get("ContentLength")
    if length is not None:
        headers["Content-Length"] = str(length)

    return StreamingResponse(
        body.iter_chunks(chunk_size=256 * 1024),
        media_type="application/pdf",
        headers=headers,
    )


@papers_router.get('/{paper_id}/pdf-url')
async def get_paper_contents(
    paper_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> PaperPdfUrlResponse:
    paper = await paper_service.get_paper_by_id(paper_id, session)
    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found"
        )

    if not paper.s3_key:
        raise HTTPException(
            status_code=404,
            detail="PDF not found"
        )

    signed = get_pdf_url(paper.s3_key)

    return PaperPdfUrlResponse(
        url=str(signed["url"]),
        expires_in=int(signed["expires_in"]),
        paper=PaperResponse(
            uid=paper.uid,
            title=paper.title,
            authors=paper.authors,
            openalex_id=paper.openalex_id,
            doi=paper.doi,
            status=paper.status,
            abstract=paper.abstract,
            already_added=True,
        ),
    )


@papers_router.get('/')
async def get_papers(
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=500)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PaperResponse]:
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return await paper_service.get_papers(
        search,
        user_data.uid,
        session,
        limit=limit,
        offset=offset,
    )


@papers_router.post('/upload')
async def create_paper(
    body: PaperCreatePayload,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
):
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise NotFoundError(
            message="User not found"
        )

    result = await paper_service.ingest_from_openalex(
        openalex_id=body.openalex_id,
        user_id=user_data.uid,
        session=session,
    )

    return JSONResponse(
        status_code=201 if result.ready else 202,
        content={
            "success": True,
            "message": result.message,
            "paper_id": str(result.paper_id),
            "status": result.status.value,
            "ready": result.ready,
        }
    )


@papers_router.post('/{paper_id}/reprocess')
async def reprocess_paper(
    paper_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
):
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise NotFoundError(message="User not found")

    result = await paper_service.reprocess_paper(paper_id, session)
    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "message": result.message,
            "paper_id": str(result.paper_id),
            "status": result.status.value,
            "ready": result.ready,
        },
    )
