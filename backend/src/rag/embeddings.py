from __future__ import annotations

import logging
import threading
from collections import OrderedDict

from langchain_openai import OpenAIEmbeddings
from pydantic import SecretStr

from src.config.main import Config

logger = logging.getLogger(__name__)

embeddings = OpenAIEmbeddings(
    model=Config.embedding_model,
    base_url=Config.ai_base_url,
    api_key=SecretStr(Config.ai_api_key),
    check_embedding_ctx_length=False,
)

_cache_lock = threading.Lock()
_embed_cache: OrderedDict[str, list[float]] = OrderedDict()


def _cache_key(query: str) -> str:
    return " ".join((query or "").split()).lower()


def clear_embed_cache() -> None:
    with _cache_lock:
        _embed_cache.clear()


def embed_query_cached(query: str) -> list[float]:
    """Embed a query with an in-process LRU cache keyed by normalized text."""
    key = _cache_key(query)
    max_size = max(0, int(Config.rag_embed_cache_size))

    if max_size > 0:
        with _cache_lock:
            cached = _embed_cache.get(key)
            if cached is not None:
                _embed_cache.move_to_end(key)
                logger.info("rag.dense.embed_cache hit key_len=%d", len(key))
                return list(cached)

    vector = embeddings.embed_query(query)

    if max_size > 0:
        with _cache_lock:
            _embed_cache[key] = list(vector)
            _embed_cache.move_to_end(key)
            while len(_embed_cache) > max_size:
                _embed_cache.popitem(last=False)
        logger.info("rag.dense.embed_cache miss key_len=%d", len(key))
    return vector
