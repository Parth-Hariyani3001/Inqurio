# Inquiro

**Read the paper. Ask it back.**

Inquiro is a research paper reading room: find papers through OpenAlex, ingest PDFs, read them in full beside an inline viewer, and ask questions grounded in the text—not a summary of the field.

## Features

- **Explore** — Search and filter OpenAlex works (`/dashboard/explore`)
- **Ingest** — Add papers by OpenAlex ID; a background worker parses, chunks, embeds, and indexes them
- **Library** — Personal paper collection with search (`/dashboard/library`)
- **Read** — Inline PDF viewer next to the chat workspace
- **Ask** — Streaming chat with paper, OpenAlex, and optional web citations, scoped to the attached paper
- **Auth** — Clerk sign-in; JWT forwarded to the backend; webhooks keep local users in sync

## Architecture

```mermaid
flowchart TB
  subgraph Client["Browser — TanStack Start :3000"]
    UI[Explore · Library · Papers · Chat + PDF]
    ClerkClient[Clerk session]
  end

  subgraph API["FastAPI :8000"]
    Routers[Routers /api/v1]
    Services[Services]
    Agent[LangGraph ReAct agent]
    RAG[Hybrid RAG]
  end

  subgraph Data["Data & infra"]
    PG[(PostgreSQL<br/>users · papers · chats · FTS)]
    Qdrant[(Qdrant<br/>chunk vectors)]
    R2[(Cloudflare R2<br/>PDFs)]
    Redis[(Redis)]
  end

  subgraph Workers["Background"]
    Celery[Celery worker]
    GROBID[GROBID :8070]
  end

  subgraph External["External APIs"]
    OpenAlex[OpenAlex]
    LLM[OpenAI-compatible<br/>embed · chat · rewrite · rerank]
    Tavily[Tavily optional]
    ClerkAPI[Clerk]
  end

  UI -->|Bearer JWT| Routers
  ClerkClient --> ClerkAPI
  Routers --> Services
  Services --> PG
  Services --> Agent
  Services --> RAG
  RAG --> Qdrant
  RAG --> PG
  Agent --> LLM
  Agent --> OpenAlex
  Agent -.-> Tavily
  Services -->|enqueue| Redis
  Redis --> Celery
  Celery --> OpenAlex
  Celery --> R2
  Celery --> GROBID
  Celery --> PG
  Celery --> Qdrant
  Celery --> LLM
  Routers -->|webhooks| ClerkAPI
```

### Monorepo layout

| Directory | Role |
| --- | --- |
| [`frontend/`](frontend/) | TanStack Start UI — explore, library, papers, chat + PDF |
| [`backend/`](backend/) | FastAPI API, Celery worker, RAG pipeline |

## User flows

### Find → Read → Ask

```mermaid
flowchart LR
  Find[Find paper<br/>Explore / Library / Papers] --> Ingest[Ingest by OpenAlex ID]
  Ingest --> Wait{Status?}
  Wait -->|pending / processing| Wait
  Wait -->|ready| Read[Open chat session<br/>PDF beside chat]
  Wait -->|failed| Retry[Retry / reprocess]
  Read --> Ask[Ask grounded questions<br/>SSE streaming answers]
```

1. **Find** — Search OpenAlex from Explore, or browse your Library / Papers catalog.
2. **Read** — Ingest a paper by OpenAlex ID. When status is `ready`, open a chat session; the PDF loads beside the conversation.
3. **Ask** — Send a message; the assistant answers using hybrid-retrieved paper passages, OpenAlex metadata when needed, and optional web background.

### Paper ingest (overview)

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as FastAPI
  participant DB as PostgreSQL
  participant Worker as Celery
  participant OA as OpenAlex
  participant R2 as Cloudflare R2
  participant G as GROBID
  participant Q as Qdrant

  UI->>API: POST /papers/upload {openalex_id}
  API->>DB: Create / assign paper (pending)
  API-->>UI: 202 Accepted
  API->>Worker: process_paper(paper_id)
  Worker->>DB: status = processing
  Worker->>OA: Download OA PDF
  Worker->>R2: Store pdfs/{paper_id}.pdf
  Worker->>G: Parse sections
  Worker->>DB: Persist sections + chunks
  Worker->>Q: Embed + upsert vectors
  Worker->>DB: status = ready
```

Paper status: `pending` → `processing` → `ready` or `failed`.

### Chat message flow

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as FastAPI
  participant RAG as Hybrid RAG
  participant Agent as LangGraph agent
  participant DB as PostgreSQL

  UI->>API: POST /sessions/{id}/messages (SSE)
  API->>DB: Save user message
  API-->>UI: message.user
  API->>API: Optional query rewrite (anaphora)
  API->>RAG: Dense + keyword → RRF → rerank → neighbors
  API->>Agent: Grounded prompt + history
  loop Streaming
    Agent->>API: Token deltas / tool results
    Note over Agent,API: Tools: retrieve_paper_context, search_openalex_works, optional Tavily
    API-->>UI: chat.phase · message.assistant.delta
  end
  API->>DB: Save assistant message + citations
  API-->>UI: message.assistant.done
```

### Retrieval process

Every chat turn runs hybrid retrieval over the **attached paper only** (`paper_id` filter). Results are prefetched into the agent cache, then reused if the agent calls `retrieve_paper_context` with the same query.

```mermaid
flowchart TD
  U[User question] --> RW{Anaphora + history?<br/>RAG_QUERY_REWRITE_ENABLED}
  RW -->|yes| Rewrite[LLM rewrite → standalone query]
  RW -->|no| Q[Normalized query]
  Rewrite --> Q
  RW -.->|speculative| Emb[Start embed of original query]
  Emb -->|rewrite unchanged| Reuse[Reuse query vector]
  Emb -->|rewrite changed| Drop[Discard speculative embed]

  Q --> Parallel
  Reuse --> Dense
  Drop --> Dense

  subgraph Parallel["Parallel recall — RAG_CANDIDATE_K"]
    Dense[Dense: embed → Qdrant cosine<br/>filter paper_id]
    Keyword[Keyword: Postgres FTS<br/>ts_rank_cd on section+chunk]
  end

  Dense --> RRF[Reciprocal rank fusion<br/>RAG_RRF_K]
  Keyword --> RRF
  RRF --> Hydrate[Hydrate chunk text from Postgres]
  Hydrate --> Pref[Score prefilter<br/>RAG_MIN_SCORE]
  Pref --> Rerank[Optional listwise LLM rerank<br/>RAG_RERANK_ENABLED]
  Rerank --> Top[Keep RAG_TOP_K primaries]
  Top --> Neigh[Expand ± RAG_NEIGHBOR_WINDOW<br/>same section]
  Neigh --> Cap[Dedupe · cap RAG_MAX_CONTEXT_CHUNKS]
  Cap --> Cache[Prefetch cache + grounded prompt]
  Cache --> Agent[LangGraph agent]
  Agent -->|retrieve_paper_context| Cache
```

| Stage | What happens |
| --- | --- |
| Query rewrite | Turns follow-ups like “what about **that** method?” into a standalone search query when history has anaphora |
| Speculative embed | If rewrite is likely, embedding of the original question starts in parallel; reused only when the rewrite leaves the query unchanged |
| Dense | OpenAI-compatible embedding → Qdrant cosine search, filtered by `paper_id` |
| Keyword | Postgres `plainto_tsquery` / `ts_rank_cd` over section title + chunk text for the same paper |
| RRF | Merges the two ranked ID lists without needing calibrated scores |
| Rerank | Optional listwise LLM reorder (skipped for local/loopback chat models) |
| Neighbors | Pulls adjacent chunks in the same section so answers keep local context |

Implementation: [`backend/src/rag/retrieval.py`](backend/src/rag/retrieval.py) (`search_paper_chunks`). Full step detail and knobs: [Backend README — Retrieval process](backend/README.md#retrieval-process).

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
| Retrieval | Hybrid dense + Postgres FTS, RRF fusion, optional LLM rerank |
| Chat | LangGraph ReAct agent + OpenAlex tool + optional Tavily |

## Prerequisites

Before setup, have the following available:

- **Node.js 20+** and npm
- **Python 3.11+**
- **Docker** — for Redis, Qdrant, and GROBID (compose files in the backend)
- **PostgreSQL** — not bundled in this repo; run your own instance
- **Clerk** application (publishable + secret keys, webhook signing secret)
- **Cloudflare R2** bucket and API credentials
- **OpenAlex API key** (recommended for higher rate limits)
- **OpenAI-compatible provider** for embeddings and chat (same embedding model for ingest and query)
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
| `REWRITE_MODEL` | No | Optional fast model for RAG query rewrite (falls back to `CHAT_MODEL`) |
| `AI_API_KEY` | Yes | OpenAI-compatible API key |
| `AI_BASE_URL` | If needed | Base URL for non-OpenAI providers |
| `REWRITE_AI_BASE_URL` | No | Optional rewrite endpoint (falls back to `AI_BASE_URL`) |
| `TAVILY_API_KEY` | No | Enables optional web background search in chat |
| `RAG_TOP_K` | No | Final retrieved chunk count (default `8`) |
| `RAG_CANDIDATE_K` | No | Dense/keyword recall pool before fusion (default `20`) |
| `RAG_MIN_SCORE` | No | Score floor after fusion/rerank (default `0.15`) |
| `RAG_RRF_K` | No | Reciprocal-rank fusion constant (default `60`) |
| `RAG_NEIGHBOR_WINDOW` | No | Adjacent chunk expansion window (default `1`) |
| `RAG_RERANK_ENABLED` | No | LLM listwise rerank (default `true`; skipped for local models) |
| `RAG_RERANK_MAX_CANDIDATES` | No | Max passages sent to reranker (default `15`) |
| `RAG_MAX_CONTEXT_CHUNKS` | No | Cap after neighbor expansion (default `12`) |
| `RAG_QUERY_REWRITE_ENABLED` | No | Conversational query rewrite (default `true`) |
| `RAG_EMBED_CACHE_SIZE` | No | In-process embedding cache size (default `256`) |
| `QDRANT_URL` | No | Qdrant HTTP URL (default `http://localhost:6333`) |
| `CORS_ORIGINS` | No | JSON list of allowed origins (default includes `:3000`) |

`REDIS_URL` defaults to `redis://localhost:6379/0` if unset.

The Qdrant `papers` collection is created with the live embedding model’s dimension (see `ensure_collection` in the backend). Keep ingest and query embeddings on the same model.

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

- [Backend README — Retrieval process](backend/README.md#retrieval-process) — prefetch vs tool, full `search_paper_chunks` pipeline, RAG tunables
- [Backend README](backend/README.md) — API reference, ingest / RAG / auth diagrams, ER model, poe commands
- [Frontend README](frontend/README.md) — route map, chat workspace diagram, auth wiring, dev scripts
