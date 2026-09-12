from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config.main import Config
from .errors import register_error_handlers
from .routers.webhooks import webhook_router
from .routers.annotations import annotations_router
from .routers.papers import papers_router
from .routers.sessions import sessions_router
from .routers.user_papers import user_papers_router
from .routers.users import users_router
from .routers.openalex import open_alex_router

version = "v1"
app = FastAPI(
    title='Inquiro',
    description='Inquiro is a RAG Based project that allows users to analyse research papers.',
    version=version,
    debug=True
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)


@app.get('/')
async def health_check():
    return {'status': 'ok', 'version': version}

app.include_router(papers_router, prefix=f'/api/{version}')
app.include_router(annotations_router, prefix=f'/api/{version}')
app.include_router(sessions_router, prefix=f'/api/{version}')
app.include_router(user_papers_router, prefix=f'/api/{version}')
app.include_router(users_router, prefix=f'/api/{version}')

# Called by services
app.include_router(webhook_router, prefix=f'/api/{version}')

# Called to get OpenAlex data
app.include_router(open_alex_router, prefix=f'/api/{version}')
