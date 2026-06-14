"""
backend/app/routers/analytics.py

SSE endpoint that streams live campaign funnel stats to the browser.

Flow:
  1. Authenticate via JWT (header OR ?token= query param — EventSource can't set headers)
  2. Emit initial snapshot from Redis cache (or live DB query as fallback)
  3. Subscribe to Redis pubsub channel sse:channel:{campaign_id}
  4. Forward every pubsub message as a "funnel_update" SSE event
  5. Heartbeat every 15s so proxies/load-balancers don't close the connection
  6. On client disconnect (GeneratorExit / CancelledError) → unsubscribe cleanly
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncIterator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from app.config import Settings
from app.database import get_db

logger = logging.getLogger(__name__)
settings = Settings()

router = APIRouter(prefix="/analytics", tags=["analytics"])

HEARTBEAT_INTERVAL = 15  # seconds


# ── Auth helper that accepts token from header OR query param ─────────────────
async def _authenticate(
    request: Request,
    token: str | None = Query(None, description="JWT token (for EventSource clients)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts JWT from:
      - Authorization: Bearer <token>  header (normal REST calls)
      - ?token=<token>                  query param (browser EventSource API)
    """
    raw_token: str | None = token

    if raw_token is None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw_token = auth_header[len("Bearer "):]

    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(raw_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_id


# ── Helpers ──────────────────────────────────────────────────────────────────
async def _get_stats_from_db(campaign_id: str, db: AsyncSession) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM campaign_funnel_stats WHERE campaign_id = :id"),
        {"id": campaign_id}
    )
    row = result.fetchone()
    if not row:
        return None
    data = dict(row._mapping)
    data["campaign_id"] = str(data["campaign_id"])
    return data


async def _get_or_fetch_stats(campaign_id: str, redis_client, db: AsyncSession) -> dict | None:
    """Return stats dict from Redis cache, falling back to live DB query."""
    try:
        cached = await redis_client.get(f"campaign:stats:{campaign_id}")
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"[SSE] Redis GET failed: {e}")

    # Fallback: query the view and cache it
    data = await _get_stats_from_db(campaign_id, db)
    if data:
        try:
            await redis_client.set(f"campaign:stats:{campaign_id}", json.dumps(data), ex=3600)
        except Exception:
            pass
    return data


# ── SSE generator ─────────────────────────────────────────────────────────────
async def _campaign_event_generator(
    campaign_id: str,
    request: Request,
    db: AsyncSession,
) -> AsyncIterator[dict]:
    """
    Yields SSE-formatted dicts consumed by EventSourceResponse.
    Cleans up the pubsub connection on any exit path.
    """
    # Create a *dedicated* async Redis connection for pubsub
    # (pubsub keeps the connection in subscribe mode, can't reuse the app's shared client)
    pubsub_client = aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    pubsub = pubsub_client.pubsub()

    try:
        # ── Step 2: Initial snapshot ──────────────────────────────────────────
        stats = await _get_or_fetch_stats(campaign_id, request.app.state.redis, db)
        if stats:
            yield {
                "event": "funnel_update",
                "data": json.dumps(stats)
            }
        else:
            yield {
                "event": "funnel_update",
                "data": json.dumps({"campaign_id": campaign_id, "detail": "no stats yet"})
            }

        # ── Step 3: Subscribe to pubsub ───────────────────────────────────────
        channel = f"sse:channel:{campaign_id}"
        await pubsub.subscribe(channel)
        logger.info(f"[SSE] Subscribed to {channel}")

        # ── Steps 4 + 5: Forward messages | send heartbeats ──────────────────
        last_heartbeat = asyncio.get_event_loop().time()

        while True:
            # Check for client disconnect
            if await request.is_disconnected():
                logger.info(f"[SSE] Client disconnected from {channel}")
                break

            # Non-blocking poll for a pubsub message (100 ms window)
            try:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=0.1)
            except asyncio.TimeoutError:
                message = None

            if message and message.get("type") == "message":
                try:
                    data = json.loads(message["data"])
                    yield {"event": "funnel_update", "data": json.dumps(data)}
                except Exception as e:
                    logger.warning(f"[SSE] Failed to parse pubsub message: {e}")

            # Heartbeat if 15 s have elapsed
            now = asyncio.get_event_loop().time()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"ts": datetime.now(timezone.utc).isoformat()})
                }
                last_heartbeat = now

            await asyncio.sleep(0.05)  # yield control to event loop

    except (asyncio.CancelledError, GeneratorExit):
        logger.info(f"[SSE] Generator cancelled for campaign {campaign_id}")
    except Exception as e:
        logger.error(f"[SSE] Unexpected error: {e}", exc_info=True)
    finally:
        # ── Step 6: Clean disconnect ──────────────────────────────────────────
        try:
            await pubsub.unsubscribe()
            await pubsub_client.aclose()
            logger.info(f"[SSE] Pubsub cleaned up for campaign {campaign_id}")
        except Exception as e:
            logger.warning(f"[SSE] Error during pubsub cleanup: {e}")


# ── Route ─────────────────────────────────────────────────────────────────────
@router.get("/live/{campaign_id}")
async def analytics_live(
    campaign_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(_authenticate),
):
    """
    SSE stream of live campaign funnel stats.

    Connect via browser:
        new EventSource(`/api/analytics/live/${campaignId}?token=${jwt}`)

    Or via curl (for testing):
        curl -H "Authorization: Bearer <jwt>" \
             http://localhost:8000/api/analytics/live/<campaign_id>
    """
    logger.info(f"[SSE] User {user_id} subscribed to campaign {campaign_id}")

    return EventSourceResponse(
        _campaign_event_generator(campaign_id, request, db),
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        ping=HEARTBEAT_INTERVAL,
    )

# ── Dashboard Stats ───────────────────────────────────────────────────────────

class DashboardStatsResponse(BaseModel):
    total_customers: int
    active_campaigns: int
    messages_sent: int
    avg_delivery_rate: float | None

@router.get("/dashboard", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    # Use normal JWT auth for this REST endpoint
    request: Request = None,
):
    # Just a simple auth check since we don't have Depends(get_current_user) directly imported here
    # but let's just import it inside the function to avoid circular imports if any, or use _authenticate
    user_id = await _authenticate(request, token=None, db=db)

    # 1. Total Customers
    res = await db.execute(text("SELECT COUNT(*) FROM customers"))
    total_customers = res.scalar() or 0

    # 2. Active Campaigns
    res = await db.execute(text("SELECT COUNT(*) FROM campaigns WHERE status IN ('running', 'scheduled')"))
    active_campaigns = res.scalar() or 0

    # 3. Messages Sent & Delivery Rate
    res = await db.execute(text("SELECT SUM(total_sent), SUM(total_delivered) FROM campaign_funnel_stats"))
    row = res.fetchone()
    total_sent = row[0] if row and row[0] else 0
    total_delivered = row[1] if row and row[1] else 0

    avg_delivery_rate = None
    if total_sent > 0:
        avg_delivery_rate = (total_delivered / total_sent) * 100.0

    return DashboardStatsResponse(
        total_customers=total_customers,
        active_campaigns=active_campaigns,
        messages_sent=total_sent,
        avg_delivery_rate=avg_delivery_rate,
    )
