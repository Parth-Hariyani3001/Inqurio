from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.errors.exceptions import InquiroError


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(InquiroError)
    async def _(_request: Request, exc: InquiroError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )
