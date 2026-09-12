from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from src.rag import embeddings as embeddings_module
from src.rag.embeddings import clear_embed_cache, embed_query_cached


class TestEmbedQueryCached(unittest.TestCase):
    def setUp(self) -> None:
        clear_embed_cache()

    def tearDown(self) -> None:
        clear_embed_cache()

    def test_caches_by_normalized_query(self) -> None:
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.return_value = [0.1, 0.2, 0.3]

        with (
            patch.object(embeddings_module.Config, "rag_embed_cache_size", 256),
            patch.object(embeddings_module, "embeddings", mock_embeddings),
        ):
            first = embed_query_cached("What is BERT?")
            second = embed_query_cached("  what   is bert?  ")

        mock_embeddings.embed_query.assert_called_once_with("What is BERT?")
        self.assertEqual(first, [0.1, 0.2, 0.3])
        self.assertEqual(second, [0.1, 0.2, 0.3])

    def test_respects_zero_cache_size(self) -> None:
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.side_effect = [[0.1], [0.2]]

        with (
            patch.object(embeddings_module.Config, "rag_embed_cache_size", 0),
            patch.object(embeddings_module, "embeddings", mock_embeddings),
        ):
            first = embed_query_cached("same query")
            second = embed_query_cached("same query")

        self.assertEqual(mock_embeddings.embed_query.call_count, 2)
        self.assertEqual(first, [0.1])
        self.assertEqual(second, [0.2])

    def test_evicts_oldest_when_over_capacity(self) -> None:
        mock_embeddings = MagicMock()
        mock_embeddings.embed_query.side_effect = [[1.0], [2.0], [3.0], [1.1]]

        with (
            patch.object(embeddings_module.Config, "rag_embed_cache_size", 2),
            patch.object(embeddings_module, "embeddings", mock_embeddings),
        ):
            embed_query_cached("a")
            embed_query_cached("b")
            embed_query_cached("c")  # evicts "a"
            embed_query_cached("a")  # miss again

        self.assertEqual(mock_embeddings.embed_query.call_count, 4)


if __name__ == "__main__":
    unittest.main()
