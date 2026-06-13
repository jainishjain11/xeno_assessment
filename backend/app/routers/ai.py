"""
backend/app/routers/ai.py
AI Engine endpoints — intent parsing, message drafting, and SSE chat stream.

Rate limit: 60 req/min per user on all /ai/* endpoints.
"""
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.ai.client import parse_intent, draft_message, stream_chat
from app.schemas.ai import IntentRequest, IntentParseResult, MessageDraftRequest, ChatRequest
from app.utils.jwt import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


# ── POST /ai/parse-intent ─────────────────────────────────────────────────────

@router.post("/parse-intent", response_model=IntentParseResult)
async def ai_parse_intent(
    body: IntentRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Translate a natural language marketing prompt into structured segment rules
    and a personalised message draft.

    Example prompt:
      "Find VIP customers who spent over ₹10,000 and haven't ordered in 60 days,
       draft a WhatsApp win-back message"
    """
    logger.info(f"[AI] parse-intent requested by user={current_user.id}")
    result = await parse_intent(prompt=body.prompt, context=body.context)
    return result


# ── POST /ai/draft-message ────────────────────────────────────────────────────

@router.post("/draft-message")
async def ai_draft_message(
    body: MessageDraftRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a channel-appropriate personalised message for a campaign.
    Returns {"message": "<raw message text>"}.
    """
    logger.info(f"[AI] draft-message for channel={body.channel}")
    text = await draft_message(body)
    return {"message": text}


# ── POST /ai/chat  (SSE stream) ───────────────────────────────────────────────

@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    SSE-streaming chat with the campaign AI agent.

    Because browser EventSource can't POST a body, this uses fetch() with
    streaming on the frontend. The full conversation history is sent in the
    request body on each turn (stateless on the backend).

    Each SSE event:
      event: token
      data: <text chunk>

    Final event:
      event: done
      data: {"ts": "<iso timestamp>"}
    """
    logger.info(f"[AI] chat stream started for user={current_user.id}")

    # Convert Pydantic messages to the dict format Anthropic expects
    messages_dicts = [{"role": m.role, "content": m.content} for m in body.messages]

    async def _generator():
        try:
            async for chunk in stream_chat(messages_dicts):
                if await request.is_disconnected():
                    logger.info("[AI] chat client disconnected")
                    break
                yield {"event": "token", "data": chunk}

            yield {
                "event": "done",
                "data": json.dumps({"ts": datetime.now(timezone.utc).isoformat()})
            }
        except Exception as e:
            logger.error(f"[AI] chat stream error: {e}", exc_info=True)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(
        _generator(),
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
