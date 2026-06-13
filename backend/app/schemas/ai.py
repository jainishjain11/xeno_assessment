from pydantic import BaseModel
from typing import Any

# ── Segment intent ────────────────────────────────────────────────────────────

class IntentRequest(BaseModel):
    prompt: str
    context: dict[str, Any] | None = None

class IntentParseResult(BaseModel):
    segment_rules: dict[str, Any]
    segment_name: str
    message_draft: str
    recommended_channel: str
    reasoning: str

# ── Message draft ─────────────────────────────────────────────────────────────

class MessageDraftRequest(BaseModel):
    channel: str
    audience_description: str
    brand_context: str | None = "Aura Beauty — premium Indian beauty brand"
    tone: str | None = None

# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
