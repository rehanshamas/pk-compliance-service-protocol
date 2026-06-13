"""Application configuration from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


@lru_cache(maxsize=2)
def _read_pem(path: str) -> str:
    """Read a PEM file once and cache the contents."""
    return Path(path).read_text()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://cip:cip@localhost:5432/cip"
    database_url_sync: str = "postgresql://cip:cip@localhost:5432/cip"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_private_key_path: str = "jwt_private.pem"
    jwt_public_key_path: str = "jwt_public.pem"
    jwt_algorithm: str = "RS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    @property
    def jwt_private_key(self) -> str:
        """RSA private key PEM content for signing tokens."""
        return _read_pem(self.jwt_private_key_path)

    @property
    def jwt_public_key(self) -> str:
        """RSA public key PEM content for verifying tokens."""
        return _read_pem(self.jwt_public_key_path)

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Screening
    screening_fuzzy_threshold: float = 70.0

    # KYC adapters
    face_match_threshold: float = 0.55  # DeepFace distance threshold (lower = stricter)
    identity_verification_provider: str = "nadra"  # nadra | shufti — admin switch for ID verification
    nadra_adapter: str = "mock"  # mock | sandbox | real (sandbox/real use mock until credentials)
    nadra_base_url: str = ""  # NADRA sandbox/production API URL (required for real)
    nadra_client_id: str = ""  # From NADRA institutional agreement
    nadra_client_secret: str = ""  # From NADRA institutional agreement
    nadra_timeout_seconds: int = 10
    nadra_simulated_latency_ms: int = 0  # Simulated delay for mock (e.g. 200)
    # Shufti Pro e-IDV (fallback when NADRA unavailable). Register callback URL in Shufti backoffice.
    shufti_client_id: str = ""  # Shufti backoffice Client ID
    shufti_secret_key: str = ""  # Shufti backoffice Secret Key
    shufti_base_url: str = "https://api.shuftipro.com"  # API base
    shufti_callback_url: str = ""  # Full URL for webhook, e.g. https://api.example.com/api/v1/webhooks/shufti

    # Storage (MinIO/S3) — Phase 8.3
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "cip-records"
    s3_sse_enabled: bool = False  # SSE-S3 (AES256). Set True for AWS S3; MinIO needs encryption configured.
    encryption_key: str = ""  # Optional: for future field-level encryption (32-byte base64)

    # goAML (Phase 5.3)
    goaml_xsd_path: str | None = None  # Optional: validate STR XML against FMU XSD when set

    # Analytics (Phase 6.2–6.4)
    analytics_cache_enabled: bool = True
    analytics_cache_ttl_low_seconds: int = 86400  # 24h for clean (0–20)
    analytics_cache_ttl_medium_seconds: int = 21600  # 6h for medium (21–60)
    analytics_cache_ttl_high_seconds: int = 3600  # 1h for high (61–100)
    blockscout_base_url: str = "https://eth.blockscout.com"
    blockscout_api_key: str = ""  # Optional: for higher rate limits
    analytics_commercial_fallback_enabled: bool = True  # Phase 6.7: escalate to Layer 3 when L1 confidence is medium

    # Notifications (Phase 5.7)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_from_email: str = "noreply@cip.example.com"

    # Rate limiting
    rate_limit_per_minute: int = 1000  # per tenant (authenticated)
    rate_limit_unauth_per_minute: int = 60  # per IP (unauthenticated)


settings = Settings()
