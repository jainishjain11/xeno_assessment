from typing import Generic, TypeVar, Sequence
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.sql import Select

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

async def paginate(db: AsyncSession, query: Select, page: int, size: int) -> tuple[Sequence, int]:
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    paginated_query = query.offset((page - 1) * size).limit(size)
    items_result = await db.execute(paginated_query)
    items = items_result.scalars().all()
    
    return items, total
