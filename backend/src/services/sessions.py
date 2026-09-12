from uuid import UUID

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Chat, Message, Paper, Status
from src.errors.exceptions import NotFoundError, PaperNotReadyError
from src.schemas.sessions import (
    MessageResponse,
    SessionDetailResponse,
    SessionListItem,
    SessionResponse,
)
from src.services.papers import PaperService
from src.services.user_papers import UserPaperService


class SessionService:
    def __init__(self):
        self.paper_service = PaperService()
        self.user_paper_service = UserPaperService()

    async def create_session(
        self,
        user_id: UUID,
        paper_id: UUID,
        session: AsyncSession,
    ) -> SessionResponse:
        paper = await self.paper_service.get_paper_by_id(paper_id, session)
        if not paper:
            raise NotFoundError(message="Paper not found")

        if paper.status != Status.READY:
            raise PaperNotReadyError(
                message="Paper is not ready for chat yet",
                details={"status": paper.status.value},
            )

        user_paper = await self.user_paper_service.get_paper_by_id(
            user_id, paper.uid, session
        )
        if not user_paper:
            raise NotFoundError(message="Paper not found in your library")

        chat = Chat(
            paper_id=paper.uid,
            paper_ids=[paper.uid],
            user_id=user_id,
            title=paper.title,
        )
        session.add(chat)
        await session.commit()
        await session.refresh(chat)

        return SessionResponse(
            uid=chat.uid,
            title=chat.title,
            paper_id=chat.paper_id,
            created_at=chat.created_at,
        )

    async def list_for_user(
        self,
        user_id: UUID,
        session: AsyncSession,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SessionListItem]:
        statement = (
            select(Chat, Paper)
            .join(Paper, col(Chat.paper_id) == Paper.uid)
            .where(col(Chat.user_id) == user_id)
            .order_by(col(Chat.created_at).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.exec(statement)

        return [
            SessionListItem(
                uid=chat.uid,
                title=chat.title,
                paper_id=chat.paper_id,
                paper_title=paper.title,
                created_at=chat.created_at,
            )
            for chat, paper in result.all()
        ]

    async def get_session_for_user(
        self,
        session_id: UUID,
        user_id: UUID,
        session: AsyncSession,
    ) -> SessionDetailResponse:
        statement = select(Chat).where(
            col(Chat.uid) == session_id,
            col(Chat.user_id) == user_id,
        )
        result = await session.exec(statement)
        chat = result.first()
        if not chat:
            raise NotFoundError(message="Session not found")

        messages_statement = (
            select(Message)
            .where(col(Message.chat_id) == chat.uid)
            .order_by(col(Message.created_at).asc())
        )
        messages_result = await session.exec(messages_statement)
        messages = messages_result.all()

        return SessionDetailResponse(
            uid=chat.uid,
            title=chat.title,
            paper_id=chat.paper_id,
            created_at=chat.created_at,
            messages=[
                MessageResponse(
                    uid=message.uid,
                    content=message.content,
                    role=message.role,
                    citations=message.citations,
                    created_at=message.created_at,
                )
                for message in messages
            ],
        )
