from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.order import OrderCreate, OrderResponse
from app.services.customer_service import CustomerService
from app.utils.jwt import get_current_user
from app.utils.pagination import paginate, PaginatedResponse
from app.models import Order, User
import uuid
import math

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Order).order_by(Order.ordered_at.desc())
    items, total = await paginate(db, query, page, size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 0
    }

@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = Order(**data.model_dump())
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    await CustomerService.recalculate_stats(db, order.customer_id)
    
    return order

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("/import", status_code=200)
async def import_orders(
    data: list[OrderCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = 0
    customer_ids = set()
    for order_data in data:
        order = Order(**order_data.model_dump())
        db.add(order)
        customer_ids.add(order.customer_id)
        count += 1
    
    await db.commit()
    
    for cid in customer_ids:
        await CustomerService.recalculate_stats(db, cid)
        
    return {"imported_count": count}
