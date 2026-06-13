import time
import json
import httpx
from celery import shared_task
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from app.database import SyncSessionLocal
from app.models import Campaign, Segment, Customer, CommunicationLog
from app.utils.filter_compiler import build_segment_query
from app.config import Settings
import logging

settings = Settings()
logger = logging.getLogger(__name__)

def resolve_template(template: str, customer: Customer) -> str:
    msg = template
    msg = msg.replace("{{name}}", customer.name or "")
    first_name = customer.name.split(" ")[0] if customer.name else ""
    msg = msg.replace("{{first_name}}", first_name)
    msg = msg.replace("{{total_spent}}", str(customer.total_spent) if customer.total_spent is not None else "0")
    msg = msg.replace("{{city}}", customer.city or "")
    return msg

@shared_task(name="app.tasks.dispatch.dispatch_campaign_task")
def dispatch_campaign_task(campaign_id: str):
    db = SyncSessionLocal()
    try:
        # Load campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign or campaign.status != "running":
            logger.info(f"Campaign {campaign_id} not found or not in running state")
            return
            
        # Load segment
        segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
        if not segment:
            logger.error(f"Segment not found for campaign {campaign_id}")
            campaign.status = "failed"
            db.commit()
            return
            
        # Execute segment query
        query = build_segment_query(segment.filter_rules)
        customers = db.execute(query).scalars().all()
        
        # Snapshot customer IDs
        customer_ids = [str(c.id) for c in customers]
        campaign.audience_snapshot = customer_ids
        db.commit()
        
        # Dispatch process
        with httpx.Client() as client:
            for customer in customers:
                idempotency_key = f"{campaign.id}:{customer.id}"
                
                # Render message
                message_body = resolve_template(campaign.message_template, customer)
                
                # Insert log idempotently
                stmt = insert(CommunicationLog).values(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    channel=campaign.channel,
                    message_body=message_body,
                    status="queued",
                    idempotency_key=idempotency_key
                )
                stmt = stmt.on_conflict_do_nothing(index_elements=['idempotency_key']).returning(CommunicationLog.id)
                result = db.execute(stmt)
                db.commit()
                
                inserted_log_id = result.scalar()
                
                # If ON CONFLICT DO NOTHING triggered, it returns None
                if not inserted_log_id:
                    continue
                
                # POST to channel stub with retries
                payload = {
                    "log_id": str(inserted_log_id),
                    "channel": campaign.channel,
                    "customer_id": str(customer.id),
                    "message": message_body
                }
                
                delays = [5, 25, 125]
                success = False
                for i in range(4):
                    try:
                        resp = client.post(f"{settings.channel_stub_url}/send", json=payload, timeout=10.0)
                        resp.raise_for_status()
                        
                        # Update status to sent
                        db.execute(
                            update(CommunicationLog)
                            .where(CommunicationLog.id == inserted_log_id)
                            .values(status="sent", external_ref=resp.json().get("msg_id", ""))
                        )
                        db.commit()
                        success = True
                        break
                    except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                        logger.warning(f"Failed to send to channel stub for log {inserted_log_id}. Attempt {i+1}/4. Error: {exc}")
                        if i < 3:
                            time.sleep(delays[i])
                        else:
                            # Log failed status
                            db.execute(
                                update(CommunicationLog)
                                .where(CommunicationLog.id == inserted_log_id)
                                .values(status="failed", failure_reason=str(exc))
                            )
                            db.commit()
                            
        # Update campaign to completed
        campaign.status = "completed"
        db.commit()
        logger.info(f"Successfully completed campaign {campaign_id}")
        
    except Exception as e:
        logger.error(f"Error executing dispatch_campaign_task for {campaign_id}: {e}")
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "failed"
            db.commit()
        raise e
    finally:
        db.close()
