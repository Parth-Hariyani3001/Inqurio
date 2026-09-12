from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio.session import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.pool import NullPool

from src.config.main import Config

def create_task_engine():
    return create_async_engine(
        Config.postgresql_url,
        poolclass=NullPool,
    )


engine = create_task_engine()
# echo=True,

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


def create_session() -> AsyncSession:
    return SessionLocal()


async def get_one_session():
    async for session in get_session():
        return session
