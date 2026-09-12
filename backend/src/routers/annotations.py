from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.main import get_session
from src.errors.exceptions import NotFoundError
from src.schemas.annotations import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
)
from src.services.annotations import AnnotationService
from src.services.users import UserService
from src.utils.clerk import validate_user_session

annotations_router = APIRouter(tags=["annotations"])

annotation_service = AnnotationService()
user_service = UserService()

ClerkUserIdDep = Annotated[str, Depends(validate_user_session)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def require_user(clerk_user_id: str, session: AsyncSession):
    user_data = await user_service.get_user_by_clerk_id(clerk_user_id, session)
    if not user_data:
        raise NotFoundError(message="User not found")
    return user_data


@annotations_router.get("/papers/{paper_id}/annotations")
async def list_annotations(
    paper_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> list[AnnotationResponse]:
    user_data = await require_user(clerk_user_id, session)
    return await annotation_service.list_for_paper(
        paper_id, user_data.uid, session
    )


@annotations_router.post("/papers/{paper_id}/annotations", status_code=201)
async def create_annotation(
    paper_id: UUID,
    body: AnnotationCreate,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> AnnotationResponse:
    user_data = await require_user(clerk_user_id, session)
    return await annotation_service.create_for_paper(
        paper_id, user_data.uid, body, session
    )


@annotations_router.patch("/annotations/{annotation_id}")
async def update_annotation(
    annotation_id: UUID,
    body: AnnotationUpdate,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> AnnotationResponse:
    user_data = await require_user(clerk_user_id, session)
    return await annotation_service.update_owned(
        annotation_id, user_data.uid, body, session
    )


@annotations_router.delete("/annotations/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: UUID,
    clerk_user_id: ClerkUserIdDep,
    session: SessionDep,
) -> Response:
    user_data = await require_user(clerk_user_id, session)
    await annotation_service.delete_owned(annotation_id, user_data.uid, session)
    return Response(status_code=204)
