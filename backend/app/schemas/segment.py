from pydantic import BaseModel
from typing import Any
from datetime import datetime
import uuid

class SegmentBase(BaseModel):
    name: str
    description: str | None = None
    filter_rules: dict[str, Any]

class SegmentCreate(SegmentBase):
    pass

class SegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    filter_rules: dict[str, Any] | None = None

class SegmentResponse(SegmentBase):
    id: uuid.UUID
    audience_size: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SegmentPreviewResponse(BaseModel):
    sql_query: str
    estimated_count: int
    count: int | None = None
    sample: list[Any] = []

    class Config:
        from_attributes = True
