# todo.md — AI-Native Mini CRM
## Implementation Checklist (Phase-by-Phase)
> Engineering Standard: $10k Production-Grade
> Workflow: Antigravity Agent IDE | Strict Phase Control

---

## Status Legend
- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Blocked / needs review

---

## Phase 0: Project Scaffolding & Configuration
> Goal: Repo structure, tooling, and environment are ready. No app code yet.

### 0.1 Repository Setup
- [x] Initialize Git repo: `ai-native-crm`
- [x] Create monorepo structure:
  ```
  /
  ├── backend/          # FastAPI CRM + Celery worker
  ├── channel-stub/     # Stubbed channel service (separate FastAPI app)
  ├── frontend/         # React + Vite
  ├── spec.md           # ✅ Done
  ├── todo.md           # ✅ Done
  ├── docker-compose.yml
  └── README.md
  ```
- [x] Add root `.gitignore` (Python, Node, .env files)
- [x] Create `docker-compose.yml` with: `crm-api`, `crm-worker`, `channel-stub`, `redis`, `flower`

### 0.2 Backend Project Init (`/backend`)
- [x] Create `pyproject.toml` with all dependencies:
  - `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`
  - `alembic`, `pydantic-settings`, `pydantic[email]`
  - `celery[redis]`, `redis`, `httpx`, `sse-starlette`
  - `python-jose[cryptography]`, `passlib[bcrypt]`
  - `anthropic`, `slowapi`, `faker`
- [x] Create directory structure:
  ```
  backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py             # FastAPI app factory
  │   ├── config.py           # pydantic-settings
  │   ├── database.py         # async engine + session factory
  │   ├── models/             # SQLAlchemy ORM models
  │   ├── schemas/            # Pydantic request/response schemas
  │   ├── routers/            # FastAPI routers
  │   ├── services/           # Business logic layer
  │   ├── tasks/              # Celery task definitions
  │   ├── ai/                 # AI engine + prompt templates
  │   └── utils/              # JWT, filters, helpers
  ├── alembic/
  ├── alembic.ini
  ├── celery_app.py
  ├── seed.py
  ├── Dockerfile
  └── .env.example
  ```
- [x] Create `.env.example` with all required env vars (per spec.md §9)

### 0.3 Channel Stub Project Init (`/channel-stub`)
- [x] Create `pyproject.toml` with: `fastapi`, `uvicorn`, `celery[redis]`, `httpx`, `pydantic-settings`
- [x] Create directory structure:
  ```
  channel-stub/
  ├── app/
  │   ├── main.py
  │   ├── config.py
  │   ├── routers/send.py
  │   └── tasks/simulate.py
  ├── celery_app.py
  ├── Dockerfile
  └── .env.example
  ```

### 0.4 Frontend Project Init (`/frontend`)
- [x] Scaffold with `npm create vite@latest frontend -- --template react-ts`
- [x] Install dependencies:
  - `@radix-ui/*`, `tailwindcss`, `@tanstack/react-query`, `zustand`
  - `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `zod`
  - `recharts`, `axios`, `lucide-react`, `clsx`, `tailwind-merge`
  - `@microsoft/fetch-event-source`
- [x] Configure Tailwind CSS with shadcn/ui preset
- [x] Initialize shadcn/ui: `npx shadcn-ui@latest init`
- [x] Add shadcn components: Button, Card, Input, Dialog, Select, Table, Badge, Tabs, Sheet, ScrollArea, Textarea, Skeleton, Toast

### 0.5 Environment Verification
- [x] Start `docker-compose up redis` and verify Redis connection
- [x] Verify Python environment installs cleanly
- [x] Verify Node environment installs cleanly

---

## Phase 1: Database Layer
> Goal: All tables exist in Supabase, ORM models defined, migrations work.

### 1.1 SQLAlchemy Models
- [x] `backend/app/database.py` — async engine, session factory, `Base` declarative
- [x] `backend/app/models/user.py` — `User` model
- [x] `backend/app/models/customer.py` — `Customer` model with all indexes
- [x] `backend/app/models/order.py` — `Order` model with all indexes
- [x] `backend/app/models/segment.py` — `Segment` model with JSONB `filter_rules`
- [x] `backend/app/models/campaign.py` — `Campaign` model with status enum
- [x] `backend/app/models/communication_log.py` — `CommunicationLog` with idempotency_key UNIQUE
- [x] `backend/app/models/receipt_event.py` — `ReceiptEvent` append-only model
- [x] `backend/app/models/__init__.py` — import all models for Alembic discovery

### 1.2 Alembic Setup
- [x] `alembic init alembic` (in /backend)
- [x] Configure `alembic.ini` with async SQLAlchemy target
- [x] Configure `alembic/env.py` to import all models + use async engine
- [x] Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
- [x] Review generated migration — ensure all indexes, UNIQUE constraints, FKs are present
- [x] Run migration against Supabase: `alembic upgrade head`
- [x] Create analytics view via raw SQL migration: `campaign_funnel_stats`

### 1.3 Seed Data
- [x] `backend/seed.py` — Faker-based seed script:
  - [x] Create demo user (`demo@aurabeauty.com` / `demo1234`)
  - [x] Generate 500 customers (realistic Indian names, emails, cities, spend distribution)
  - [x] Generate 2,000 orders across customers
  - [x] Recompute `total_spent` + `order_count` + `last_order_at` on each customer
  - [x] Create 3 segments with filter_rules JSONB
  - [x] Create 2 completed campaigns with full communication_logs (all statuses)
- [x] Run seed script and verify data in Supabase dashboard
- [x] Verify analytics view returns correct numbers on seeded data

---

## Phase 2: Backend Core — Auth & Customers
> Goal: Working auth + customer/order CRUD with bulk import.

### 2.1 App Foundation
- [x] `backend/app/config.py` — `Settings` class with pydantic-settings
- [x] `backend/app/main.py` — FastAPI app factory with:
  - [x] CORS middleware (allow frontend origin)
  - [x] Global exception handlers (404, 422, 500)
  - [x] Router registration
  - [x] Lifespan handler (DB connection check on startup)
- [x] `backend/app/utils/jwt.py` — `create_token()`, `decode_token()`, `get_current_user` dependency
- [x] `backend/app/utils/pagination.py` — reusable `PaginatedResponse` schema + `paginate()` helper

### 2.2 Auth Endpoints
- [x] `backend/app/schemas/auth.py` — `RegisterRequest`, `LoginRequest`, `TokenResponse`
- [x] `backend/app/services/auth_service.py` — `register()`, `login()`, password hashing
- [x] `backend/app/routers/auth.py` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [x] Test auth flow: register → login → get JWT → use on protected endpoint

### 2.3 Customer Endpoints
- [x] `backend/app/schemas/customer.py` — `CustomerCreate`, `CustomerUpdate`, `CustomerResponse`, `CustomerListResponse`
- [x] `backend/app/services/customer_service.py` — CRUD + bulk import logic:
  - [x] `create_customer()` — single create
  - [x] `bulk_import()` — upsert by email, recompute aggregates
  - [x] `get_customers()` — paginated + filterable
  - [x] `get_customer()` — with orders
  - [x] `update_customer()` — partial update
  - [x] `soft_delete_customer()`
- [x] `backend/app/routers/customers.py` — all endpoints per spec §5.2
- [x] Test bulk import with 100 customers

### 2.4 Order Endpoints
- [x] `backend/app/schemas/order.py` — `OrderCreate`, `OrderResponse`
- [x] `backend/app/services/order_service.py` — `bulk_import_orders()`, `get_orders_for_customer()`
  - [x] After order import: recompute customer `total_spent`, `order_count`, `last_order_at`
- [x] `backend/app/routers/orders.py` — endpoints per spec §5.3
- [x] Test order import + verify customer aggregates update correctly

---

## Phase 3: Segment Engine
> Goal: Segments can be created, previewed, and executed as dynamic SQL.

### 3.1 Filter Rule Compiler
- [ ] `backend/app/utils/filter_compiler.py` — core business logic:
  - [ ] `compile_rules(rules: dict) -> sqlalchemy.Select` — recursive function that:
    - [ ] Handles `AND` / `OR` operators
    - [ ] Maps field names to `Customer` / `Order` model columns
    - [ ] Maps operators (`eq`, `gte`, `contains`, `in`, etc.) to SQLAlchemy expressions
    - [ ] Handles date-relative values (`"NOW() - INTERVAL '30 days'"`)
    - [ ] Handles `tags` array field with `@>` operator
    - [ ] Joins `orders` table when order-level fields are referenced
  - [ ] `validate_rules(rules: dict) -> list[str]` — validate field names + operators before compilation
  - [ ] Unit test: 10 different rule combinations → verify correct SQL + customer counts

### 3.2 Segment Endpoints
- [ ] `backend/app/schemas/segment.py` — `SegmentCreate`, `SegmentResponse`, `SegmentPreviewResponse`
- [ ] `backend/app/services/segment_service.py`:
  - [ ] `create_segment()` — validate rules + save
  - [ ] `preview_segment()` — compile → execute → return count + 20 sample customers
  - [ ] `get_segments()` — list with cached audience_size
  - [ ] `refresh_audience_size()` — execute count query + update DB
- [ ] `backend/app/routers/segments.py` — all endpoints per spec §5.4
- [ ] Test: create segment "total_spent >= 5000 AND last_order_at < 30d ago", preview returns correct customers

---

## Phase 4: Campaign Engine + Celery Dispatch
> Goal: Campaigns can be created and launched; Celery dispatches to channel stub asynchronously.

### 4.1 Celery Setup
- [ ] `backend/celery_app.py` — Celery instance with Redis broker + result backend
- [ ] Configure task serialization (JSON), timezone (UTC), task routing
- [ ] Test: fire a simple test task, verify it appears in Flower

### 4.2 Campaign Service
- [ ] `backend/app/schemas/campaign.py` — `CampaignCreate`, `CampaignResponse`, `CampaignStatsResponse`
- [ ] `backend/app/services/campaign_service.py`:
  - [ ] `create_campaign()` — validate segment exists, set status=draft
  - [ ] `launch_campaign()` — validate status=draft, set status=running, enqueue Celery task
  - [ ] `get_campaign_stats()` — query `campaign_funnel_stats` view
  - [ ] `get_communication_logs()` — paginated logs for a campaign
- [ ] `backend/app/routers/campaigns.py` — all endpoints per spec §5.5

### 4.3 Dispatch Task
- [ ] `backend/app/tasks/dispatch.py` — `dispatch_campaign_task(campaign_id)`:
  - [ ] Load campaign from DB
  - [ ] Execute segment filter query → get customer list
  - [ ] Snapshot customer IDs → save to `campaigns.audience_snapshot`
  - [ ] For each customer:
    - [ ] Build idempotency_key: `{campaign_id}:{customer_id}`
    - [ ] `INSERT INTO communication_logs ... ON CONFLICT DO NOTHING` (idempotent insert)
    - [ ] Resolve message template variables ({{name}}, etc.)
  - [ ] Group all logs into chunks of 50
  - [ ] For each chunk: Celery group → call channel stub `/send` for each log
  - [ ] On all dispatched: update campaign status → `completed`
  - [ ] Error handling: if channel stub unreachable → retry with backoff (max 3)
- [ ] Test: launch campaign with 50-customer segment, verify 50 communication_logs created

---

## Phase 5: Channel Stub Service
> Goal: Standalone service simulates delivery lifecycle and fires callbacks.

### 5.1 Channel Stub App
- [ ] `channel-stub/app/main.py` — FastAPI app
- [ ] `channel-stub/app/config.py` — Settings (REDIS_URL, CRM_RECEIPT_URL)
- [ ] `channel-stub/celery_app.py` — Celery worker (separate Redis DB index)

### 5.2 Send Endpoint
- [ ] `channel-stub/app/routers/send.py` — `POST /send`:
  - [ ] Validate request payload
  - [ ] Generate `external_ref` UUID
  - [ ] Enqueue `simulate_delivery_task`
  - [ ] Return `202 Accepted` with `{ "external_ref": "..." }`
- [ ] Test: POST to `/send` → returns 202 → task appears in Flower

### 5.3 Simulation Task
- [ ] `channel-stub/app/tasks/simulate.py` — `simulate_delivery_task(...)`:
  - [ ] Sleep 1–5s → POST `sent` callback to CRM
  - [ ] Sleep 2–8s → POST `delivered` (85%) or `failed` (15%) callback
  - [ ] If delivered: sleep 5–15s → POST `opened` (40% probability)
  - [ ] If opened: sleep 2–5s → POST `read` (70% of opened)
  - [ ] If read: sleep 3–8s → POST `clicked` (20% of read)
  - [ ] If clicked: sleep 1–3s → POST `converted` (10% of clicked)
  - [ ] All callbacks: `httpx.post(callback_url, json=payload)` with retry on failure
  - [ ] Log each callback attempt to stdout with timestamp
- [ ] Test: launch campaign with 10 customers, watch full lifecycle in logs over ~30s

---

## Phase 6: Receipt API (Idempotent Webhook Handler)
> Goal: CRM handles callbacks correctly, idempotently, in any order.

### 6.1 Receipt Service
- [ ] `backend/app/services/receipt_service.py` — core idempotency logic:
  - [ ] `process_receipt(payload: ReceiptCallback) -> ReceiptResult`:
    1. Check Redis: `idempotency:receipt:{event_id}` — if exists → return `duplicate`
    2. Load `communication_log` by `communication_log_id` — if not found → `404`
    3. Check `receipt_events` table: has this `event_type` already been processed? → `duplicate`
    4. Determine if state transition is valid (forward-only, see spec §4.2)
    5. If out-of-order: backfill intermediate timestamps
    6. Execute DB transaction:
       - `INSERT INTO receipt_events (...)` — append-only
       - `UPDATE communication_logs SET status=..., {event}_at=...`
    7. Set Redis idempotency key with 24h TTL
    8. Enqueue `update_campaign_aggregate_task(campaign_id)` 
    9. Return `ReceiptResult` with previous + new status

### 6.2 Receipt Router
- [ ] `backend/app/routers/receipts.py` — `POST /receipts/callback`:
  - [ ] Rate limiting via slowapi (1000/min per IP)
  - [ ] Call `receipt_service.process_receipt()`
  - [ ] Always return `200 OK` (never 4xx to channel stub — log errors instead)
- [ ] Unit test idempotency: fire same callback 3x → DB updated once, receipt_events has 1 real + 2 duplicates
- [ ] Unit test out-of-order: fire `clicked` before `delivered` → all intermediate timestamps backfilled

### 6.3 Aggregate Update Task
- [ ] `backend/app/tasks/analytics.py` — `update_campaign_aggregate_task(campaign_id)`:
  - [ ] Query `campaign_funnel_stats` view
  - [ ] Cache result in Redis: `campaign:stats:{campaign_id}` (TTL 1h)
  - [ ] Publish to Redis pubsub: `sse:channel:{campaign_id}`
  - [ ] Task should be deduplicated: if same campaign_id task already queued, skip (use Celery `apply_async` with `countdown=1`)

---

## Phase 7: Analytics SSE Stream
> Goal: Frontend can subscribe to live campaign stats updates via SSE.

### 7.1 SSE Endpoint
- [ ] `backend/app/routers/analytics.py` — `GET /analytics/live/{campaign_id}`:
  - [ ] Authenticate request (JWT in query param or header)
  - [ ] Send initial snapshot from Redis cache
  - [ ] Subscribe to Redis pubsub `sse:channel:{campaign_id}`
  - [ ] On each pubsub message: yield SSE `funnel_update` event
  - [ ] Yield heartbeat every 15s to keep connection alive
  - [ ] Handle client disconnect cleanly
- [ ] Test: open SSE stream in browser, launch campaign, watch stats tick up in real time

---

## Phase 8: AI Engine
> Goal: Natural language → segment rules + message draft. Chat assistant works.

### 8.1 AI Service Foundation
- [ ] `backend/app/ai/prompts.py` — all system prompts as constants:
  - [ ] `INTENT_PARSE_SYSTEM_PROMPT` — includes schema, operators, output format
  - [ ] `MESSAGE_DRAFT_SYSTEM_PROMPT` — channel-aware, brand-context-aware
  - [ ] `CHAT_AGENT_SYSTEM_PROMPT` — campaign assistant persona + tool descriptions
- [ ] `backend/app/ai/client.py` — Anthropic client wrapper:
  - [ ] `parse_intent(prompt, context) -> IntentParseResult`
  - [ ] `draft_message(channel, audience_desc, brand_context) -> str`
  - [ ] `chat_stream(messages, tools) -> AsyncGenerator`

### 8.2 Intent Parse Endpoint
- [ ] `backend/app/schemas/ai.py` — `IntentRequest`, `IntentParseResult`, `ChatMessage`
- [ ] `backend/app/routers/ai.py`:
  - [ ] `POST /ai/parse-intent` — call AI, validate JSON output, return structured result
    - [ ] Retry loop: if AI returns invalid JSON → retry with error context (max 2x)
    - [ ] Rate limit: 60 req/min per user
  - [ ] `POST /ai/draft-message` — channel-aware message generation
  - [ ] `GET /ai/chat` — SSE stream for chat interface
    - [ ] Maintain conversation history from request body
    - [ ] Stream tokens using `sse-starlette`
    - [ ] Handle tool calls: `preview_segment` executes real query, returns count

### 8.3 AI Integration Test
- [ ] Test: send "Find VIP customers who spent over ₹10,000 and haven't ordered in 60 days, draft a WhatsApp win-back message"
- [ ] Verify: returned `segment_rules` compiles successfully and returns correct customers
- [ ] Verify: `message_draft` is personalized and channel-appropriate

---

## Phase 9: Frontend — Foundation & Auth
> Goal: React app running, routing works, auth flow complete.

### 9.1 App Foundation
- [ ] `frontend/src/lib/axios.ts` — Axios instance with:
  - [ ] `baseURL` from `VITE_API_BASE_URL`
  - [ ] Request interceptor: inject `Authorization: Bearer {token}` from Zustand store
  - [ ] Response interceptor: on 401 → clear auth + redirect to `/login`
- [ ] `frontend/src/store/auth.ts` — Zustand auth store: `{ user, token, login(), logout() }`
- [ ] `frontend/src/lib/query-client.ts` — TanStack Query client with default config
- [ ] `frontend/src/App.tsx` — Router setup: public routes (`/login`) + protected routes (all others)
- [ ] `frontend/src/components/layout/Layout.tsx` — Shell: sidebar nav + main content area
- [ ] `frontend/src/components/layout/Sidebar.tsx` — Navigation links with active states

### 9.2 Auth Pages
- [ ] `frontend/src/pages/Login.tsx` — Login form with React Hook Form + Zod validation
- [ ] `frontend/src/hooks/useAuth.ts` — `useLogin()`, `useLogout()`, `useCurrentUser()`
- [ ] Test: login with demo credentials → redirects to dashboard → logout → back to login

---

## Phase 10: Frontend — Customer & Segment Pages
> Goal: Data management pages complete and functional.

### 10.1 Dashboard
- [ ] `frontend/src/pages/Dashboard.tsx` — summary cards: total customers, active campaigns, messages sent, avg delivery rate
- [ ] `frontend/src/hooks/useAnalytics.ts` — queries for dashboard stats

### 10.2 Customer Pages
- [ ] `frontend/src/hooks/useCustomers.ts` — TanStack Query hooks: `useCustomers()`, `useCustomer(id)`, `useImportCustomers()`
- [ ] `frontend/src/pages/CustomerList.tsx` — paginated table: name, email, city, total_spent, last_order, tags
  - [ ] Search by name/email
  - [ ] Filter by city, tags
  - [ ] Sort by total_spent, last_order_at
- [ ] `frontend/src/pages/CustomerDetail.tsx` — profile card + order history table + communication history

### 10.3 Segment Pages
- [ ] `frontend/src/hooks/useSegments.ts` — TanStack Query hooks
- [ ] `frontend/src/pages/SegmentList.tsx` — card grid with audience size badge
- [ ] `frontend/src/pages/SegmentBuilder.tsx` — key page:
  - [ ] Visual rule builder (field + operator + value dropdowns)
  - [ ] Live preview: "This segment contains X customers" (debounced preview call)
  - [ ] AI assist button → opens AI input → populates rules from `parse-intent`
  - [ ] Save segment
- [ ] `frontend/src/pages/SegmentDetail.tsx` — rules display + audience sample table + refresh button

---

## Phase 11: Frontend — Campaign Builder + Analytics
> Goal: Campaigns can be created, launched, and monitored with live analytics.

### 11.1 Campaign Pages
- [ ] `frontend/src/hooks/useCampaigns.ts` — TanStack Query hooks
- [ ] `frontend/src/pages/CampaignList.tsx` — table with status badge, audience size, delivery rate
- [ ] `frontend/src/pages/CampaignBuilder.tsx` — key page:
  - [ ] Step 1: Name + channel select + segment select
  - [ ] Step 2: Message composer with template variable chip insertion + AI draft button
  - [ ] Step 3: Review (audience count, preview message, estimated send time)
  - [ ] Launch button → `POST /campaigns/{id}/launch` → redirect to analytics
- [ ] `frontend/src/pages/CampaignDetail.tsx` — key page:
  - [ ] Funnel chart (Recharts BarChart or FunnelChart): Sent → Delivered → Opened → Clicked → Converted
  - [ ] Rate cards: Delivery Rate, Open Rate, CTR, Conversion Rate
  - [ ] Live SSE: stats update in real time as callbacks arrive
  - [ ] Communication logs table: customer name, status badge, timestamps

### 11.2 SSE Hook
- [ ] `frontend/src/hooks/useCampaignSSE.ts` — wraps `@microsoft/fetch-event-source`:
  - [ ] Connect on component mount, disconnect on unmount
  - [ ] Parse `funnel_update` events → update Zustand/local state
  - [ ] Handle reconnection on disconnect
  - [ ] Show "Live" indicator badge when connected

---

## Phase 12: Frontend — AI Assistant
> Goal: Chat-first AI interface is functional and end-to-end.

### 12.1 AI Chat Interface
- [ ] `frontend/src/store/ai.ts` — Zustand store: `{ messages, isStreaming, addMessage(), clearHistory() }`
- [ ] `frontend/src/pages/AIAssistant.tsx` — full-page chat interface:
  - [ ] Message list (user + assistant bubbles with markdown rendering)
  - [ ] Streaming response (tokens appear in real time via SSE)
  - [ ] Structured result cards: when AI returns `IntentParseResult`, show as interactive card
  - [ ] Action buttons on card: "Create Segment", "Create Campaign with this" → pre-populate builders
  - [ ] Suggested prompts shown when history is empty
- [ ] `frontend/src/components/ai/IntentResultCard.tsx` — displays segment rules + message draft with approve/edit flow
- [ ] `frontend/src/hooks/useAIChat.ts` — manages streaming, history, SSE connection

### 12.2 AI Integration Throughout App
- [ ] Segment Builder: "✨ Describe your audience" button → calls AI → auto-fills rules
- [ ] Campaign Builder: "✨ Draft with AI" button → calls AI → auto-fills message
- [ ] Campaign Builder: "✨ Generate from intent" → full parse-intent → fills segment + message

---

## Phase 13: Polish, Error States & UX
> Goal: Production-quality UX: all loading/error/empty states handled.

### 13.1 Loading & Error States
- [ ] All TanStack Query hooks: handle `isLoading` → Skeleton components
- [ ] All TanStack Query hooks: handle `isError` → Toast error notification
- [ ] Empty states: customer list, segment list, campaign list (with CTAs)
- [ ] Campaign analytics: "No data yet" state when campaign just launched

### 13.2 Notifications
- [ ] `frontend/src/components/ui/Toaster.tsx` — shadcn toast setup
- [ ] Success toasts: campaign launched, segment saved, import complete
- [ ] Error toasts: API failures, validation errors

### 13.3 Responsive Design Check
- [ ] Verify layout works on 1280px, 1440px, 1920px
- [ ] Table overflows handled with horizontal scroll
- [ ] Sidebar collapses on smaller screens

---

## Phase 14: Deployment
> Goal: All services live and accessible.

### 14.1 Backend Deployment (Railway)
- [ ] Create `backend/Dockerfile`:
  - [ ] Multi-stage build
  - [ ] CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] Create `backend/Dockerfile.worker`:
  - [ ] CMD: `celery -A celery_app worker --loglevel=info --concurrency=4`
- [ ] Railway project setup:
  - [ ] Service: `crm-api` (Dockerfile)
  - [ ] Service: `crm-worker` (Dockerfile.worker)
  - [ ] Add-on: Redis
  - [ ] Set all environment variables
- [ ] Run `alembic upgrade head` against Supabase
- [ ] Run `python seed.py` to populate demo data
- [ ] Verify: `GET /health` returns 200

### 14.2 Channel Stub Deployment (Railway)
- [ ] Create `channel-stub/Dockerfile`
- [ ] Create `channel-stub/Dockerfile.worker`
- [ ] Deploy to Railway as separate services
- [ ] Update `CRM_RECEIPT_URL` env var to point to live CRM API
- [ ] Test: POST to channel stub `/send` → callbacks arrive at CRM

### 14.3 Frontend Deployment (Vercel)
- [ ] Set `VITE_API_BASE_URL` to Railway CRM API URL
- [ ] Deploy via Vercel CLI or GitHub integration
- [ ] Verify: login works, campaign launch works, SSE connects

### 14.4 End-to-End Smoke Test (Live)
- [ ] Login as `demo@aurabeauty.com`
- [ ] Create a segment via AI intent
- [ ] Create and launch a campaign
- [ ] Watch delivery funnel populate in real time
- [ ] Verify: `receipt_events` table has correct entries, no duplicates
- [ ] Verify: fire duplicate callback manually → `is_duplicate=true` in DB, stats unchanged

---

## Phase 15: Documentation & Submission
> Goal: README, architecture diagram, and video.

### 15.1 README
- [ ] `README.md` — covers:
  - [ ] Project overview + demo URL
  - [ ] Architecture diagram (copy from spec.md or link to it)
  - [ ] Local development setup (docker-compose up)
  - [ ] Seeding instructions
  - [ ] Key technical decisions + tradeoffs (reference spec.md §12)
  - [ ] Scale considerations ("at 1M customers, I would...")

### 15.2 Architecture Diagram
- [ ] Create visual architecture diagram (Excalidraw or Mermaid)
- [ ] Include in README and prepare for walkthrough video

### 15.3 Walkthrough Video (~5 min)
- [ ] Script outline:
  - [ ] 0:00-0:30 — Product intro: what is Aura Beauty CRM, the problem
  - [ ] 0:30-2:00 — Demo: AI intent → segment → campaign launch → live analytics
  - [ ] 2:00-3:00 — Architecture: diagram walkthrough, key decisions
  - [ ] 3:00-4:00 — Code walkthrough: filter_compiler.py, receipt_service.py (idempotency), celery dispatch
  - [ ] 4:00-5:00 — AI-native workflow: how AI was used to build this, spec.md + todo.md approach
- [ ] Record with Loom or OBS
- [ ] Upload and add link to README

### 15.4 Final Submission Checklist
- [ ] Hosted URL is live and accessible
- [ ] GitHub repo is public
- [ ] Demo credentials are documented
- [ ] `spec.md` and `todo.md` are committed to root
- [ ] Walkthrough video link is in README
- [ ] Submit via Xeno submission form (SDE link)

---

## Tracking Summary

| Phase | Description | Status |
|---|---|---|
| 0 | Scaffolding & Configuration | `[x]` |
| 1 | Database Layer | `[x]` |
| 2 | Auth & Customer CRUD | `[x]` |
| 3 | Segment Engine | `[ ]` |
| 4 | Campaign Engine + Celery | `[ ]` |
| 5 | Channel Stub Service | `[ ]` |
| 6 | Receipt API (Idempotency) | `[ ]` |
| 7 | Analytics SSE | `[ ]` |
| 8 | AI Engine | `[ ]` |
| 9 | Frontend Foundation + Auth | `[ ]` |
| 10 | Customer + Segment Pages | `[ ]` |
| 11 | Campaign Builder + Analytics | `[ ]` |
| 12 | AI Assistant | `[ ]` |
| 13 | Polish + Error States | `[ ]` |
| 14 | Deployment | `[ ]` |
| 15 | Docs + Submission | `[ ]` |

---

## Key Implementation Notes

> These are engineering decisions to remember during implementation:

1. **Never use raw f-strings in SQL** — all queries go through SQLAlchemy ORM / parameterized expressions
2. **Receipt endpoint always returns 200** — never return 4xx/5xx to channel stub; log errors internally
3. **idempotency_key in communication_logs** — INSERT ON CONFLICT DO NOTHING, never check-then-insert
4. **State transitions are forward-only** — the receipt service must enforce this; `delivered` cannot go back to `sent`
5. **Out-of-order callbacks** — if `clicked` arrives before `delivered`, backfill all intermediate timestamps at NOW()
6. **Celery tasks are idempotent** — `dispatch_campaign_task` can be retried safely due to ON CONFLICT DO NOTHING
7. **AI output validation** — always validate AI JSON output with Pydantic before trusting it; retry with error context on failure
8. **SSE keepalives** — heartbeat every 15s prevents proxy timeouts; frontend must handle reconnects
9. **Segment preview is stateless** — never persists results; always executes fresh query
10. **Message personalization at send time** — resolve template vars when creating communication_log, not at campaign creation
