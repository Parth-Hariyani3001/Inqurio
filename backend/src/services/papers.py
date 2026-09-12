from src.errors.exceptions import (
    UserPaperAlreadyAssigned,
    PaperNotFoundInOpenAlexError,
    PaperNotReadyError,
    PaperUrlsNotFoundError,
    NotFoundError,
)
from uuid import UUID
from sqlalchemy import or_
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import col, select
from src.db.models import Paper, Status
from src.schemas.papers import PaperCreate, PaperIngestResult, PaperResponse
from src.services.user_papers import UserPaperService
from src.utils.open_alex import OpenAlex


class PaperService:
    def __init__(self):
        self.user_paper_service = UserPaperService()

    async def get_paper_by_id(self, id: UUID, session: AsyncSession) -> Paper | None:
        statement = select(Paper).where(
            Paper.uid == id
        ).limit(1)

        result = await session.exec(statement)
        return result.first()

    async def get_paper_by_openalex_id(self, id: str, session: AsyncSession) -> Paper | None:
        statement = select(Paper).where(
            Paper.openalex_id == id
        ).limit(1)

        result = await session.exec(statement)
        return result.first()

    async def create_paper(self, paper_payload: PaperCreate, session: AsyncSession):
        new_paper = Paper(
            title=paper_payload.title,
            doi=paper_payload.doi,
            openalex_id=paper_payload.openalex_id,
            authors=paper_payload.authors,
            uploaded_by=paper_payload.uploaded_by
        )

        session.add(new_paper)
        await session.commit()

        return new_paper

    async def update_paper(self, paper: Paper, updates: dict, session: AsyncSession) -> Paper:
        for field, value in updates.items():
            if hasattr(paper, field):
                setattr(paper, field, value)

        session.add(paper)
        await session.commit()
        await session.refresh(paper)

        return paper

    async def get_papers(
        self,
        search: str | None,
        user_id: UUID,
        session: AsyncSession,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[PaperResponse]:
        statement = select(Paper).where(
            Paper.status == Status.READY,
        )

        if search:
            pattern = f"%{search}%"
            statement = statement.where(
                or_(
                    col(Paper.title).ilike(pattern),
                    col(Paper.doi).ilike(pattern),
                )
            )

        statement = statement.offset(offset).limit(limit)
        result = await session.exec(statement)
        papers = result.all()

        assigned_ids = await self.user_paper_service.get_paper_ids_for_user(
            user_id, session
        )

        return [
            PaperResponse(
                uid=paper.uid,
                title=paper.title,
                authors=paper.authors,
                openalex_id=paper.openalex_id,
                doi=paper.doi,
                status=paper.status,
                abstract=paper.abstract,
                already_added=paper.uid in assigned_ids,
            )
            for paper in papers
        ]

    async def ingest_from_openalex(
        self,
        openalex_id: str,
        user_id: UUID,
        session: AsyncSession,
    ) -> PaperIngestResult:
        paper = await self.get_paper_by_openalex_id(openalex_id, session)
        if paper:
            is_user_assigned = await self.user_paper_service.get_paper_by_id(
                user_id, paper.uid, session)

            if is_user_assigned:
                raise UserPaperAlreadyAssigned

            if paper.status == Status.FAILED:
                raise PaperNotReadyError(
                    details={"status": paper.status.value})

            await self.user_paper_service.create_user_paper(user_id, paper.uid, session)
            ready = paper.status == Status.READY
            return PaperIngestResult(
                paper_id=paper.uid,
                status=paper.status,
                ready=ready,
                already_existed=True,
                message=(
                    "Paper already exists, added in users list"
                    if ready
                    else "Paper is still processing and will be available once finished"
                ),
            )

        openalex_payload = await OpenAlex.get_data_by_openalex_id(openalex_id)
        if not openalex_payload:
            raise PaperNotFoundInOpenAlexError()

        urls = OpenAlex.get_pdf_urls(openalex_payload)
        authors = OpenAlex.get_authors(openalex_payload)
        if len(urls) == 0:
            raise PaperUrlsNotFoundError()

        new_paper = await self.create_paper(
            PaperCreate(
                title=openalex_payload["title"],
                doi=openalex_payload["doi"],
                openalex_id=openalex_id,
                uploaded_by=user_id,
                authors=authors,
            ),
            session,
        )

        await self.user_paper_service.create_user_paper(user_id, new_paper.uid, session)

        # Lazy import avoids circular dependency with the Celery worker module
        from src.worker.tasks import process_paper
        process_paper.delay({
            "paper_id": str(new_paper.uid),
            "openalex_id": openalex_id,
            "user_id": str(user_id),
            "urls": urls,
            "authors": authors,
        })

        return PaperIngestResult(
            paper_id=new_paper.uid,
            status=Status.PENDING,
            ready=False,
            already_existed=False,
            message=(
                "The system has started processing the paper, "
                "it will be available once the processing is finished"
            ),
        )

    async def reprocess_paper(
        self,
        paper_id: UUID,
        session: AsyncSession,
    ) -> PaperIngestResult:
        """Re-chunk and re-embed an existing paper with the current RAG pipeline."""
        paper = await self.get_paper_by_id(paper_id, session)
        if not paper:
            raise NotFoundError(message="Paper not found")

        openalex_payload = await OpenAlex.get_data_by_openalex_id(paper.openalex_id)
        urls: list[str] = []
        if openalex_payload:
            urls = OpenAlex.get_pdf_urls(openalex_payload)

        if not urls and not paper.s3_key:
            raise PaperUrlsNotFoundError()

        authors = paper.authors
        if openalex_payload and not authors:
            authors = OpenAlex.get_authors(openalex_payload)

        await self.update_paper(
            paper=paper,
            updates={"status": Status.PENDING},
            session=session,
        )

        from src.worker.tasks import process_paper

        process_paper.delay(
            {
                "paper_id": str(paper.uid),
                "openalex_id": paper.openalex_id,
                "user_id": str(paper.uploaded_by) if paper.uploaded_by else str(paper.uid),
                "urls": urls,
                "authors": authors or [],
            }
        )

        return PaperIngestResult(
            paper_id=paper.uid,
            status=Status.PENDING,
            ready=False,
            already_existed=True,
            message=(
                "Paper reprocessing started; it will be available once "
                "chunking and re-indexing finish"
            ),
        )
