from uuid import UUID

from sqlalchemy import or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Paper, UserPaper
from src.schemas.papers import UserPaperResponse


class UserPaperService:
    async def create_user_paper(self, user_id: UUID, paper_id: UUID, session: AsyncSession):
        user_paper = UserPaper(
            user_id=user_id,
            paper_id=paper_id,
            custom_tags=[]
        )

        session.add(user_paper)
        await session.commit()

        return user_paper

    async def get_paper_by_id(self, user_id: UUID, paper_id: UUID, session: AsyncSession):
        statement = select(UserPaper).where(
            col(UserPaper.user_id) == user_id,
            col(UserPaper.paper_id) == paper_id
        )

        result = await session.exec(statement)
        return result.first()

    async def get_paper_ids_for_user(
        self, user_id: UUID, session: AsyncSession
    ) -> set[UUID]:
        statement = select(UserPaper.paper_id).where(
            col(UserPaper.user_id) == user_id
        )
        result = await session.exec(statement)
        return set(result.all())

    async def list_for_user(
        self,
        user_id: UUID,
        session: AsyncSession,
        search: str | None = None,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[UserPaperResponse]:
        statement = (
            select(Paper, UserPaper)
            .join(UserPaper, col(UserPaper.paper_id) == Paper.uid)
            .where(col(UserPaper.user_id) == user_id)
        )

        if search:
            pattern = f"%{search}%"
            statement = statement.where(
                or_(
                    col(Paper.title).ilike(pattern),
                    col(Paper.doi).ilike(pattern),
                )
            )

        statement = (
            statement
            .order_by(col(UserPaper.added_at).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.exec(statement)

        return [
            UserPaperResponse(
                uid=paper.uid,
                title=paper.title,
                authors=paper.authors,
                openalex_id=paper.openalex_id,
                doi=paper.doi,
                status=paper.status,
                abstract=paper.abstract,
                added_at=user_paper.added_at,
                custom_tags=user_paper.custom_tags,
            )
            for paper, user_paper in result.all()
        ]
