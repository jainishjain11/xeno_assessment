import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default='{}')
    total_spent: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0", index=True)
    order_count: Mapped[int] = mapped_column(Integer, server_default="0")
    last_order_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    orders = relationship("Order", back_populates="customer", cascade="all, delete")
