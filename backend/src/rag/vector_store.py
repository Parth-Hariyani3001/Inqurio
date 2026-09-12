from qdrant_client.http.models import Distance, VectorParams
from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore

from src.rag.embeddings import embeddings
from src.config.main import Config

client = QdrantClient(Config.qdrant_url)


collection_name = "papers"
if not client.collection_exists(collection_name):
    # dimension = len(embeddings.embed_query("test"))
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=1024,
            distance=Distance.COSINE,
        ),
    )

vector_store = QdrantVectorStore(
    client=client,
    collection_name="papers",
    embedding=embeddings,
)
