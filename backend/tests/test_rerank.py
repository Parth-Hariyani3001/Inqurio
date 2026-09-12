from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.rag.rerank import _is_local_chat_model, rerank_hits


class TestIsLocalChatModel(unittest.TestCase):
    def test_loopback_base_url(self) -> None:
        self.assertTrue(
            _is_local_chat_model(
                chat_model="gpt-4o-mini",
                ai_base_url="http://localhost:1234/v1",
            )
        )
        self.assertTrue(
            _is_local_chat_model(
                chat_model="gpt-4o-mini",
                ai_base_url="http://127.0.0.1:8080/v1",
            )
        )

    def test_self_hosted_model_names(self) -> None:
        self.assertTrue(
            _is_local_chat_model(
                chat_model="google/gemma-4-12b-qat",
                ai_base_url="",
            )
        )
        self.assertTrue(
            _is_local_chat_model(chat_model="llama-3.1-8b", ai_base_url="")
        )

    def test_openai_hosted_gpt_is_not_local(self) -> None:
        self.assertFalse(
            _is_local_chat_model(chat_model="gpt-4o-mini", ai_base_url="")
        )
        self.assertFalse(
            _is_local_chat_model(
                chat_model="gpt-4o-mini",
                ai_base_url="https://api.openai.com/v1",
            )
        )


class TestRerankHitsLocalSkip(unittest.IsolatedAsyncioTestCase):
    async def test_skips_llm_for_local_model(self) -> None:
        hits = [
            {
                "chunk_id": str(uuid4()),
                "section": "Intro",
                "excerpt": "first",
                "score": 0.9,
            },
            {
                "chunk_id": str(uuid4()),
                "section": "Methods",
                "excerpt": "second",
                "score": 0.8,
            },
        ]

        with (
            patch("src.rag.rerank.Config.rag_rerank_enabled", True),
            patch(
                "src.rag.rerank._is_local_chat_model",
                return_value=True,
            ),
            patch("src.rag.rerank._get_rerank_model") as get_model,
        ):
            ranked = await rerank_hits("query", hits, top_k=1)

        get_model.assert_not_called()
        self.assertEqual(ranked, hits[:1])

    async def test_calls_llm_for_hosted_gpt(self) -> None:
        first_id = str(uuid4())
        second_id = str(uuid4())
        hits = [
            {
                "chunk_id": first_id,
                "section": "Intro",
                "excerpt": "first",
                "score": 0.9,
            },
            {
                "chunk_id": second_id,
                "section": "Methods",
                "excerpt": "second",
                "score": 0.8,
            },
        ]
        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(
            return_value=MagicMock(
                content='{"ranked_ids":["' + second_id + '","' + first_id + '"]}'
            )
        )

        with (
            patch("src.rag.rerank.Config.rag_rerank_enabled", True),
            patch("src.rag.rerank.Config.rag_rerank_max_candidates", 15),
            patch("src.rag.rerank._is_local_chat_model", return_value=False),
            patch("src.rag.rerank._get_rerank_model", return_value=mock_model),
        ):
            ranked = await rerank_hits("query", hits, top_k=2)

        mock_model.ainvoke.assert_awaited_once()
        self.assertEqual(ranked[0]["chunk_id"], second_id)
