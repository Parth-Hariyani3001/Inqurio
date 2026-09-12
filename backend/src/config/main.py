from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    domain: str = 'localhost:8000'
    postgresql_url: str = ''
    clerk_signing_secret: str = ''
    clerk_publishable_key: str = ''
    clerk_secret_key: str = ''
    r2_secret_access_key: str = ''
    r2_account_id: str = ''
    r2_access_key: str = ''
    r2_bucket: str = 'inquiro'
    redis_url: str = 'redis://localhost:6379/0'
    open_alex_key: str = ""
    grobid_url: str = "http://localhost:8070/"
    embedding_model: str = ""
    chat_model: str = "google/gemma-4-12b-qat"
    ai_api_key: str = ""
    ai_base_url: str = ""
    tavily_api_key: str = ""
    rag_top_k: int = 6
    qdrant_url: str = "http://localhost:6333"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


Config = Settings()
