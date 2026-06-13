import json
import logging
from datetime import datetime, timezone
from celery import shared_task
from app.database import SyncSessionLocal

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.analytics.update_campaign_aggregate_task")
def update_campaign_aggregate_task(campaign_id: str):
    """
    1. Query campaign_funnel_stats view for this campaign_id.
    2. Cache the result in Redis: SET campaign:stats:{campaign_id} <json> EX 3600
    3. Publish to Redis pubsub: PUBLISH sse:channel:{campaign_id} <json>
    """
    import redis as redis_lib
    from app.config import Settings
    from sqlalchemy import text

    settings = Settings()
    db = SyncSessionLocal()
    r = redis_lib.from_url(settings.redis_url, decode_responses=True)

    try:
        result = db.execute(
            text("SELECT * FROM campaign_funnel_stats WHERE campaign_id = :id"),
            {"id": campaign_id}
        )
        row = result.fetchone()
        if not row:
            logger.info(f"[analytics] No funnel stats yet for campaign {campaign_id}")
            return

        stats = dict(row._mapping)
        # UUIDs are not JSON-serializable by default
        stats["campaign_id"] = str(stats["campaign_id"])
        payload = json.dumps(stats)

        redis_key = f"campaign:stats:{campaign_id}"
        r.set(redis_key, payload, ex=3600)
        r.publish(f"sse:channel:{campaign_id}", payload)

        logger.info(f"[analytics] Published stats for campaign {campaign_id}")
    except Exception as e:
        logger.error(f"[analytics] update_campaign_aggregate_task failed: {e}")
        raise
    finally:
        db.close()
        r.close()
