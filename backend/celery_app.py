from celery import Celery
from app.config import Settings

settings = Settings()

celery_app = Celery(
    "crm_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.dispatch", "app.tasks.analytics"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True
)
