# test.md — AI-Native Mini CRM
## Automated Test Checklist for Antigravity Agent
> Run this after all phases are complete. Work through every [ ] item in order.
> For each test: execute the request, verify the assertion, mark [x] if passed or [!] if failed.
> Never skip a test. If a test fails, fix the code before moving to the next section.

---

## Instructions for Agent

1. Read spec.md to understand expected behavior before testing
2. Start all servers before running any test:
   - Backend API on port 8000
   - Channel stub on port 8001
   - Both Celery workers running
   - Redis running on port 6379
3. Run tests strictly in order — later tests depend on variables captured in earlier ones
4. After every [!] failure: identify the broken file, fix it, re-run the failed test, then continue
5. At the end: output a summary table showing pass/fail for every test

---

## Pre-Test Setup

- [ ] Verify backend API is running: `GET http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] Verify channel stub is running: `GET http://localhost:8001/health` returns `{"status":"ok"}`
- [ ] Verify Redis is reachable: `redis-cli ping` returns `PONG`
- [ ] Verify both Celery workers are connected to Redis (no connection errors in worker logs)
- [ ] Run seed script if not already done: `python seed.py` from /backend
- [ ] Capture JWT token and store as $TOKEN for all subsequent tests:
  ```
  POST /api/v1/auth/login
  Body: {"email":"demo@aurabeauty.com","password":"demo1234"}
  Assert: response contains access_token
  Store: $TOKEN = response.access_token
  Store: $HEADERS = {Authorization: "Bearer $TOKEN"}
  ```

---

## Section 1: Auth (Phase 2)

- [ ] **T01** — Health check
  ```
  GET http://localhost:8000/health
  Assert: status=200, body.status="ok"
  ```

- [ ] **T02** — Register new user
  ```
  POST /api/v1/auth/register
  Body: {"email":"testuser@test.com","password":"testpass123","full_name":"Test User"}
  Assert: status=201, response.email="testuser@test.com", response.role="marketer"
  Assert: response does NOT contain "password" or "hashed_password" field
  ```

- [ ] **T03** — Duplicate email registration rejected
  ```
  POST /api/v1/auth/register (same body as T02)
  Assert: status=409 (conflict) — not 500
  ```

- [ ] **T04** — Login returns valid JWT
  ```
  POST /api/v1/auth/login
  Body: {"email":"demo@aurabeauty.com","password":"demo1234"}
  Assert: status=200, response.access_token exists and length > 100
  ```

- [ ] **T05** — Wrong password rejected
  ```
  POST /api/v1/auth/login
  Body: {"email":"demo@aurabeauty.com","password":"wrongpassword"}
  Assert: status=401
  ```

- [ ] **T06** — Protected route blocked without token
  ```
  GET /api/v1/customers (no Authorization header)
  Assert: status=401
  ```

- [ ] **T07** — GET /auth/me returns current user
  ```
  GET /api/v1/auth/me (with $HEADERS)
  Assert: status=200, response.email="demo@aurabeauty.com"
  ```

---

## Section 2: Customers & Orders (Phase 2)

- [ ] **T08** — Bulk import customers
  ```
  POST /api/v1/customers/import (with $HEADERS)
  Body: array of 5 customers with name, email, phone, city fields
  Assert: status=200, imported_count=5
  Store: $CUSTOMER_ID = any id from the response
  ```

- [ ] **T09** — Duplicate import is idempotent
  ```
  POST /api/v1/customers/import (same body as T08)
  Assert: status=200, no duplicate rows (total count unchanged)
  Assert: upserted by email — existing records updated not duplicated
  ```

- [ ] **T10** — List customers paginated
  ```
  GET /api/v1/customers?page=1&size=5 (with $HEADERS)
  Assert: status=200, response.items is array, response.total >= 5
  Assert: response.page=1, response.size=5
  ```

- [ ] **T11** — Get single customer
  ```
  GET /api/v1/customers/$CUSTOMER_ID (with $HEADERS)
  Assert: status=200, response.id=$CUSTOMER_ID
  Assert: response contains orders array (may be empty)
  ```

- [ ] **T12** — Import orders and verify aggregate recomputation
  ```
  POST /api/v1/orders/import (with $HEADERS)
  Body: 3 orders all with customer_id=$CUSTOMER_ID, amounts: 2500, 1800, 3200
  Assert: status=200

  Then: GET /api/v1/customers/$CUSTOMER_ID
  Assert: total_spent=7500.00 (sum of 3 orders)
  Assert: order_count=3
  Assert: last_order_at is set to most recent order date
  ```

- [ ] **T13** — Soft delete customer
  ```
  DELETE /api/v1/customers/$CUSTOMER_ID (with $HEADERS)
  Assert: status=200 or 204

  Then: GET /api/v1/customers?page=1&size=100
  Assert: deleted customer does NOT appear in list
  Assert: customer row in DB has deleted_at set (not hard deleted)
  ```

- [ ] **T14** — Search customers by name
  ```
  GET /api/v1/customers?search=Priya (with $HEADERS)
  Assert: status=200, all returned items have "Priya" in name or email
  ```

---

## Section 3: Segment Engine (Phase 3)

- [ ] **T15** — Create segment with simple AND rule
  ```
  POST /api/v1/segments (with $HEADERS)
  Body: {
    "name": "High Value Customers",
    "description": "Spent over 5000",
    "filter_rules": {
      "operator": "AND",
      "rules": [{"field":"total_spent","op":"gte","value":5000}]
    }
  }
  Assert: status=201, response.id exists
  Store: $SEGMENT_ID = response.id
  ```

- [ ] **T16** — Preview segment returns count and sample
  ```
  POST /api/v1/segments/$SEGMENT_ID/preview (with $HEADERS)
  Assert: status=200, response.count >= 0 (integer)
  Assert: response.sample is array of customers
  Assert: all sample customers have total_spent >= 5000
  ```

- [ ] **T17** — Nested OR inside AND rule
  ```
  POST /api/v1/segments (with $HEADERS)
  Body: {
    "name": "VIP or High Spender",
    "filter_rules": {
      "operator": "AND",
      "rules": [
        {
          "operator": "OR",
          "rules": [
            {"field":"total_spent","op":"gte","value":5000},
            {"field":"tags","op":"contains","value":"vip"}
          ]
        },
        {"field":"order_count","op":"gte","value":1}
      ]
    }
  }
  Assert: status=201
  Preview it: Assert count >= 0, no SQL error thrown
  ```

- [ ] **T18** — Date-relative filter compiles correctly
  ```
  POST /api/v1/segments (with $HEADERS)
  Body: {
    "name": "Lapsed 30 Days",
    "filter_rules": {
      "operator": "AND",
      "rules": [
        {"field":"last_order_at","op":"lt","value":"NOW() - INTERVAL '30 days'"}
      ]
    }
  }
  Assert: status=201
  Preview: Assert no SQL error, count is integer
  ```

- [ ] **T19** — Tags array filter works
  ```
  POST /api/v1/segments (with $HEADERS)
  Body: {
    "name": "VIP Only",
    "filter_rules": {
      "operator": "AND",
      "rules": [{"field":"tags","op":"contains","value":"vip"}]
    }
  }
  Assert: status=201
  Preview: all sample customers must have "vip" in their tags array
  ```

- [ ] **T20** — Invalid field name rejected
  ```
  POST /api/v1/segments (with $HEADERS)
  Body: {
    "name": "Bad Segment",
    "filter_rules": {
      "operator": "AND",
      "rules": [{"field":"credit_card_number","op":"eq","value":"1234"}]
    }
  }
  Assert: status=422 — must NOT be 201 or 500
  Assert: error message mentions invalid field
  ```

- [ ] **T21** — List all segments
  ```
  GET /api/v1/segments (with $HEADERS)
  Assert: status=200, response is array with length >= 3
  Assert: each item has id, name, audience_size field
  ```

---

## Section 4: Campaign Engine (Phase 4)

- [ ] **T22** — Create campaign in draft status
  ```
  POST /api/v1/campaigns (with $HEADERS)
  Body: {
    "name": "Test Win-back Campaign",
    "segment_id": "$SEGMENT_ID",
    "channel": "whatsapp",
    "message_template": "Hey {{first_name}}! We miss you. Use COMEBACK20 for 20% off!"
  }
  Assert: status=201, response.status="draft"
  Store: $CAMPAIGN_ID = response.id
  ```

- [ ] **T23** — Cannot launch non-existent campaign
  ```
  POST /api/v1/campaigns/00000000-0000-0000-0000-000000000000/launch (with $HEADERS)
  Assert: status=404
  ```

- [ ] **T24** — Launch campaign triggers Celery dispatch
  ```
  POST /api/v1/campaigns/$CAMPAIGN_ID/launch (with $HEADERS)
  Assert: status=200 or 202

  Wait 5 seconds, then:
  GET /api/v1/campaigns/$CAMPAIGN_ID (with $HEADERS)
  Assert: status is "running" or "completed" (not "draft")
  ```

- [ ] **T25** — Communication logs created after dispatch
  ```
  Wait 10 seconds after T24, then:
  GET /api/v1/campaigns/$CAMPAIGN_ID/logs?page=1&size=50 (with $HEADERS)
  Assert: status=200, total >= 1
  Assert: each log has idempotency_key in format "{campaign_id}:{customer_id}"
  Assert: no duplicate idempotency_key values in the results
  Store: $LOG_ID = first log's id
  ```

- [ ] **T26** — Template variables resolved in message body
  ```
  GET /api/v1/campaigns/$CAMPAIGN_ID/logs?page=1&size=1 (with $HEADERS)
  Assert: message_body does NOT contain "{{" or "}}"
  Assert: message_body contains an actual customer name
  ```

- [ ] **T27** — Campaign stats endpoint returns funnel data
  ```
  GET /api/v1/campaigns/$CAMPAIGN_ID/stats (with $HEADERS)
  Assert: status=200
  Assert: response contains total_sent, total_delivered, total_failed
  Assert: all values are integers >= 0
  ```

---

## Section 5: Channel Stub (Phase 5)

- [ ] **T28** — Channel stub health check
  ```
  GET http://localhost:8001/health
  Assert: status=200, body.service="channel-stub"
  ```

- [ ] **T29** — POST /send returns 202 immediately
  ```
  POST http://localhost:8001/send
  Body: {
    "communication_log_id": "$LOG_ID",
    "customer_id": "any-uuid",
    "channel": "whatsapp",
    "recipient": "+919876543210",
    "message_body": "Test message",
    "callback_url": "http://localhost:8000/api/v1/receipts/callback"
  }
  Assert: status=202
  Assert: response.external_ref exists (UUID string)
  Assert: response time < 500ms (non-blocking)
  ```

- [ ] **T30** — Callbacks arrive at CRM after delay
  ```
  After T29, wait 10 seconds then:
  GET /api/v1/campaigns/$CAMPAIGN_ID/logs?page=1&size=50 (with $HEADERS)
  Assert: at least some logs have status != "queued"
  Assert: logs with status "sent" have sent_at timestamp set
  Assert: logs with status "delivered" have delivered_at timestamp set
  ```

- [ ] **T31** — Full lifecycle fires in correct sequence
  ```
  Wait 60 seconds after launching campaign, then:
  GET /api/v1/campaigns/$CAMPAIGN_ID/stats (with $HEADERS)
  Assert: total_sent > 0
  Assert: total_delivered > 0
  Assert: delivery_rate between 70 and 100
  ```

---

## Section 6: Receipt API Idempotency (Phase 6) — CRITICAL

- [ ] **T32** — Normal callback advances status
  ```
  POST /api/v1/receipts/callback (with $HEADERS)
  Body: {
    "event_id": "test-event-uuid-001",
    "communication_log_id": "$LOG_ID",
    "event_type": "delivered",
    "timestamp": "<current UTC ISO timestamp>",
    "metadata": {"channel":"whatsapp","failure_reason":null}
  }
  Assert: status=200
  Assert: response.status = "accepted"
  Assert: response.new_status = "delivered"
  ```

- [ ] **T33** — Duplicate event_id is complete no-op
  ```
  POST /api/v1/receipts/callback (exact same body as T32, same event_id)
  Assert: status=200
  Assert: response.status = "duplicate"
  Verify: receipt_events table has second row with is_duplicate=true
  Verify: communication_log status unchanged from T32
  ```

- [ ] **T34** — Out-of-order callback backfills intermediate states
  ```
  Find a log still in "queued" or "sent" status
  Store: $FRESH_LOG_ID = that log's id

  POST /api/v1/receipts/callback (with $HEADERS)
  Body: {
    "event_id": "test-event-uuid-002",
    "communication_log_id": "$FRESH_LOG_ID",
    "event_type": "clicked",
    "timestamp": "<current UTC ISO timestamp>",
    "metadata": {"channel":"whatsapp"}
  }
  Assert: status=200, response.status="accepted"

  Then GET the log and verify ALL of these are non-null:
  Assert: delivered_at is set
  Assert: opened_at is set
  Assert: read_at is set
  Assert: clicked_at is set
  Assert: status = "clicked"

  FAILURE HERE = idempotency backfill logic is broken — fix receipt_service.py
  ```

- [ ] **T35** — Failed event accepted regardless of current status
  ```
  POST /api/v1/receipts/callback (with $HEADERS)
  Body: {
    "event_id": "test-event-uuid-003",
    "communication_log_id": "$LOG_ID",
    "event_type": "failed",
    "timestamp": "<current UTC ISO timestamp>",
    "metadata": {"channel":"whatsapp","failure_reason":"number_unreachable"}
  }
  Assert: status=200
  Assert: response.status = "accepted" or "duplicate"
  ```

- [ ] **T36** — Malformed payload still returns 200
  ```
  POST /api/v1/receipts/callback (with $HEADERS)
  Body: {"completely":"wrong","structure":true}
  Assert: status=200 — MUST NOT return 4xx or 5xx
  ```

- [ ] **T37** — Rate limiting active but not triggered by normal volume
  ```
  Send 10 rapid sequential requests to POST /api/v1/receipts/callback
  Assert: all return 200
  Assert: no 429 responses for this volume
  ```

---

## Section 7: Analytics SSE (Phase 7)

- [ ] **T38** — Campaign stats view returns correct aggregates
  ```
  GET /api/v1/campaigns/$CAMPAIGN_ID/stats (with $HEADERS)
  Assert: status=200
  Assert: total_sent is integer > 0
  Assert: delivery_rate is decimal between 0 and 100
  ```

- [ ] **T39** — SSE endpoint accepts connection and streams
  ```
  GET /api/v1/analytics/live/$CAMPAIGN_ID?token=$TOKEN
  Assert: HTTP 200 with Content-Type: text/event-stream
  Assert: within 15 seconds receives a "heartbeat" event
  Assert: receives at least one "funnel_update" event with campaign stats JSON
  Assert: connection stays open
  ```

- [ ] **T40** — SSE requires authentication
  ```
  GET /api/v1/analytics/live/$CAMPAIGN_ID (no token)
  Assert: status=401 or connection immediately closed
  ```

---

## Section 8: AI Engine (Phase 8)

- [ ] **T41** — Parse intent returns valid structured JSON
  ```
  POST /api/v1/ai/parse-intent (with $HEADERS)
  Body: {
    "prompt": "Find customers who spent more than 5000 rupees but haven't ordered in 60 days. Draft a WhatsApp win-back message with 15% discount.",
    "context": {"available_channels":["whatsapp","email","sms"],"brand_name":"Aura Beauty"}
  }
  Assert: status=200
  Assert: response.segment_rules has "operator" and "rules" fields
  Assert: response.segment_name is non-empty string
  Assert: response.message_draft is non-empty string
  Assert: response.recommended_channel is one of: whatsapp, sms, email, rcs
  ```

- [ ] **T42** — AI-generated rules compile and execute without error
  ```
  Using segment_rules from T41:
  POST /api/v1/segments (with $HEADERS)
  Body: {"name":"<segment_name from T41>","filter_rules":<segment_rules from T41>}
  Assert: status=201

  POST /api/v1/segments/<new_id>/preview (with $HEADERS)
  Assert: status=200, count is integer, no SQL error
  Store: $AI_SEGMENT_ID = new segment id
  ```

- [ ] **T43** — Draft message endpoint works
  ```
  POST /api/v1/ai/draft-message (with $HEADERS)
  Body: {
    "channel": "whatsapp",
    "audience_description": "High-value lapsed customers",
    "brand_name": "Aura Beauty"
  }
  Assert: status=200
  Assert: response.message is non-empty string
  Assert: message length <= 1024
  ```

- [ ] **T44** — AI chat SSE streams tokens
  ```
  POST /api/v1/ai/chat (with $HEADERS)
  Body: {"messages":[{"role":"user","content":"Suggest a campaign for VIP customers"}]}
  Assert: Content-Type is text/event-stream
  Assert: tokens stream progressively
  Assert: stream ends cleanly
  ```

---

## Section 9: Full End-to-End Flow

- [ ] **T45** — Complete AI-driven campaign flow
  ```
  Step 1: POST /api/v1/ai/parse-intent → get segment_rules + message_draft
  Step 2: POST /api/v1/segments with AI rules → verify preview count > 0
  Step 3: POST /api/v1/campaigns with AI segment + AI message → status=draft
  Step 4: POST /api/v1/campaigns/:id/launch → status moves to running
  Step 5: Wait 30 seconds
  Step 6: GET /api/v1/campaigns/:id/stats → total_sent > 0, delivery_rate > 0
  Step 7: GET /api/v1/analytics/live/:id?token=$TOKEN → funnel_update event received

  ALL 7 STEPS MUST PASS — this is the core product flow
  ```

---

## Section 10: Frontend Smoke Tests (Phases 9-12)

- [ ] **T46** — Frontend loads without errors
  ```
  Open http://localhost:3000
  Assert: login page renders
  Assert: no console errors on load
  ```

- [ ] **T47** — Login flow works end to end
  ```
  Enter demo@aurabeauty.com / demo1234
  Click Sign In
  Assert: redirects to dashboard
  Assert: sidebar renders with all nav items
  Assert: user name visible in sidebar footer
  ```

- [ ] **T48** — All routes render without crashing
  ```
  Click each sidebar link:
  Dashboard, Customers, Segments, Campaigns, AI Assistant
  Assert: none show a blank white screen
  Assert: no uncaught React errors in console
  ```

- [ ] **T49** — Segment builder AI flow works
  ```
  Navigate to /segments/new
  Click "✨ Describe your audience"
  Type: "Customers who spent over 5000 and haven't ordered in 30 days"
  Submit
  Assert: rule builder auto-populates with AI rules
  Assert: preview count appears
  Assert: saving creates a new segment
  ```

- [ ] **T50** — Campaign analytics shows live funnel
  ```
  Navigate to /campaigns/$CAMPAIGN_ID
  Assert: funnel chart renders
  Assert: stat cards show rates
  Assert: Live indicator visible when SSE connected
  Assert: communication logs table shows rows
  ```

---

## Final Summary

After all tests, output this table:

| Section | Tests | Passed | Failed |
|---|---|---|---|
| Auth | T01-T07 | | |
| Customers & Orders | T08-T14 | | |
| Segment Engine | T15-T21 | | |
| Campaign Engine | T22-T27 | | |
| Channel Stub | T28-T31 | | |
| Receipt Idempotency | T32-T37 | | |
| Analytics SSE | T38-T40 | | |
| AI Engine | T41-T44 | | |
| End-to-End | T45 | | |
| Frontend | T46-T50 | | |
| **TOTAL** | **50** | | |

Definition of done: all 50 tests marked [x].
Any [!] failure must be fixed before marking complete.
