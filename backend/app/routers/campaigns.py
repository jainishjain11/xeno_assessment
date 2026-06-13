from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.campaign import CampaignCreate, CampaignResponse, CampaignStatsResponse, CommunicationLogResponse
from app.services.campaign_service import CampaignService
from app.utils.jwt import get_current_user
from app.utils.pagination import paginate, PaginatedResponse
from app.models import User
import uuid
import math

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    data: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await CampaignService.create_campaign(db, data, current_user.id)

@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
async def launch_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await CampaignService.launch_campaign(db, campaign_id)

@router.get("/{campaign_id}/stats", response_model=CampaignStatsResponse)
async def get_campaign_stats(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await CampaignService.get_campaign_stats(db, campaign_id)

@router.get("/{campaign_id}/logs", response_model=PaginatedResponse[CommunicationLogResponse])
async def get_communication_logs(
    campaign_id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_stmt = CampaignService.get_communication_logs_query(campaign_id)
    items, total = await paginate(db, query_stmt, page, size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 0
    }
