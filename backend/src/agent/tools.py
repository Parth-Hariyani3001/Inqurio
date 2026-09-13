from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from langchain_core.tools import BaseTool, tool
from langchain_tavily import TavilySearch

from src.config.main import Config
from src.rag.retrieval import normalize_retrieval_query, search_paper_chunks
from src.utils.open_alex import OpenAlex


def _serialize_openalex_work(work: Any) -> dict[str, Any]:
    return {
        "id": work.id,
        "doi": work.doi,
        "display_name": work.display_name,
        "publication_year": work.publication_year,
        "cited_by_count": work.cited_by_count,
        "is_oa": work.is_oa,
        "authors": work.authors,
        "venue": work.venue,
        "tags": work.tags,
    }


def build_retrieve_paper_tool(
    paper_id: UUID,
    *,
    retrieval_cache: dict[str, list[dict[str, Any]]] | None = None,
) -> BaseTool:
    cache = retrieval_cache if retrieval_cache is not None else {}

    @tool("retrieve_paper_context")
    async def retrieve_paper_context(query: str) -> str:
        """Search the attached research paper for passages relevant to the query.

        Always use this before answering when the provided paper context is insufficient.
        Prefer paper passages over general knowledge. If nothing matches, say so.
        """
        cache_key = normalize_retrieval_query(query)
        if cache_key in cache:
            hits = cache[cache_key]
        else:
            hits = await search_paper_chunks(paper_id, query)
            cache[cache_key] = hits

        if not hits:
            return json.dumps(
                {
                    "paper": [],
                    "note": "No matching passages found in the paper.",
                }
            )
        return json.dumps({"paper": hits})

    return retrieve_paper_context


def build_web_search_tool() -> BaseTool | None:
    api_key = Config.tavily_api_key.strip()
    if not api_key:
        return None

    os.environ.setdefault("TAVILY_API_KEY", api_key)
    tavily = TavilySearch(
        max_results=5,
        topic="general",
    )

    @tool("search_paper_background")
    def search_paper_background(query: str) -> str:
        """Search the web only for background that helps interpret the attached paper.

        Allowed: citations, related work, or definitions used by the paper.
        Forbidden: general programming help, homework, tutorials, or unrelated Q&A.
        """
        result = tavily.invoke(query)
        if isinstance(result, str):
            return result
        return json.dumps(result)

    return search_paper_background


def build_openalex_search_tool() -> BaseTool:
    @tool("search_openalex_works")
    async def search_openalex_works(query: str) -> str:
        """Search OpenAlex for scholarly works related to the attached paper.

        Use for related work, cited papers, authorship, venue, DOI, or citation-count
        lookups. Prefer this over web search when you need academic metadata.
        Do not use for in-paper passages — use retrieve_paper_context instead.
        """
        cleaned = (query or "").strip()
        if not cleaned:
            return json.dumps(
                {
                    "openalex": [],
                    "note": "Empty search query.",
                }
            )

        response = await OpenAlex.search_works(search=cleaned, per_page=5)
        works = [_serialize_openalex_work(work) for work in response.results]
        if not works:
            return json.dumps(
                {
                    "openalex": [],
                    "note": "No matching works found on OpenAlex.",
                }
            )
        return json.dumps({"openalex": works})

    return search_openalex_works


def build_agent_tools(
    paper_id: UUID,
    *,
    retrieval_cache: dict[str, list[dict[str, Any]]] | None = None,
) -> list[BaseTool]:
    tools: list[BaseTool] = [
        build_retrieve_paper_tool(paper_id, retrieval_cache=retrieval_cache),
        build_openalex_search_tool(),
    ]
    web_tool = build_web_search_tool()
    if web_tool is not None:
        tools.append(web_tool)

    return tools
