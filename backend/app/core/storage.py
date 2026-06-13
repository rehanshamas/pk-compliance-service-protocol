"""S3/MinIO storage helpers for batch results."""

from app.config import settings


def get_s3_client():
    """Get boto3 S3 client configured for MinIO or AWS."""
    import boto3
    from botocore.config import Config

    config = Config(
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
    )
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=config,
        region_name="us-east-1",
    )


def upload_bytes(key: str, body: bytes, content_type: str = "text/csv") -> str:
    """Upload bytes to S3. Returns the key. Phase 8.3: SSE-S3 when s3_sse_enabled."""
    client = get_s3_client()
    kwargs = {
        "Bucket": settings.s3_bucket,
        "Key": key,
        "Body": body,
        "ContentType": content_type,
    }
    if getattr(settings, "s3_sse_enabled", False):
        kwargs["ServerSideEncryption"] = "AES256"
    client.put_object(**kwargs)
    return key


def generate_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate presigned URL for download."""
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def get_bytes(key: str) -> bytes:
    """Download object from S3/MinIO and return bytes."""
    client = get_s3_client()
    resp = client.get_object(Bucket=settings.s3_bucket, Key=key)
    return resp["Body"].read()
