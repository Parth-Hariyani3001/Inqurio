# Inquiro

**Read the paper. Ask it back.**

Inquiro is a research paper reading room: find papers through OpenAlex, ingest PDFs, read them in full beside an inline viewer, and ask questions grounded in the text—not a summary of the field.

## Features

- **Explore** — Search and filter OpenAlex works (`/dashboard/explore`)
- **Ingest** — Add papers by OpenAlex ID; a background worker parses, chunks, embeds, and indexes them
- **Library** — Personal paper collection with search (`/dashboard/library`)
- **Read** — Inline PDF viewer next to the chat workspace
- **Ask** — Streaming chat with paper and web citations, scoped to the attached paper
- **Auth** — Clerk sign-in; JWT forwarded to the backend; webhooks keep local users in sync

## Architecture

```
Browser (TanStack Start :3000)
  │  Clerk session JWT on API calls
  ▼
FastAPI (:8000)
  ├── PostgreSQL     users, papers, chats, messages, sections, chunks
  ├── Celery + Redis background paper processing
  ├── Qdrant         chunk vectors (1024-dim, cosine)
  ├── Cloudflare R2  stored PDFs
  ├── GROBID         section parsing (:8070)
  └── OpenAI-compatible API
        ├── embeddings (ingest + retrieval)
        ├── chat model (LangGraph agent)
        └── optional Tavily (web background search)
```

### Monorepo layout

| Directory | Role |
| --- | --- |
| [`frontend/`](frontend/) | TanStack Start UI — explore, library, papers, chat + PDF |
| [`backend/`](backend/) | FastAPI API, Celery worker, RAG pipeline |

## User flows

### Find → Read → Ask

1. **Find** — Search OpenAlex from Explore, or browse your Library / Papers catalog.
2. **Read** — Ingest a paper by OpenAlex ID. When status is `ready`, open a chat session; the PDF loads beside the conversation.
3. **Ask** — Send a message; the assistant answers using retrieved paper passages (and optional web context for citations/related work).

### Chat message flow

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as FastAPI
  participant RAG as Qdrant
  participant Agent as LangGraphAgent
  participant DB as PostgreSQL

  UI->>API: POST /sessions/{id}/messages (SSE)
  API->>DB: Save user message
  API->>RAG: Prefetch top-k chunks for query
  API->>Agent: Grounded prompt + history
  loop Streaming
    Agent->>API: Token deltas / tool results
    API->>UI: SSE message.assistant.delta
  end
  API->>DB: Save assistant message + citations
  API->>UI: SSE message.assistant.done
```

Paper ingest runs asynchronously: `pending` → `processing` → `ready` or `failed`.

## Tech stack

### Frontend

| Layer | Choice |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, Vite, Nitro) |
| Routing / data | TanStack Router, TanStack Query |
| Auth | Clerk (`@clerk/tanstack-react-start`) |
| UI | shadcn/ui, Tailwind CSS 4, Lucide |
| PDF | pdfjs-dist |
| Markdown | react-markdown, remark-gfm |

### Backend

| Layer | Choice |
| --- | --- |
| API | FastAPI |
| Auth | Clerk (Bearer JWT + Svix webhooks) |
| Database | PostgreSQL, SQLModel, Alembic |
| Queue | Celery + Redis |
| PDF storage | Cloudflare R2 (S3-compatible) |
| Metadata | [OpenAlex](https://openalex.org/) |
| PDF parsing | [GROBID](https://grobid.readthedocs.io/) |
| Chunking | LangChain `RecursiveCharacterTextSplitter` |
| Embeddings | OpenAI-compatible API (`langchain-openai`) |
| Vectors | Qdrant collection `papers` |
| Chat | LangGraph ReAct agent + optional Tavily search |

## Prerequisites

Before setup, have the following available:

- **Node.js 20+** and npm
- **Python 3.11+**
- **Docker** — for Redis, Qdrant, and GROBID (compose files in the backend)
- **PostgreSQL** — not bundled in this repo; run your own instance
- **Clerk** application (publishable + secret keys, webhook signing secret)
- **Cloudflare R2** bucket and API credentials
- **OpenAlex API key** (recommended for higher rate limits)
- **OpenAI-compatible provider** for embeddings (1024-dimensional vectors) and chat
- **Tavily API key** (optional — enables web background search in chat)

## Full-stack setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd Inquiro
```

### 2. PostgreSQL

Create a database and note the connection URL:

```bash
# Example
POSTGRESQL_URL=postgresql+asyncpg://inquiro:inquiro@localhost:5432/inquiro
```

### 3. Clerk

1. Create an application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Copy the **publishable key** and **secret key** (used by both frontend and backend).
3. Copy the **webhook signing secret** for the backend.
4. Add a webhook endpoint pointing at your backend:

   ```http
   POST https://<your-backend-host>/api/v1/webhooks/clerk
   ```

   Subscribe to: `user.created`, `user.updated`, `user.deleted`.

   For local development, expose the backend with a tunnel (e.g. ngrok or cloudflared) so Clerk can reach it. Alternatively, the first authenticated request to `GET /api/v1/users/me` can create the local user without a webhook.

### 4. Cloudflare R2

1. Create a bucket (default name in config: `inquiro`).
2. Create an API token with read/write access.
3. Note account ID, access key, secret key, and bucket name for the backend `.env`.

### 5. Backend

From the `backend/` directory:

```bash
# Virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` — see [Environment variables](#environment-variables) below.

Start infrastructure and the API:

```bash
poe start_docker_compose_backend   # Redis :6379, Qdrant :6333
poe start_docker_compose_grobid    # GROBID :8070

alembic upgrade head

# Terminal 1 — API (http://localhost:8000)
poe start

# Terminal 2 — Celery worker
poe start_celery
```

Optional: `poe start_flower` for Celery Flower.

Verify: `GET http://localhost:8000/` → `{"status":"ok","version":"v1"}`.

Interactive API docs: http://localhost:8000/docs

### 6. Frontend

From the `frontend/` directory:

```bash
npm install
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Start the dev server:

```bash
npm run dev
```

App: http://localhost:3000

### 7. Smoke test

1. Sign up or sign in at http://localhost:3000
2. Open **Explore** and find a paper with an open-access PDF
3. Add it to your library (ingest by OpenAlex ID)
4. Wait until paper status is **ready** (Celery worker must be running)
5. Start a chat session and send a question about the paper

## Development URLs

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Qdrant | http://localhost:6333 |
| GROBID | http://localhost:8070 |
| Redis | localhost:6379 |

## Environment variables

### Backend (`backend/.env`)

Copy from [`backend/.env.example`](backend/.env.example). Loaded by [`backend/src/config/main.py`](backend/src/config/main.py).

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRESQL_URL` | Yes | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |
| `CLERK_SIGNING_SECRET` | Yes | Svix secret for Clerk webhooks |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (session validation) |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET` | No | Bucket name (default `inquiro`) |
| `OPEN_ALEX_API_KEY` | Recommended | OpenAlex API key (see note below) |
| `GROBID_URL` | No | GROBID base URL (default `http://localhost:8070/`) |
| `EMBEDDING_MODEL` | Yes | Embedding model name |
| `CHAT_MODEL` | No | Chat model (default in `.env.example`: `gpt-4o-mini`) |
| `AI_API_KEY` | Yes | OpenAI-compatible API key |
| `AI_BASE_URL` | If needed | Base URL for non-OpenAI providers |
| `TAVILY_API_KEY` | No | Enables web search tool in chat |
| `RAG_TOP_K` | No | Retrieval chunk count (default `6`) |
| `QDRANT_URL` | No | Qdrant HTTP URL (default `http://localhost:6333`) |
| `CORS_ORIGINS` | No | JSON list of allowed origins (default includes `:3000`) |

`REDIS_URL` defaults to `redis://localhost:6379/0` if unset.

Embeddings must produce **1024-dimensional** vectors to match the Qdrant collection.

### Frontend (`frontend/.env.local`)

Copy from [`frontend/.env.example`](frontend/.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Backend base URL (e.g. `http://127.0.0.1:8000`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (server-side only) |
| `CLERK_SIGN_IN_URL` | No | Sign-in path (default `/sign-in`) |
| `CLERK_SIGN_UP_URL` | No | Sign-up path (default `/sign-up`) |

Never expose `CLERK_SECRET_KEY` in client bundles; it is used only on the server.

**OpenAlex env name:** `.env.example` uses `OPEN_ALEX_API_KEY`, but Pydantic Settings reads the field `open_alex_key` as `OPEN_ALEX_KEY`. Set `OPEN_ALEX_KEY` in your `.env` (or rename the example key) so the backend picks up your key.

## Further reading

- [Backend README](backend/README.md) — API reference, paper pipeline, data model, poe commands
- [Frontend README](frontend/README.md) — routes, auth wiring, frontend dev scripts
