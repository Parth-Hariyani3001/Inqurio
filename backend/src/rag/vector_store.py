from __future__ import annotations

from uuid import UUID

from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    VectorParams,
)

from src.config.main import Config
from src.rag.embeddings import embeddings

client = QdrantClient(Config.qdrant_url)
collection_name = "papers"


def get_embedding_dimension() -> int:
    vector = embeddings.embed_query("dimension probe")
    return len(vector)


def ensure_collection(*, recreate_if_dim_mismatch: bool = False) -> int:
    """Create the papers collection with the live embedding dimension."""
    dimension = get_embedding_dimension()

    if client.collection_exists(collection_name):
        info = client.get_collection(collection_name)
        vectors = info.config.params.vectors
        existing_size: int | None = None
        if isinstance(vectors, VectorParams):
            existing_size = vectors.size
        elif isinstance(vectors, dict) and "" in vectors:
            existing_size = vectors[""].size
        elif hasattr(vectors, "size"):
            existing_size = getattr(vectors, "size", None)

        if existing_size is not None and existing_size != dimension:
            if not recreate_if_dim_mismatch:
                raise ValueError(
                    f"Qdrant collection '{collection_name}' has size={existing_size} "
                    f"but embedding model outputs {dimension}. "
                    "Re-create the collection or reprocess papers."
                )
            client.delete_collection(collection_name)
        else:
            return dimension

    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=dimension,
            distance=Distance.COSINE,
        ),
    )
    return dimension


# Bootstrap on import so local/dev starts with a valid collection.
try:
    ensure_collection(recreate_if_dim_mismatch=False)
except Exception:
    # Defer hard failures to first upsert/search — embeddings API may be down at import.
    pass


vector_store = QdrantVectorStore(
    client=client,
    collection_name=collection_name,
    embedding=embeddings,
)


def delete_points_for_paper(paper_id: UUID) -> None:
    if not client.collection_exists(collection_name):
        return

    client.delete(
        collection_name=collection_name,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="paper_id",
                    match=MatchValue(value=str(paper_id)),
                )
            ]
        ),
    )
