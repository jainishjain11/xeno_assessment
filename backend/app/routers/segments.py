from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.segment import SegmentCreate, SegmentResponse, SegmentPreviewResponse
from app.services.segment_service import SegmentService
from app.utils.jwt import get_current_user
from app.utils.pagination import paginate, PaginatedResponse
from app.models import User
from typing import Any
import uuid
import math

router = APIRouter(prefix="/segments", tags=["segments"])

@router.get("", response_model=PaginatedResponse[SegmentResponse])
async def list_segments(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_stmt = SegmentService.get_segments_query()
    items, total = await paginate(db, query_stmt, page, size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 0
    }

@router.post("", response_model=SegmentResponse, status_code=201)
async def create_segment(
    data: SegmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await SegmentService.create_segment(db, data)

@router.post("/preview", response_model=SegmentPreviewResponse)
async def preview_segment(
    filter_rules: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sql_query, count = await SegmentService.preview_segment(db, filter_rules)
    return {"sql_query": sql_query, "estimated_count": count}

@router.get("/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    segment = await SegmentService.get_segment(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment
