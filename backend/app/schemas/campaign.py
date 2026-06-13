from pydantic import BaseModel
from datetime import datetime
import uuid

class CampaignBase(BaseModel):
    name: str
    segment_id: uuid.UUID
    channel: str
    message_template: str

class CampaignCreate(CampaignBase):
    pass

class CampaignResponse(CampaignBase):
    id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CampaignStatsResponse(BaseModel):
    campaign_id: uuid.UUID
    total_sent: int
    total_delivered: int
    total_failed: int
    total_opened: int
    total_read: int
    total_clicked: int
    total_converted: int
    delivery_rate: float | None
    open_rate: float | None
    ctr: float | None

class CommunicationLogResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    customer_id: uuid.UUID
    channel: str
    message_body: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
