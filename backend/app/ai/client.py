"""
backend/app/ai/client.py
Anthropic wrapper with retry logic, streaming, and Pydantic validation.
"""
import json
import logging
from typing import AsyncGenerator

import anthropic
from fastapi import HTTPException

from app.config import Settings
from app.ai.prompts import (
    INTENT_PARSE_SYSTEM_PROMPT,
    MESSAGE_DRAFT_SYSTEM_PROMPT,
    CHAT_AGENT_SYSTEM_PROMPT,
)
from app.schemas.ai import IntentParseResult, MessageDraftRequest

logger = logging.getLogger(__name__)
settings = Settings()

# Lazy singleton — instantiated on first call so tests can patch the key
_client: anthropic.AsyncAnthropic | None = None

def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client

MODEL = "claude-sonnet-4-5"


# ── Intent parse ──────────────────────────────────────────────────────────────

async def parse_intent(prompt: str, context: dict | None = None) -> IntentParseResult:
    """
    Translate a natural-language marketing prompt into a structured
    IntentParseResult (segment_rules + message_draft + metadata).

    Retries once on JSON parse failure, appending the error to help the model
    self-correct. Raises HTTPException 422 on second failure.
    """
    client = _get_client()
    ctx_str = json.dumps(context or {}, ensure_ascii=False)
    user_message = f"{prompt}\n\nContext: {ctx_str}"

    for attempt in range(2):
        if attempt == 1:
            user_message += (
                f"\n\n[SYSTEM NOTE] Your previous response was not valid JSON. "
                f"Error: {last_error}. "
                "Return ONLY the raw JSON object — no markdown, no explanation."
            )

        response = await client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=INTENT_PARSE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if model disobeys instructions
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            data = json.loads(raw)
            return IntentParseResult(**data)
        except (json.JSONDecodeError, Exception) as exc:
            last_error = str(exc)
            logger.warning(f"[AI] parse_intent attempt {attempt + 1} failed: {exc}")

    raise HTTPException(
        status_code=422,
        detail="AI returned invalid JSON after 2 attempts. Please rephrase your prompt."
    )


# ── Message draft ─────────────────────────────────────────────────────────────

async def draft_message(req: MessageDraftRequest) -> str:
    """
    Generate a channel-aware personalised message for the given audience.
    Returns raw message text (no JSON wrapper).
    """
    client = _get_client()
    user_content = (
        f"Channel: {req.channel}\n"
        f"Brand: {req.brand_context}\n"
        f"Audience description: {req.audience_description}"
    )
    if req.tone:
        user_content += f"\nTone: {req.tone}"

    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=MESSAGE_DRAFT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text.strip()


# ── Chat stream ───────────────────────────────────────────────────────────────

async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    """
    Stream chat tokens from Claude using the CHAT_AGENT_SYSTEM_PROMPT.
    Yields each text delta as it arrives for SSE streaming.
    """
    client = _get_client()

    async with client.messages.stream(
        model=MODEL,
        max_tokens=2048,
        system=CHAT_AGENT_SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
