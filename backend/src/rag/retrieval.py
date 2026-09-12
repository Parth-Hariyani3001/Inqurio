from __future__ import annotations

from uuid import UUID

from qdrant_client.http.models import FieldCondition, Filter, MatchValue
from sqlmodel import col, select

from src.config.main import Config
from src.db.main import SessionLocal
from src.db.models import Chunk, Section
from src.rag.embeddings import embeddings
from src.rag.vector_store import collection_name, vector_store


async def search_paper_chunks(
    paper_id: UUID,
    query: str,
    *,
    top_k: int | None = None,
) -> list[dict]:
    limit = top_k or Config.rag_top_k
    query_vector = embeddings.embed_query(query)
    response = vector_store.client.query_points(
        collection_name=collection_name,
        query=query_vector,
        query_filter=Filter(
            must=[
                FieldCondition(
                    key="paper_id",
                    match=MatchValue(value=str(paper_id)),
                )
            ]
        ),
        limit=limit,
        with_payload=True,
    )

    points = response.points or []
    if not points:
        return []

    chunk_ids: list[UUID] = []
    scores: dict[UUID, float] = {}
    for point in points:
        try:
            chunk_id = UUID(str(point.id))
        except ValueError:
            continue

        chunk_ids.append(chunk_id)
        scores[chunk_id] = float(point.score or 0.0)

    if not chunk_ids:
        return []

    async with SessionLocal() as session:
        statement = (
            select(Chunk, Section)
            .join(Section, col(Chunk.section_id) == Section.uid)
            .where(col(Chunk.uid).in_(chunk_ids))
        )
        result = await session.exec(statement)
        rows = result.all()

    by_id = {chunk.uid: (chunk, section) for chunk, section in rows}
    hits: list[dict] = []
    for chunk_id in chunk_ids:
        row = by_id.get(chunk_id)
        if not row:
            continue

        chunk, section = row
        hits.append(
            {
                "chunk_id": str(chunk.uid),
                "paper_id": str(chunk.paper_id),
                "section": section.title,
                "excerpt": chunk.content,
                "score": scores.get(chunk_id, 0.0),
            }
        )

    return hits
