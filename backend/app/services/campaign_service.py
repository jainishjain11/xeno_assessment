from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models import Campaign, Segment, CommunicationLog
from app.schemas.campaign import CampaignCreate
from fastapi import HTTPException
import uuid

class CampaignService:
    @staticmethod
    def get_campaigns_query(status: str | None = None):
        query = select(Campaign).order_by(Campaign.created_at.desc())
        if status:
            query = query.where(Campaign.status == status)
        return query

    @staticmethod
    async def get_campaign_or_404(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign

    @staticmethod
    async def create_campaign(db: AsyncSession, data: CampaignCreate, user_id: uuid.UUID) -> Campaign:
        result = await db.execute(select(Segment).where(Segment.id == data.segment_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Segment not found")
            
        campaign = Campaign(
            name=data.name,
            segment_id=data.segment_id,
            channel=data.channel,
            message_template=data.message_template,
            status="draft"
        )
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def launch_campaign(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
            
        if campaign.status != "draft":
            raise HTTPException(status_code=400, detail="Campaign is not in draft status")
            
        campaign.status = "running"
        await db.commit()
        await db.refresh(campaign)
        
        try:
            import celery_app  # Force celery app to initialize with our settings
            from app.tasks.dispatch import dispatch_campaign_task
            dispatch_campaign_task.delay(str(campaign_id))
        except Exception as e:
            import traceback
            err = traceback.format_exc()
            raise HTTPException(status_code=400, detail=f"Celery Error: {e}\n{err}")
        
        return campaign

    @staticmethod
    async def get_campaign_stats(db: AsyncSession, campaign_id: uuid.UUID):
        result = await db.execute(
            text("SELECT * FROM campaign_funnel_stats WHERE campaign_id = :id"),
            {"id": campaign_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Stats not found")
        
        return dict(row._mapping)

    @staticmethod
    def get_communication_logs_query(campaign_id: uuid.UUID):
        return select(CommunicationLog).where(CommunicationLog.campaign_id == campaign_id).order_by(CommunicationLog.created_at.desc())
