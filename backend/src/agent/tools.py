from __future__ import annotations

import json
import os
from uuid import UUID

from langchain_core.tools import BaseTool, tool
from langchain_tavily import TavilySearch

from src.config.main import Config
from src.rag.retrieval import search_paper_chunks


def build_retrieve_paper_tool(paper_id: UUID) -> BaseTool:
    @tool("retrieve_paper_context")
    async def retrieve_paper_context(query: str) -> str:
        """Search the attached research paper for passages relevant to the query.

        Always use this before answering when the provided paper context is insufficient.
        Prefer paper passages over general knowledge. If nothing matches, say so.
        """
        hits = await search_paper_chunks(paper_id, query)
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


def build_agent_tools(paper_id: UUID) -> list[BaseTool]:
    tools: list[BaseTool] = [build_retrieve_paper_tool(paper_id)]
    web_tool = build_web_search_tool()
    if web_tool is not None:
        tools.append(web_tool)

    return tools
