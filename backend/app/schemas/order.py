from pydantic import BaseModel
from datetime import datetime
import uuid

class OrderBase(BaseModel):
    external_id: str | None = None
    amount: float
    status: str = "completed"
    channel: str | None = None
    items: list | dict = []
    ordered_at: datetime

class OrderCreate(OrderBase):
    customer_id: uuid.UUID

class OrderResponse(OrderBase):
    id: uuid.UUID
    customer_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
