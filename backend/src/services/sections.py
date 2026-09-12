from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import col, delete
from src.db.models import Section
from uuid import UUID


class SectionService:
    async def create_section(self, paper_id: UUID, title: str, section_order: int, session: AsyncSession):
        new_section = Section(
            paper_id=paper_id,
            title=title,
            section_order=section_order
        )

        session.add(new_section)
        await session.flush()
        await session.commit()

        return new_section

    async def delete_sections_for_paper(
        self,
        paper_id: UUID,
        session: AsyncSession,
    ) -> None:
        statement = delete(Section).where(col(Section.paper_id) == paper_id)
        await session.exec(statement)
        await session.commit()
