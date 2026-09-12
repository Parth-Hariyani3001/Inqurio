from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from src.utils.clerk import fetch_clerk_user_profile, validate_user_session
from src.services.users import UserService
from src.db.main import get_session
from src.db.models import User
from src.errors.exceptions import ClerkUpstreamError
from src.schemas.users import UserMeResponse
from typing import Annotated

users_router = APIRouter(prefix='/users', tags=["users"])
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def to_me_response(user: User) -> UserMeResponse:
    return UserMeResponse(
        id=str(user.uid),
        clerk_id=user.clerk_user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@users_router.get('/me')
async def get_me(clerk_user_id: ClerkUserIdDep, session: SessionDep) -> UserMeResponse:
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if user_data:
        return to_me_response(user_data)

    email, first_name, last_name = await fetch_clerk_user_profile(clerk_user_id)
    if not email:
        raise ClerkUpstreamError("Clerk user has no email")

    user_data = await user_service.get_or_create_from_clerk(
        clerk_user_id,
        email,
        first_name,
        last_name,
        session,
    )

    return to_me_response(user_data)
