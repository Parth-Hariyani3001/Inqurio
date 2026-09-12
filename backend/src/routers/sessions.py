import json
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from src.db.main import get_session
from src.schemas.sessions import (
    MessageCreatePayload,
    SessionCreatePayload,
    SessionDetailResponse,
    SessionListItem,
    SessionResponse,
    SessionUpdatePayload,
)
from src.services.chat import ChatService
from src.services.sessions import SessionService
from src.services.users import UserService
from src.utils.clerk import validate_user_session

sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])

session_service = SessionService()
chat_service = ChatService()
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _require_user(clerk_user_id: str, session: AsyncSession):
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )
    return user_data


@sessions_router.post("/")
async def create_session(
    body: SessionCreatePayload,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> SessionResponse:
    user_data = await _require_user(clerk_user_id, session)

    return await session_service.create_session(
        user_data.uid,
        body.paper_id,
        session,
    )


@sessions_router.get("/")
async def list_sessions(
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SessionListItem]:
    user_data = await _require_user(clerk_user_id, session)

    return await session_service.list_for_user(
        user_data.uid,
        session,
        limit=limit,
        offset=offset,
    )


@sessions_router.get("/{session_id}")
async def get_session(
    session_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> SessionDetailResponse:
    user_data = await _require_user(clerk_user_id, session)

    return await session_service.get_session_for_user(
        session_id,
        user_data.uid,
        session,
    )


@sessions_router.patch("/{session_id}")
async def update_session(
    session_id: UUID,
    body: SessionUpdatePayload,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> SessionResponse:
    user_data = await _require_user(clerk_user_id, session)

    return await session_service.update_title(
        session_id,
        user_data.uid,
        body.title,
        session,
    )


@sessions_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> Response:
    user_data = await _require_user(clerk_user_id, session)

    await session_service.delete_session(
        session_id,
        user_data.uid,
        session,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@sessions_router.post("/{session_id}/messages")
async def create_message(
    session_id: UUID,
    body: MessageCreatePayload,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> EventSourceResponse:
    user_data = await _require_user(clerk_user_id, session)

    async def event_stream() -> AsyncIterator[ServerSentEvent]:
        async for event_name, payload in chat_service.stream_message(
            session_id=session_id,
            user_id=user_data.uid,
            content=body.content,
            session=session,
        ):
            yield ServerSentEvent(
                event=event_name,
                data=json.dumps(payload),
            )

    return EventSourceResponse(event_stream())
