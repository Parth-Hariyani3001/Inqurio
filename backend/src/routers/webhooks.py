from fastapi import APIRouter, Request, Depends, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi.responses import JSONResponse
from src.services.users import UserService
from src.db.main import get_session
from src.utils.clerk import verify_clerk_signature

webhook_router = APIRouter(prefix='/webhooks', tags=["webhooks"])

user_service = UserService()


def _profile_from_webhook_data(data: dict) -> tuple[str | None, str | None, str | None, str | None]:
    clerk_user_id = data.get("id")
    emails = data.get("email_addresses") or []
    email = None
    if emails:
        primary_id = data.get("primary_email_address_id")
        email = emails[0].get("email_address")
        if primary_id:
            for item in emails:
                if item.get("id") == primary_id:
                    email = item.get("email_address")
                    break
    return clerk_user_id, email, data.get("first_name"), data.get("last_name")


@webhook_router.post('/clerk')
async def clerk_webhook(request: Request, session: AsyncSession = Depends(get_session), _=Depends(verify_clerk_signature)):
    payload = await request.json()

    event_type = payload['type']
    data = payload['data']

    if event_type in ('user.created', 'user.updated'):
        clerk_user_id, email, first_name, last_name = _profile_from_webhook_data(data)
        if not clerk_user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"message": "Missing Clerk user id"},
            )
            
        if not email:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"message": "Missing Clerk user email"},
            )

        await user_service.upsert_from_clerk(
            clerk_user_id,
            email,
            first_name,
            last_name,
            session,
        )

        return Response(status_code=status.HTTP_200_OK)

    if event_type == 'user.deleted':
        clerk_user_id = data.get('id')
        await user_service.delete_user(
            clerk_user_id,
            session
        )

        return Response(status_code=204)

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "message": f"Unsupported event type: {event_type}"
        }
    )
