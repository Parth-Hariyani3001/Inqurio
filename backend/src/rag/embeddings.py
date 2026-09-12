from langchain_openai import OpenAIEmbeddings
from src.config.main import Config
from pydantic import SecretStr

embeddings = OpenAIEmbeddings(
    model=Config.embedding_model,
    base_url=Config.ai_base_url,
    api_key=SecretStr(Config.ai_api_key),
    check_embedding_ctx_length=False,
)
