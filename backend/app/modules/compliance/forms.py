"""Form A5 (Outsourcing Register) and Form A6 (Annual AML/CFT Return) generators.

PVARA-compliant form generation. Phase 5.4 / 5.5 / WS-6.
"""

from datetime import datetime, timezone
from html import escape
from typing import Any

# Default outsourcing register when tenant has none configured (CIP as provider)
DEFAULT_OUTSOURCING_REGISTER: list[dict[str, Any]] = [
    {
        "provider": "CIP",
        "providerDescription": "Compliance Infrastructure Platform",
        "countryOfIncorporation": "Pakistan",
        "functionOutsourced": "KYC verification, Sanctions screening, Blockchain analytics, Compliance operations",
        "functions": [
            "KYC verification",
            "Sanctions screening",
            "Blockchain analytics",
            "Compliance operations",
        ],
        "amlCftRelevance": "Core AML/CFT operations including customer verification, sanctions screening, and transaction monitoring",
        "dataShared": "KYC data, wallet addresses, transaction logs",
        "slaSummary": "99.9% uptime, 24h response SLA, monthly performance reports",
        "auditRights": True,
        "subOutsourcingPermitted": False,
        "terminationRights": "Standard",
        "riskAssessment": "Low",
        "riskJustification": "Regulated platform with SOC2 compliance and data residency in Pakistan",
        "monitoringFrequency": "Quarterly",
        "scope": "Shared RegTech platform per NOC Reg. 14",
        "status": "active",
    }
]


def _get_register(tenant: Any) -> list[dict[str, Any]]:
    """Return outsourcing register from tenant config or default."""
    reg = getattr(tenant, "outsourcing_register", None)
    if reg is not None and isinstance(reg, list) and len(reg) > 0:
        return reg
    return DEFAULT_OUTSOURCING_REGISTER


def _esc(val: Any, default: str = "") -> str:
    """Escape a value for HTML, with a default."""
    if val is None:
        return escape(default)
    return escape(str(val))


def _bool_display(val: Any) -> str:
    """Display a boolean-like value as Yes/No."""
    if isinstance(val, bool):
        return "Yes" if val else "No"
    if isinstance(val, str):
        return "Yes" if val.lower() in ("yes", "true", "1") else "No"
    return "No"


def generate_form_a5_html(tenant: Any) -> str:
    """Generate Form A5 (Outsourcing Register) as HTML document.

    PVARA NOC Regulation Annex A -- outsourcing declaration and register.
    Includes all 11 fields per outsourced service plus compliance officer signature.
    Printable; user can save as PDF from browser.
    """
    register = _get_register(tenant)
    tenant_name = escape(getattr(tenant, "name", "VASP"))
    tenant_slug = escape(getattr(tenant, "slug", ""))
    now = datetime.now(timezone.utc).strftime("%d %B %Y")

    rows = []
    for i, entry in enumerate(register, 1):
        provider = _esc(entry.get("provider"))
        country = _esc(entry.get("countryOfIncorporation", entry.get("country", "")))

        # Function outsourced: prefer dedicated field, fall back to functions list
        func_outsourced = entry.get("functionOutsourced", "")
        if not func_outsourced:
            functions = entry.get("functions", [])
            if isinstance(functions, list):
                func_outsourced = ", ".join(str(f) for f in functions)
            else:
                func_outsourced = str(functions)

        aml_relevance = _esc(entry.get("amlCftRelevance", ""))
        data_shared = _esc(entry.get("dataShared", ""))
        sla_summary = _esc(entry.get("slaSummary", ""))
        audit_rights = _bool_display(entry.get("auditRights"))
        sub_outsourcing = _bool_display(entry.get("subOutsourcingPermitted"))
        termination = _esc(entry.get("terminationRights", "Standard"))
        risk_assessment = _esc(entry.get("riskAssessment", "Medium"))
        risk_justification = _esc(entry.get("riskJustification", ""))
        monitoring_freq = _esc(entry.get("monitoringFrequency", "Quarterly"))

        rows.append(f"""
        <tr>
            <td class="row-num">{i}</td>
            <td><strong>{provider}</strong></td>
            <td>{country}</td>
            <td>{escape(func_outsourced)}</td>
            <td>{aml_relevance}</td>
            <td>{data_shared}</td>
            <td class="small">{sla_summary}</td>
            <td class="center">{audit_rights}</td>
            <td class="center">{sub_outsourcing}</td>
            <td>{termination}</td>
            <td><span class="risk-{risk_assessment.lower()}">{risk_assessment}</span><br><span class="muted">{risk_justification}</span></td>
            <td>{monitoring_freq}</td>
        </tr>""")

    table_rows = "\n".join(rows)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form A5 — Outsourcing Register — {tenant_name}</title>
    <style>
        @page {{ size: A4 landscape; margin: 12mm; }}
        * {{ box-sizing: border-box; }}
        body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; font-size: 9pt; }}
        .page {{ padding: 0; max-width: 100%; }}
        h1 {{ font-size: 14pt; margin: 0 0 2px 0; }}
        h2 {{ font-size: 11pt; margin: 12px 0 4px 0; }}
        .subtitle {{ color: #666; font-size: 8pt; margin-bottom: 8px; }}
        .meta {{ font-size: 8pt; margin-bottom: 8px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 7pt; table-layout: fixed; }}
        th, td {{ border: 1px solid #999; padding: 3px 4px; text-align: left; vertical-align: top; overflow: hidden; word-wrap: break-word; }}
        th {{ background: #f0f0f0; font-weight: 600; font-size: 6.5pt; }}
        .muted {{ color: #666; font-size: 6pt; }}
        .small {{ font-size: 6pt; }}
        .center {{ text-align: center; }}
        .row-num {{ text-align: center; width: 18px; }}
        .col-provider {{ width: 8%; }}
        .col-country {{ width: 6%; }}
        .col-func {{ width: 12%; }}
        .col-aml {{ width: 12%; }}
        .col-data {{ width: 10%; }}
        .col-sla {{ width: 10%; }}
        .col-audit {{ width: 5%; }}
        .col-sub {{ width: 5%; }}
        .col-term {{ width: 8%; }}
        .col-risk {{ width: 12%; }}
        .col-mon {{ width: 6%; }}
        .risk-low {{ color: #2e7d32; font-weight: 600; }}
        .risk-medium {{ color: #f57f17; font-weight: 600; }}
        .risk-high {{ color: #c62828; font-weight: 600; }}
        .signature-section {{ margin-top: 12px; border-top: 1px solid #333; padding-top: 8px; font-size: 8pt; }}
        .signature-line {{ border-bottom: 1px solid #333; width: 180px; display: inline-block; margin-top: 12px; }}
        .footer {{ margin-top: 8px; font-size: 6pt; color: #666; }}
    </style>
</head>
<body class="page">
    <h1>Form A5 — Outsourcing Register</h1>
    <p class="subtitle">PVARA NOC Regulation Annex A — Outsourcing Declaration and Register</p>

    <p class="meta"><strong>Reporting Entity:</strong> {tenant_name} &nbsp;|&nbsp; <strong>Reference:</strong> {tenant_slug or "(tenant)"} &nbsp;|&nbsp; <strong>Date:</strong> {now}</p>

    <h2>Outsourced Services Register</h2>

    <table>
        <thead>
            <tr>
                <th class="row-num">#</th>
                <th class="col-provider">Service Provider</th>
                <th class="col-country">Country</th>
                <th class="col-func">Function Outsourced</th>
                <th class="col-aml">AML/CFT Relevance</th>
                <th class="col-data">Data Shared</th>
                <th class="col-sla">SLA Summary</th>
                <th class="col-audit">Audit Rights</th>
                <th class="col-sub">Sub-Out</th>
                <th class="col-term">Termination Rights</th>
                <th class="col-risk">Risk Assessment</th>
                <th class="col-mon">Monitor Freq</th>
            </tr>
        </thead>
        <tbody>
{table_rows}
        </tbody>
    </table>

    <div class="signature-section">
        <h2>Compliance Officer Declaration</h2>
        <p>I confirm that this outsourcing register is accurate and complete as of the date stated above.
        All outsourced functions have been assessed for AML/CFT risk and appropriate controls,
        monitoring, and contractual safeguards are in place in accordance with PVARA regulations.</p>
        <p>Outsourcing does not relieve the reporting entity of its compliance obligations under
        the PVARA framework and NOC Regulation 14.</p>

        <p style="margin-top: 2rem;">
            <strong>Name:</strong> <span class="signature-line">&nbsp;</span><br><br>
            <strong>Title:</strong> <span class="signature-line">&nbsp;</span><br><br>
            <strong>Signature:</strong> <span class="signature-line">&nbsp;</span><br><br>
            <strong>Date:</strong> <span class="signature-line">&nbsp;</span>
        </p>
    </div>

    <p class="footer">
        Generated by CIP. Outsourcing does not relieve the reporting entity of compliance responsibility.
        PVARA NOC Reg. 14 applies.
    </p>
</body>
</html>"""
    return html


def generate_form_a6_html(tenant: Any, stats: dict, year: int) -> str:
    """Generate Form A6 (Annual AML/CFT Return) as HTML document.

    PVARA Part 6 -- annual compliance return with 8 sections:
    1. Entity Profile
    2. Governance
    3. Risk Assessment Update
    4. CDD Metrics
    5. Transaction Monitoring Metrics
    6. STR/CTR Reporting
    7. Independent Audit
    8. Declaration (MLRO + CEO signatures)

    Sections 4-6 are populated from database aggregates (via stats dict).
    Sections 1-3, 7-8 are populated from manual_input dict within stats.
    """
    tenant_name = escape(getattr(tenant, "name", "VASP"))
    tenant_slug = escape(getattr(tenant, "slug", ""))
    now = datetime.now(timezone.utc).strftime("%d %B %Y")

    # --- Section 4: CDD Metrics ---
    customers_onboarded = stats.get("customersOnboarded", 0)
    customers_high_risk = stats.get("customersHighRisk", 0)
    customers_pep = stats.get("customersPep", 0)
    customers_refused = stats.get("customersRefused", 0)
    customers_exited = stats.get("customersExited", 0)

    # --- Section 5: Transaction Monitoring ---
    alerts_total = stats.get("alertsTotal", 0)
    alerts_escalated = stats.get("alertsEscalated", 0)
    alerts_closed = stats.get("alertsClosed", 0)
    alerts_pending = stats.get("alertsPending", 0)

    # --- Section 6: STR/CTR ---
    strs_filed = stats.get("strsFiled", 0)
    ctrs_filed = stats.get("ctrsFiled", 0)
    suspicion_categories = stats.get("suspicionCategories", "N/A")
    screenings_conducted = stats.get("screeningsConducted", 0)

    # --- Legacy / backward compat ---
    training = stats.get("trainingHours", 0)

    # --- Manual input sections ---
    manual = stats.get("manualInput", {}) or {}

    # Section 1: Entity Profile
    s1 = manual.get("entityProfile", {}) or {}
    legal_name = _esc(s1.get("legalName", tenant_name))
    pvara_reg_number = _esc(s1.get("pvaraRegistrationNumber", ""))
    key_individuals = _esc(s1.get("keyIndividuals", ""))

    # Section 2: Governance
    s2 = manual.get("governance", {}) or {}
    mlro_statement = _esc(s2.get("mlroAnnualStatement", ""))
    governance_changes = _esc(s2.get("governanceChanges", "None"))
    outsourcing_changes = _esc(s2.get("outsourcingChanges", "None"))

    # Section 3: Risk Assessment Update
    s3 = manual.get("riskAssessment", {}) or {}
    new_risks = _esc(s3.get("newRisks", "None identified"))
    material_changes = _esc(s3.get("materialChanges", "None"))
    emerging_trends = _esc(s3.get("emergingTrends", "None identified"))

    # Section 7: Independent Audit
    s7 = manual.get("independentAudit", {}) or {}
    audit_findings = _esc(s7.get("findingsSummary", ""))
    remediation_status = _esc(s7.get("remediationStatus", ""))
    outstanding_gaps = _esc(s7.get("outstandingGaps", "None"))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form A6 — Annual AML/CFT Return — {tenant_name} — {year}</title>
    <style>
        @page {{ size: A4 portrait; margin: 12mm; }}
        * {{ box-sizing: border-box; }}
        body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; font-size: 9pt; }}
        .page {{ padding: 0; max-width: 100%; }}
        h1 {{ font-size: 14pt; margin: 0 0 2px 0; }}
        h2 {{ font-size: 10pt; margin: 8px 0 3px 0; border-bottom: 1px solid #ccc; padding-bottom: 2px; }}
        .subtitle {{ color: #666; font-size: 8pt; margin-bottom: 4px; }}
        .meta {{ font-size: 7pt; margin-bottom: 6px; line-height: 1.4; }}
        .section-num {{ color: #1565c0; font-weight: 700; margin-right: 2px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 2px; margin-bottom: 4px; font-size: 8pt; }}
        th, td {{ border: 1px solid #999; padding: 3px 6px; text-align: left; }}
        th {{ background: #f0f0f0; font-weight: 600; width: 45%; font-size: 7pt; }}
        td.value {{ text-align: right; font-weight: 500; }}
        .narrative {{ background: #fafafa; border: 1px solid #ddd; padding: 4px 6px; margin: 2px 0; white-space: pre-wrap; font-size: 7pt; }}
        .signature-section {{ margin-top: 8px; border-top: 1px solid #333; padding-top: 6px; font-size: 8pt; }}
        .signature-block {{ display: inline-block; width: 45%; vertical-align: top; margin-right: 4%; }}
        .signature-line {{ border-bottom: 1px solid #333; width: 100%; display: inline-block; margin-top: 8px; }}
        .footer {{ margin-top: 6px; font-size: 6pt; color: #666; }}
    </style>
</head>
<body class="page">
    <h1>Form A6 — Annual AML/CFT Return</h1>
    <p class="subtitle">PVARA Part 6 — Annual Compliance Return</p>

    <p class="meta"><strong>Reporting Entity:</strong> {tenant_name} &nbsp;|&nbsp; <strong>Reference:</strong> {tenant_slug or "(tenant)"} &nbsp;|&nbsp; <strong>Year:</strong> {year} &nbsp;|&nbsp; <strong>Period:</strong> 1 Jan {year} – 31 Dec {year} &nbsp;|&nbsp; <strong>Generated:</strong> {now}</p>

    <!-- Section 1: Entity Profile -->
    <h2><span class="section-num">1.</span> Entity Profile</h2>
    <table>
        <tr><th>Legal Name</th><td>{legal_name}</td></tr>
        <tr><th>PVARA Registration Number</th><td>{pvara_reg_number}</td></tr>
        <tr><th>Reporting Period</th><td>1 January {year} — 31 December {year}</td></tr>
        <tr><th>Key Individuals (MLRO, CEO, Board)</th><td>{key_individuals}</td></tr>
    </table>

    <!-- Section 2: Governance -->
    <h2><span class="section-num">2.</span> Governance</h2>
    <table>
        <tr><th>MLRO Annual Statement</th><td>{mlro_statement}</td></tr>
        <tr><th>Changes in Governance Structure</th><td>{governance_changes}</td></tr>
        <tr><th>Changes in Outsourcing Arrangements</th><td>{outsourcing_changes}</td></tr>
        <tr><th>AML/CFT Training Hours (Period)</th><td class="value">{training}</td></tr>
    </table>

    <!-- Section 3: Risk Assessment Update -->
    <h2><span class="section-num">3.</span> Risk Assessment Update</h2>
    <table>
        <tr><th>New Risks Identified</th><td>{new_risks}</td></tr>
        <tr><th>Material Changes to Risk Profile</th><td>{material_changes}</td></tr>
        <tr><th>Emerging Trends / Typologies</th><td>{emerging_trends}</td></tr>
    </table>

    <!-- Section 4: CDD Metrics -->
    <h2><span class="section-num">4.</span> Customer Due Diligence Metrics</h2>
    <table>
        <tr><th>Total Customers Onboarded</th><td class="value">{customers_onboarded}</td></tr>
        <tr><th>High-Risk Customers</th><td class="value">{customers_high_risk}</td></tr>
        <tr><th>Politically Exposed Persons (PEPs)</th><td class="value">{customers_pep}</td></tr>
        <tr><th>Customers Refused / Rejected</th><td class="value">{customers_refused}</td></tr>
        <tr><th>Customers Exited / Off-boarded</th><td class="value">{customers_exited}</td></tr>
        <tr><th>Screenings Conducted</th><td class="value">{screenings_conducted}</td></tr>
    </table>

    <!-- Section 5: Transaction Monitoring Metrics -->
    <h2><span class="section-num">5.</span> Transaction Monitoring Metrics</h2>
    <table>
        <tr><th>Total Alerts Generated</th><td class="value">{alerts_total}</td></tr>
        <tr><th>Alerts Escalated</th><td class="value">{alerts_escalated}</td></tr>
        <tr><th>Alerts Closed / Resolved</th><td class="value">{alerts_closed}</td></tr>
        <tr><th>Alerts Pending</th><td class="value">{alerts_pending}</td></tr>
    </table>

    <!-- Section 6: STR/CTR Reporting -->
    <h2><span class="section-num">6.</span> STR/CTR Reporting</h2>
    <table>
        <tr><th>STRs Filed</th><td class="value">{strs_filed}</td></tr>
        <tr><th>Categories of Suspicion</th><td>{suspicion_categories}</td></tr>
        <tr><th>CTRs Filed</th><td class="value">{ctrs_filed}</td></tr>
    </table>

    <!-- Section 7: Independent Audit -->
    <h2><span class="section-num">7.</span> Independent Audit</h2>
    <table>
        <tr><th>Findings Summary</th><td>{audit_findings}</td></tr>
        <tr><th>Remediation Status</th><td>{remediation_status}</td></tr>
        <tr><th>Outstanding Gaps</th><td>{outstanding_gaps}</td></tr>
    </table>

    <!-- Section 8: Declaration -->
    <div class="signature-section">
        <h2><span class="section-num">8.</span> Declaration</h2>
        <p>We hereby declare that the information provided in this Annual AML/CFT Return is
        true, accurate, and complete to the best of our knowledge. We confirm that adequate
        policies, procedures, and controls are in place to ensure compliance with the PVARA
        framework and applicable AML/CFT regulations.</p>

        <div class="signature-block">
            <p><strong>MLRO</strong></p>
            <p>Name: <span class="signature-line">&nbsp;</span></p>
            <p>Signature: <span class="signature-line">&nbsp;</span></p>
            <p>Date: <span class="signature-line">&nbsp;</span></p>
        </div>
        <div class="signature-block">
            <p><strong>CEO / Managing Director</strong></p>
            <p>Name: <span class="signature-line">&nbsp;</span></p>
            <p>Signature: <span class="signature-line">&nbsp;</span></p>
            <p>Date: <span class="signature-line">&nbsp;</span></p>
        </div>
    </div>

    <p class="footer">
        Generated by CIP. Data aggregated for period 1 Jan {year} – 31 Dec {year}.
        PVARA Part 6 applies.
    </p>
</body>
</html>"""
    return html


def generate_fmu_freeze_report_html(
    freeze_record: Any,
    tenant: Any,
    customer: Any,
) -> str:
    """Generate FMU Freeze Report (PVARA NOC Reg. 12.2) as printable HTML.

    Required when a VASP freezes assets of a designated person and must
    report the freeze to FMU and any other designated authority.
    """
    tenant_name = escape(getattr(tenant, "name", "VASP"))
    tenant_slug = escape(getattr(tenant, "slug", ""))
    now = datetime.now(timezone.utc).strftime("%d %B %Y %H:%M UTC")

    # Customer details
    cust_name = escape(getattr(customer, "full_name", "") or "")
    cust_cnic = escape(getattr(customer, "cnic_number", "") or "N/A")
    cust_nationality = escape(getattr(customer, "nationality", "") or "N/A")

    # Freeze details
    freeze_type = escape(str(getattr(freeze_record, "freeze_type", "") or ""))
    matched_list = escape(str(getattr(freeze_record, "matched_list", "") or "N/A"))
    matched_name = escape(str(getattr(freeze_record, "matched_name", "") or "N/A"))
    match_score = getattr(freeze_record, "match_score", None)
    match_score_str = f"{match_score:.1f}%" if match_score is not None else "N/A"
    frozen_at = getattr(freeze_record, "frozen_at", None)
    frozen_at_str = frozen_at.strftime("%d %B %Y %H:%M UTC") if frozen_at else now
    notes = escape(str(getattr(freeze_record, "notes", "") or ""))
    fr_id = str(getattr(freeze_record, "id", ""))[:8]

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FMU Freeze Report — {tenant_name}</title>
    <style>
        @page {{ size: A4 portrait; margin: 15mm; }}
        * {{ box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; }}
        h1 {{ font-size: 15pt; text-align: center; margin-bottom: 4px; color: #c62828; }}
        .subtitle {{ text-align: center; font-size: 9pt; color: #666; margin-bottom: 20px; }}
        h2 {{ font-size: 11pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 20px; color: #1e3a5f; }}
        table {{ width: 100%; border-collapse: collapse; margin: 8px 0 16px; }}
        th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 9pt; }}
        th {{ background: #f0f4f8; width: 35%; font-weight: 600; }}
        .urgent {{ background: #ffebee; border: 2px solid #c62828; padding: 12px; margin: 16px 0; font-weight: 600; color: #c62828; text-align: center; }}
        .sig-block {{ margin-top: 30px; }}
        .sig-line {{ border-bottom: 1px solid #333; width: 250px; display: inline-block; margin-top: 20px; }}
        .ref {{ font-size: 8pt; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }}
        @media print {{ body {{ padding: 20px; }} }}
    </style>
</head>
<body>
<h1>ASSET FREEZE NOTIFICATION TO FMU</h1>
<p class="subtitle">PVARA NOC Regulation 12.2 — Targeted Financial Sanctions Compliance<br>
Freeze Reference: {fr_id}</p>

<div class="urgent">URGENT: Assets frozen under Targeted Financial Sanctions obligations.
Immediate reporting to FMU required.</div>

<h2>1. REPORTING ENTITY</h2>
<table>
<tr><th>VASP Name</th><td>{tenant_name}</td></tr>
<tr><th>PVARA Registration</th><td>{tenant_slug or "(pending)"}</td></tr>
<tr><th>Report Date</th><td>{now}</td></tr>
</table>

<h2>2. DESIGNATED PERSON / CUSTOMER</h2>
<table>
<tr><th>Full Name</th><td>{cust_name}</td></tr>
<tr><th>CNIC / ID Number</th><td>{cust_cnic}</td></tr>
<tr><th>Nationality</th><td>{cust_nationality}</td></tr>
</table>

<h2>3. SANCTIONS MATCH DETAILS</h2>
<table>
<tr><th>Sanctions List Matched</th><td>{matched_list}</td></tr>
<tr><th>Matched Name on List</th><td>{matched_name}</td></tr>
<tr><th>Match Confidence Score</th><td>{match_score_str}</td></tr>
<tr><th>Freeze Type</th><td>{freeze_type.replace("_", " ").title()}</td></tr>
</table>

<h2>4. FREEZE ACTION</h2>
<table>
<tr><th>Date and Time of Freeze</th><td>{frozen_at_str}</td></tr>
<tr><th>Action Taken</th><td>All virtual assets and accounts associated with the designated person
have been immediately frozen. No transactions permitted pending further instruction from FMU.</td></tr>
<tr><th>Additional Notes</th><td>{notes or "None"}</td></tr>
</table>

<h2>5. COMPLIANCE OFFICER DECLARATION</h2>
<p>I hereby confirm that the above freeze action was taken immediately upon identification
of the designated person, in accordance with PVARA NOC Regulation 12.2 and applicable
Targeted Financial Sanctions obligations. No funds or virtual assets have been released
or made available to the designated person since the time of the freeze.</p>

<div class="sig-block">
<p><strong>Name:</strong> <span class="sig-line">&nbsp;</span></p>
<p><strong>Title:</strong> <span class="sig-line">&nbsp;</span></p>
<p><strong>Signature:</strong> <span class="sig-line">&nbsp;</span></p>
<p><strong>Date:</strong> <span class="sig-line">&nbsp;</span></p>
</div>

<p class="ref">Generated by CIP (Compliance Infrastructure Platform) for {tenant_name}<br>
PVARA NOC Regulation 12.2 — Targeted Financial Sanctions</p>
</body>
</html>"""
    return html


def generate_isar_html(isar, tenant, customer=None) -> str:
    """Generate Form A7 (ISAR) as printable HTML matching PVARA template."""

    reporter = isar.reporter_details or {}
    cust = isar.customer_details or {}
    tx = isar.transaction_details or {}
    mlro_det = isar.mlro_determination or {}

    # Customer details from linked customer if available (schema uses camelCase)
    cust_name = cust.get("customerName", cust.get("customer_name", "")) or (customer.full_name if customer else getattr(isar, "subject_name", "") or "")
    wallet_addrs = cust.get("walletAddresses", cust.get("wallet_addresses", [])) or []
    account_nums = cust.get("accountNumbers", cust.get("account_numbers", [])) or []

    # Transaction details (schema uses camelCase)
    tx_dates = tx.get("transactionDates", tx.get("dates", [])) or []
    tx_amounts = tx.get("amounts", []) or []
    tx_type = tx.get("transactionType", tx.get("type", "")) or ""
    tx_onchain = tx.get("onChainDetails", tx.get("offChainDetails", tx.get("onchain_details", ""))) or ""

    # MLRO determination
    determination = mlro_det.get("determination", "")
    det_checkbox = lambda val: "\u2611" if determination == val else "\u2610"

    tenant_name = escape(getattr(tenant, "name", "VASP"))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form A7 \u2014 Internal Suspicious Activity Report (ISAR)</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; }}
  h1 {{ font-size: 16pt; text-align: center; margin-bottom: 4px; }}
  .subtitle {{ text-align: center; font-size: 9pt; color: #666; margin-bottom: 24px; }}
  h2 {{ font-size: 12pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 24px; color: #1e3a5f; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 10pt; }}
  th {{ background: #f0f4f8; width: 35%; font-weight: 600; }}
  .narrative {{ white-space: pre-wrap; border: 1px solid #ccc; padding: 12px; min-height: 80px; background: #fafafa; font-size: 10pt; line-height: 1.5; }}
  .determination {{ margin: 4px 0; font-size: 11pt; }}
  .sig-block {{ margin-top: 30px; }}
  .sig-line {{ border-bottom: 1px solid #333; width: 250px; display: inline-block; margin-top: 20px; }}
  .ref {{ font-size: 8pt; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }}
  @media print {{ body {{ padding: 20px; }} }}
</style>
</head>
<body>
<h1>FORM A7 \u2014 INTERNAL SUSPICIOUS ACTIVITY REPORT (ISAR)</h1>
<p class="subtitle">Issued under the PVARA No Objection Certificate Regulations 2025, Annex A<br>
Reference: <a href="https://pvara.gov.pk" style="color:#1e3a5f;">pvara.gov.pk</a> \u00b7 ISAR Ref: {isar.id}</p>

<h2>SECTION 1 \u2014 REPORTER DETAILS</h2>
<table>
<tr><th>1.1 Name</th><td>{escape(str(reporter.get("reporterName", reporter.get("name", ""))))}</td></tr>
<tr><th>1.2 Position</th><td>{escape(str(reporter.get("reporterPosition", reporter.get("position", ""))))}</td></tr>
<tr><th>1.3 Date of Report</th><td>{escape(str(reporter.get("reportDate", reporter.get("date", str(isar.created_at)[:10] if isar.created_at else ""))))}</td></tr>
</table>

<h2>SECTION 2 \u2014 CUSTOMER DETAILS</h2>
<table>
<tr><th>2.1 Customer Name / ID</th><td>{escape(str(cust_name))}</td></tr>
<tr><th>2.2 Wallet Addresses</th><td>{escape(", ".join(wallet_addrs) if wallet_addrs else "N/A")}</td></tr>
<tr><th>2.3 Account Numbers</th><td>{escape(", ".join(account_nums) if account_nums else "N/A")}</td></tr>
</table>

<h2>SECTION 3 \u2014 TRANSACTION DETAILS</h2>
<table>
<tr><th>3.1 Date(s)</th><td>{escape(", ".join(tx_dates) if tx_dates else "N/A")}</td></tr>
<tr><th>3.2 Amount(s)</th><td>{escape(", ".join(str(a) for a in tx_amounts) if tx_amounts else "N/A")}</td></tr>
<tr><th>3.3 Type of Transaction</th><td>{escape(tx_type or "N/A")}</td></tr>
<tr><th>3.4 On-chain / Off-chain Details</th><td>{escape(tx_onchain or "N/A")}</td></tr>
</table>

<h2>SECTION 4 \u2014 SUSPICION NARRATIVE</h2>
<div class="narrative">{escape(getattr(isar, "suspicion_narrative", None) or getattr(isar, "narrative", "") or "No narrative provided.")}</div>

<h2>SECTION 5 \u2014 MLRO DETERMINATION</h2>
<p class="determination">{det_checkbox("file_str")} File STR</p>
<p class="determination">{det_checkbox("do_not_file")} Do not file</p>
<p class="determination">{det_checkbox("additional_info")} Additional information required</p>
{f'<p style="margin-top:8px;font-size:10pt;"><strong>Notes:</strong> {escape(str(mlro_det.get("determinationNotes", mlro_det.get("notes", ""))))}</p>' if mlro_det.get("determinationNotes") or mlro_det.get("notes") else ""}

<div class="sig-block">
<p><strong>MLRO Signature:</strong> <span class="sig-line"></span></p>
<p><strong>Name:</strong> {escape(str(mlro_det.get("mlroName", mlro_det.get("mlro_name", ""))))}</p>
<p><strong>Date:</strong> {escape(str(mlro_det.get("mlroSignatureDate", mlro_det.get("signature_date", ""))))}</p>
</div>

<p class="ref">Generated by CIP (Compliance Infrastructure Platform) for {tenant_name}<br>
PVARA NOC Regulations 2025, Annex A \u2014 Form A7</p>
</body>
</html>"""
