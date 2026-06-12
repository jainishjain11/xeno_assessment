from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid

class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    external_id: str | None = None
    phone: str | None = None
    city: str | None = None
    tags: list[str] = []

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    external_id: str | None = None
    phone: str | None = None
    city: str | None = None
    tags: list[str] | None = None

class CustomerResponse(CustomerBase):
    id: uuid.UUID
    total_spent: float
    order_count: int
    last_order_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CustomerBulkImport(BaseModel):
    customers: list[CustomerCreate]
