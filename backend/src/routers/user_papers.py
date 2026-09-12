from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.main import get_session
from src.schemas.papers import UserPaperResponse
from src.services.user_papers import UserPaperService
from src.services.users import UserService
from src.utils.clerk import validate_user_session

user_papers_router = APIRouter(prefix="/user-papers", tags=["user-papers"])

user_paper_service = UserPaperService()
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@user_papers_router.get("/")
async def list_user_papers(
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=500)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[UserPaperResponse]:
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return await user_paper_service.list_for_user(
        user_data.uid,
        session,
        search,
        limit=limit,
        offset=offset,
    )
