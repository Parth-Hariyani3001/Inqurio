from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.main import get_session
from src.schemas.sessions import (
    SessionCreatePayload,
    SessionDetailResponse,
    SessionListItem,
    SessionResponse,
)
from src.services.sessions import SessionService
from src.services.users import UserService
from src.utils.clerk import validate_user_session

sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])

session_service = SessionService()
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@sessions_router.post("/")
async def create_session(
    body: SessionCreatePayload,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> SessionResponse:
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

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
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

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
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return await session_service.get_session_for_user(
        session_id,
        user_data.uid,
        session,
    )
