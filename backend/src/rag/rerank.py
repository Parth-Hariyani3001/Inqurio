from __future__ import annotations

import json
import logging
import re
import time
from typing import Any
from urllib.parse import urlparse

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from src.config.main import Config

logger = logging.getLogger(__name__)

_rerank_model: ChatOpenAI | None = None

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}
_LOCAL_MODEL_MARKERS = ("gemma", "llama", "qwen", "mistral", "phi", "qat")


def _is_local_chat_model(
    *,
    chat_model: str | None = None,
    ai_base_url: str | None = None,
) -> bool:
    """True for loopback OpenAI-compatible servers or self-hosted model names."""
    base_url = ai_base_url if ai_base_url is not None else Config.ai_base_url
    host = (urlparse(base_url or "").hostname or "").lower()
    if host in _LOOPBACK_HOSTS:
        return True

    model = (chat_model if chat_model is not None else Config.chat_model or "").lower()
    if "gpt-" in model:
        return False
    return any(marker in model for marker in _LOCAL_MODEL_MARKERS)


def _get_rerank_model() -> ChatOpenAI:
    global _rerank_model

    if _rerank_model is None:
        _rerank_model = ChatOpenAI(
            model=Config.chat_model or "gpt-4o-mini",
            api_key=SecretStr(Config.ai_api_key),
            base_url=Config.ai_base_url or None,
            temperature=0,
            max_completion_tokens=256,
            streaming=False,
        )

    return _rerank_model


def _parse_ranked_ids(raw: str, allowed: set[str]) -> list[str]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        ids = re.findall(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            text,
        )
        return [chunk_id for chunk_id in ids if chunk_id in allowed]

    ordered: list[str] = []
    if isinstance(parsed, dict):
        candidates = parsed.get("ranked_ids") or parsed.get("ids") or []
    elif isinstance(parsed, list):
        candidates = parsed
    else:
        candidates = []

    for item in candidates:
        chunk_id = str(item).strip()
        if chunk_id in allowed and chunk_id not in ordered:
            ordered.append(chunk_id)

    return ordered


async def rerank_hits(
    query: str,
    hits: list[dict[str, Any]],
    *,
    top_k: int,
) -> list[dict[str, Any]]:
    """Listwise LLM rerank; falls back to input order on failure."""
    if not hits or not Config.rag_rerank_enabled or len(hits) <= 1:
        return hits[:top_k]

    if _is_local_chat_model():
        logger.info("rag.rerank skipped reason=local_model")
        return hits[:top_k]

    hits = hits[: Config.rag_rerank_max_candidates]

    by_id = {str(hit["chunk_id"]): hit for hit in hits if hit.get("chunk_id")}
    if len(by_id) <= 1:
        return hits[:top_k]

    passages: list[str] = []
    for index, hit in enumerate(hits, start=1):
        excerpt = str(hit.get("excerpt") or "").strip()
        if len(excerpt) > 600:
            excerpt = f"{excerpt[:599]}…"

        passages.append(
            f"{index}. chunk_id={hit.get('chunk_id')} "
            f"section={hit.get('section') or 'Unknown'}\n{excerpt}"
        )

    prompt = (
        "You are a relevance reranker for a research-paper RAG system.\n"
        "Rank the passages by how well they answer the query. "
        "Return ONLY JSON of the form "
        '{"ranked_ids":["chunk-id-1","chunk-id-2",...]} '
        "using the given chunk_ids. Do not invent ids.\n\n"
        f"Query:\n{query}\n\n"
        f"Passages:\n{chr(10).join(passages)}"
    )

    try:
        model = _get_rerank_model()
        started = time.perf_counter()

        response = await model.ainvoke(prompt)
        logger.info(
            "rag.rerank elapsed_ms=%.1f candidates=%d",
            (time.perf_counter() - started) * 1000,
            len(hits),
        )

        content = response.content
        if isinstance(content, list):
            text = "".join(
                str(part.get("text") if isinstance(part, dict) else part)
                for part in content
            )
        else:
            text = str(content or "")

        ordered_ids = _parse_ranked_ids(text, set(by_id))
        if not ordered_ids:
            return hits[:top_k]

        ranked: list[dict[str, Any]] = []
        for rank, chunk_id in enumerate(ordered_ids):
            hit = dict(by_id[chunk_id])
            hit["score"] = max(0.0, 1.0 - (rank * 0.05))
            ranked.append(hit)

        seen = {item["chunk_id"] for item in ranked}
        for hit in hits:
            chunk_id = str(hit.get("chunk_id") or "")
            if chunk_id and chunk_id not in seen:
                ranked.append(hit)

        return ranked[:top_k]

    except Exception:
        return hits[:top_k]
