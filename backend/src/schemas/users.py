from pydantic import BaseModel


class UserMeResponse(BaseModel):
    id: str
    clerk_id: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
