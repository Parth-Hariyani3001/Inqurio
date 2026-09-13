from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from src.agent.tools import build_agent_tools, build_openalex_search_tool
from src.schemas.openalex import OpenAlexWork, OpenAlexWorksMeta, OpenAlexWorksResponse
from src.services.chat import _ingest_tool_output, _merge_openalex_citations


class TestOpenAlexSearchTool(unittest.IsolatedAsyncioTestCase):
    async def test_returns_compact_openalex_payload(self) -> None:
        work = OpenAlexWork(
            id="W123",
            doi="https://doi.org/10.1234/example",
            display_name="Example Paper",
            publication_year=2024,
            cited_by_count=12,
            is_oa=True,
            authors=["Ada Lovelace"],
            tags=["ml"],
            venue="Nature",
        )
        response = OpenAlexWorksResponse(
            meta=OpenAlexWorksMeta(count=1, per_page=5, next_cursor=None),
            results=[work],
        )

        tool = build_openalex_search_tool()
        with patch(
            "src.agent.tools.OpenAlex.search_works",
            new=AsyncMock(return_value=response),
        ) as search_mock:
            raw = await tool.ainvoke({"query": "transformers attention"})

        search_mock.assert_awaited_once_with(
            search="transformers attention",
            per_page=5,
        )
        payload = json.loads(raw)
        self.assertEqual(
            payload["openalex"],
            [
                {
                    "id": "W123",
                    "doi": "https://doi.org/10.1234/example",
                    "display_name": "Example Paper",
                    "publication_year": 2024,
                    "cited_by_count": 12,
                    "is_oa": True,
                    "authors": ["Ada Lovelace"],
                    "venue": "Nature",
                    "tags": ["ml"],
                }
            ],
        )

    async def test_empty_query_skips_upstream(self) -> None:
        tool = build_openalex_search_tool()
        with patch(
            "src.agent.tools.OpenAlex.search_works",
            new=AsyncMock(),
        ) as search_mock:
            raw = await tool.ainvoke({"query": "   "})

        search_mock.assert_not_awaited()
        payload = json.loads(raw)
        self.assertEqual(payload["openalex"], [])
        self.assertIn("note", payload)

    def test_registered_on_agent_tools(self) -> None:
        with patch("src.agent.tools.Config.tavily_api_key", ""):
            tools = build_agent_tools(uuid4())
        names = {tool.name for tool in tools}
        self.assertIn("retrieve_paper_context", names)
        self.assertIn("search_openalex_works", names)
        self.assertNotIn("search_paper_background", names)


class TestOpenAlexCitationMerge(unittest.TestCase):
    def test_merges_and_dedupes_by_id(self) -> None:
        bucket: list[dict] = []
        _merge_openalex_citations(
            bucket,
            {
                "openalex": [
                    {
                        "id": "W1",
                        "display_name": "First",
                        "doi": "https://doi.org/10.1/a",
                        "publication_year": 2020,
                        "authors": ["A"],
                        "venue": "Venue",
                        "cited_by_count": 3,
                        "is_oa": False,
                    },
                    {
                        "id": "W1",
                        "display_name": "Duplicate",
                        "doi": "https://doi.org/10.1/a",
                    },
                ]
            },
        )
        self.assertEqual(len(bucket), 1)
        self.assertEqual(bucket[0]["id"], "W1")
        self.assertEqual(bucket[0]["display_name"], "First")

    def test_ingest_routes_openalex_tool(self) -> None:
        citations: dict[str, list[dict]] = {
            "paper": [],
            "web": [],
            "openalex": [],
        }
        _ingest_tool_output(
            citations,
            "search_openalex_works",
            json.dumps(
                {
                    "openalex": [
                        {
                            "id": "W9",
                            "display_name": "Cited Work",
                            "authors": ["Author"],
                            "cited_by_count": 1,
                            "is_oa": True,
                        }
                    ]
                }
            ),
        )
        self.assertEqual(len(citations["openalex"]), 1)
        self.assertEqual(citations["openalex"][0]["display_name"], "Cited Work")
        self.assertEqual(citations["web"], [])
        self.assertEqual(citations["paper"], [])


if __name__ == "__main__":
    unittest.main()
