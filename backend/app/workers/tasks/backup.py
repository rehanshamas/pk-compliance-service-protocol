"""Automated database backup task."""

import subprocess
from datetime import datetime, timezone

from app.workers.celery_app import celery_app


@celery_app.task(name="tasks.daily_backup")
def daily_backup():
    """Dump PostgreSQL database to timestamped file."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"/backups/cip_backup_{timestamp}.sql.gz"

    try:
        result = subprocess.run(
            ["pg_dump", "-U", "cip", "-h", "postgres", "cip"],
            capture_output=True,
            timeout=300,
        )
        if result.returncode == 0:
            import gzip
            with gzip.open(filename, "wb") as f:
                f.write(result.stdout)
            return {"status": "success", "file": filename}
        return {"status": "error", "stderr": result.stderr.decode()[:500]}
    except Exception as e:
        return {"status": "error", "error": str(e)}
