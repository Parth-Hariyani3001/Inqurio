from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage

from src.rag.query_rewrite import will_rewrite_retrieval_query
from src.rag.retrieval import normalize_retrieval_query, search_paper_chunks


class TestWillRewriteAlignment(unittest.TestCase):
    def test_matches_rewrite_gating(self) -> None:
        history = [
            HumanMessage(content="Tell me about BERT"),
            AIMessage(content="BERT is a transformer."),
        ]
        with patch("src.rag.query_rewrite.Config.rag_query_rewrite_enabled", True):
            self.assertTrue(
                will_rewrite_retrieval_query(
                    "How does it work?",
                    history=history,
                )
            )
            self.assertFalse(
                will_rewrite_retrieval_query(
                    "What evaluation metrics are reported?",
                    history=history,
                )
            )


class TestSpeculativeEmbedReuse(unittest.IsolatedAsyncioTestCase):
    async def test_reuses_vector_when_rewrite_unchanged(self) -> None:
        """Mirrors chat.py: reuse speculative vector when rewrite equals original."""
        original = "How does it handle masking?"
        rewritten = "How does it handle masking?"
        speculative = [0.1, 0.2, 0.3]

        reusable = normalize_retrieval_query(rewritten) == normalize_retrieval_query(
            original
        )
        self.assertTrue(reusable)

        paper_id = uuid4()
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
                rewritten,
                query_vector=speculative if reusable else None,
            )

        self.assertIs(dense_mock.await_args.kwargs.get("query_vector"), speculative)

    async def test_skips_precomputed_when_rewrite_changes_query(self) -> None:
        original = "How does it handle masking?"
        rewritten = "BERT masked language modeling"
        speculative = [0.1, 0.2, 0.3]

        reusable = normalize_retrieval_query(rewritten) == normalize_retrieval_query(
            original
        )
        self.assertFalse(reusable)

        paper_id = uuid4()
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
                rewritten,
                query_vector=speculative if reusable else None,
            )

        self.assertIsNone(dense_mock.await_args.kwargs.get("query_vector"))


if __name__ == "__main__":
    unittest.main()
