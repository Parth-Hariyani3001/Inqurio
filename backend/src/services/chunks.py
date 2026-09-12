from src.db.models import Chunk
from sqlmodel.ext.asyncio.session import AsyncSession
from uuid import UUID


class ChunkService:
    async def bulk_create_chunks(
        self,
        *,
        paper_id: UUID,
        section_id: UUID,
        contents: list[str],
        session: AsyncSession,
    ) -> list[Chunk]:
        chunks = [
            Chunk(
                paper_id=paper_id,
                section_id=section_id,
                chunk_index=index,
                content=content,
            )
            for index, content in enumerate(contents)
        ]

        session.add_all(chunks)
        await session.commit()
        await session.flush()

        return chunks
