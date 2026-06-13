#!/usr/bin/env python3
"""
Phase 8.4: Enable S3/MinIO bucket versioning for cip-records.
Run from compliance/: make s3-versioning
Requires: boto3, backend .env (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET).
"""
import sys
from pathlib import Path

# Ensure backend/app is importable
backend = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(backend))

def main() -> None:
    from app.config import settings
    from app.core.storage import get_s3_client

    client = get_s3_client()
    bucket = settings.s3_bucket
    try:
        client.put_bucket_versioning(
            Bucket=bucket,
            VersioningConfiguration={
                "Status": "Enabled",
            },
        )
        print(f"Versioning enabled on bucket: {bucket}")
    except Exception as e:
        err_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if err_code == "NoSuchBucket":
            print(f"Bucket {bucket} does not exist. Create it first (e.g. upload a file via the app).", file=sys.stderr)
        else:
            print(f"Failed to enable versioning: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
