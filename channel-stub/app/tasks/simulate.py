import time
import random
import uuid
import httpx
from datetime import datetime
from celery import shared_task
import logging

logger = logging.getLogger(__name__)

def fire_callback(url: str, log_id: str, event_type: str, ext_ref: str, channel: str, failure_reason: str = None):
    payload = {
        "event_id": str(uuid.uuid4()),
        "communication_log_id": log_id,
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": {
            "channel": channel,
            "external_ref": ext_ref,
            "failure_reason": failure_reason
        }
    }
    
    logger.info(f"[{ext_ref}] Firing {event_type} callback to {url}")
    
    with httpx.Client() as client:
        for i in range(3):
            try:
                resp = client.post(url, json=payload, timeout=10.0)
                resp.raise_for_status()
                logger.info(f"[{ext_ref}] Successfully posted {event_type} callback.")
                return True
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                logger.warning(f"[{ext_ref}] Attempt {i+1} failed to post callback: {e}")
                if i < 2:
                    time.sleep(2)
        logger.error(f"[{ext_ref}] Exhausted all retries for {event_type} callback.")
        return False

@shared_task(name="app.tasks.simulate.simulate_delivery_task")
def simulate_delivery_task(log_id: str, callback_url: str, ext_ref: str, channel: str):
    logger.info(f"Starting simulation for log {log_id}")
    
    # Step 1: Sent
    time.sleep(random.uniform(1, 5))
    fire_callback(callback_url, log_id, "sent", ext_ref, channel)
    
    # Step 2: Delivered / Failed
    time.sleep(random.uniform(2, 8))
    is_delivered = random.random() < 0.85
    
    if not is_delivered:
        fire_callback(callback_url, log_id, "failed", ext_ref, channel, failure_reason="Simulated failure")
        return
        
    fire_callback(callback_url, log_id, "delivered", ext_ref, channel)
    
    # Step 3: Opened
    time.sleep(random.uniform(5, 15))
    is_opened = random.random() < 0.40
    if not is_opened:
        return
        
    fire_callback(callback_url, log_id, "opened", ext_ref, channel)
    
    # Step 4: Read
    time.sleep(random.uniform(2, 5))
    is_read = random.random() < 0.70
    if not is_read:
        return
        
    fire_callback(callback_url, log_id, "read", ext_ref, channel)
    
    # Step 5: Clicked
    time.sleep(random.uniform(3, 8))
    is_clicked = random.random() < 0.20
    if not is_clicked:
        return
        
    fire_callback(callback_url, log_id, "clicked", ext_ref, channel)
    
    # Step 6: Converted
    time.sleep(random.uniform(1, 3))
    is_converted = random.random() < 0.10
    if is_converted:
        fire_callback(callback_url, log_id, "converted", ext_ref, channel)
