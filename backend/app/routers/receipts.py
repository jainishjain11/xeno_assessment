import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.receipt import ReceiptCallback
from app.services.receipt_service import process_receipt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receipts", tags=["receipts"])

# Dependency: async Redis client (created once per request from app state)
async def get_redis(request: Request):
    return request.app.state.redis


@router.post("/callback")
async def receipt_callback(
    payload: ReceiptCallback,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis)
):
    """
    Channel-stub posts delivery events here.
    ALWAYS returns 200 OK — never 4xx/5xx to the caller.
    Rate limited to 1000/min per IP via slowapi (configured in main.py).
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        f"[receipt] Incoming event_type={payload.event_type} "
        f"log_id={payload.communication_log_id} event_id={payload.event_id} from {client_ip}"
    )

    try:
        result = await process_receipt(db=db, redis_client=redis_client, payload=payload)
        return result.model_dump(exclude_none=True)
    except Exception as e:
        # Catch everything — never return a 5xx to channel stub
        logger.error(f"[receipt] Unhandled error in receipt_callback: {e}", exc_info=True)
        return {
            "status": "accepted",
            "log_id": str(payload.communication_log_id),
            "detail": "internal error logged"
        }
