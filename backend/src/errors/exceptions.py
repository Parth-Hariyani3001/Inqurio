class InquiroError(Exception):
    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict | None = None,
    ):
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> dict:
        payload = {
            "success": False,
            "error": self.error_code,
            "message": self.message,
        }

        if self.details is not None:
            payload["details"] = self.details

        return payload

# CUSTOM ERRORS


class UserPaperAlreadyAssigned(InquiroError):
    status_code = 409
    error_code = "user_paper_already_assigned"
    message = "User already has this paper assigned"


class PaperNotReadyError(InquiroError):
    status_code = 409
    error_code = "paper_not_ready"
    message = "Paper is not ready to add yet"


class PaperNotFoundInOpenAlexError(InquiroError):
    status_code = 404
    error_code = "paper_not_found_in_openalex"
    message = "Paper not found in OpenAlex"


class PaperUrlsNotFoundError(InquiroError):
    status_code = 404
    error_code = "paper_urls_not_found"
    message = "Paper URLs not found, Please try again later"


class OpenAlexUpstreamError(InquiroError):
    status_code = 502
    error_code = "openalex_upstream_error"
    message = "OpenAlex is unavailable right now"


class ClerkUpstreamError(InquiroError):
    status_code = 502
    error_code = "clerk_upstream_error"
    message = "Clerk is unavailable right now"

# GENERAL ERRORS


class BadRequestError(InquiroError):
    status_code = 400
    error_code = "bad_request"
    message = "Bad request"


class UnauthorizedError(InquiroError):
    status_code = 401
    error_code = "unauthorized"
    message = "Not authenticated"


class ForbiddenError(InquiroError):
    status_code = 403
    error_code = "forbidden"
    message = "Forbidden"


class NotFoundError(InquiroError):
    status_code = 404
    error_code = "not_found"
    message = "Resource not found"


class ConflictError(InquiroError):
    status_code = 409
    error_code = "conflict"
    message = "Resource already exists"
