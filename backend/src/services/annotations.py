from datetime import datetime
from uuid import UUID

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Annotation
from src.errors.exceptions import NotFoundError
from src.schemas.annotations import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
)
from src.services.papers import PaperService


class AnnotationService:
    def __init__(self):
        self.paper_service = PaperService()

    def _to_response(self, annotation: Annotation) -> AnnotationResponse:
        return AnnotationResponse(
            uid=annotation.uid,
            paper_id=annotation.paper_id,
            content=annotation.content,
            selection=annotation.selection,
            color=annotation.color,
            created_at=annotation.created_at,
            updated_at=annotation.updated_at,
        )

    async def list_for_paper(
        self,
        paper_id: UUID,
        user_id: UUID,
        session: AsyncSession,
    ) -> list[AnnotationResponse]:
        paper = await self.paper_service.get_paper_by_id(paper_id, session)
        if not paper:
            raise NotFoundError(message="Paper not found")

        statement = (
            select(Annotation)
            .where(
                col(Annotation.paper_id) == paper_id,
                col(Annotation.user_id) == user_id,
            )
            .order_by(col(Annotation.created_at).asc())
        )
        result = await session.exec(statement)
        return [self._to_response(row) for row in result.all()]

    async def create_for_paper(
        self,
        paper_id: UUID,
        user_id: UUID,
        payload: AnnotationCreate,
        session: AsyncSession,
    ) -> AnnotationResponse:
        paper = await self.paper_service.get_paper_by_id(paper_id, session)
        if not paper:
            raise NotFoundError(message="Paper not found")

        annotation = Annotation(
            paper_id=paper_id,
            user_id=user_id,
            content=payload.content,
            selection=payload.selection.model_dump(),
            color=payload.color,
        )
        session.add(annotation)
        await session.commit()
        await session.refresh(annotation)
        return self._to_response(annotation)

    async def get_owned(
        self,
        annotation_id: UUID,
        user_id: UUID,
        session: AsyncSession,
    ) -> Annotation:
        statement = select(Annotation).where(
            col(Annotation.uid) == annotation_id,
            col(Annotation.user_id) == user_id,
        )
        result = await session.exec(statement)
        annotation = result.first()
        if not annotation:
            raise NotFoundError(message="Annotation not found")
        return annotation

    async def update_owned(
        self,
        annotation_id: UUID,
        user_id: UUID,
        payload: AnnotationUpdate,
        session: AsyncSession,
    ) -> AnnotationResponse:
        annotation = await self.get_owned(annotation_id, user_id, session)
        if payload.content is not None:
            annotation.content = payload.content
        if payload.color is not None:
            annotation.color = payload.color
        annotation.updated_at = datetime.utcnow()
        session.add(annotation)
        await session.commit()
        await session.refresh(annotation)
        return self._to_response(annotation)

    async def delete_owned(
        self,
        annotation_id: UUID,
        user_id: UUID,
        session: AsyncSession,
    ) -> None:
        annotation = await self.get_owned(annotation_id, user_id, session)
        await session.delete(annotation)
        await session.commit()
