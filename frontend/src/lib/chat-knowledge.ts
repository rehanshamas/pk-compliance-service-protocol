/**
 * CIP AI Chat Assistant — Knowledge Base
 * Structured Q&A entries covering every feature, workflow, term, and page.
 * Fuzzy-matched against user queries for instant answers.
 */

export interface KBEntry {
  keywords: string[];
  question: string;
  answer: string;
  links?: { label: string; href: string }[];
}

export const KNOWLEDGE_BASE: KBEntry[] = [
  // === GETTING STARTED ===
  {
    keywords: ["start", "begin", "first", "new", "onboard", "setup", "how to use"],
    question: "How do I get started with CIP?",
    answer: "Welcome to CIP! Here's how to start:\n1. **Add your team** — Go to Settings → Team and invite your MLRO and analysts.\n2. **Create your first customer** — Go to KYC → Customers → New Customer.\n3. **Run KYC** — Upload their CNIC, run NADRA verification, and score their risk.\n4. **Screen them** — The system automatically screens against sanctions lists.\n5. **Monitor** — Set up monitoring rules in Settings → Monitoring Rules.\n\nYour dashboard overview shows all key metrics at a glance.",
    links: [
      { label: "Team Settings", href: "/settings/team" },
      { label: "New Customer", href: "/kyc/customers/new" },
      { label: "Overview", href: "/overview" },
    ],
  },

  // === KYC / CUSTOMERS ===
  {
    keywords: ["kyc", "customer", "create customer", "add customer", "onboard customer", "new customer"],
    question: "How do I create a new customer?",
    answer: "Go to **KYC → Customers** and click **New Customer**. Fill in:\n- Full name\n- CNIC number (format: 42301-1234567-8)\n- Date of birth\n- Nationality\n\nAfter creation, the customer starts in 'initiated' status. Upload documents and run verification to advance their KYC.",
    links: [{ label: "New Customer", href: "/kyc/customers/new" }],
  },
  {
    keywords: ["cnic", "verify", "nadra", "identity", "verification", "id check"],
    question: "How does NADRA verification work?",
    answer: "NADRA e-Verisys verifies a customer's identity against Pakistan's national database:\n1. Go to the **customer detail page**\n2. Click **Verify (NADRA)**\n3. The system checks their CNIC number against NADRA records\n4. If verified, KYC status advances to 'identity_verified'\n\nIf NADRA is unavailable, the system falls back to Shufti Pro (configurable by admin).",
    links: [{ label: "Customers", href: "/kyc/customers" }],
  },
  {
    keywords: ["kyc status", "kyc flow", "kyc pipeline", "kyc steps", "verification steps"],
    question: "What are the KYC status steps?",
    answer: "KYC progresses through these statuses:\n1. **initiated** — Customer created\n2. **documents_uploaded** — CNIC/passport uploaded\n3. **identity_verified** — NADRA/OCR verification passed\n4. **liveness_checked** — Face match + selfie verified\n5. **risk_scored** — Risk tier assigned (low/medium/high)\n6. **approved** — KYC complete\n\nHigh-risk customers go to **edd_required** → **edd_in_progress** for Enhanced Due Diligence.",
  },
  {
    keywords: ["edd", "enhanced due diligence", "high risk", "source of funds"],
    question: "What is EDD and when does it trigger?",
    answer: "**Enhanced Due Diligence (EDD)** is required for high-risk customers under Regulation 10. It triggers when:\n- Risk scoring assigns 'high' risk tier\n- Customer is a PEP (Politically Exposed Person)\n- Customer is from a high-risk jurisdiction\n\nTo handle EDD:\n1. Go to the customer detail page\n2. Click **Start EDD**\n3. Collect source of funds documentation\n4. Upload proof (bank statements, proof of address)\n5. MLRO approves or rejects the EDD case",
    links: [{ label: "Customers", href: "/kyc/customers" }],
  },
  {
    keywords: ["document", "upload", "cnic", "passport", "selfie", "ocr"],
    question: "How do I upload customer documents?",
    answer: "On the **customer detail page**, use the document upload section:\n- Select document type: CNIC, passport, driving license, or selfie\n- Upload JPEG, PNG, or PDF (max 10MB)\n- The system automatically runs **OCR** to extract text from ID documents\n- Upload a **selfie** to trigger face matching against the ID photo",
  },

  // === SCREENING ===
  {
    keywords: ["screen", "sanctions", "screening", "watchlist", "check name", "pep"],
    question: "How does sanctions screening work?",
    answer: "CIP screens names against 5 watchlists:\n- **UN** Security Council consolidated list\n- **OFAC** SDN (US sanctions)\n- **EU** consolidated list\n- **NACTA** Pakistan domestic proscribed list\n- **PEP** databases (politically exposed persons)\n\nScreening runs automatically when a customer is created. You can also:\n- Run ad-hoc checks via **Screening → Results**\n- Upload a CSV for **batch screening** at Screening → Batch Jobs",
    links: [
      { label: "Screening Results", href: "/screening/results" },
      { label: "Batch Screening", href: "/screening/batch" },
    ],
  },
  {
    keywords: ["disposition", "true positive", "false positive", "match", "screening result"],
    question: "How do I handle a screening match?",
    answer: "When a screening match is found:\n1. Go to **Screening → Results**\n2. Click on the match to open the **disposition panel**\n3. Review the matched name, source, and score\n4. Choose a disposition:\n   - **True Positive** — confirmed real match (may require STR filing)\n   - **False Positive** — not a real match (similar name, different person)\n   - **Escalate** — uncertain, forward to MLRO for review\n5. Enter your rationale and save",
    links: [{ label: "Screening Results", href: "/screening/results" }],
  },
  {
    keywords: ["batch", "csv", "bulk", "batch screening", "upload csv"],
    question: "How do I run batch screening?",
    answer: "To screen multiple names at once:\n1. Go to **Screening → Batch Jobs**\n2. Prepare a CSV file with a 'name' column (optional: dob, id_number)\n3. Upload the CSV\n4. The system processes names in background\n5. Download results when complete\n\nBatch jobs show status: queued → processing → complete.",
    links: [{ label: "Batch Jobs", href: "/screening/batch" }],
  },
  {
    keywords: ["fuzzy", "threshold", "match score", "screening config", "sensitivity"],
    question: "How do I adjust screening sensitivity?",
    answer: "Go to **Settings → Screening Config**:\n- **Fuzzy threshold** (60-100): Lower values catch more matches but increase false positives. Default is 70.\n- **Source toggles**: Enable/disable individual lists (UN, OFAC, EU, NACTA, PEP)\n- **Ongoing monitoring**: When enabled, re-screens all customers automatically when lists update",
    links: [{ label: "Screening Config", href: "/settings/screening" }],
  },

  // === BLOCKCHAIN ANALYTICS ===
  {
    keywords: ["wallet", "blockchain", "analytics", "risk score", "address", "check wallet"],
    question: "How do I check a wallet address?",
    answer: "Go to **Analytics → Wallet Checks**:\n1. Click **Check new address**\n2. Enter the wallet address and select the chain (Ethereum, BSC, Polygon, Tron)\n3. Choose analysis depth:\n   - **L1** — On-chain basic data (Blockscout, free)\n   - **L2** — Enriched analytics (Subsquid, included)\n   - **L3** — Commercial deep investigation (premium, per-query fee)\n4. View the risk score, exposure breakdown, flagged indicators, and counterparty analysis",
    links: [{ label: "Wallet Checks", href: "/analytics/wallets" }],
  },
  {
    keywords: ["risk score", "exposure", "mixer", "sanctioned", "wallet risk"],
    question: "What do wallet risk scores mean?",
    answer: "Wallet risk scores range 0-100:\n- **0-20 (Low)** — Clean wallet, no red flags\n- **21-60 (Medium)** — Some exposure, review recommended\n- **61-80 (High)** — Significant risk indicators, investigation needed\n- **81-100 (Severe)** — Direct sanctions/mixer exposure, immediate action required\n\nThe **exposure breakdown** shows percentages: mixer, sanctioned, gambling, exchange, unknown.\n**Flagged indicators** list specific concerns like MIXER_EXPOSURE, SANCTIONED_COUNTERPARTY.",
  },

  // === ALERTS & CASES ===
  {
    keywords: ["alert", "monitoring", "transaction alert", "suspicious"],
    question: "How do alerts work?",
    answer: "Alerts are generated automatically from:\n- **Screening matches** — when a name hits a sanctions list\n- **Transaction monitoring** — when a rule triggers (e.g., PKR 2M threshold)\n- **Blockchain analytics** — when a wallet has high risk exposure\n\nView all alerts at **Analytics → Alerts**. Each alert has a severity (critical/high/medium/low) and can be assigned to a team member for investigation.",
    links: [{ label: "Alerts", href: "/analytics/alerts" }],
  },
  {
    keywords: ["case", "investigation", "create case", "link alert"],
    question: "How do I create an investigation case?",
    answer: "Go to **Cases** and click **Create Case**:\n1. Enter a title describing the investigation\n2. Optionally link an alert\n3. The case tracks the investigation lifecycle\n\nInside a case you can:\n- Add **notes** documenting your findings\n- Link **alerts** and **customers**\n- Track status: open → investigating → escalated → closed\n- Create an **ISAR** if suspicious activity is confirmed",
    links: [{ label: "Cases", href: "/cases" }],
  },

  // === ISAR & STR ===
  {
    keywords: ["isar", "suspicious activity", "form a7", "create isar", "internal report"],
    question: "How do I create an ISAR?",
    answer: "An ISAR (Internal Suspicious Activity Report / Form A7) is created when you identify suspicious activity:\n1. Go to **Reports → ISARs → Create ISAR**\n2. **Step 1**: Select the subject (customer from dropdown or manual entry)\n3. **Step 2**: Choose suspicion type and write a narrative describing the activity\n4. **Step 3**: Link evidence — alert IDs, wallet addresses, documents\n5. **Step 4**: Review and submit\n\nAfter submission, the MLRO reviews and decides whether to file as STR.",
    links: [{ label: "Create ISAR", href: "/reports/isars/new" }],
  },
  {
    keywords: ["str", "ctr", "goaml", "file str", "regulatory report", "fmu"],
    question: "How do I file an STR?",
    answer: "STR filing workflow:\n1. **Create an ISAR** with all evidence and narrative\n2. **Submit for review** — MLRO receives notification\n3. **MLRO approves** the ISAR\n4. **File as STR** — click 'File as STR' on the approved ISAR\n5. **Download XML** — go to Reports → STR/CTR, download the goAML-compatible XML\n6. **Submit to FMU** — upload the XML file to the goAML portal (fmu.gov.pk)\n\nNote: CIP prepares the STR but does NOT submit to goAML directly. Your MLRO must submit through the FMU portal.",
    links: [
      { label: "ISARs", href: "/reports/isars" },
      { label: "STR/CTR Reports", href: "/reports/str-ctr" },
    ],
  },

  // === FORMS ===
  {
    keywords: ["form a5", "outsourcing", "register", "regulation 14"],
    question: "What is Form A5?",
    answer: "**Form A5** is the Outsourcing Declaration & Register required under PVARA Regulation 14. It documents all third-party providers handling AML/CFT functions.\n\nCIP auto-generates Form A5 listing itself as your outsourced compliance provider. You can download it as a PDF from **Reports → Form A5**.",
    links: [{ label: "Form A5", href: "/reports/form-a5" }],
  },
  {
    keywords: ["form a6", "annual return", "yearly report", "regulation 18"],
    question: "What is Form A6?",
    answer: "**Form A6** is the Annual AML/CFT Return required under PVARA Regulation 18. It's a yearly compliance report covering:\n- Customers onboarded\n- Screenings conducted\n- STRs/CTRs filed\n- AML training hours\n\nCIP auto-compiles these metrics from your platform data. Download the PDF from **Reports → Form A6**. Due annually by the date set by PVARA.",
    links: [{ label: "Form A6", href: "/reports/form-a6" }],
  },

  // === MONITORING RULES ===
  {
    keywords: ["monitoring rule", "transaction rule", "threshold", "velocity", "pattern", "create rule"],
    question: "How do I set up transaction monitoring rules?",
    answer: "Go to **Settings → Monitoring Rules**:\n\nPre-configured rules include:\n- **PKR 2M CTR Threshold** — triggers on transactions ≥ PKR 2,000,000\n- **Rapid Cycling** — detects burst transaction patterns\n- **Mixer Pattern** — flags mixer/tumbler activity\n- **Structuring** — detects split transactions below reporting threshold\n- **Hawala/Hundi** — flags informal value transfer patterns\n\nYou can create custom rules with type (threshold/velocity/pattern), severity, and conditions. Adjust sensitivity with the sliders.",
    links: [{ label: "Monitoring Rules", href: "/settings/monitoring" }],
  },

  // === SETTINGS ===
  {
    keywords: ["team", "add user", "invite", "role", "analyst", "mlro role"],
    question: "How do I manage my team?",
    answer: "Go to **Settings → Team**:\n- Click **Add Member** to invite a new user\n- Enter their name, email, and password\n- Assign a role:\n  - **Analyst** — can view data, run checks, create ISARs\n  - **MLRO** — full access, approves ISARs, manages team\n\nYou can edit or deactivate team members from the same page.",
    links: [{ label: "Team", href: "/settings/team" }],
  },
  {
    keywords: ["api key", "generate key", "integration", "programmatic"],
    question: "How do I get an API key?",
    answer: "Go to **Settings → API Keys**:\n1. Click **Generate New Key**\n2. Copy the key immediately — it's shown only once\n3. Use it in the `X-API-Key` header for programmatic API access\n\nYou can also explore all endpoints interactively at **Settings → API Explorer**.",
    links: [
      { label: "API Keys", href: "/settings/api-keys" },
      { label: "API Explorer", href: "/settings/api-explorer" },
    ],
  },
  {
    keywords: ["webhook", "callback", "event notification", "real-time"],
    question: "How do I configure webhooks?",
    answer: "Go to **Settings → Webhooks**:\n1. Enter your HTTPS endpoint URL\n2. Select events to receive: KYC status changed, screening match, new alert\n3. Click **Save**\n4. Use the **Test** button to verify delivery\n\nWebhooks are signed with HMAC-SHA256 — verify the `X-CIP-Signature` header.",
    links: [{ label: "Webhooks", href: "/settings/webhooks" }],
  },
  {
    keywords: ["billing", "plan", "invoice", "payment", "subscription", "pricing"],
    question: "How does billing work?",
    answer: "View your subscription and usage at **Settings → Usage & Billing**:\n- Your current plan and base price\n- Per-service usage vs quota (KYC, screening, analytics, reports)\n- Invoice history with download\n\nCIP offers 4 plans: Trial (free, 14 days), Starter (PKR 25,000/mo), Professional (PKR 75,000/mo), Enterprise (PKR 200,000/mo). Overages are billed per-unit beyond included quotas.",
    links: [{ label: "Billing", href: "/settings/billing" }],
  },
  {
    keywords: ["retention", "record", "7 year", "archive", "delete", "regulation 13"],
    question: "How does record retention work?",
    answer: "CIP enforces **7-year minimum retention** per Regulation 13.1. Go to **Settings → Record Retention** to configure:\n- Retention period (7/10/15 years)\n- Action at expiry: Archive (compress) or Delete permanently\n- Notification days before expiry\n\nRecords cannot be deleted within the retention period — the system blocks it.",
    links: [{ label: "Retention", href: "/settings/retention" }],
  },

  // === NAVIGATION ===
  {
    keywords: ["overview", "dashboard", "home", "summary", "stats"],
    question: "Where is the dashboard overview?",
    answer: "The **Overview** page is your home dashboard showing:\n- Total customers and approved count\n- Pending screening hits\n- Open alerts with critical count\n- Pending ISARs\n- KYC onboarding chart (last 14 days)\n- Recent alerts list\n- Form A6 deadline countdown",
    links: [{ label: "Overview", href: "/overview" }],
  },
  {
    keywords: ["where", "find", "navigate", "page", "location"],
    question: "Where can I find specific features?",
    answer: "Here's a quick page map:\n- **KYC → Customers** — manage customers and run verification\n- **Screening → Results** — view and disposition screening matches\n- **Screening → Batch Jobs** — bulk CSV screening\n- **Analytics → Wallets** — check wallet addresses for risk\n- **Analytics → Alerts** — view triggered alerts\n- **Cases** — investigation case management\n- **Reports → ISARs** — internal suspicious activity reports\n- **Reports → STR/CTR** — download goAML XML files\n- **Reports → Form A5/A6** — regulatory forms\n- **Settings** — team, API keys, webhooks, screening, monitoring, retention, analytics, billing",
  },

  // === INCIDENT REPORTING ===
  {
    keywords: ["incident", "breach", "outage", "report incident", "1 hour", "48 hour", "pvara notification"],
    question: "How do I report an incident?",
    answer: "Go to **Incidents** in the sidebar:\n1. Click **Report Incident**\n2. Enter title, severity (critical/high/medium/low), category, and description\n3. The system automatically sets two deadlines:\n   - **1 hour** — notify PVARA (click 'Mark Authority Notified')\n   - **48 hours** — submit detailed report (nature, scope, containment, root cause, remediation)\n4. Countdown timers show remaining time\n5. Overdue incidents are flagged in red\n\nThis is required under PVARA Sandbox Undertaking clauses 8-9.",
    links: [{ label: "Incidents", href: "/incidents" }],
  },

  // === COMPLIANCE TERMS ===
  {
    keywords: ["pvara", "regulator", "regulation", "virtual assets act"],
    question: "What is PVARA?",
    answer: "**PVARA** (Pakistan Virtual Asset Regulatory Authority) is the primary regulator for VASPs under the Virtual Assets Act 2026. CIP helps you comply with PVARA's NOC Regulations including CDD (Reg. 8), EDD (Reg. 9/10), TFS screening (Reg. 11), transaction monitoring (Reg. 12), record retention (Reg. 13), outsourcing (Reg. 14), and annual returns (Reg. 18).",
  },
  {
    keywords: ["fmu", "financial monitoring", "goaml portal"],
    question: "What is FMU?",
    answer: "**FMU** (Financial Monitoring Unit) is Pakistan's financial intelligence unit under the State Bank. VASPs file STRs and CTRs through FMU's **goAML portal** (fmu.gov.pk). CIP generates goAML-compatible XML files — you download them and upload to the portal. CIP does NOT submit directly to goAML.",
  },
  {
    keywords: ["tfs", "targeted financial sanctions", "sanctions compliance"],
    question: "What are Targeted Financial Sanctions?",
    answer: "**TFS** (Targeted Financial Sanctions) under Regulation 11 require VASPs to screen all customers against UN, OFAC, EU, and NACTA sanctions lists. CIP automates this with real-time and ongoing screening. Matches must be dispositioned (true positive, false positive, or escalated) and documented.",
  },
];

/**
 * Search the knowledge base with fuzzy matching.
 * Returns entries sorted by relevance score (higher = better match).
 */
export function searchKnowledge(query: string, limit = 3): (KBEntry & { score: number })[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter(w => w.length > 1);
  const scored: (KBEntry & { score: number })[] = [];

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;

    // Keyword matches (highest weight)
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += 10;
      for (const word of words) {
        if (kw.includes(word)) score += 3;
        if (word.includes(kw)) score += 2;
      }
    }

    // Question match
    const ql = entry.question.toLowerCase();
    for (const word of words) {
      if (ql.includes(word)) score += 2;
    }

    // Answer match (lower weight)
    const al = entry.answer.toLowerCase();
    for (const word of words) {
      if (al.includes(word)) score += 1;
    }

    if (score > 0) {
      scored.push({ ...entry, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
