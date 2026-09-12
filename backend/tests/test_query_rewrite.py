from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage

from src.rag import query_rewrite
from src.rag.query_rewrite import (
    _needs_rewrite,
    rewrite_retrieval_query,
    will_rewrite_retrieval_query,
)


class TestNeedsRewrite(unittest.TestCase):
    def test_detects_pronouns(self) -> None:
        self.assertTrue(_needs_rewrite("What does it claim about BERT?"))
        self.assertTrue(_needs_rewrite("How does this method work?"))
        self.assertTrue(_needs_rewrite("Explain those results."))

    def test_skips_standalone_queries(self) -> None:
        self.assertFalse(_needs_rewrite("What is the main contribution of BERT?"))
        self.assertFalse(_needs_rewrite("Summarize the experimental setup"))


class TestWillRewriteRetrievalQuery(unittest.TestCase):
    def test_true_when_enabled_with_history_and_anaphora(self) -> None:
        history = [HumanMessage(content="Tell me about BERT")]
        with patch("src.rag.query_rewrite.Config.rag_query_rewrite_enabled", True):
            self.assertTrue(
                will_rewrite_retrieval_query(
                    "How does it handle masking?",
                    history=history,
                )
            )

    def test_false_when_disabled(self) -> None:
        history = [HumanMessage(content="Tell me about BERT")]
        with patch("src.rag.query_rewrite.Config.rag_query_rewrite_enabled", False):
            self.assertFalse(
                will_rewrite_retrieval_query(
                    "How does it handle masking?",
                    history=history,
                )
            )


class TestGetRewriteModel(unittest.TestCase):
    def tearDown(self) -> None:
        query_rewrite._rewrite_model = None

    def test_prefers_rewrite_model_and_base_url(self) -> None:
        query_rewrite._rewrite_model = None
        mock_client = MagicMock()

        with (
            patch("src.rag.query_rewrite.Config.rewrite_model", "tiny-rewrite"),
            patch("src.rag.query_rewrite.Config.chat_model", "google/gemma-4-12b-qat"),
            patch(
                "src.rag.query_rewrite.Config.rewrite_ai_base_url",
                "http://localhost:1234/v1",
            ),
            patch("src.rag.query_rewrite.Config.ai_base_url", "http://localhost:9999/v1"),
            patch("src.rag.query_rewrite.Config.ai_api_key", "test-key"),
            patch(
                "src.rag.query_rewrite.ChatOpenAI",
                return_value=mock_client,
            ) as chat_ctor,
        ):
            model = query_rewrite._get_rewrite_model()

        self.assertIs(model, mock_client)
        kwargs = chat_ctor.call_args.kwargs
        self.assertEqual(kwargs["model"], "tiny-rewrite")
        self.assertEqual(kwargs["base_url"], "http://localhost:1234/v1")

    def test_falls_back_to_chat_model(self) -> None:
        query_rewrite._rewrite_model = None
        mock_client = MagicMock()

        with (
            patch("src.rag.query_rewrite.Config.rewrite_model", ""),
            patch("src.rag.query_rewrite.Config.chat_model", "google/gemma-4-12b-qat"),
            patch("src.rag.query_rewrite.Config.rewrite_ai_base_url", ""),
            patch("src.rag.query_rewrite.Config.ai_base_url", "http://localhost:9999/v1"),
            patch("src.rag.query_rewrite.Config.ai_api_key", "test-key"),
            patch(
                "src.rag.query_rewrite.ChatOpenAI",
                return_value=mock_client,
            ) as chat_ctor,
        ):
            query_rewrite._get_rewrite_model()

        kwargs = chat_ctor.call_args.kwargs
        self.assertEqual(kwargs["model"], "google/gemma-4-12b-qat")
        self.assertEqual(kwargs["base_url"], "http://localhost:9999/v1")


class TestRewriteRetrievalQuery(unittest.IsolatedAsyncioTestCase):
    async def test_skips_llm_without_anaphora(self) -> None:
        history = [
            HumanMessage(content="Tell me about the abstract"),
            AIMessage(content="The abstract discusses transformers."),
        ]

        with patch("src.rag.query_rewrite._get_rewrite_model") as get_model:
            result = await rewrite_retrieval_query(
                "What evaluation metrics are used?",
                history=history,
                paper_title="Attention Is All You Need",
            )

        get_model.assert_not_called()
        self.assertEqual(result, "What evaluation metrics are used?")

    async def test_calls_llm_when_anaphora_present(self) -> None:
        history = [
            HumanMessage(content="Tell me about BERT"),
            AIMessage(content="BERT is a transformer model."),
        ]
        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(
            return_value=MagicMock(content="BERT architecture overview")
        )

        with (
            patch("src.rag.query_rewrite.Config.rag_query_rewrite_enabled", True),
            patch(
                "src.rag.query_rewrite._get_rewrite_model",
                return_value=mock_model,
            ),
        ):
            result = await rewrite_retrieval_query(
                "How does it handle masking?",
                history=history,
                paper_title="BERT",
            )

        mock_model.ainvoke.assert_awaited_once()
        self.assertEqual(result, "BERT architecture overview")

    async def test_skips_llm_without_history(self) -> None:
        with patch("src.rag.query_rewrite._get_rewrite_model") as get_model:
            result = await rewrite_retrieval_query(
                "How does it handle masking?",
                history=[],
                paper_title="BERT",
            )

        get_model.assert_not_called()
        self.assertEqual(result, "How does it handle masking?")

    async def test_skips_llm_when_disabled(self) -> None:
        history = [HumanMessage(content="Tell me about BERT")]

        with (
            patch("src.rag.query_rewrite.Config.rag_query_rewrite_enabled", False),
            patch("src.rag.query_rewrite._get_rewrite_model") as get_model,
        ):
            result = await rewrite_retrieval_query(
                "How does it handle masking?",
                history=history,
                paper_title="BERT",
            )

        get_model.assert_not_called()
        self.assertEqual(result, "How does it handle masking?")


if __name__ == "__main__":
    unittest.main()
