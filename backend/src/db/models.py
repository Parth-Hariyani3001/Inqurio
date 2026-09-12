import sqlalchemy.dialects.postgresql as pg
import uuid
import datetime

from sqlmodel import SQLModel, Field, Column, String
from sqlalchemy import ForeignKey, JSON, UniqueConstraint
from datetime import datetime
from typing import ClassVar
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin",
    USER = "user"


class Status(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class User(SQLModel, table=True):
    __tablename__: ClassVar[str] = 'users'
    __table_args__ = (
        UniqueConstraint("clerk_user_id", name="uq_users_clerk_user_id"),
    )
    uid: uuid.UUID = Field(default_factory=uuid.uuid4,
                           primary_key=True, nullable=False)
    first_name: str | None = Field(
        default=None,
        sa_column=Column(
            pg.VARCHAR,
            nullable=True
        )
    )
    last_name: str | None = Field(
        default=None,
        sa_column=Column(
            pg.VARCHAR,
            nullable=True
        )
    )
    email: str = Field(
        sa_column=Column(
            pg.VARCHAR,
            nullable=False,
            unique=True
        )
    )
    role: UserRole = Field(
        default=UserRole.USER,
        sa_column=Column(
            pg.VARCHAR,
            nullable=False,
        ),
    )
    create_at: datetime = Field(default_factory=datetime.utcnow)
    clerk_user_id: str | None = Field(
        default=None,
        sa_column=Column(
            pg.VARCHAR,
            nullable=True,
        )
    )

    def __repr__(self) -> str:
        return f"<User {self.email} - {self.first_name} - {self.last_name}"


class Paper(SQLModel, table=True):
    __tablename__: ClassVar[str] = 'papers'
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    title: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )
    authors: list[str] = Field(
        default_factory=list,
        sa_column=Column(
            pg.ARRAY(pg.TEXT),
            nullable=False,
        )
    )
    abstract: str = Field(
        nullable=True,
        sa_type=pg.TEXT,
        default=None
    )
    openalex_id: str = Field(
        sa_column=Column(
            String(255),
            unique=True,
            nullable=False,
        )
    )
    doi: str | None = Field(
        default=None,
        sa_column=Column(
            String(255),
            unique=True,
            nullable=True,
        )
    )
    file_hash: str | None = Field(
        default=None,
        sa_column=Column(
            String(64),
            unique=True,
            default=None,
            nullable=True
        )
    )
    s3_key: str = Field(
        nullable=True,
        sa_type=pg.TEXT,
        default=None
    )
    page_count: int = Field(
        nullable=True,
        sa_type=pg.INTEGER,
        default=None
    )
    status: Status = Field(
        default=Status.PENDING,
        sa_column=Column(
            pg.VARCHAR,
            nullable=False,
            default=Status.PENDING
        )
    )
    uploaded_by: uuid.UUID = Field(
        # ForeignKey("users.uid", ondelete="SET NULL"),
        sa_column=Column(
            pg.UUID,
            ForeignKey("users.uid", ondelete="SET NULL"),
            nullable=True,
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime | None = Field(default=None)


class Section(SQLModel, table=True):
    __tablename__: ClassVar[str] = 'sections'
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    paper_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("papers.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )
    section_order: int = Field(
        nullable=False,
        sa_type=pg.INTEGER
    )


class Chunk(SQLModel, table=True):
    __tablename__: ClassVar[str] = 'chunks'
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    paper_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("papers.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    section_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("sections.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    chunk_index: int = Field(
        nullable=False,
        sa_type=pg.INTEGER
    )
    content: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )


class UserPaper(SQLModel, table=True):
    __tablename__: ClassVar[str] = "user_papers"
    user_id: uuid.UUID = Field(
        default=None,
        sa_column=Column(
            pg.UUID,
            ForeignKey("users.uid", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    paper_id: uuid.UUID = Field(
        default=None,
        sa_column=Column(
            pg.UUID,
            ForeignKey("papers.uid", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    added_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            pg.TIMESTAMP,
            nullable=False,
            default=datetime.utcnow
        )
    )
    custom_tags: list[str] = Field(
        default_factory=list,
        sa_column=Column(
            pg.ARRAY(pg.TEXT),
            nullable=False,
        )
    )


class Chat(SQLModel, table=True):
    __tablename__: ClassVar[str] = "chats"
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    paper_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("papers.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    paper_ids: list[uuid.UUID] = Field(
        default_factory=list,
        sa_column=Column(
            pg.ARRAY(pg.UUID),
            nullable=False,
        )
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("users.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Message(SQLModel, table=True):
    __tablename__: ClassVar[str] = "messages"
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    chat_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("chats.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("users.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    content: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )
    role: ChatRole = Field(
        default=ChatRole.USER,
        sa_column=Column(
            pg.VARCHAR,
            nullable=False,
            default=ChatRole.USER
        )
    )
    citations: dict = Field(
        default_factory=dict,
        sa_column=Column(
            JSON,
            nullable=False,
            default=dict
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Annotation(SQLModel, table=True):
    __tablename__: ClassVar[str] = "annotations"
    uid: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False
    )
    paper_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("papers.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID,
            ForeignKey("users.uid", ondelete="CASCADE"),
            nullable=False,
        )
    )
    content: str = Field(
        nullable=False,
        sa_type=pg.TEXT
    )
    selection: dict = Field(
        default_factory=dict,
        sa_column=Column(
            JSON,
            nullable=False,
            default=dict
        )
    )
    color: str = Field(
        sa_column=Column(
            pg.VARCHAR,
            nullable=False,
            default="#FFFF00"
        )
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime | None = Field(default=None)
