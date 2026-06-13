"""SQLAlchemy models. Import all for Alembic."""

from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.usage_event import UsageEvent
from app.models.screening import (
    BatchJob,
    MatchDisposition,
    ScreeningResult,
    WatchlistEntry,
    WatchlistSource,
)
from app.models.notification import Notification
from app.models.tenant import Tenant, User, TenantStatus, UserRole, VaspApplication
from app.modules.identity.models import (
    BeneficialOwner,
    Customer,
    DocumentType,
    EddCase,
    EddApprovalStatus,
    FreezeRecord,
    IdentityDocument,
    KycStatus,
    RiskTier,
    ShuftiPendingVerification,
    VerificationResult,
    VerificationStatus,
    VerificationType,
)
from app.modules.compliance.models import (
    Case,
    CaseAlertLink,
    CaseCustomerLink,
    CaseNote,
    CaseStatus,
    Isar,
    IsarStatus,
)
from app.modules.analytics.models import Wallet, WalletRiskScore
from app.models.incident import (
    Incident,
    IncidentCategory,
    IncidentSeverity,
    IncidentStatus,
)
from app.models.monitoring_rule import (
    MonitoringRule,
    MonitoringRuleSeverity,
    MonitoringRuleType,
)
from app.models.system_settings import SystemSetting
from app.models.billing import (
    BillingCycle,
    Invoice,
    InvoiceStatus,
    PricingRule,
    ServicePlan,
    ServiceType,
    ServiceUsageSummary,
    TenantSubscription,
)

__all__ = [
    "Case",
    "CaseAlertLink",
    "CaseCustomerLink",
    "CaseNote",
    "CaseStatus",
    "Isar",
    "IsarStatus",
    "Alert",
    "AuditLog",
    "BeneficialOwner",
    "BatchJob",
    "Customer",
    "DocumentType",
    "EddCase",
    "EddApprovalStatus",
    "FreezeRecord",
    "IdentityDocument",
    "KycStatus",
    "MatchDisposition",
    "Notification",
    "RiskTier",
    "ScreeningResult",
    "Tenant",
    "User",
    "TenantStatus",
    "UserRole",
    "VerificationResult",
    "VerificationStatus",
    "VerificationType",
    "WatchlistEntry",
    "WatchlistSource",
    "Wallet",
    "WalletRiskScore",
    "MonitoringRule",
    "MonitoringRuleSeverity",
    "MonitoringRuleType",
    "BillingCycle",
    "Invoice",
    "InvoiceStatus",
    "PricingRule",
    "ServicePlan",
    "ServiceType",
    "ServiceUsageSummary",
    "TenantSubscription",
    "SystemSetting",
    "VaspApplication",
    "Incident",
    "IncidentCategory",
    "IncidentSeverity",
    "IncidentStatus",
]
