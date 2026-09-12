from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from qdrant_client.http.models import FieldCondition, Filter, MatchValue
from sqlalchemy import func, literal_column
from sqlmodel import col, select

from src.config.main import Config
from src.db.main import SessionLocal
from src.db.models import Chunk, Section
from src.rag.embeddings import embeddings
from src.rag.rerank import rerank_hits
from src.rag.vector_store import collection_name, vector_store


def reciprocal_rank_fusion(
    rankings: list[list[UUID]],
    *,
    rrf_k: int,
) -> dict[UUID, float]:
    scores: dict[UUID, float] = defaultdict(float)
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking):
            scores[chunk_id] += 1.0 / (rrf_k + rank + 1)
    return dict(scores)


async def _dense_search(
    paper_id: UUID,
    query: str,
    *,
    limit: int,
) -> list[tuple[UUID, float]]:
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

    results: list[tuple[UUID, float]] = []
    for point in response.points or []:
        try:
            chunk_id = UUID(str(point.id))
        except ValueError:
            continue
        results.append((chunk_id, float(point.score or 0.0)))
    return results


async def _keyword_search(
    paper_id: UUID,
    query: str,
    *,
    limit: int,
) -> list[tuple[UUID, float]]:
    """Postgres full-text search (sparse / BM25-style channel) scoped to one paper."""
    cleaned = " ".join(query.split())
    if not cleaned:
        return []

    ts_query = func.plainto_tsquery("english", cleaned)
    document = func.to_tsvector(
        "english",
        func.concat(Section.title, literal_column("' '"), Chunk.content),
    )
    rank = func.ts_rank_cd(document, ts_query)

    async with SessionLocal() as session:
        statement = (
            select(Chunk.uid, rank)
            .join(Section, col(Chunk.section_id) == Section.uid)
            .where(col(Chunk.paper_id) == paper_id)
            .where(document.op("@@")(ts_query))
            .order_by(rank.desc())
            .limit(limit)
        )
        result = await session.exec(statement)
        rows = result.all()

    return [(chunk_id, float(score or 0.0)) for chunk_id, score in rows]


async def _hydrate_chunks(
    chunk_ids: list[UUID],
    scores: dict[UUID, float],
) -> list[dict]:
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
                "section_id": str(chunk.section_id),
                "chunk_index": chunk.chunk_index,
                "section": section.title,
                "excerpt": chunk.content,
                "score": scores.get(chunk_id, 0.0),
            }
        )
    return hits


async def _expand_neighbors(hits: list[dict], *, window: int) -> list[dict]:
    if window <= 0 or not hits:
        return hits

    paper_id = hits[0]["paper_id"]
    needed: set[tuple[str, int]] = set()
    for hit in hits:
        section_id = hit.get("section_id")
        index = hit.get("chunk_index")
        if section_id is None or index is None:
            continue
        for offset in range(-window, window + 1):
            needed.add((str(section_id), int(index) + offset))

    async with SessionLocal() as session:
        statement = (
            select(Chunk, Section)
            .join(Section, col(Chunk.section_id) == Section.uid)
            .where(col(Chunk.paper_id) == UUID(str(paper_id)))
        )
        result = await session.exec(statement)
        rows = result.all()

    by_key = {
        (str(chunk.section_id), chunk.chunk_index): (chunk, section)
        for chunk, section in rows
    }
    existing = {hit["chunk_id"] for hit in hits}
    expanded = list(hits)

    for section_id, chunk_index in sorted(needed, key=lambda item: (item[0], item[1])):
        row = by_key.get((section_id, chunk_index))
        if not row:
            continue
        chunk, section = row
        chunk_id = str(chunk.uid)
        if chunk_id in existing:
            continue
        expanded.append(
            {
                "chunk_id": chunk_id,
                "paper_id": str(chunk.paper_id),
                "section_id": str(chunk.section_id),
                "chunk_index": chunk.chunk_index,
                "section": section.title,
                "excerpt": chunk.content,
                "score": 0.0,
            }
        )
        existing.add(chunk_id)

    return expanded


def _dedupe_hits(hits: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for hit in hits:
        chunk_id = str(hit.get("chunk_id") or "")
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(chunk_id)
        unique.append(hit)
    return unique


def _strip_internal_fields(hits: list[dict]) -> list[dict]:
    return [
        {
            "chunk_id": hit["chunk_id"],
            "paper_id": hit["paper_id"],
            "section": hit.get("section") or "",
            "excerpt": hit.get("excerpt") or "",
            "score": float(hit.get("score") or 0.0),
        }
        for hit in hits
    ]


async def search_paper_chunks(
    paper_id: UUID,
    query: str,
    *,
    top_k: int | None = None,
) -> list[dict]:
    """Hybrid dense + keyword retrieval with RRF, neighbor expansion, and rerank."""
    cleaned = " ".join((query or "").split())
    if not cleaned:
        return []

    final_k = top_k or Config.rag_top_k
    recall_k = Config.rag_candidate_k

    dense_hits = await _dense_search(paper_id, cleaned, limit=recall_k)
    keyword_hits = await _keyword_search(paper_id, cleaned, limit=recall_k)

    dense_ids = [chunk_id for chunk_id, _ in dense_hits]
    keyword_ids = [chunk_id for chunk_id, _ in keyword_hits]
    dense_scores = {chunk_id: score for chunk_id, score in dense_hits}

    fused_scores = reciprocal_rank_fusion(
        [dense_ids, keyword_ids],
        rrf_k=Config.rag_rrf_k,
    )
    if not fused_scores and dense_ids:
        fused_scores = {
            chunk_id: 1.0 / (Config.rag_rrf_k + rank + 1)
            for rank, chunk_id in enumerate(dense_ids)
        }

    ordered_ids = sorted(
        fused_scores.keys(),
        key=lambda chunk_id: fused_scores[chunk_id],
        reverse=True,
    )[:recall_k]

    hydrate_scores = {
        chunk_id: dense_scores.get(chunk_id, fused_scores.get(chunk_id, 0.0))
        for chunk_id in ordered_ids
    }
    hits = await _hydrate_chunks(ordered_ids, hydrate_scores)
    hits = await _expand_neighbors(hits, window=Config.rag_neighbor_window)
    hits = _dedupe_hits(hits)

    if Config.rag_min_score > 0:
        keyword_keep = {str(chunk_id) for chunk_id in keyword_ids[:final_k]}
        filtered = [
            hit
            for hit in hits
            if float(hit.get("score") or 0.0) >= Config.rag_min_score
            or hit.get("chunk_id") in keyword_keep
        ]
        if filtered:
            hits = filtered

    ranked = await rerank_hits(cleaned, hits, top_k=final_k)
    if Config.rag_min_score > 0 and Config.rag_rerank_enabled:
        thresholded = [
            hit
            for hit in ranked
            if float(hit.get("score") or 0.0) >= Config.rag_min_score
        ]
        if thresholded:
            ranked = thresholded
        elif ranked:
            ranked = ranked[: min(3, len(ranked))]

    return _strip_internal_fields(ranked[:final_k])
