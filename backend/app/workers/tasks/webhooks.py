"""Celery tasks for webhook delivery with retry."""

from app.workers.celery_app import app as celery_app
from app.core.webhooks import deliver_webhook_sync


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,  # 10s, 20s, 40s (exponential via retry backoff)
    acks_late=True,
)
def deliver_webhook_task(self, webhook_url: str, event_type: str, data: dict, api_key_hash: str | None = None):
    """Deliver a webhook with exponential backoff retry (3 attempts)."""
    result = deliver_webhook_sync(webhook_url, event_type, data, api_key_hash)
    if not result["success"]:
        try:
            self.retry(countdown=10 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            # Log final failure — could also create an alert
            pass
    return result
