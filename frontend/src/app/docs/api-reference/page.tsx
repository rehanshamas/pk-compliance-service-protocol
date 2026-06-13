"use client";

import Link from "next/link";
import { FlaskConical, Lock, Zap, Webhook, Shield } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
  queryParams?: string;
}

const sections: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Authentication",
    endpoints: [
      {
        method: "POST",
        path: "/v1/auth/login",
        description: "Authenticate with email and password. Returns JWT access + refresh tokens.",
        requestBody: `{
  "email": "mlro@vasp.pk",
  "password": "your_password"
}`,
        responseBody: `{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "mlro@vasp.pk",
    "fullName": "Ahmed Hassan",
    "role": "mlro",
    "tenantId": "uuid",
    "tenantName": "CryptoExchange PK"
  }
}`,
      },
      {
        method: "POST",
        path: "/v1/auth/refresh",
        description: "Refresh an expired access token using a valid refresh token.",
        requestBody: `{
  "refresh_token": "eyJhbGciOiJSUzI1NiIs..."
}`,
      },
    ],
  },
  {
    title: "Customers (KYC)",
    endpoints: [
      {
        method: "POST",
        path: "/v1/customers",
        description: "Create a new customer for KYC verification.",
        requestBody: `{
  "full_name": "Muhammad Ahmed Khan",
  "cnic_number": "42301-1234567-8",
  "dob": "1990-05-15",
  "nationality": "PK",
  "external_ref": "your-system-id-123"
}`,
        responseBody: `{
  "id": "uuid",
  "tenantId": "uuid",
  "fullName": "Muhammad Ahmed Khan",
  "cnicNumber": "42301-1234567-8",
  "riskTier": "low",
  "kycStatus": "initiated",
  "createdAt": "2026-03-19T14:32:00Z"
}`,
      },
      {
        method: "GET",
        path: "/v1/customers",
        description: "List customers with optional filters.",
        queryParams: "limit, offset, status (initiated|approved|rejected|...), risk_tier (low|medium|high), search",
      },
      {
        method: "GET",
        path: "/v1/customers/{id}",
        description: "Retrieve customer details, KYC status, and risk tier.",
      },
      {
        method: "POST",
        path: "/v1/customers/{id}/documents",
        description: "Upload an identity document (CNIC, passport, selfie). Multipart form data.",
        requestBody: `// multipart/form-data
document_type: "cnic"    // cnic | passport | selfie | driving_license
file: <binary>           // JPEG, PNG, or PDF (max 10MB)`,
      },
      {
        method: "POST",
        path: "/v1/customers/{id}/verify-nadra",
        description: "Run identity verification via NADRA e-Verisys or Shufti Pro (configured by admin).",
        responseBody: `{
  "id": "uuid",
  "verificationType": "nadra",
  "provider": "mock_nadra",
  "status": "pass",
  "confidenceScore": 1.0,
  "createdAt": "2026-03-19T14:32:00Z"
}`,
      },
      {
        method: "POST",
        path: "/v1/customers/{id}/run-kyc",
        description: "Run full KYC pipeline: NADRA verification + risk scoring in one call.",
      },
      {
        method: "POST",
        path: "/v1/customers/{id}/score-risk",
        description: "Run risk scoring for a customer. Updates risk tier and advances KYC status.",
      },
    ],
  },
  {
    title: "Screening",
    endpoints: [
      {
        method: "POST",
        path: "/v1/screening/check",
        description: "Screen a name against UN, OFAC, EU, NACTA, and PEP sanctions lists.",
        requestBody: `{
  "name": "Muhammad Ahmed Khan",
  "dob": "1990-05-15",
  "id_number": "42301-1234567-8"
}`,
        responseBody: `{
  "id": "uuid",
  "screenedEntityName": "Muhammad Ahmed Khan",
  "overallStatus": "no_match",
  "matches": [],
  "dispositionStatus": "pending",
  "createdAt": "2026-03-19T14:32:00Z"
}`,
      },
      {
        method: "GET",
        path: "/v1/screening/results",
        description: "List screening results with disposition status.",
        queryParams: "limit, offset, status (pending|true_positive|false_positive|escalated), source (un|ofac|eu|nacta|pep)",
      },
      {
        method: "POST",
        path: "/v1/screening/batch",
        description: "Upload CSV for bulk screening. Required column: name. Optional: dob, id_number.",
      },
    ],
  },
  {
    title: "Blockchain Analytics",
    endpoints: [
      {
        method: "POST",
        path: "/v1/wallets/score",
        description: "Score a wallet address for risk. Supports multi-layer analysis (L1/L2/L3).",
        requestBody: `{
  "address": "0x48f9c0b3aF7c2D4A16b52Ef11cA4D50e15CfAf41",
  "chain": "ethereum",
  "depth": "L2"
}`,
        responseBody: `{
  "address": "0x48f9...af41",
  "chain": "ethereum",
  "riskScore": 35,
  "riskCategory": "medium",
  "resolutionLayer": "layer_2",
  "confidence": "high",
  "exposureBreakdown": {
    "mixer": 5, "sanctioned": 0,
    "gambling": 10, "exchange": 60, "unknown": 25
  },
  "flaggedIndicators": ["ELEVATED_RISK"],
  "lastScoredAt": "2026-03-19T14:32:00Z"
}`,
      },
      {
        method: "GET",
        path: "/v1/wallets",
        description: "List scored wallets for your tenant.",
        queryParams: "limit, offset, riskCategory (low|medium|high|severe), chain, search",
      },
      {
        method: "GET",
        path: "/v1/wallets/{address}",
        description: "Get detailed wallet risk breakdown, exposure, counterparties, and score history.",
      },
    ],
  },
  {
    title: "Alerts & Cases",
    endpoints: [
      {
        method: "GET",
        path: "/v1/alerts",
        description: "List transaction monitoring and screening alerts.",
        queryParams: "limit, offset, severity (low|medium|high|critical), status (open|investigating|resolved)",
      },
      {
        method: "POST",
        path: "/v1/cases",
        description: "Create an investigation case from alerts.",
        requestBody: `{
  "title": "Suspicious mixer activity — Wallet 0x48f9",
  "description": "Multiple transactions routed through known mixer",
  "alertId": "uuid"
}`,
      },
      {
        method: "GET",
        path: "/v1/cases",
        description: "List investigation cases.",
        queryParams: "limit, offset, status (open|investigating|escalated|closed_no_action|closed_str_filed), search",
      },
    ],
  },
  {
    title: "ISARs & Reports",
    endpoints: [
      {
        method: "POST",
        path: "/v1/isars",
        description: "Create an Internal Suspicious Activity Report (Form A7).",
        requestBody: `{
  "subjectCustomerId": "uuid",
  "suspicionType": "mixer_usage",
  "narrative": "Customer routed funds through...",
  "supportingEvidence": {
    "alertIds": ["uuid1", "uuid2"],
    "walletAddresses": ["0x48f9..."]
  }
}`,
      },
      {
        method: "POST",
        path: "/v1/isars/{id}/submit",
        description: "Submit ISAR for MLRO review (draft → submitted_for_review).",
      },
      {
        method: "POST",
        path: "/v1/isars/{id}/approve",
        description: "MLRO approves ISAR (submitted_for_review → approved).",
      },
      {
        method: "POST",
        path: "/v1/isars/{id}/file-as-str",
        description: "File approved ISAR as STR (approved → filed_as_str). Generates goAML XML.",
      },
      {
        method: "GET",
        path: "/v1/reports/str",
        description: "List generated STR/CTR reports.",
      },
      {
        method: "GET",
        path: "/v1/reports/str/{id}/download",
        description: "Download STR report as goAML-compatible XML file.",
      },
    ],
  },
  {
    title: "Monitoring Rules",
    endpoints: [
      {
        method: "GET",
        path: "/v1/monitoring-rules",
        description: "List transaction monitoring rules for your tenant.",
      },
      {
        method: "POST",
        path: "/v1/monitoring-rules",
        description: "Create a transaction monitoring rule.",
        requestBody: `{
  "name": "PKR 2M CTR Threshold",
  "rule_type": "threshold",
  "severity": "high",
  "conditions": { "amount_gte": 2000000, "currency": "PKR" },
  "is_enabled": true
}`,
      },
    ],
  },
];

export default function ApiReferencePage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="opacity-40">/</span>
        <Link href="/docs" className="hover:text-foreground">Documentation</Link>
        <span className="opacity-40">/</span>
        <span className="text-foreground">API Reference</span>
      </div>

      <div>
        <h1 className="text-[1.65rem] font-extrabold tracking-tight mb-2">API Reference</h1>
        <p className="text-muted-foreground text-[0.86rem]">
          Integrate CIP services programmatically. Submit KYC, run screenings,
          check wallets, and manage compliance operations via REST API.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 text-xs font-semibold">
        <FlaskConical className="h-3.5 w-3.5" />
        Sandbox Environment
      </div>

      <pre className="rounded-[14px] border bg-card p-4 font-mono text-sm overflow-x-auto">
        <span className="text-primary font-medium">Base URL:</span>{" "}
        <span className="text-green-600 dark:text-green-400">https://sandbox.api.cip.pk/v1</span>
      </pre>

      {/* Authentication */}
      <div>
        <h2 className="text-[1rem] font-semibold mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4" /> Authentication
        </h2>
        <p className="text-[0.82rem] text-muted-foreground mb-3">
          Two authentication methods are supported:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div className="rounded-[14px] border bg-card p-4">
            <h3 className="text-[0.82rem] font-semibold mb-1">JWT Bearer Token</h3>
            <p className="text-[0.72rem] text-muted-foreground">Login with email/password to get tokens. Best for dashboard integrations.</p>
            <code className="block mt-2 text-[0.68rem] font-mono text-primary">Authorization: Bearer eyJhbG...</code>
          </div>
          <div className="rounded-[14px] border bg-card p-4">
            <h3 className="text-[0.82rem] font-semibold mb-1">API Key</h3>
            <p className="text-[0.72rem] text-muted-foreground">Generate in Settings → API Keys. Best for server-to-server integration.</p>
            <code className="block mt-2 text-[0.68rem] font-mono text-primary">X-API-Key: cip_live_sk_...</code>
          </div>
        </div>
      </div>

      {/* Endpoints by section */}
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-[1rem] font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" /> {section.title}
          </h2>
          <div className="space-y-3">
            {section.endpoints.map((ep, idx) => (
              <div key={idx} className="rounded-[14px] border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[0.65rem] font-bold font-mono ${
                      ep.method === "GET" ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : ep.method === "POST" ? "bg-primary/10 text-primary"
                      : ep.method === "PATCH" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-[0.78rem]">{ep.path}</span>
                  </div>
                  <p className="text-[0.72rem] text-muted-foreground mt-1">{ep.description}</p>
                  {ep.queryParams && (
                    <p className="text-[0.65rem] text-muted-foreground/60 mt-1">
                      Query params: <span className="font-mono">{ep.queryParams}</span>
                    </p>
                  )}
                </div>
                {(ep.requestBody || ep.responseBody) && (
                  <div className={`grid ${ep.requestBody && ep.responseBody ? "sm:grid-cols-2 divide-x divide-border" : ""}`}>
                    {ep.requestBody && (
                      <div className="p-3">
                        <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">Request</div>
                        <pre className="text-[0.68rem] font-mono text-muted-foreground leading-relaxed whitespace-pre overflow-x-auto">{ep.requestBody}</pre>
                      </div>
                    )}
                    {ep.responseBody && (
                      <div className="p-3">
                        <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">Response</div>
                        <pre className="text-[0.68rem] font-mono text-muted-foreground leading-relaxed whitespace-pre overflow-x-auto">{ep.responseBody}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Response envelope */}
      <div>
        <h2 className="text-[1rem] font-semibold mb-3">Response Envelope</h2>
        <p className="text-[0.82rem] text-muted-foreground mb-3">All responses use a consistent structure:</p>
        <pre className="rounded-[14px] border bg-card p-4 font-mono text-[0.72rem] leading-relaxed overflow-x-auto whitespace-pre">{`// Success
{
  "status": "success",
  "data": { ... },
  "meta": { "total": 53, "page": 1, "per_page": 25 }
}

// Error
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Customer not found",
    "details": { "customer_id": "uuid" }
  }
}`}</pre>
      </div>

      {/* Rate limits */}
      <div>
        <h2 className="text-[1rem] font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" /> Rate Limits
        </h2>
        <div className="rounded-[14px] border bg-card overflow-hidden">
          <table className="w-full text-[0.78rem]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">Environment</th>
                <th className="px-4 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">Limit</th>
                <th className="px-4 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">Auth Endpoints</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-2">Sandbox</td>
                <td className="px-4 py-2">100 req/min</td>
                <td className="px-4 py-2">10 req/min</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Production</td>
                <td className="px-4 py-2">1,000 req/min (per tenant)</td>
                <td className="px-4 py-2">10 req/min</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhooks */}
      <div>
        <h2 className="text-[1rem] font-semibold mb-3 flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhooks
        </h2>
        <p className="text-[0.82rem] text-muted-foreground mb-3">
          Configure webhook URLs in Settings → Webhooks. CIP sends HMAC-SHA256 signed POST requests for these events:
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {["kyc.status_changed", "screening.match", "alert.created"].map((ev) => (
            <div key={ev} className="rounded-[14px] border bg-card px-3 py-2">
              <code className="text-[0.72rem] font-mono text-primary">{ev}</code>
            </div>
          ))}
        </div>
        <p className="text-[0.72rem] text-muted-foreground mt-3">
          Verify signatures using the <code className="bg-muted px-1 py-0.5 rounded text-[0.65rem] font-mono">X-CIP-Signature</code> header (HMAC-SHA256 of the payload body using your API key hash as secret).
        </p>
      </div>

      {/* Interactive explorer CTA */}
      <div className="rounded-[14px] border border-primary/20 bg-primary/5 p-4 text-[0.82rem]">
        <strong className="text-foreground">Interactive API Explorer</strong>{" "}
        <span className="text-muted-foreground">
          — Already a CIP customer? Try endpoints directly from your browser with auto-injected authentication.
        </span>{" "}
        <Link href="/settings/api-explorer" className="text-primary hover:underline font-medium">
          Open API Explorer →
        </Link>
      </div>

      {/* Production access */}
      <div className="rounded-[14px] border bg-card p-4 text-[0.82rem] text-muted-foreground">
        <strong className="text-foreground">Need production access?</strong>{" "}
        Production API keys are available after your VASP application is approved.{" "}
        <Link href="/apply" className="text-primary hover:underline">Apply now →</Link>
      </div>
    </div>
  );
}
