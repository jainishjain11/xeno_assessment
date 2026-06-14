"""
backend/app/ai/client.py
Google Gemini wrapper with retry logic, streaming, and Pydantic validation.
"""
import json
import logging
from typing import AsyncGenerator

from google import genai
from google.genai import types
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

# Lazy singleton
_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client

MODEL = "gemini-2.5-flash"


# ── Intent parse ──────────────────────────────────────────────────────────────

async def parse_intent(prompt: str, context: dict | None = None) -> IntentParseResult:
    """
    Translate a natural-language marketing prompt into a structured
    IntentParseResult (segment_rules + message_draft + metadata).

    Retries once on JSON parse failure.
    """
    client = _get_client()
    ctx_str = json.dumps(context or {}, ensure_ascii=False)
    user_message = f"{prompt}\n\nContext: {ctx_str}"

    last_error = ""
    for attempt in range(2):
        if attempt == 1:
            user_message += (
                f"\n\n[SYSTEM NOTE] Your previous response was not valid JSON. "
                f"Error: {last_error}. "
                "Return ONLY the raw JSON object — no markdown, no explanation."
            )

        config = types.GenerateContentConfig(
            system_instruction=INTENT_PARSE_SYSTEM_PROMPT,
            temperature=0.0
        )
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=user_message,
            config=config
        )

        raw = response.text.strip()
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

    config = types.GenerateContentConfig(
        system_instruction=MESSAGE_DRAFT_SYSTEM_PROMPT,
        temperature=0.7
    )
    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user_content,
        config=config
    )
    return response.text.strip()


# ── Chat stream ───────────────────────────────────────────────────────────────

async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    """
    Stream chat tokens from Gemini using the CHAT_AGENT_SYSTEM_PROMPT.
    Yields each text delta as it arrives for SSE streaming.
    """
    client = _get_client()

    config = types.GenerateContentConfig(
        system_instruction=CHAT_AGENT_SYSTEM_PROMPT,
        temperature=0.7
    )

    # Map messages to Gemini format
    gemini_messages = []
    for m in messages:
        role = "user" if m.get("role") == "user" else "model"
        gemini_messages.append({"role": role, "parts": [{"text": m.get("content")}]})

    response_stream = await client.aio.models.generate_content_stream(
        model=MODEL,
        contents=gemini_messages,
        config=config
    )

    async for chunk in response_stream:
        if chunk.text:
            yield chunk.text
