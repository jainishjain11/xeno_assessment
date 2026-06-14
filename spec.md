# spec.md — AI-Native Mini CRM
## Architectural Specification & Product Contract
> Version: 1.0.0 | Status: Approved for Implementation

---

## 1. Project Overview

### 1.1 Product Summary
An AI-Native Mini CRM for consumer brands (DTC fashion, coffee, beauty, etc.) to intelligently reach their shoppers. A marketer can describe intent in natural language, the system segments an audience, drafts personalized messages, dispatches them through a stubbed channel service, and surfaces real-time delivery analytics — all in one cohesive flow.

### 1.2 Core User Journey
```
Marketer types intent → AI segments audience + drafts message
→ Campaign created → CRM dispatches to Channel Stub (async via Celery)
→ Channel Stub simulates delivery/engagement → Callbacks hit CRM receipt API
→ CRM updates state idempotently → Live analytics surface in dashboard
```

### 1.3 Design Pillars
1. **Intent-Driven AI** — Natural language → SQL audience query → message draft
2. **Async Resilience** — All channel I/O is non-blocking; Celery handles volume + retries
3. **Idempotency** — Receipt API is safe to replay; duplicate callbacks are no-ops
4. **Observability** — Every communication event is logged; funnels are computable at any time

---

## 2. System Architecture

### 2.1 High-Level Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React 18 + Vite)                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  AI Chat UI  │  │  Campaign Builder │  │  Analytics Dashboard │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│         │                  │                        │ SSE stream    │
└─────────┼──────────────────┼────────────────────────┼──────────────┘
          │ REST/JSON         │ REST/JSON              │
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FASTAPI APPLICATION SERVER                        │
│                                                                      │
│  /api/v1/ai/*        /api/v1/campaigns/*    /api/v1/analytics/*     │
│  /api/v1/customers/* /api/v1/segments/*     /api/v1/receipts/*      │
│                                                                      │
│  ┌─────────────────┐   ┌───────────────────────────────────────┐   │
│  │  Google Gemini  │   │         SQLAlchemy ORM (async)         │   │
│  │  (AI Engine)    │   │                                        │   │
│  └─────────────────┘   └──────────────────┬────────────────────┘   │
│                                            │                        │
│  ┌─────────────────────────────────────────▼──────────────────┐    │
│  │              CELERY TASK QUEUE (Redis broker)               │    │
│  │                                                              │    │
│  │  dispatch_campaign_task   |   simulate_channel_callback     │    │
│  └───────────────────────────────────────────────────────────-┘    │
└─────────────────────────────────────────────────────────────────────┘
          │ asyncpg                          │ httpx callbacks
          ▼                                  ▼
┌──────────────────┐              ┌──────────────────────────────┐
│   SUPABASE       │              │   STUBBED CHANNEL SERVICE    │
│   PostgreSQL     │              │   (FastAPI, separate app)    │
│   (hosted)       │              │   Simulates: delivered,      │
└──────────────────┘              │   failed, opened, clicked    │
                                  └──────────────────────────────┘
          ▲
          │ Redis
┌──────────────────┐
│   REDIS          │
│   (Upstash /     │
│   Railway)       │
│   - Celery broker│
│   - SSE pubsub   │
│   - Rate limit   │
└──────────────────┘
```

### 2.2 Service Topology

| Service | Port | Tech | Deployment |
|---|---|---|---|
| `crm-api` | 8000 | FastAPI + Uvicorn | Railway / Render |
| `crm-worker` | — | Celery worker | Railway (same repo, separate process) |
| `channel-stub` | 8001 | FastAPI + Uvicorn | Railway (same repo, separate service) |
| `crm-frontend` | 3000 | Vite + React | Vercel |
| `postgres` | 5432 | Supabase managed | Supabase |
| `redis` | 6379 | Redis | Railway / Upstash |

---

## 3. Database Schema

All tables use `UUID` primary keys and `timestamptz` for all timestamps. Soft deletes via `deleted_at` nullable column.

### 3.1 Entity Relationship Diagram
```
customers ──────────────── orders
    │                         │
    └──────── campaign_audiences
                   │
              campaigns
                   │
           communication_logs ── receipt_events
```

### 3.2 Table Definitions

#### `customers`
```sql
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     TEXT UNIQUE,                    -- optional brand's own ID
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    phone           TEXT,
    city            TEXT,
    tags            TEXT[] DEFAULT '{}',             -- e.g. ['vip', 'churned']
    total_spent     NUMERIC(12,2) DEFAULT 0,
    order_count     INTEGER DEFAULT 0,
    last_order_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                     -- soft delete
);
CREATE INDEX idx_customers_total_spent ON customers(total_spent);
CREATE INDEX idx_customers_last_order_at ON customers(last_order_at);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
```

#### `orders`
```sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_id     TEXT UNIQUE,
    amount          NUMERIC(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed', -- completed | refunded | pending
    channel         TEXT,                             -- online | in-store | app
    items           JSONB DEFAULT '[]',               -- [{product, qty, price}]
    ordered_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at);
CREATE INDEX idx_orders_amount ON orders(amount);
```

#### `segments`
```sql
CREATE TABLE segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    filter_rules    JSONB NOT NULL,    -- structured rule tree (see §4.1)
    ai_prompt       TEXT,             -- the natural language that generated this segment
    audience_size   INTEGER,          -- cached, refreshed on demand
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `campaigns`
```sql
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    segment_id      UUID REFERENCES segments(id) ON DELETE SET NULL,
    channel         TEXT NOT NULL,   -- whatsapp | sms | email | rcs
    message_template TEXT NOT NULL,
    ai_prompt       TEXT,            -- original AI prompt if AI-generated
    status          TEXT NOT NULL DEFAULT 'draft',
                                     -- draft | scheduled | running | completed | failed
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    audience_snapshot JSONB,          -- snapshot of customer IDs at time of send
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_segment_id ON campaigns(segment_id);
```

#### `communication_logs`
```sql
CREATE TABLE communication_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,
    message_body    TEXT NOT NULL,    -- personalized message for this customer
    status          TEXT NOT NULL DEFAULT 'queued',
                                      -- queued | sent | delivered | failed |
                                      -- opened | read | clicked | converted
    idempotency_key TEXT UNIQUE NOT NULL, -- campaign_id:customer_id — prevents duplicates
    external_ref    TEXT,             -- channel stub's message reference
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    converted_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_commlog_campaign_id ON communication_logs(campaign_id);
CREATE INDEX idx_commlog_customer_id ON communication_logs(customer_id);
CREATE INDEX idx_commlog_status ON communication_logs(status);
CREATE UNIQUE INDEX idx_commlog_idempotency ON communication_logs(idempotency_key);
```

#### `receipt_events`
```sql
-- Immutable append-only log of every callback received from channel stub
-- This is the audit trail that makes idempotency provable
CREATE TABLE receipt_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_log_id UUID NOT NULL REFERENCES communication_logs(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,    -- delivered | failed | opened | read | clicked | converted
    payload         JSONB,            -- full raw callback payload archived
    received_at     TIMESTAMPTZ DEFAULT NOW(),
    is_duplicate    BOOLEAN DEFAULT FALSE  -- flagged if out-of-order or replay
);
CREATE INDEX idx_receipt_events_log_id ON receipt_events(communication_log_id);
CREATE INDEX idx_receipt_events_type ON receipt_events(event_type);
```

#### `users` (CRM operators/marketers)
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT DEFAULT 'marketer',   -- marketer | admin
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Computed Analytics Views

```sql
-- Campaign-level funnel aggregation
CREATE VIEW campaign_funnel_stats AS
SELECT
    campaign_id,
    COUNT(*) FILTER (WHERE status != 'queued')          AS total_sent,
    COUNT(*) FILTER (WHERE status = 'delivered'
        OR delivered_at IS NOT NULL)                     AS total_delivered,
    COUNT(*) FILTER (WHERE status = 'failed')            AS total_failed,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL)        AS total_opened,
    COUNT(*) FILTER (WHERE read_at IS NOT NULL)          AS total_read,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)       AS total_clicked,
    COUNT(*) FILTER (WHERE converted_at IS NOT NULL)     AS total_converted,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE status != 'queued'), 0), 2
    )                                                    AS delivery_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE opened_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE delivered_at IS NOT NULL), 0), 2
    )                                                    AS open_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE opened_at IS NOT NULL), 0), 2
    )                                                    AS ctr
FROM communication_logs
GROUP BY campaign_id;
```

---

## 4. Core Domain Contracts

### 4.1 Segment Filter Rules Schema (JSONB)

Segments are defined by a recursive rule tree stored as JSONB. This is what the AI generates and what the backend compiles to SQL.

```json
{
  "operator": "AND",
  "rules": [
    {
      "field": "total_spent",
      "op": "gte",
      "value": 5000
    },
    {
      "field": "last_order_at",
      "op": "lt",
      "value": "NOW() - INTERVAL '30 days'"
    },
    {
      "operator": "OR",
      "rules": [
        { "field": "tags", "op": "contains", "value": "vip" },
        { "field": "order_count", "op": "gte", "value": 5 }
      ]
    }
  ]
}
```

**Supported fields:** `total_spent`, `order_count`, `last_order_at`, `created_at`, `city`, `tags`, `channel` (from orders)

**Supported operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `in`, `not_in`, `is_null`, `is_not_null`

### 4.2 Communication Lifecycle State Machine

```
           ┌────────────────────────────────────────┐
           │                                        │
  [CREATE] ▼                                        │
        queued                                      │
           │ Celery task picks up                   │
           ▼                                        │
         sent ──────────────────────────────► failed (terminal)
           │        channel stub callback           │
           ▼                                        │
       delivered ──────────────────────────────► failed (re-callback)
           │
           ▼
        opened
           │
           ▼
          read
           │
           ▼
        clicked
           │
           ▼
       converted (terminal positive)

Ordering rules:
- State transitions only move FORWARD in the funnel
- A `clicked` callback on a `queued` log: advance through all intermediate states
- `failed` is always accepted regardless of current state (terminal)
- `converted` only accepted if status >= `clicked`
- Duplicate callbacks for the same event are logged in receipt_events with is_duplicate=true
  but do NOT mutate communication_logs
```

### 4.3 Idempotency Contract

The receipt endpoint uses a two-layer idempotency guarantee:

1. **Log-level idempotency**: `communication_logs.idempotency_key = campaign_id:customer_id` — enforced by DB UNIQUE constraint. No duplicate log rows can be inserted.
2. **Event-level idempotency**: `receipt_events` is append-only. Processing logic checks: "has an event of this `event_type` already been recorded for this `communication_log_id`?" If yes → log as duplicate, return `200 OK`, skip state mutation.
3. **Out-of-order handling**: If a `clicked` event arrives before a `delivered` event, the system applies all intermediate state timestamps retroactively (at `NOW()`) to maintain funnel integrity.

---

## 5. API Contract

All endpoints prefixed `/api/v1/`. Auth via Bearer JWT.

### 5.1 Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create marketer account |
| POST | `/auth/login` | Returns `access_token` (JWT, 24h expiry) |
| GET | `/auth/me` | Current user info |

### 5.2 Customers

| Method | Path | Description |
|---|---|---|
| POST | `/customers/import` | Bulk import (JSON array, up to 10k rows) |
| GET | `/customers` | List with pagination, filters |
| GET | `/customers/{id}` | Single customer with order history |
| POST | `/customers` | Create single customer |
| PATCH | `/customers/{id}` | Update customer |
| DELETE | `/customers/{id}` | Soft delete |

### 5.3 Orders

| Method | Path | Description |
|---|---|---|
| POST | `/orders/import` | Bulk import orders |
| GET | `/orders` | List with pagination |
| GET | `/customers/{id}/orders` | Orders for a customer |

### 5.4 Segments

| Method | Path | Description |
|---|---|---|
| POST | `/segments` | Create segment (with filter_rules JSONB) |
| GET | `/segments` | List all segments |
| GET | `/segments/{id}` | Segment detail + audience preview (first 20) |
| POST | `/segments/{id}/preview` | Execute filter, return count + sample |
| PATCH | `/segments/{id}` | Update rules |
| DELETE | `/segments/{id}` | Delete segment |

### 5.5 Campaigns

| Method | Path | Description |
|---|---|---|
| POST | `/campaigns` | Create campaign (draft) |
| GET | `/campaigns` | List with status filter |
| GET | `/campaigns/{id}` | Campaign detail |
| POST | `/campaigns/{id}/launch` | Trigger send (enqueues Celery task) |
| GET | `/campaigns/{id}/stats` | Real-time funnel stats from view |
| GET | `/campaigns/{id}/logs` | Communication logs with pagination |

### 5.6 AI Engine

| Method | Path | Description |
|---|---|---|
| POST | `/ai/parse-intent` | NL → segment rules + message draft |
| POST | `/ai/draft-message` | Generate personalized message for channel |
| POST | `/ai/suggest-segment` | Suggest segment name + description |
| GET | `/ai/chat` | SSE stream — chat with campaign AI agent |

**`POST /ai/parse-intent` Request:**
```json
{
  "prompt": "Find high-spending customers who haven't ordered in 30 days and draft a WhatsApp discount message",
  "context": {
    "available_channels": ["whatsapp", "email", "sms"],
    "brand_name": "Aura Beauty"
  }
}
```

**`POST /ai/parse-intent` Response:**
```json
{
  "segment_rules": {
    "operator": "AND",
    "rules": [
      { "field": "total_spent", "op": "gte", "value": 3000 },
      { "field": "last_order_at", "op": "lt", "value": "NOW() - INTERVAL '30 days'" }
    ]
  },
  "segment_name": "High-Value Lapsed (30d)",
  "message_draft": "Hey {{name}}! 👋 We miss you at Aura Beauty. As one of our top customers, here's an exclusive 20% off your next order — use code COMEBACK20. Valid this week only! 💄",
  "recommended_channel": "whatsapp",
  "reasoning": "High-spend customers have demonstrated purchase intent. WhatsApp has highest open rates. 30-day lapse suggests re-engagement window."
}
```

### 5.7 Receipts (Webhook Callback Endpoint)

| Method | Path | Description |
|---|---|---|
| POST | `/receipts/callback` | Channel stub posts delivery events here |

**Payload (from channel stub):**
```json
{
  "event_id": "evt_uuid_here",
  "communication_log_id": "uuid",
  "event_type": "delivered",  // delivered|failed|opened|read|clicked|converted
  "timestamp": "2025-01-15T10:30:00Z",
  "metadata": {
    "channel": "whatsapp",
    "failure_reason": null
  }
}
```

**Response:**
```json
{
  "status": "accepted",        // accepted | duplicate | ignored
  "log_id": "uuid",
  "previous_status": "sent",
  "new_status": "delivered"
}
```

### 5.8 Analytics SSE Stream

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/live/{campaign_id}` | SSE stream of funnel updates |

**SSE Event format:**
```
event: funnel_update
data: {"campaign_id":"uuid","total_sent":500,"total_delivered":487,"open_rate":34.2,...}

event: heartbeat
data: {"ts":"2025-01-15T10:30:00Z"}
```

### 5.9 Channel Stub API (Separate Service, Port 8001)

| Method | Path | Description |
|---|---|---|
| POST | `/send` | CRM calls this to dispatch a message |

**Request from CRM:**
```json
{
  "communication_log_id": "uuid",
  "customer_id": "uuid",
  "channel": "whatsapp",
  "recipient": "+91-9876543210",
  "message_body": "Hey Priya! ...",
  "callback_url": "https://crm-api.railway.app/api/v1/receipts/callback"
}
```

**Channel stub behavior:**
1. Returns `202 Accepted` immediately with a reference ID
2. Enqueues a Celery task: `simulate_delivery_task`
3. Task sleeps 1–5s (simulated latency), then fires `sent` callback
4. After 2–8s, fires `delivered` (85% probability) or `failed` (15%)
5. If delivered: after 5–15s, fires `opened` (40%), then `read` (70% of opened), then `clicked` (20% of read)
6. `converted` fires with 10% probability on `clicked`

---

## 6. AI Engine Design

### 6.1 System Prompt Architecture

The AI receives a structured system prompt that includes:
- The current database schema (field names, types, allowed operators)
- Brand context (name, industry, typical customer profile)
- Output format specification (must return valid JSON matching `IntentParseResult`)
- Examples of good segment rules and message templates

### 6.2 Intent Parse Pipeline

```
User prompt
    │
    ▼
FastAPI /ai/parse-intent
    │
    ├─► Gemini 2.5 Flash
    │       System: schema + format spec
    │       User: prompt + brand context
    │       → Returns JSON with segment_rules + message_draft
    │
    ▼
Pydantic validation of returned JSON
    │
    ├─ Valid → return to frontend for user review
    └─ Invalid → retry with error feedback (max 2 retries)
```

### 6.3 Message Personalization

Messages support template variables resolved at send time:
- `{{name}}` — customer.name
- `{{first_name}}` — first word of customer.name
- `{{total_spent}}` — customer.total_spent (formatted)
- `{{last_order_date}}` — customer.last_order_at (formatted)
- `{{city}}` — customer.city

### 6.4 AI Chat Agent (SSE)

The chat interface maintains conversation history in the frontend (Zustand store). Each message sends the full history to `/ai/chat`. The AI is a campaign planning assistant with tools:
- `preview_segment(rules)` — executes segment preview, returns count
- `draft_message(channel, audience_description)` — drafts personalized message
- `create_campaign(segment_id, message, channel)` — creates campaign draft

---

## 7. Asynchronous Architecture

### 7.1 Celery Task Definitions

#### `dispatch_campaign_task(campaign_id: str)`
- Triggered by: `POST /campaigns/{id}/launch`
- Steps:
  1. Load campaign + segment from DB
  2. Execute segment filter → get customer IDs
  3. Snapshot customer list → save to `campaigns.audience_snapshot`
  4. For each customer: create `communication_logs` row (idempotency key: `{campaign_id}:{customer_id}`)
  5. Set campaign status → `running`
  6. For each log: call channel stub `/send` via httpx
  7. On all dispatched: set campaign status → check if any remain, else `completed`
- Concurrency: Use Celery chord/group for parallel dispatch (up to 50 concurrent)

#### `simulate_delivery_task(communication_log_id: str, callback_url: str, stage: str)`
- Triggered by: Channel stub after receiving a `/send` request
- Fires callbacks in sequence with random delays

#### `update_campaign_aggregate_task(campaign_id: str)`
- Triggered by: After each receipt callback
- Refreshes cached stats → publishes to Redis pubsub → SSE stream picks up

### 7.2 Redis Key Patterns

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `campaign:stats:{campaign_id}` | Hash | 1h | Cached funnel stats |
| `sse:channel:{campaign_id}` | PubSub channel | — | Live analytics broadcast |
| `idempotency:receipt:{event_id}` | String | 24h | Receipt dedup at Redis layer (pre-DB) |
| `ratelimit:receipts:{ip}` | Counter | 1m | Receipt endpoint rate limiting |

---

## 8. Security & Non-Functional Requirements

### 8.1 Authentication
- All `/api/v1/*` endpoints require `Authorization: Bearer <jwt>` except `/auth/*`
- JWT signed with HS256, 24h expiry, contains `user_id` + `role`

### 8.2 Rate Limiting
- `/receipts/callback`: 1000 req/min per IP (slowapi + Redis)
- `/ai/*`: 60 req/min per user

### 8.3 Idempotency Keys
- All mutating endpoints accept `Idempotency-Key` header (UUID)
- Stored in Redis for 24h; duplicate requests return cached response

### 8.4 Data Validation
- All inputs validated via Pydantic v2 models
- Segment filter rules validated against allowed field/operator matrix before SQL compilation
- SQL injection prevented by SQLAlchemy parameterized queries (never raw f-strings)

### 8.5 Error Handling
- All API errors return structured JSON: `{"error": "code", "message": "...", "detail": {}}`
- 4xx: client errors (validation, not found, auth)
- 5xx: server errors (task failures, DB unavailable)
- Celery tasks: max 3 retries with exponential backoff (1s, 4s, 16s)

---

## 9. Environment Variables

### CRM API (`crm-api`)
```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=<32-byte random>
JWT_ALGORITHM=HS256
GEMINI_API_KEY=AIzaSy...
CHANNEL_STUB_URL=http://localhost:8001
ENVIRONMENT=production
```

### Channel Stub (`channel-stub`)
```env
REDIS_URL=redis://localhost:6379/1
CRM_RECEIPT_URL=https://crm-api.railway.app/api/v1/receipts/callback
ENVIRONMENT=production
```

### Frontend (`crm-frontend`)
```env
VITE_API_BASE_URL=https://crm-api.railway.app/api/v1
VITE_APP_NAME=Xeno Mini CRM
```

---

## 10. Seed Data Specification

The seed script generates realistic data for a fictional brand **"Aura Beauty"**:
- 500 customers with names, emails, cities (Mumbai, Delhi, Bangalore, Chennai, Pune)
- 2,000 orders across customers (realistic spending patterns: 20% VIP >₹10k, 60% regular, 20% low-value)
- 3 pre-built segments demonstrating different filter types
- 2 completed campaigns with full analytics data
- 1 marketer user: `demo@aurabeauty.com` / `demo1234`

---

## 11. Frontend Route Map

| Route | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Overview metrics, recent campaigns |
| `/customers` | `CustomerList` | Table with search, filter |
| `/customers/:id` | `CustomerDetail` | Profile + order history + comms |
| `/segments` | `SegmentList` | All segments with audience size |
| `/segments/new` | `SegmentBuilder` | Rule builder + AI assist |
| `/segments/:id` | `SegmentDetail` | Preview audience, edit rules |
| `/campaigns` | `CampaignList` | All campaigns with status |
| `/campaigns/new` | `CampaignBuilder` | Create campaign + AI draft |
| `/campaigns/:id` | `CampaignDetail` | Funnel analytics + log table |
| `/ai` | `AIAssistant` | Chat-first intent interface |
| `/login` | `Login` | Auth form |

---

## 12. Key Technical Decisions & Tradeoffs

| Decision | Chosen Approach | Alternative | Reason |
|---|---|---|---|
| ORM | SQLAlchemy 2 async | Tortoise ORM | Mature ecosystem, Alembic, better type hints |
| State management | Zustand + TanStack Query | Redux Toolkit | Lower boilerplate, better DX for this scale |
| Real-time | SSE (sse-starlette) | WebSockets | Unidirectional data fits SSE; no WS overhead |
| AI integration | Google Gemini direct API | LangChain | Avoid abstraction overhead; direct control |
| Segment rules | JSONB rule tree → dynamic SQL | Hardcoded filter forms | Fully AI-composable; extensible without migration |
| Channel sim | Separate FastAPI service | Same-process mock | Reflects real architecture; tests real async loop |
| Auth | JWT (stateless) | Session + DB | Stateless scales horizontally; no session table |
| Analytics | SQL view + Redis cache | Separate analytics DB | Right-sized for this scope; simple to maintain |
