import httpx

from clerk_backend_api.security import AuthenticateRequestOptions
from clerk_backend_api import Clerk
from clerk_backend_api.models.user import User as ClerkUser
from fastapi import Request, HTTPException, status
from src.config.main import Config
from src.errors.exceptions import ClerkUpstreamError, UnauthorizedError
from svix.webhooks import WebhookVerificationError, Webhook


clerk_sdk = Clerk(
    bearer_auth=Config.clerk_secret_key
)


async def validate_user_session(request: Request) -> str:
    try:
        httpx_request = httpx.Request(
            method=request.method,
            url=str(request.url),
            headers=dict(request.headers),
        )

        request_state = clerk_sdk.authenticate_request(
            httpx_request,
            AuthenticateRequestOptions(
                authorized_parties=None
            )
        )

        if not request_state.is_signed_in:
            raise UnauthorizedError()

        if request_state.payload is None:
            raise UnauthorizedError()

        user_id = request_state.payload['sub']
        return user_id

    except HTTPException:
        raise

    except Exception as e:
        print("Clerk error:", e)
        raise UnauthorizedError()


def clerk_profile_from_user(clerk_user: ClerkUser) -> tuple[str | None, str | None, str | None]:
    email: str | None = None
    addresses = clerk_user.email_addresses or []

    if addresses:
        primary_id = clerk_user.primary_email_address_id
        for address in addresses:
            if primary_id is not None and address.id == primary_id:
                email = address.email_address
                break

        if email is None:
            email = addresses[0].email_address

    return email, clerk_user.first_name, clerk_user.last_name


async def fetch_clerk_user_profile(
    clerk_user_id: str,
) -> tuple[str | None, str | None, str | None]:

    try:
        clerk_user = await clerk_sdk.users.get_async(user_id=clerk_user_id)
    except Exception as e:
        print("Clerk error:", e)
        raise ClerkUpstreamError() from e

    if clerk_user is None:
        raise ClerkUpstreamError("Clerk user not found")

    return clerk_profile_from_user(clerk_user)


async def verify_clerk_signature(request: Request):
    payload_bytes = await request.body()

    CLERK_SIGNATURE = Config.clerk_signing_secret
    if not CLERK_SIGNATURE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret is not configured."
        )

    # 1. Extract Svix specific headers from the request
    headers = request.headers
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    # 2. Check if all required headers are present
    if not all([svix_id, svix_timestamp, svix_signature]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required Svix webhook headers."
        )

    # 3. Initialize the webhook
    wh = Webhook(CLERK_SIGNATURE)

    try:
        # 4. Verification
        evt = wh.verify(
            payload_bytes,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }  # pyright: ignore[reportArgumentType]
        )
    except WebhookVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid webhook signature: {e}"
        )
