from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Segment
from app.schemas.segment import SegmentCreate
from app.utils.filter_compiler import build_segment_query, validate_rules
from fastapi import HTTPException
import uuid

class SegmentService:
    @staticmethod
    async def create_segment(db: AsyncSession, data: SegmentCreate) -> Segment:
        errors = validate_rules(data.filter_rules)
        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})
            
        segment = Segment(**data.model_dump())
        db.add(segment)
        await db.commit()
        await db.refresh(segment)
        await SegmentService.refresh_audience_size(db, segment.id)
        return segment

    @staticmethod
    def get_segments_query():
        return select(Segment).order_by(Segment.created_at.desc())

    @staticmethod
    async def get_segment(db: AsyncSession, segment_id: uuid.UUID) -> Segment | None:
        result = await db.execute(select(Segment).where(Segment.id == segment_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def preview_segment(db: AsyncSession, filter_rules: dict) -> tuple[str, int, list[dict]]:
        errors = validate_rules(filter_rules)
        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})
            
        query = build_segment_query(filter_rules)
        count_query = select(func.count()).select_from(query.subquery())
        
        # We can compile the query to string to show the user, using postgresql dialect if possible
        from sqlalchemy.dialects import postgresql
        compiled_sql = str(query.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Get sample
        sample_query = query.limit(10)
        sample_result = await db.execute(sample_query)
        sample_customers = sample_result.scalars().all()
        # Convert to dicts or let FastAPI serialize them? We'll return dicts or objects. 
        # Actually returning objects is fine if we convert them to dicts so pydantic parses them.
        # But wait, we can just return the SQLAlchemy models and FastAPI will serialize them.
        # But wait, SegmentPreviewResponse doesn't have a sample field defined! We need to add it to schema.
        # Wait, if we return models, it's fine. We will return them.
        
        return compiled_sql, total, list(sample_customers)

    @staticmethod
    async def refresh_audience_size(db: AsyncSession, segment_id: uuid.UUID) -> int:
        segment = await SegmentService.get_segment(db, segment_id)
        if not segment:
            return 0
        
        query = build_segment_query(segment.filter_rules)
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        segment.audience_size = total
        await db.commit()
        await db.refresh(segment)
        return total
