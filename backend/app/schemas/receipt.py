from pydantic import BaseModel
from typing import Any
import uuid

class ReceiptCallbackMetadata(BaseModel):
    channel: str | None = None
    external_ref: str | None = None
    failure_reason: str | None = None

class ReceiptCallback(BaseModel):
    event_id: str
    communication_log_id: uuid.UUID
    event_type: str
    timestamp: str | None = None
    metadata: dict[str, Any] | None = None

class ReceiptResult(BaseModel):
    status: str   # accepted | duplicate | ignored
    log_id: str
    previous_status: str | None = None
    new_status: str | None = None
    detail: str | None = None
