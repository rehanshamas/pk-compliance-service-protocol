/**
 * Mock data for frontend development (Phase 1).
 * Realistic Pakistani names, CNIC formats, wallet addresses.
 * Replaced by API calls when backend connects.
 */

export type KycStatus =
  | "initiated"
  | "documents_uploaded"
  | "identity_verified"
  | "liveness_checked"
  | "risk_scored"
  | "approved"
  | "rejected"
  | "edd_required"
  | "edd_in_progress";

export type RiskTier = "low" | "medium" | "high" | "prohibited";

export type DispositionStatus = "pending" | "true_positive" | "false_positive" | "escalated";

export type CaseStatus = "open" | "investigating" | "escalated" | "closed_no_action" | "closed_str_filed";

export type IsarStatus = "draft" | "submitted_for_review" | "approved" | "rejected" | "filed_as_str";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
}

/** Extended tenant for admin view (feature flags, users count) */
export interface TenantAdmin extends Tenant {
  featureFlags: Record<string, boolean>;
  usersCount: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "mlro" | "compliance_officer" | "analyst" | "developer" | "platform_admin";
  tenantId: string | null;
  lastLoginAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  fullName: string;
  cnicNumber: string;
  dob: string;
  nationality: string;
  riskTier: RiskTier;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface ScreeningResult {
  id: string;
  tenantId: string;
  screenedEntityName: string;
  source: "UN" | "OFAC" | "EU" | "NACTA" | "PEP";
  matchScore: number;
  dispositionStatus: DispositionStatus;
  createdAt: string;
}

export interface WalletRiskScore {
  id: string;
  tenantId: string;
  address: string;
  chain: "ethereum" | "bitcoin" | "bsc";
  riskScore: number;
  riskCategory: "low" | "medium" | "high" | "severe";
  resolutionLayer: "layer_1" | "layer_2" | "layer_3";
  confidenceLevel: "high" | "medium" | "low";
  lastScoredAt: string;
}

export interface Alert {
  id: string;
  tenantId: string;
  severity: AlertSeverity;
  source: "transaction_monitoring" | "screening" | "analytics";
  summary: string;
  status: "open" | "investigating" | "escalated" | "resolved" | "false_alarm";
  assignedTo: string | null;
  createdAt: string;
}

export interface Case {
  id: string;
  tenantId: string;
  title: string;
  status: CaseStatus;
  linkedAlertsCount: number;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Isar {
  id: string;
  tenantId: string;
  subjectName: string;
  suspicionType: string;
  status: IsarStatus;
  submittedBy: string | null;
  createdAt: string;
}

export interface BatchJob {
  id: string;
  tenantId: string;
  recordsCount: number;
  status: "queued" | "processing" | "complete" | "failed";
  progressPercent: number;
  startedAt: string;
  completedAt: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface PipelineHealth {
  source: string;
  lastIngestionAt: string;
  recordsCount: number;
  status: "healthy" | "stale" | "error";
  nextRunAt: string;
}

// ——— Mock Data ———

export const MOCK_TENANT: Tenant = {
  id: "t1",
  name: "CryptoExchange PK",
  slug: "cryptoexchange-pk",
  status: "active",
};

export const MOCK_TENANTS: Tenant[] = [
  MOCK_TENANT,
  { id: "t2", name: "PakCrypto VASP", slug: "pakcrypto-vasp", status: "active" },
  { id: "t3", name: "Digital Assets Ltd", slug: "digital-assets-ltd", status: "trial" },
  { id: "t4", name: "BlockChain Pakistan", slug: "blockchain-pakistan", status: "suspended" },
];

export const MOCK_TENANTS_ADMIN: TenantAdmin[] = MOCK_TENANTS.map((t, i) => ({
  ...t,
  featureFlags: {
    identity: i < 3,
    screening: true,
    analytics: i < 2,
    compliance: true,
  },
  usersCount: [5, 3, 1, 2][i] ?? 1,
  createdAt: `2026-0${Math.max(1, 3 - i)}-01T00:00:00Z`,
}));

export const MOCK_USER: User = {
  id: "u1",
  email: "mlro@cryptoexchange.pk",
  fullName: "Ahmed Hassan",
  role: "mlro",
  tenantId: "t1",
  lastLoginAt: "2026-03-15T08:30:00Z",
};

export const MOCK_USERS_BY_TENANT: User[] = [
  MOCK_USER,
  { id: "u2", email: "compliance@cryptoexchange.pk", fullName: "Sara Khan", role: "compliance_officer", tenantId: "t1", lastLoginAt: "2026-03-14T16:00:00Z" },
  { id: "u3", email: "analyst@cryptoexchange.pk", fullName: "Imran Ali", role: "analyst", tenantId: "t1", lastLoginAt: "2026-03-15T09:00:00Z" },
  { id: "u4", email: "mlro@pakcrypto.pk", fullName: "Bilal Ahmed", role: "mlro", tenantId: "t2", lastLoginAt: "2026-03-15T08:30:00Z" },
  { id: "u5", email: "admin@digitalassets.pk", fullName: "Zain Malik", role: "mlro", tenantId: "t3", lastLoginAt: "2026-03-10T12:00:00Z" },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    tenantId: "t1",
    fullName: "Muhammad Ali Khan",
    cnicNumber: "35201-1234567-8",
    dob: "1990-05-15",
    nationality: "PK",
    riskTier: "low",
    kycStatus: "approved",
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "c2",
    tenantId: "t1",
    fullName: "Fatima Noor",
    cnicNumber: "42101-9876543-1",
    dob: "1985-11-22",
    nationality: "PK",
    riskTier: "medium",
    kycStatus: "risk_scored",
    createdAt: "2026-03-10T14:20:00Z",
  },
  {
    id: "c3",
    tenantId: "t1",
    fullName: "Hassan Raza",
    cnicNumber: "31301-4567890-2",
    dob: "1992-08-03",
    nationality: "PK",
    riskTier: "high",
    kycStatus: "edd_required",
    createdAt: "2026-03-12T09:15:00Z",
  },
  ...Array.from({ length: 47 }, (_, i) => ({
    id: `c${i + 4}`,
    tenantId: "t1",
    fullName: `Customer ${i + 4}`,
    cnicNumber: `35201-${1000000 + i}-${(i % 9) + 1}`,
    dob: "1988-01-15",
    nationality: "PK",
    riskTier: ["low", "medium", "high"][i % 3] as RiskTier,
    kycStatus: ["approved", "rejected", "initiated", "documents_uploaded"][i % 4] as KycStatus,
    createdAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T10:00:00Z`,
  })),
];

export const MOCK_SCREENING_RESULTS: ScreeningResult[] = [
  {
    id: "sr1",
    tenantId: "t1",
    screenedEntityName: "Muhammad Ali Khan",
    source: "UN",
    matchScore: 78,
    dispositionStatus: "false_positive",
    createdAt: "2026-03-14T11:00:00Z",
  },
  {
    id: "sr2",
    tenantId: "t1",
    screenedEntityName: "Abdul Rahman",
    source: "OFAC",
    matchScore: 92,
    dispositionStatus: "pending",
    createdAt: "2026-03-15T09:30:00Z",
  },
  ...Array.from({ length: 198 }, (_, i) => ({
    id: `sr${i + 3}`,
    tenantId: "t1",
    screenedEntityName: `Entity ${i + 3}`,
    source: ["UN", "OFAC", "EU", "NACTA", "PEP"][i % 5] as ScreeningResult["source"],
    matchScore: 60 + (i % 40),
    dispositionStatus: ["pending", "true_positive", "false_positive", "escalated"][i % 4] as DispositionStatus,
    createdAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T${String(10 + (i % 8)).padStart(2, "0")}:00:00Z`,
  })),
];

export const MOCK_WALLETS: WalletRiskScore[] = [
  {
    id: "w1",
    tenantId: "t1",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e",
    chain: "ethereum",
    riskScore: 12,
    riskCategory: "low",
    resolutionLayer: "layer_1",
    confidenceLevel: "high",
    lastScoredAt: "2026-03-15T08:00:00Z",
  },
  {
    id: "w2",
    tenantId: "t1",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    chain: "bitcoin",
    riskScore: 67,
    riskCategory: "high",
    resolutionLayer: "layer_2",
    confidenceLevel: "medium",
    lastScoredAt: "2026-03-14T22:00:00Z",
  },
  ...Array.from({ length: 28 }, (_, i) => ({
    id: `w${i + 3}`,
    tenantId: "t1",
    address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    chain: ["ethereum", "bitcoin", "bsc"][i % 3] as WalletRiskScore["chain"],
    riskScore: Math.floor(Math.random() * 100),
    riskCategory: ["low", "medium", "high", "severe"][Math.floor(Math.random() * 4)] as WalletRiskScore["riskCategory"],
    resolutionLayer: ["layer_1", "layer_2", "layer_3"][i % 3] as WalletRiskScore["resolutionLayer"],
    confidenceLevel: ["high", "medium", "low"][i % 3] as WalletRiskScore["confidenceLevel"],
    lastScoredAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T10:00:00Z`,
  })),
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: "a1",
    tenantId: "t1",
    severity: "critical",
    source: "screening",
    summary: "OFAC match — Abdul Rahman (92% confidence)",
    status: "open",
    assignedTo: null,
    createdAt: "2026-03-15T09:35:00Z",
  },
  {
    id: "a2",
    tenantId: "t1",
    severity: "high",
    source: "transaction_monitoring",
    summary: "PKR 2M structuring pattern detected on wallet 0x7a3...",
    status: "investigating",
    assignedTo: "Ahmed Hassan",
    createdAt: "2026-03-14T16:20:00Z",
  },
  ...Array.from({ length: 28 }, (_, i) => ({
    id: `a${i + 3}`,
    tenantId: "t1",
    severity: ["low", "medium", "high", "critical"][i % 4] as AlertSeverity,
    source: ["transaction_monitoring", "screening", "analytics"][i % 3] as Alert["source"],
    summary: `Alert ${i + 3}: Rule triggered`,
    status: ["open", "investigating", "escalated", "resolved", "false_alarm"][i % 5] as Alert["status"],
    assignedTo: i % 3 === 0 ? "Ahmed Hassan" : null,
    createdAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T${String(8 + (i % 10)).padStart(2, "0")}:00:00Z`,
  })),
];

export const MOCK_CASES: Case[] = [
  {
    id: "case1",
    tenantId: "t1",
    title: "OFAC hit — Abdul Rahman",
    status: "investigating",
    linkedAlertsCount: 2,
    assignedTo: "Ahmed Hassan",
    createdAt: "2026-03-15T09:40:00Z",
    updatedAt: "2026-03-15T10:00:00Z",
  },
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `case${i + 2}`,
    tenantId: "t1",
    title: `Case ${i + 2}`,
    status: ["open", "investigating", "escalated", "closed_no_action", "closed_str_filed"][i % 5] as CaseStatus,
    linkedAlertsCount: 1 + (i % 4),
    assignedTo: i % 2 === 0 ? "Ahmed Hassan" : null,
    createdAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T10:00:00Z`,
    updatedAt: `2026-03-${String(5 + (i % 10)).padStart(2, "0")}T10:00:00Z`,
  })),
];

export const MOCK_ISARS: Isar[] = [
  {
    id: "isar1",
    tenantId: "t1",
    subjectName: "Hassan Raza",
    suspicionType: "Structuring",
    status: "submitted_for_review",
    submittedBy: "Analyst User",
    createdAt: "2026-03-14T15:00:00Z",
  },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `isar${i + 2}`,
    tenantId: "t1",
    subjectName: `Subject ${i + 2}`,
    suspicionType: ["Structuring", "Hawala", "Sanctions match", "Fraud"][i % 4],
    status: ["draft", "submitted_for_review", "approved", "rejected", "filed_as_str"][i % 5] as IsarStatus,
    submittedBy: i % 2 === 0 ? "Analyst User" : null,
    createdAt: `2026-03-${String(1 + (i % 14)).padStart(2, "0")}T10:00:00Z`,
  })),
];

export const MOCK_BATCH_JOBS: BatchJob[] = [
  {
    id: "bj1",
    tenantId: "t1",
    recordsCount: 500,
    status: "complete",
    progressPercent: 100,
    startedAt: "2026-03-15T08:00:00Z",
    completedAt: "2026-03-15T08:12:00Z",
  },
  {
    id: "bj2",
    tenantId: "t1",
    recordsCount: 1200,
    status: "processing",
    progressPercent: 67,
    startedAt: "2026-03-15T09:00:00Z",
    completedAt: null,
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `bj${i + 3}`,
    tenantId: "t1",
    recordsCount: 200 + i * 100,
    status: ["queued", "processing", "complete", "failed"][i % 4] as BatchJob["status"],
    progressPercent: i % 4 === 2 ? 100 : i % 4 === 1 ? 30 + i * 5 : 0,
    startedAt: `2026-03-${String(10 + (i % 5)).padStart(2, "0")}T10:00:00Z`,
    completedAt: i % 4 === 2 ? `2026-03-${String(10 + (i % 5)).padStart(2, "0")}T11:00:00Z` : null,
  })),
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "alert",
    message: "New critical alert: OFAC match — Abdul Rahman",
    timestamp: "2026-03-15T09:35:00Z",
    read: false,
    link: "/dashboard/alerts",
  },
  {
    id: "n2",
    type: "isar",
    message: "ISAR #2 pending MLRO review",
    timestamp: "2026-03-15T08:00:00Z",
    read: false,
    link: "/dashboard/reports/isars",
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `n${i + 3}`,
    type: ["alert", "deadline", "case", "system"][i % 4],
    message: `Notification ${i + 3}`,
    timestamp: `2026-03-${String(14 - (i % 5)).padStart(2, "0")}T10:00:00Z`,
    read: i > 4,
    link: "/dashboard",
  })),
];

export const MOCK_PIPELINE_HEALTH: PipelineHealth[] = [
  { source: "UN", lastIngestionAt: "2026-03-15T06:00:00Z", recordsCount: 730, status: "healthy", nextRunAt: "2026-03-16T06:00:00Z" },
  { source: "OFAC", lastIngestionAt: "2026-03-15T05:30:00Z", recordsCount: 19292, status: "healthy", nextRunAt: "2026-03-15T11:30:00Z" },
  { source: "EU", lastIngestionAt: "2026-03-15T05:00:00Z", recordsCount: 2011, status: "healthy", nextRunAt: "2026-03-16T05:00:00Z" },
  { source: "NACTA", lastIngestionAt: "2026-03-14T06:00:00Z", recordsCount: 3638, status: "stale", nextRunAt: "2026-03-15T06:00:00Z" },
  { source: "PEP", lastIngestionAt: "2026-03-15T04:00:00Z", recordsCount: 1824505, status: "healthy", nextRunAt: "2026-03-16T04:00:00Z" },
];

// Aggregated stats for Overview
export const MOCK_OVERVIEW_STATS = {
  totalCustomers: MOCK_CUSTOMERS.length,
  customersByStatus: {
    approved: MOCK_CUSTOMERS.filter((c) => c.kycStatus === "approved").length,
    pending: MOCK_CUSTOMERS.filter((c) =>
      ["initiated", "documents_uploaded", "identity_verified", "liveness_checked", "risk_scored"].includes(c.kycStatus)
    ).length,
    rejected: MOCK_CUSTOMERS.filter((c) => c.kycStatus === "rejected").length,
    eddRequired: MOCK_CUSTOMERS.filter((c) => c.kycStatus === "edd_required" || c.kycStatus === "edd_in_progress").length,
  },
  screeningHitsPending: MOCK_SCREENING_RESULTS.filter((r) => r.dispositionStatus === "pending").length,
  openAlerts: MOCK_ALERTS.filter((a) => a.status === "open" || a.status === "investigating").length,
  alertsBySeverity: {
    critical: MOCK_ALERTS.filter((a) => a.severity === "critical").length,
    high: MOCK_ALERTS.filter((a) => a.severity === "high").length,
    medium: MOCK_ALERTS.filter((a) => a.severity === "medium").length,
  },
  pendingIsars: MOCK_ISARS.filter((i) => i.status === "submitted_for_review").length,
  nextDeadline: "2026-06-30", // Form A6 annual
};

export function getMockOverview() {
  const s = MOCK_OVERVIEW_STATS;
  return {
    totalCustomers: s.totalCustomers,
    approvedCustomers: s.customersByStatus.approved,
    pendingScreeningHits: s.screeningHitsPending,
    openAlerts: s.openAlerts,
    criticalAlerts: s.alertsBySeverity.critical,
    pendingISARs: s.pendingIsars,
  };
}
