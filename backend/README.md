# Inquiro Backend

Inquiro is a RAG-based backend for analysing research papers. Users ingest papers by OpenAlex ID; the system fetches metadata and a PDF, parses the document, chunks it, embeds the text, and stores vectors for later retrieval.

This repository is the FastAPI API, Celery worker, and supporting infrastructure. Chat and RAG Q&A over papers are modelled in the database but not exposed as HTTP APIs yet.

## Current capabilities

- Health check at `GET /`
- Clerk webhooks for user create and delete
- Authenticated paper ingest from OpenAlex (`POST /api/v1/papers/upload`)
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

## Architecture

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

## Project layout

```
src/
  __init__.py              # FastAPI app, routers, error handlers
  config/main.py           # Settings from .env
  db/                      # Engine, session, SQLModel tables
  errors/                  # InquiroError types and HTTP handlers
  routers/                 # papers, Clerk webhooks
  schemas/                 # Request/response models
  services/                # Papers, users, sections, chunks, user_papers
  rag/                     # Chunker, embeddings, Qdrant store
  utils/                   # Clerk, OpenAlex, GROBID, R2, PDF
  worker/                  # Celery app and process_paper task
  docker_compose/
    backend/               # Redis + Qdrant
    grobid/                # GROBID 0.9.0
alembic/                   # Database migrations
```

## Prerequisites

- Python 3.11+ (or the version you use for this project)
- Docker (Redis, Qdrant, GROBID)
- PostgreSQL
- Clerk application (API keys + webhook signing secret)
- Cloudflare R2 bucket
- OpenAlex API key (optional but recommended)
- OpenAI-compatible embeddings endpoint (1024-dimensional vectors)

## Setup

1. Clone the repo and create a virtual environment.

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
| `OPEN_ALEX_API_KEY` | OpenAlex API key |
| `GROBID_URL` | GROBID base URL (default `http://localhost:8070/`) |
| `EMBEDDING_MODEL` | Embedding model name |
| `AI_API_KEY` / `AI_BASE_URL` | OpenAI-compatible embeddings client |
| `QDRANT_URL` | Qdrant HTTP URL (default `http://localhost:6333`) |

`REDIS_URL` defaults to `redis://localhost:6379/0` if unset. Qdrant collection `papers` is created on first import of the vector store if it does not exist.

## API

Base prefix: `/api/v1`. Interactive docs: `/docs`.

### Health

```http
GET /
```

Returns `{ "status": "ok", "version": "v1" }`.

### Papers

```http
POST /api/v1/papers/upload
Authorization: Bearer <Clerk session token>
Content-Type: application/json

{ "openalex_id": "W2741809807" }
```

- **201** — paper queued for processing, or already in the library and added to the user
- **401** — missing or invalid Clerk session
- **404** — local user missing, or work not found in OpenAlex
- **409** — paper already assigned to this user (`user_paper_already_assigned`)

### Clerk webhooks

```http
POST /api/v1/webhooks/clerk
```

Verified with the Clerk signing secret. Supported events:

- `user.created` — creates a local user
- `user.deleted` — deletes the local user

Configure the webhook URL in the Clerk dashboard to this endpoint.

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
| `chats` / `messages` | Planned Q&A (schema only) |

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

## Not built yet

These exist as tables (and some services) but have no public API yet:

- Chat / RAG question answering over ingested papers
- Annotations
- Listing papers, status polling, or PDF download endpoints
