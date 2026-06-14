from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl
from typing import Any
import uuid
from app.tasks.simulate import simulate_delivery_task
from app.config import Settings

router = APIRouter()
settings = Settings()

class SendRequest(BaseModel):
    communication_log_id: uuid.UUID
    customer_id: uuid.UUID
    channel: str
    recipient: str | None = None
    message_body: str
    callback_url: Any | None = None

class SendResponse(BaseModel):
    status: str
    external_ref: str

@router.post("/send", response_model=SendResponse, status_code=202)
def send_message(req: SendRequest):
    external_ref = str(uuid.uuid4())
    
    callback_url = str(req.callback_url) if req.callback_url else settings.crm_receipt_url
    
    import celery_app  # Ensure Celery app is loaded with broker config
    simulate_delivery_task.delay(
        str(req.communication_log_id),
        callback_url,
        external_ref,
        req.channel
    )
    
    return {"status": "accepted", "external_ref": external_ref}
