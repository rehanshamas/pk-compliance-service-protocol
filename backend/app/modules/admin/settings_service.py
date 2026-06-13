"""Admin system settings service — runtime configuration management."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_settings import SystemSetting

# Default settings with categories and descriptions
DEFAULT_SETTINGS = [
    # Platform
    ("platform_name", "CIP", False, "platform", "Platform display name"),
    ("default_currency", "PKR", False, "platform", "Default currency for reporting and thresholds"),
    ("ctr_threshold_amount", "2000000", False, "compliance", "Currency Transaction Report threshold amount"),
    ("sanctions_screening_enabled", "true", False, "compliance", "Enable sanctions screening for customers"),
    ("pep_screening_enabled", "true", False, "compliance", "Enable PEP screening for customers"),
    ("analytics_l1_enabled", "true", False, "analytics", "Enable Layer 1 on-chain analytics (basic)"),
    ("analytics_l2_enabled", "true", False, "analytics", "Enable Layer 2 on-chain analytics (Subsquid)"),
    # SMTP
    ("smtp_host", "", False, "smtp", "SMTP server hostname"),
    ("smtp_port", "587", False, "smtp", "SMTP server port"),
    ("smtp_user", "", False, "smtp", "SMTP username"),
    ("smtp_password", "", True, "smtp", "SMTP password"),
    ("smtp_from_email", "noreply@paiso.io", False, "smtp", "Sender email address"),
    ("smtp_enabled", "false", False, "smtp", "Enable email notifications"),
    # Analytics Layer 3
    ("analytics_l3_provider", "mock", False, "analytics", "Commercial analytics provider: mock | scorechain | trm | chainalysis"),
    ("analytics_l3_api_key", "", True, "analytics", "Commercial analytics API key"),
    ("analytics_l3_api_url", "", False, "analytics", "Commercial analytics API base URL"),
    ("analytics_l3_enabled", "false", False, "analytics", "Enable Layer 3 commercial analytics"),
    # Subsquid
    ("subsquid_mode", "public", False, "subsquid", "Subsquid mode: public | cloud"),
    ("subsquid_cloud_url", "", False, "subsquid", "Subsquid Cloud deployment URL (for cloud mode)"),
    ("subsquid_api_key", "", True, "subsquid", "Subsquid Cloud API key"),
    # OpenSanctions
    ("opensanctions_mode", "free", False, "sanctions", "OpenSanctions mode: free | commercial"),
    ("opensanctions_api_key", "", True, "sanctions", "OpenSanctions commercial API key"),
    # Trial limits
    ("trial_quota_per_service", "10", False, "billing", "Default trial quota per service (calls)"),
    ("grace_period_hours", "48", False, "billing", "Default grace period for soft quota (hours)"),
    # Identity verification routing
    ("identity_primary_provider", "nadra", False, "identity", "Primary identity provider: nadra | shufti"),
    ("identity_fallback_provider", "shufti", False, "identity", "Fallback identity provider: nadra | shufti | none"),
    ("identity_fallback_trigger", "error", False, "identity", "Fallback trigger: timeout | error | low_confidence | always_both"),
    ("identity_fallback_timeout_ms", "5000", False, "identity", "Timeout threshold for fallback trigger (ms)"),
    ("identity_fallback_confidence_threshold", "70", False, "identity", "Confidence threshold below which fallback triggers (%)"),
    # Notification preferences
    ("notif_admin_email_enabled", "true", False, "notifications", "Enable admin email notifications"),
    ("notif_admin_email_on_application", "true", False, "notifications", "Email admin on new VASP application"),
    ("notif_admin_email_on_pipeline_failure", "true", False, "notifications", "Email admin on pipeline ingestion failure"),
    ("notif_admin_email_on_system_health", "false", False, "notifications", "Email admin on system health degradation"),
    ("notif_tenant_email_alerts_enabled", "true", False, "notifications", "Enable tenant MLRO email alerts"),
    ("notif_tenant_webhook_enabled", "true", False, "notifications", "Enable tenant webhook event delivery"),
    ("notif_tenant_daily_digest", "false", False, "notifications", "Send daily digest email to tenant MLROs"),
    ("notif_smtp_provider", "sendgrid", False, "notifications", "SMTP provider: sendgrid | custom"),
    # AI Chat Assistant
    ("chat_assistant_enabled", "true", False, "chat", "Enable AI chat assistant for VASP dashboards"),
    ("chat_assistant_welcome", "Hi! I'm your CIP assistant. Ask me about KYC, screening, analytics, cases, reports, or any compliance workflow.", False, "chat", "Welcome message for chat assistant"),
    # VASP Settings Visibility (admin can toggle what VASPs see in their Settings section)
    ("vasp_settings_team_enabled", "true", False, "vasp_config", "VASPs can see Team settings"),
    ("vasp_settings_api_keys_enabled", "true", False, "vasp_config", "VASPs can see API Keys"),
    ("vasp_settings_webhooks_enabled", "true", False, "vasp_config", "VASPs can see Webhooks"),
    ("vasp_settings_screening_enabled", "true", False, "vasp_config", "VASPs can see Screening Config"),
    ("vasp_settings_monitoring_enabled", "true", False, "vasp_config", "VASPs can see Monitoring Rules"),
    ("vasp_settings_retention_enabled", "true", False, "vasp_config", "VASPs can see Record Retention"),
    ("vasp_settings_analytics_enabled", "true", False, "vasp_config", "VASPs can see Analytics settings"),
    ("vasp_settings_billing_enabled", "true", False, "vasp_config", "VASPs can see Usage & Billing"),
    ("vasp_settings_api_explorer_enabled", "true", False, "vasp_config", "VASPs can see API Explorer"),
]


class SystemSettingsService:

    async def initialize_defaults(self, db: AsyncSession) -> None:
        """Ensure all default settings exist. Called on app startup."""
        for key, default_value, is_secret, category, description in DEFAULT_SETTINGS:
            result = await db.execute(
                select(SystemSetting).where(SystemSetting.key == key)
            )
            if not result.scalar_one_or_none():
                db.add(SystemSetting(
                    key=key, value=default_value, is_secret=is_secret,
                    category=category, description=description,
                ))
        await db.flush()

    async def get_all(self, db: AsyncSession, category: str | None = None) -> list[dict]:
        """Get all settings, masking secret values."""
        query = select(SystemSetting)
        if category:
            query = query.where(SystemSetting.category == category)
        query = query.order_by(SystemSetting.category, SystemSetting.key)
        result = await db.execute(query)
        settings = []
        for s in result.scalars().all():
            settings.append({
                "key": s.key,
                "value": "••••••••" if s.is_secret and s.value else s.value,
                "is_secret": s.is_secret,
                "description": s.description,
                "category": s.category,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            })
        return settings

    async def get(self, db: AsyncSession, key: str) -> str:
        """Get a single setting value (unmasked, for internal use)."""
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        return setting.value if setting else ""

    async def get_bool(self, db: AsyncSession, key: str) -> bool:
        """Get a boolean setting."""
        val = await self.get(db, key)
        return val.lower() in ("true", "1", "yes", "on")

    async def update(self, db: AsyncSession, key: str, value: str) -> dict:
        """Update a setting value. Returns the updated setting."""
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if not setting:
            raise ValueError(f"Unknown setting: {key}")
        setting.value = value
        return {
            "key": setting.key,
            "value": "••••••••" if setting.is_secret else setting.value,
            "category": setting.category,
            "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
        }

    async def bulk_update(self, db: AsyncSession, updates: dict[str, str]) -> list[dict]:
        """Update multiple settings at once."""
        results = []
        for key, value in updates.items():
            results.append(await self.update(db, key, value))
        return results

    VASP_CONFIG_KEYS = [
        "vasp_settings_team_enabled",
        "vasp_settings_api_keys_enabled",
        "vasp_settings_webhooks_enabled",
        "vasp_settings_screening_enabled",
        "vasp_settings_monitoring_enabled",
        "vasp_settings_retention_enabled",
        "vasp_settings_analytics_enabled",
        "vasp_settings_billing_enabled",
        "vasp_settings_api_explorer_enabled",
    ]

    async def get_vasp_config(self, db: AsyncSession) -> dict[str, bool]:
        """Get VASP settings visibility config as key -> bool."""
        result = {}
        for key in self.VASP_CONFIG_KEYS:
            result[key] = await self.get_bool(db, key)
        return result

    async def update_vasp_config(self, db: AsyncSession, updates: dict[str, bool]) -> dict[str, bool]:
        """Update VASP settings visibility. Only accepts known keys."""
        for key, val in updates.items():
            if key in self.VASP_CONFIG_KEYS:
                await self.update(db, key, "true" if val else "false")
        return await self.get_vasp_config(db)


system_settings_service = SystemSettingsService()
