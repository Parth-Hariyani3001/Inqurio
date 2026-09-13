# Inquiro Backend

Inquiro is a RAG-based backend for analysing research papers. Users ingest papers by OpenAlex ID; the system fetches metadata and a PDF, parses the document, chunks it, embeds the text, and stores vectors for retrieval. Authenticated users can list papers, read PDFs, and chat with a LangGraph agent grounded in the attached paper.

For full-stack setup (Clerk, R2, PostgreSQL, frontend), see the [root README](../README.md).

## Current capabilities

- Health check at `GET /`
- Clerk webhooks for user create, update, and delete
- Lazy user provisioning via `GET /api/v1/users/me`
- Authenticated paper ingest from OpenAlex (`POST /api/v1/papers/upload`)
- Paper list with search, PDF stream, and signed PDF URL
- User library (`GET /api/v1/user-papers`)
- OpenAlex proxy for work search and detail (`/api/v1/openalex/works`)
- Chat sessions CRUD and streaming Q&A (`/api/v1/sessions`)
- Background processing: download PDF, upload to Cloudflare R2, parse with GROBID, chunk, embed, upsert into Qdrant
- Shared paper library plus per-user assignment (`user_papers`)
- Typed API errors via `InquiroError` handlers

Paper status flow: `pending` → `processing` → `ready` or `failed`.

## Stack

| Layer | Choice |
| --- | --- |
| API | FastAPI |
| Auth | Clerk (session tokens + Svix-signed webhooks) |
| Database | PostgreSQL via SQLModel / SQLAlchemy (async, `asyncpg`) |
| Migrations | Alembic |
| Queue | Celery + Redis |
| PDF storage | Cloudflare R2 (S3-compatible) |
| Metadata | [OpenAlex](https://openalex.org/) |
| PDF parsing | [GROBID](https://grobid.readthedocs.io/) |
| Chunking | LangChain `RecursiveCharacterTextSplitter` (size 600, overlap 150) |
| Embeddings | OpenAI-compatible API (`langchain-openai`) |
| Vectors | Qdrant collection `papers` (1024-dim, cosine) |
| Chat | LangGraph ReAct agent (`langgraph`, `langchain-openai`) |
| Web search | Optional Tavily (`langchain-tavily`) |

## Architecture

### Paper ingest

```
Client (Clerk JWT)
        │
        ▼
   FastAPI (src:app)
        │  ingest OpenAlex ID
        ▼
   PaperService ──► PostgreSQL (papers, user_papers)
        │
        ▼
   Celery task process_paper
        │
        ├── OpenAlex PDF download
        ├── Cloudflare R2 upload
        ├── GROBID section parse
        ├── chunk + persist sections/chunks
        └── embed + Qdrant upsert
```

If the paper already exists, ingest assigns it to the current user instead of reprocessing. Assigning a paper the user already has returns a conflict.

### Chat / RAG

```
POST /sessions/{id}/messages (SSE)
        │
        ├── Save user message → message.user
        ├── Emit chat.phase (understanding → searching → thinking)
        ├── Prefetch Qdrant chunks (RAG_TOP_K)
        ├── Build grounded user prompt (guardrails)
        ▼
   LangGraph ReAct agent
        ├── Tool: retrieve_paper_context (Qdrant + PostgreSQL)
        └── Tool: search_paper_background (Tavily, if TAVILY_API_KEY set)
            → chat.phase searching_web
        │
        ├── chat.phase writing → Stream token deltas → message.assistant.delta
        └── Persist assistant message + citations → message.assistant.done
```

Scope guardrails in `src/agent/guardrails.py` restrict answers to the attached paper. Web search is only for paper-related background (citations, related work, definitions used in the paper).

SSE event types:

| Event | Payload |
| --- | --- |
| `message.user` | Saved user message |
| `chat.phase` | `{ "phase": "understanding\|searching\|thinking\|searching_web\|writing", "label": "..." }` status before/during generation |
| `message.assistant.delta` | `{ "delta": "..." }` streaming token |
| `message.assistant.done` | Full assistant message with citations |
| `error` | `{ "detail": "..." }` |

## Project layout

```
src/
  __init__.py              # FastAPI app, routers, error handlers
  config/main.py           # Settings from .env
  db/                      # Engine, session, SQLModel tables
  errors/                  # InquiroError types and HTTP handlers
  agent/                   # LangGraph agent, tools, guardrails
  routers/                 # papers, sessions, user-papers, users, openalex, webhooks
  schemas/                 # Request/response models
  services/                # Papers, sessions, chat, users, sections, chunks
  rag/                     # Chunker, embeddings, Qdrant store, retrieval
  utils/                   # Clerk, OpenAlex, GROBID, R2, PDF
  worker/                  # Celery app and process_paper task
  docker_compose/
    backend/               # Redis + Qdrant
    grobid/                # GROBID 0.9.0
alembic/                   # Database migrations
```

## Prerequisites

- Python 3.11+
- Docker (Redis, Qdrant, GROBID)
- PostgreSQL (external — see [root README](../README.md))
- Clerk application (API keys + webhook signing secret)
- Cloudflare R2 bucket
- OpenAlex API key (optional but recommended)
- OpenAI-compatible embeddings endpoint (1024-dimensional vectors) and chat model
- Tavily API key (optional)

## Setup

1. Create and activate a virtual environment.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Copy environment variables and fill in secrets.

```bash
cp .env.example .env
```

4. Start local infrastructure.

```bash
poe start_docker_compose_backend   # Redis :6379, Qdrant :6333
poe start_docker_compose_grobid    # GROBID :8070
```

5. Run migrations.

```bash
alembic upgrade head
```

6. Start the API and worker (separate terminals).

```bash
poe start          # uvicorn src:app --reload  (default http://localhost:8000)
poe start_celery   # Celery worker (solo pool)
```

Optional: `poe start_flower` for Celery Flower.

## Environment variables

Defined in `.env.example` and loaded by `src/config/main.py`:

| Variable | Purpose |
| --- | --- |
| `POSTGRESQL_URL` | Async SQLAlchemy URL (e.g. `postgresql+asyncpg://...`) |
| `CLERK_SIGNING_SECRET` | Svix secret for `/api/v1/webhooks/clerk` |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (session validation) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 credentials |
| `R2_BUCKET` | Bucket name (default `inquiro`) |
| `OPEN_ALEX_API_KEY` | OpenAlex API key in `.env.example`; runtime expects `OPEN_ALEX_KEY` (field `open_alex_key`) |
| `GROBID_URL` | GROBID base URL (default `http://localhost:8070/`) |
| `EMBEDDING_MODEL` | Embedding model name |
| `CHAT_MODEL` | Chat model for the agent |
| `AI_API_KEY` / `AI_BASE_URL` | OpenAI-compatible client |
| `TAVILY_API_KEY` | Optional; enables web search tool in chat |
| `RAG_TOP_K` | Number of chunks retrieved per query (default `6`) |
| `QDRANT_URL` | Qdrant HTTP URL (default `http://localhost:6333`) |
| `CORS_ORIGINS` | JSON list of allowed frontend origins |

`REDIS_URL` defaults to `redis://localhost:6379/0` if unset. Qdrant collection `papers` is created on first import of the vector store if it does not exist.

## API

Base prefix: `/api/v1`. Interactive docs: `/docs`.

All authenticated routes expect:

```http
Authorization: Bearer <Clerk session token>
```

### Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | `{ "status": "ok", "version": "v1" }` |

### Users

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/users/me` | Current user profile; creates local user from Clerk if missing |

### Papers

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/papers` | List papers for the user (search, pagination) |
| POST | `/api/v1/papers/upload` | Ingest by OpenAlex ID |
| GET | `/api/v1/papers/{paper_id}/pdf` | Stream PDF inline |
| GET | `/api/v1/papers/{paper_id}/pdf-url` | Signed URL + paper metadata |

**Upload**

```http
POST /api/v1/papers/upload
Content-Type: application/json

{ "openalex_id": "W2741809807" }
```

- **201** — paper ready (already processed)
- **202** — paper queued for processing
- **404** — user or OpenAlex work not found
- **409** — paper already assigned to this user

### User papers (library)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/user-papers` | User's assigned papers (search, pagination) |

### OpenAlex proxy

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/openalex/works` | Search works (filters: open access, year range, sort, cursor) |
| GET | `/api/v1/openalex/works/{work_id}` | Work detail; includes ingest status if already in DB |

### Sessions (chat)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/sessions` | Create session for a paper (`{ "paper_id": "..." }`) |
| GET | `/api/v1/sessions` | List sessions (pagination) |
| GET | `/api/v1/sessions/{session_id}` | Session detail with message history |
| PATCH | `/api/v1/sessions/{session_id}` | Update title |
| DELETE | `/api/v1/sessions/{session_id}` | Delete session |
| POST | `/api/v1/sessions/{session_id}/messages` | Send message; returns **SSE** stream |

**Send message**

```http
POST /api/v1/sessions/{session_id}/messages
Content-Type: application/json

{ "content": "What method did the authors use?" }
```

Response: `text/event-stream` with events listed in [Chat / RAG](#chat--rag).

### Clerk webhooks

```http
POST /api/v1/webhooks/clerk
```

Verified with the Clerk signing secret. Supported events:

- `user.created` / `user.updated` — upsert local user
- `user.deleted` — delete local user

Configure the webhook URL in the Clerk dashboard. For local dev, use a tunnel so Clerk can reach your machine.

## Paper processing pipeline

Celery task `process_paper` (`src/worker/process_paper.py`):

1. Mark paper `processing`
2. Download PDF from OpenAlex / arXiv OA URLs
3. SHA-256 hash the file and upload to R2 at `pdfs/{paper_id}.pdf`
4. Parse sections with GROBID
5. Split each section into overlapping chunks
6. Persist `sections` and `chunks` in PostgreSQL
7. Embed chunk text and upsert points into Qdrant (`papers`), payload: `paper_id`, `section_id`, `chunk_index`
8. Mark paper `ready`, or `failed` on error

## Data model (high level)

| Table | Role |
| --- | --- |
| `users` | Local users linked to Clerk |
| `papers` | Canonical paper (OpenAlex ID, DOI, status, R2 key) |
| `user_papers` | User ↔ paper assignment and tags |
| `sections` / `chunks` | Parsed structure used for RAG |
| `chats` / `messages` | Chat sessions and Q&A history with citations |

## Common commands

| Command | What it does |
| --- | --- |
| `poe start` | API with reload |
| `poe start_celery` | Celery worker |
| `poe start_flower` | Flower UI |
| `poe start_docker_compose_backend` | Redis + Qdrant |
| `poe start_docker_compose_grobid` | GROBID |
| `poe stop_docker_compose_backend` | Stop Redis + Qdrant |
| `poe stop_docker_compose_grobid` | Stop GROBID |
| `poe migrate "<message>"` | Autogenerate an Alembic revision |
