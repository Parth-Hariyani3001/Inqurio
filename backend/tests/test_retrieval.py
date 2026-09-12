from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.agent.tools import build_retrieve_paper_tool
from src.rag.retrieval import (
    _expand_neighbors,
    normalize_retrieval_query,
    search_paper_chunks,
)


class TestNormalizeRetrievalQuery(unittest.TestCase):
    def test_normalizes_whitespace_and_case(self) -> None:
        self.assertEqual(
            normalize_retrieval_query("  What   is BERT?  "),
            "what is bert?",
        )


class TestExpandNeighbors(unittest.IsolatedAsyncioTestCase):
    async def test_fetches_neighbors_with_inherited_score(self) -> None:
        section_id = uuid4()
        paper_id = uuid4()
        parent_id = uuid4()
        neighbor_id = uuid4()

        hits = [
            {
                "chunk_id": str(parent_id),
                "paper_id": str(paper_id),
                "section_id": str(section_id),
                "chunk_index": 5,
                "section": "Methods",
                "excerpt": "parent text",
                "score": 0.8,
            }
        ]

        mock_chunk = MagicMock()
        mock_chunk.uid = neighbor_id
        mock_chunk.paper_id = paper_id
        mock_chunk.section_id = section_id
        mock_chunk.chunk_index = 4
        mock_chunk.content = "neighbor text"

        mock_section = MagicMock()
        mock_section.title = "Methods"

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = [(mock_chunk, mock_section)]
        mock_session.exec = AsyncMock(return_value=mock_result)

        mock_session_cm = MagicMock()
        mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cm.__aexit__ = AsyncMock(return_value=None)

        with patch("src.rag.retrieval.SessionLocal", return_value=mock_session_cm):
            expanded = await _expand_neighbors(hits, window=1)

        self.assertEqual(len(expanded), 2)
        neighbor = next(hit for hit in expanded if hit["chunk_id"] == str(neighbor_id))
        self.assertAlmostEqual(neighbor["score"], 0.72)

        statement = mock_session.exec.await_args.args[0]
        compiled = str(statement.compile(compile_kwargs={"literal_binds": True})).lower()
        self.assertIn("chunk_index", compiled)
        self.assertNotRegex(compiled, r"where\s+chunks\.paper_id\s*=")

    async def test_skips_db_when_no_neighbors_needed(self) -> None:
        hits = [
            {
                "chunk_id": str(uuid4()),
                "paper_id": str(uuid4()),
                "section_id": str(uuid4()),
                "chunk_index": 0,
                "section": "Intro",
                "excerpt": "only chunk",
                "score": 0.5,
            }
        ]

        with patch("src.rag.retrieval.SessionLocal") as mock_session_local:
            result = await _expand_neighbors(hits, window=0)
            mock_session_local.assert_not_called()

        self.assertEqual(result, hits)


class TestSearchPaperChunks(unittest.IsolatedAsyncioTestCase):
    async def test_rerank_receives_capped_candidates(self) -> None:
        paper_id = uuid4()
        chunk_ids = [uuid4() for _ in range(20)]

        dense_hits = [
            (chunk_id, 0.9 - index * 0.01) for index, chunk_id in enumerate(chunk_ids)
        ]
        keyword_hits: list[tuple] = []

        hydrated = [
            {
                "chunk_id": str(chunk_id),
                "paper_id": str(paper_id),
                "section_id": str(uuid4()),
                "chunk_index": index,
                "section": "Section",
                "excerpt": f"text {index}",
                "score": score,
            }
            for index, (chunk_id, score) in enumerate(dense_hits)
        ]

        rerank_mock = AsyncMock(return_value=hydrated[:8])

        with (
            patch("src.rag.retrieval._dense_search", new_callable=AsyncMock) as dense_mock,
            patch(
                "src.rag.retrieval._keyword_search", new_callable=AsyncMock
            ) as keyword_mock,
            patch(
                "src.rag.retrieval._hydrate_chunks", new_callable=AsyncMock
            ) as hydrate_mock,
            patch(
                "src.rag.retrieval._expand_neighbors", new_callable=AsyncMock
            ) as expand_mock,
            patch("src.rag.retrieval.rerank_hits", rerank_mock),
            patch("src.rag.retrieval.Config.rag_rerank_max_candidates", 15),
            patch("src.rag.retrieval.Config.rag_top_k", 8),
            patch("src.rag.retrieval.Config.rag_candidate_k", 20),
            patch("src.rag.retrieval.Config.rag_max_context_chunks", 12),
            patch("src.rag.retrieval.Config.rag_min_score", 0.0),
            patch("src.rag.retrieval.Config.rag_rrf_k", 60),
            patch("src.rag.retrieval.Config.rag_neighbor_window", 0),
            patch("src.rag.retrieval.Config.rag_rerank_enabled", True),
        ):
            dense_mock.return_value = dense_hits
            keyword_mock.return_value = keyword_hits
            hydrate_mock.return_value = hydrated
            expand_mock.side_effect = lambda hits, window: hits

            await search_paper_chunks(paper_id, "test query")

        rerank_input = rerank_mock.await_args.args[1]
        self.assertLessEqual(len(rerank_input), 15)

    async def test_passes_precomputed_query_vector_to_dense_search(self) -> None:
        paper_id = uuid4()
        precomputed = [0.5, 0.25, 0.125]

        with (
            patch("src.rag.retrieval._dense_search", new_callable=AsyncMock) as dense_mock,
            patch(
                "src.rag.retrieval._keyword_search", new_callable=AsyncMock
            ) as keyword_mock,
            patch(
                "src.rag.retrieval._hydrate_chunks", new_callable=AsyncMock
            ) as hydrate_mock,
            patch(
                "src.rag.retrieval._expand_neighbors", new_callable=AsyncMock
            ) as expand_mock,
            patch("src.rag.retrieval.rerank_hits", new_callable=AsyncMock) as rerank_mock,
            patch("src.rag.retrieval.Config.rag_rerank_max_candidates", 15),
            patch("src.rag.retrieval.Config.rag_top_k", 8),
            patch("src.rag.retrieval.Config.rag_candidate_k", 20),
            patch("src.rag.retrieval.Config.rag_max_context_chunks", 12),
            patch("src.rag.retrieval.Config.rag_min_score", 0.0),
            patch("src.rag.retrieval.Config.rag_rrf_k", 60),
            patch("src.rag.retrieval.Config.rag_neighbor_window", 0),
            patch("src.rag.retrieval.Config.rag_rerank_enabled", True),
        ):
            dense_mock.return_value = []
            keyword_mock.return_value = []
            hydrate_mock.return_value = []
            expand_mock.side_effect = lambda hits, window: hits
            rerank_mock.return_value = []

            await search_paper_chunks(
                paper_id,
                "test query",
                query_vector=precomputed,
            )

        self.assertEqual(
            dense_mock.await_args.kwargs.get("query_vector"),
            precomputed,
        )


class TestRetrievalCache(unittest.IsolatedAsyncioTestCase):
    async def test_tool_uses_cache_for_duplicate_queries(self) -> None:
        paper_id = uuid4()
        cache: dict[str, list[dict]] = {}
        tool = build_retrieve_paper_tool(paper_id, retrieval_cache=cache)
        cached_hits = [
            {
                "chunk_id": str(uuid4()),
                "paper_id": str(paper_id),
                "section": "Intro",
                "excerpt": "cached",
                "score": 0.9,
            }
        ]

        with patch(
            "src.agent.tools.search_paper_chunks",
            new_callable=AsyncMock,
        ) as search_mock:
            search_mock.return_value = cached_hits
            await tool.ainvoke({"query": "What is the main result?"})
            await tool.ainvoke({"query": "  what is the main result?  "})

        search_mock.assert_called_once()
        self.assertIn(normalize_retrieval_query("What is the main result?"), cache)


if __name__ == "__main__":
    unittest.main()
