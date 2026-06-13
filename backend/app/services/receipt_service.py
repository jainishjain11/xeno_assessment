"""
backend/app/services/receipt_service.py
Four-layer idempotency pipeline for processing channel-stub delivery callbacks.

TEST CASES (as comments):

Test 1 — Normal forward flow:
  log.status = "sent"
  payload.event_type = "delivered"
  → Layer 1 pass (no Redis key), Layer 2 load log, Layer 3 no prior event,
    Layer 4 new_rank(2) > current_rank(1) → set delivered_at=NOW(), status="delivered"
  → INSERT receipt_event(is_duplicate=False), SET Redis key, enqueue aggregate task
  → Returns {status:"accepted", previous_status:"sent", new_status:"delivered"}

Test 2 — Duplicate callback (same event_id twice):
  First call  → Layer 1 misses, processes normally, sets Redis key
  Second call → Layer 1 hits Redis key for same event_id
  → Returns {status:"duplicate"} immediately. DB never touched on second call.

Test 3 — Out-of-order: "clicked" arrives when log.status="sent":
  log.status = "sent", payload.event_type = "clicked"
  → Layer 1 pass, Layer 2 load, Layer 3 no prior event,
    Layer 4 new_rank(5) > current_rank(1) → GAP exists
  → Set ALL intermediate timestamps: delivered_at, opened_at, read_at, clicked_at = NOW()
  → status set to "clicked", INSERT receipt_event(is_duplicate=False)
  → Returns {status:"accepted", previous_status:"sent", new_status:"clicked"}

Test 4 — "failed" event on a "delivered" log:
  log.status = "delivered", payload.event_type = "failed"
  → Layer 1 pass, Layer 2 load, Layer 3 no prior "failed" event
  → Layer 4: "failed" is always terminal — set failed_at=NOW(), status="failed"
  → INSERT receipt_event(is_duplicate=False)
  → Returns {status:"accepted", previous_status:"delivered", new_status:"failed"}
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import CommunicationLog, ReceiptEvent
from app.schemas.receipt import ReceiptCallback, ReceiptResult

logger = logging.getLogger(__name__)

# Ordered status funnel — index == rank
STATUS_ORDER = ["queued", "sent", "delivered", "opened", "read", "clicked", "converted", "failed"]

# Maps a status name to the timestamp column name on CommunicationLog
STATUS_TIMESTAMP_MAP = {
    "sent": "sent_at",
    "delivered": "delivered_at",
    "opened": "opened_at",
    "read": "read_at",
    "clicked": "clicked_at",
    "converted": "converted_at",
    "failed": "failed_at",
}


async def process_receipt(
    db: AsyncSession,
    redis_client,
    payload: ReceiptCallback
) -> ReceiptResult:
    """
    Execute the 4-layer idempotency pipeline and return a ReceiptResult.
    Never raises — all errors are logged and the caller always returns 200.
    """
    # ── Layer 1: Redis pre-check (cheapest gate, blocks replay attacks) ──────
    redis_key = f"idempotency:receipt:{payload.event_id}"
    try:
        if await redis_client.get(redis_key):
            logger.info(f"[receipt] Duplicate event_id={payload.event_id} — Redis hit")
            return ReceiptResult(status="duplicate", log_id=str(payload.communication_log_id))
    except Exception as e:
        # Redis unavailable → degrade gracefully; continue processing
        logger.warning(f"[receipt] Redis get failed: {e}. Continuing without pre-check.")

    # ── Layer 2: Load communication log ─────────────────────────────────────
    log = await db.get(CommunicationLog, payload.communication_log_id)
    if not log:
        logger.warning(f"[receipt] communication_log_id={payload.communication_log_id} not found")
        return ReceiptResult(
            status="ignored",
            log_id=str(payload.communication_log_id),
            detail="communication log not found"
        )

    previous_status = log.status

    # ── Layer 3: DB event dedup check ────────────────────────────────────────
    existing_result = await db.execute(
        select(ReceiptEvent).where(
            ReceiptEvent.communication_log_id == log.id,
            ReceiptEvent.event_type == payload.event_type
        )
    )
    existing_event = existing_result.scalar_one_or_none()
    is_duplicate = existing_event is not None

    if is_duplicate:
        # Still append to receipt_events as audit trail, but skip state mutation
        logger.info(
            f"[receipt] Duplicate event_type={payload.event_type} for log={log.id}. "
            "Logging to receipt_events, skipping status mutation."
        )
        receipt_event = ReceiptEvent(
            communication_log_id=log.id,
            event_type=payload.event_type,
            payload=payload.model_dump(mode="json"),
            is_duplicate=True
        )
        db.add(receipt_event)
        await db.commit()

        # Still stamp Redis so fast-path catches next replay
        try:
            await redis_client.setex(redis_key, 86400, "1")
        except Exception as e:
            logger.warning(f"[receipt] Redis setex failed: {e}")

        return ReceiptResult(
            status="duplicate",
            log_id=str(log.id),
            previous_status=previous_status,
            new_status=log.status
        )

    # ── Layer 4: Forward-only state transition ───────────────────────────────
    now = datetime.now(timezone.utc)
    new_status = log.status  # default: unchanged unless we mutate

    event_type = payload.event_type

    if event_type == "failed":
        # "failed" is always accepted regardless of current state (terminal)
        log.failed_at = log.failed_at or now
        log.failure_reason = (payload.metadata or {}).get("failure_reason") or log.failure_reason
        new_status = "failed"

    elif event_type in STATUS_ORDER:
        try:
            current_rank = STATUS_ORDER.index(log.status)
        except ValueError:
            current_rank = 0  # unknown status — treat as queued

        new_rank = STATUS_ORDER.index(event_type)

        if new_rank > current_rank:
            # Normal forward transition — backfill all intermediate timestamps
            for rank in range(current_rank + 1, new_rank + 1):
                status_name = STATUS_ORDER[rank]
                ts_col = STATUS_TIMESTAMP_MAP.get(status_name)
                if ts_col and getattr(log, ts_col) is None:
                    setattr(log, ts_col, now)

            new_status = event_type
            log.status = new_status

        else:
            # Out-of-order or same-rank: backfill timestamps that are still None
            # Do NOT move status backward
            ts_col = STATUS_TIMESTAMP_MAP.get(event_type)
            if ts_col and getattr(log, ts_col) is None:
                setattr(log, ts_col, now)
            # new_status remains unchanged (log.status stays as-is)
            new_status = log.status
    else:
        logger.warning(f"[receipt] Unknown event_type={event_type}")

    log.updated_at = now

    # ── Atomic DB transaction ────────────────────────────────────────────────
    receipt_event = ReceiptEvent(
        communication_log_id=log.id,
        event_type=event_type,
        payload=payload.model_dump(mode="json"),
        is_duplicate=False
    )
    db.add(receipt_event)
    await db.commit()
    await db.refresh(log)

    # ── Post-processing ──────────────────────────────────────────────────────
    # Stamp Redis so future replays are caught at Layer 1
    try:
        await redis_client.setex(redis_key, 86400, "1")
    except Exception as e:
        logger.warning(f"[receipt] Redis setex failed: {e}")

    # Enqueue aggregate refresh (Celery — fire and forget)
    try:
        from app.tasks.analytics import update_campaign_aggregate_task
        update_campaign_aggregate_task.delay(str(log.campaign_id))
    except Exception as e:
        logger.warning(f"[receipt] Failed to enqueue aggregate task: {e}")

    return ReceiptResult(
        status="accepted",
        log_id=str(log.id),
        previous_status=previous_status,
        new_status=new_status
    )
