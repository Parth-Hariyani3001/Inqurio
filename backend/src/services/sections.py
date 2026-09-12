from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.db.models import Section
from src.schemas.papers import PaperCreate
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
