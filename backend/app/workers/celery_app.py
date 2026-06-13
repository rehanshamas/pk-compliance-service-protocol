"""Celery application for async tasks: ingestors, batch screening."""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

app = Celery(
    "cip",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.tasks.ingesters",
        "app.workers.tasks.batch",
        "app.workers.tasks.ongoing_monitoring",
        "app.workers.tasks.webhooks",
        "app.workers.tasks.backup",
        "app.workers.tasks.wallet_monitoring",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "ingest-un-daily": {"task": "ingest_un_sanctions", "schedule": 86400.0},
        "ingest-ofac-daily": {"task": "ingest_ofac_sdn", "schedule": 86400.0},
        "ingest-eu-daily": {"task": "ingest_eu_sanctions", "schedule": 86400.0},
        "ingest-nacta-daily": {"task": "ingest_nacta_proscribed", "schedule": 86400.0},
        "ingest-pep-daily": {"task": "ingest_peps", "schedule": 86400.0},
        "ongoing-monitoring-daily": {
            "task": "run_ongoing_monitoring",
            "schedule": 86400.0,  # Daily, ~1h after ingestions
        },
        "daily-backup": {
            "task": "tasks.daily_backup",
            "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM UTC
        },
        "rescore-monitored-wallets": {
            "task": "rescore_monitored_wallets",
            "schedule": 1800.0,  # Every 30 minutes
        },
    },
)
