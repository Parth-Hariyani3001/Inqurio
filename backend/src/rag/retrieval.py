from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from uuid import UUID

from qdrant_client.http.models import FieldCondition, Filter, MatchValue
from sqlalchemy import and_, func, literal_column, or_
from sqlmodel import col, select

from src.config.main import Config
from src.db.main import SessionLocal
from src.db.models import Chunk, Section
from src.rag.embeddings import embed_query_cached
from src.rag.rerank import rerank_hits
from src.rag.vector_store import collection_name, vector_store

logger = logging.getLogger(__name__)


def normalize_retrieval_query(query: str) -> str:
    return " ".join((query or "").split()).lower()


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
    query_vector: list[float] | None = None,
) -> list[tuple[UUID, float]]:
    started = time.perf_counter()

    if query_vector is None:
        query_vector = await asyncio.to_thread(embed_query_cached, query)
        embed_ms = (time.perf_counter() - started) * 1000

        logger.info("rag.dense.embed elapsed_ms=%.1f source=embed", embed_ms)
    else:
        logger.info("rag.dense.embed elapsed_ms=0.0 source=precomputed")

    qdrant_started = time.perf_counter()
    response = await asyncio.to_thread(
        vector_store.client.query_points,
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

    logger.info(
        "rag.dense.qdrant elapsed_ms=%.1f hits=%d",
        (time.perf_counter() - qdrant_started) * 1000,
        len(results),
    )

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

    started = time.perf_counter()

    ts_query = func.plainto_tsquery("english", cleaned)
    document = func.to_tsvector(
        "english",
        func.concat(Section.title, literal_column("' '"), Chunk.content),
    )

    # It ranks the similartiy between the document and query
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

    results = [(chunk_id, float(score or 0.0)) for chunk_id, score in rows]
    logger.info(
        "rag.keyword elapsed_ms=%.1f hits=%d",
        (time.perf_counter() - started) * 1000,
        len(results),
    )

    return results


async def _hydrate_chunks(
    chunk_ids: list[UUID],
    scores: dict[UUID, float],
) -> list[dict]:
    if not chunk_ids:
        return []

    started = time.perf_counter()
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
    logger.info(
        "rag.hydrate elapsed_ms=%.1f chunks=%d",
        (time.perf_counter() - started) * 1000,
        len(hits),
    )
    return hits


async def _expand_neighbors(hits: list[dict], *, window: int) -> list[dict]:
    if window <= 0 or not hits:
        return hits

    started = time.perf_counter()

    existing = {hit["chunk_id"] for hit in hits}
    neighbor_scores: dict[tuple[str, int], float] = {}

    for hit in hits:
        section_id = hit.get("section_id")
        index = hit.get("chunk_index")
        if section_id is None or index is None:
            continue

        parent_score = float(hit.get("score") or 0.0)
        section_key = str(section_id)
        base_index = int(index)

        for offset in range(-window, window + 1):
            if offset == 0:
                continue

            neighbor_key = (section_key, base_index + offset)
            inherited = parent_score * 0.9
            neighbor_scores[neighbor_key] = max(
                neighbor_scores.get(neighbor_key, 0.0),
                inherited,
            )

    present_positions: set[tuple[str, int]] = set()
    for hit in hits:
        section_id = hit.get("section_id")
        chunk_index = hit.get("chunk_index")
        if section_id is not None and chunk_index is not None:
            present_positions.add((str(section_id), int(str(chunk_index))))

    needed_neighbors = {
        key for key in neighbor_scores if key not in present_positions
    }
    if not needed_neighbors:
        logger.info(
            "rag.expand elapsed_ms=%.1f added=0",
            (time.perf_counter() - started) * 1000,
        )
        return hits

    conditions = [
        and_(
            col(Chunk.section_id) == UUID(section_id),
            col(Chunk.chunk_index) == chunk_index,
        )
        for section_id, chunk_index in needed_neighbors
    ]

    async with SessionLocal() as session:
        statement = (
            select(Chunk, Section)
            .join(Section, col(Chunk.section_id) == Section.uid)
            .where(or_(*conditions))
        )
        result = await session.exec(statement)
        rows = result.all()

    expanded = list(hits)
    for chunk, section in rows:
        chunk_id = str(chunk.uid)
        if chunk_id in existing:
            continue
        position = (str(chunk.section_id), chunk.chunk_index)
        expanded.append(
            {
                "chunk_id": chunk_id,
                "paper_id": str(chunk.paper_id),
                "section_id": str(chunk.section_id),
                "chunk_index": chunk.chunk_index,
                "section": section.title,
                "excerpt": chunk.content,
                "score": neighbor_scores.get(position, 0.0),
            }
        )
        existing.add(chunk_id)

    logger.info(
        "rag.expand elapsed_ms=%.1f added=%d",
        (time.perf_counter() - started) * 1000,
        len(expanded) - len(hits),
    )
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


def _prefilter_hits(
    hits: list[dict],
    *,
    keyword_ids: list[UUID],
    final_k: int,
) -> list[dict]:
    if Config.rag_min_score <= 0:
        return hits

    keyword_keep = {str(chunk_id) for chunk_id in keyword_ids[:final_k]}
    filtered = [
        hit
        for hit in hits
        if float(hit.get("score") or 0.0) >= Config.rag_min_score
        or hit.get("chunk_id") in keyword_keep
    ]
    return filtered if filtered else hits


def _apply_rerank_threshold(ranked: list[dict]) -> list[dict]:
    if Config.rag_min_score <= 0 or not Config.rag_rerank_enabled:
        return ranked

    thresholded = [
        hit
        for hit in ranked
        if float(hit.get("score") or 0.0) >= Config.rag_min_score
    ]

    if thresholded:
        return thresholded

    if ranked:
        return ranked[: min(3, len(ranked))]

    return ranked


async def search_paper_chunks(
    paper_id: UUID,
    query: str,
    *,
    top_k: int | None = None,
    query_vector: list[float] | None = None,
) -> list[dict]:
    """Hybrid dense + keyword retrieval with RRF, rerank, and neighbor expansion."""

    # Clean the query
    cleaned = " ".join((query or "").split())
    if not cleaned:
        return []

    # Config for pipeline
    pipeline_started = time.perf_counter()
    final_k = top_k or Config.rag_top_k
    recall_k = Config.rag_candidate_k
    max_context = Config.rag_max_context_chunks

    # Cap LLM rerank input: prefer config, else ~2x top_k (min 12).
    rerank_pool = min(
        Config.rag_rerank_max_candidates,
        max(Config.rag_top_k * 2, 12),
        recall_k,
    )

    # Perform the dense search(vector)
    # Perform the keyword search(PG Database)
    dense_hits, keyword_hits = await asyncio.gather(
        _dense_search(
            paper_id,
            cleaned,
            limit=recall_k,
            query_vector=query_vector,
        ),
        _keyword_search(paper_id, cleaned, limit=recall_k),
    )

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
    hits = _prefilter_hits(hits, keyword_ids=keyword_ids, final_k=final_k)

    rerank_candidates = hits[:rerank_pool]
    ranked = await rerank_hits(cleaned, rerank_candidates, top_k=final_k)
    ranked = _apply_rerank_threshold(ranked)

    primaries = ranked[:final_k]
    expanded = await _expand_neighbors(
        primaries,
        window=Config.rag_neighbor_window,
    )
    expanded = _dedupe_hits(expanded)
    result = _strip_internal_fields(expanded[:max_context])

    logger.info(
        "rag.search elapsed_ms=%.1f dense=%d keyword=%d rerank_in=%d out=%d",
        (time.perf_counter() - pipeline_started) * 1000,
        len(dense_hits),
        len(keyword_hits),
        len(rerank_candidates),
        len(result),
    )

    return result
