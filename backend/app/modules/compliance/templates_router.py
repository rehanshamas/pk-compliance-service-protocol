"""Public PVARA form template downloads — no authentication required."""

from fastapi import APIRouter
from fastapi.responses import Response

from app.core.pdf import html_to_pdf

router = APIRouter()


def _blank_form_a5_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form A5 — Outsourcing Declaration & Register (Blank Template)</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 15pt; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 9pt; color: #666; margin-bottom: 20px; }
  h2 { font-size: 11pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; color: #1e3a5f; margin-top: 20px; }
  p { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; font-size: 9pt; }
  th { background: #f0f4f8; font-weight: 600; }
  td { min-height: 20px; }
  .blank { height: 24px; }
  .sig-line { border-bottom: 1px solid #333; width: 250px; display: inline-block; margin-top: 16px; }
  .ref { font-size: 8pt; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
<h1>FORM A5 — OUTSOURCING DECLARATION &amp; REGISTER</h1>
<p class="subtitle">Issued under Regulation 14 of the PVARA No Objection Certificate Regulations 2025<br>
Reference: <a href="https://pvara.gov.pk">pvara.gov.pk</a> &middot; Virtual Assets Act 2026, Section 39</p>

<h2>SECTION A — APPLICANT DECLARATION</h2>
<p>The Applicant confirms that:</p>
<ol style="font-size:9pt; line-height:1.8;">
<li>It has identified all outsourced functions that support or impact AML/CFT obligations.</li>
<li>All outsourcing arrangements comply with Regulation 14 of the NOC Regulations.</li>
<li>The Applicant retains full responsibility and oversight for all outsourced functions.</li>
<li>All outsourcing contracts include appropriate service levels, data protection clauses, audit and inspection rights, termination rights, and controls to prevent unauthorised sub-outsourcing.</li>
<li>No outsourcing arrangement prevents or restricts compliance with AMLA 2010, PVARA Regulations or FMU reporting requirements.</li>
</ol>

<h2>SECTION B — OUTSOURCING REGISTER</h2>
<p style="font-size:9pt;">Complete one row for each outsourced service relevant to AML/CFT. Attach additional pages if required.</p>
<table>
<tr><th>No.</th><th>Item</th><th>Information Required</th></tr>
<tr><td>1.</td><td>Service Provider Name</td><td class="blank"></td></tr>
<tr><td>2.</td><td>Country of Incorporation / Operation</td><td class="blank"></td></tr>
<tr><td>3.</td><td>Function Outsourced</td><td class="blank"></td></tr>
<tr><td>4.</td><td>AML/CFT Relevance</td><td class="blank"></td></tr>
<tr><td>5.</td><td>Data Shared With Provider</td><td class="blank"></td></tr>
<tr><td>6.</td><td>SLA Summary</td><td class="blank"></td></tr>
<tr><td>7.</td><td>Audit Rights</td><td>☐ Yes &nbsp; ☐ No</td></tr>
<tr><td>8.</td><td>Sub-Outsourcing Permitted</td><td>☐ Yes &nbsp; ☐ No</td></tr>
<tr><td>9.</td><td>Termination Rights</td><td>☐ Standard &nbsp; ☐ Enhanced &nbsp; ☐ None</td></tr>
<tr><td>10.</td><td>Risk Assessment Summary</td><td>☐ Low &nbsp; ☐ Medium &nbsp; ☐ High<br>Justification: <span class="blank" style="width:100%;display:block;border-bottom:1px solid #999;"></span></td></tr>
<tr><td>11.</td><td>Monitoring Frequency</td><td>☐ Monthly &nbsp; ☐ Quarterly &nbsp; ☐ Annually</td></tr>
</table>

<h2>SECTION C — COMPLIANCE OFFICER SIGNATURE</h2>
<p style="font-size:9pt;">I, the undersigned Compliance Officer, declare that the information provided is true, complete and accurate; all AML-relevant outsourcing arrangements have been disclosed; all outsourcing complies with the NOC Regulations; the Applicant remains fully accountable for AML/CFT compliance.</p>
<p><strong>Name:</strong> <span class="sig-line"></span></p>
<p><strong>Signature:</strong> <span class="sig-line"></span></p>
<p><strong>Date:</strong> <span class="sig-line"></span></p>

<p class="ref">PVARA No Objection Certificate Regulations 2025, Annex A — Form A5<br>
Document Code: PVARA/REG/AML-REG/2025-1 &middot; <a href="https://pvara.gov.pk">pvara.gov.pk</a></p>
</body>
</html>"""


def _blank_form_a6_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form A6 — Annual AML/CFT Return (Blank Template)</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 15pt; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 9pt; color: #666; margin-bottom: 20px; }
  h2 { font-size: 11pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; color: #1e3a5f; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; font-size: 9pt; }
  th { background: #f0f4f8; font-weight: 600; width: 40%; }
  .blank { height: 24px; }
  .narrative-box { border: 1px solid #999; min-height: 60px; padding: 8px; margin: 8px 0; }
  .sig-line { border-bottom: 1px solid #333; width: 250px; display: inline-block; margin-top: 16px; }
  .ref { font-size: 8pt; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
<h1>FORM A6 — ANNUAL AML/CFT RETURN</h1>
<p class="subtitle">Issued under Regulation 18 of the PVARA No Objection Certificate Regulations 2025<br>
Reference: <a href="https://pvara.gov.pk">pvara.gov.pk</a> &middot; Virtual Assets Act 2026</p>

<h2>SECTION 1 — ENTITY PROFILE</h2>
<table>
<tr><th>1.1 Legal Name of Licensee</th><td class="blank"></td></tr>
<tr><th>1.2 PVARA Registration Number</th><td class="blank"></td></tr>
<tr><th>1.3 Reporting Period (From — To)</th><td class="blank"></td></tr>
<tr><th>1.4 Key Individuals in Post</th><td class="blank" style="height:48px;"></td></tr>
</table>

<h2>SECTION 2 — GOVERNANCE</h2>
<p style="font-size:9pt;"><strong>2.1 MLRO Annual Statement:</strong></p>
<div class="narrative-box"></div>
<p style="font-size:9pt;"><strong>2.2 Changes in Governance:</strong></p>
<div class="narrative-box"></div>
<p style="font-size:9pt;"><strong>2.3 Changes in Outsourcing Arrangements:</strong></p>
<div class="narrative-box"></div>

<h2>SECTION 3 — RISK ASSESSMENT UPDATE</h2>
<p style="font-size:9pt;"><strong>3.1 New ML/TF Risks Identified:</strong></p>
<div class="narrative-box"></div>
<p style="font-size:9pt;"><strong>3.2 Material Changes to Risk Ratings:</strong></p>
<div class="narrative-box"></div>
<p style="font-size:9pt;"><strong>3.3 Emerging Risk Trends:</strong></p>
<div class="narrative-box"></div>

<h2>SECTION 4 — CUSTOMER DUE DILIGENCE METRICS</h2>
<table>
<tr><th>4.1 Total Customers Onboarded</th><td class="blank"></td></tr>
<tr><th>4.2 Total High-Risk Customers</th><td class="blank"></td></tr>
<tr><th>4.3 Total PEPs</th><td class="blank"></td></tr>
<tr><th>4.4 Customers Refused During Onboarding</th><td class="blank"></td></tr>
<tr><th>4.5 Customers Exited Due to AML Concerns</th><td class="blank"></td></tr>
</table>

<h2>SECTION 5 — TRANSACTION MONITORING METRICS</h2>
<table>
<tr><th>5.1 Total Monitoring Alerts Generated</th><td class="blank"></td></tr>
<tr><th>5.2 Alerts Escalated to Compliance/MLRO</th><td class="blank"></td></tr>
<tr><th>5.3 Alerts Closed After Review</th><td class="blank"></td></tr>
<tr><th>5.4 Alerts Remaining Pending at Year-End</th><td class="blank"></td></tr>
</table>

<h2>SECTION 6 — STR/CTR REPORTING</h2>
<table>
<tr><th>6.1 Number of STRs Filed via goAML</th><td class="blank"></td></tr>
<tr><th>6.2 Broad Categories of Suspicion Reported</th><td class="blank" style="height:36px;"></td></tr>
<tr><th>6.3 Number of CTRs Filed</th><td class="blank"></td></tr>
</table>

<h2>SECTION 7 — INDEPENDENT AUDIT &amp; REMEDIATION</h2>
<p style="font-size:9pt;"><strong>7.1 Summary of Independent AML Audit Findings:</strong></p>
<div class="narrative-box"></div>
<p style="font-size:9pt;"><strong>7.2 Status of Audit Remediation:</strong> ☐ Fully Implemented &nbsp; ☐ Partially Implemented &nbsp; ☐ In Progress &nbsp; ☐ Not Yet Started</p>
<p style="font-size:9pt;"><strong>7.3 Outstanding Gaps:</strong></p>
<div class="narrative-box"></div>

<h2>SECTION 8 — DECLARATION</h2>
<p style="font-size:9pt;">By signing below, the MLRO and CEO confirm that: (1) The information is accurate and complete; (2) All required AML/CFT controls have been operated throughout the year; (3) The Licensee has maintained compliance with AMLA 2010 and PVARA Regulations; (4) Any material issues have been reported to PVARA.</p>
<p><strong>MLRO Name:</strong> <span class="sig-line"></span> &nbsp; <strong>Signature:</strong> <span class="sig-line"></span> &nbsp; <strong>Date:</strong> <span class="sig-line" style="width:120px;"></span></p>
<p><strong>CEO Name:</strong> <span class="sig-line"></span> &nbsp; <strong>Signature:</strong> <span class="sig-line"></span> &nbsp; <strong>Date:</strong> <span class="sig-line" style="width:120px;"></span></p>

<p class="ref">PVARA No Objection Certificate Regulations 2025, Annex A — Form A6<br>
Document Code: PVARA/REG/AML-REG/2025-1 &middot; <a href="https://pvara.gov.pk">pvara.gov.pk</a></p>
</body>
</html>"""


def _blank_form_a7_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form A7 — Internal Suspicious Activity Report (Blank Template)</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 15pt; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 9pt; color: #666; margin-bottom: 20px; }
  h2 { font-size: 11pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; color: #1e3a5f; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; font-size: 9pt; }
  th { background: #f0f4f8; font-weight: 600; width: 35%; }
  .blank { height: 24px; }
  .narrative-box { border: 1px solid #999; min-height: 100px; padding: 8px; margin: 8px 0; }
  .sig-line { border-bottom: 1px solid #333; width: 250px; display: inline-block; margin-top: 16px; }
  .ref { font-size: 8pt; color: #888; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
<h1>FORM A7 — INTERNAL SUSPICIOUS ACTIVITY REPORT (ISAR)</h1>
<p class="subtitle">Issued under the PVARA No Objection Certificate Regulations 2025, Annex A<br>
VASPs may use their own ISAR format but must include the below information at minimum.<br>
Reference: <a href="https://pvara.gov.pk">pvara.gov.pk</a></p>

<h2>SECTION 1 — REPORTER DETAILS</h2>
<table>
<tr><th>1.1 Name</th><td class="blank"></td></tr>
<tr><th>1.2 Position</th><td class="blank"></td></tr>
<tr><th>1.3 Date of Report</th><td class="blank"></td></tr>
</table>

<h2>SECTION 2 — CUSTOMER DETAILS</h2>
<table>
<tr><th>2.1 Customer Name / ID</th><td class="blank"></td></tr>
<tr><th>2.2 Wallet Addresses</th><td class="blank"></td></tr>
<tr><th>2.3 Account Numbers</th><td class="blank"></td></tr>
</table>

<h2>SECTION 3 — TRANSACTION DETAILS</h2>
<table>
<tr><th>3.1 Date(s)</th><td class="blank"></td></tr>
<tr><th>3.2 Amount(s)</th><td class="blank"></td></tr>
<tr><th>3.3 Type of Transaction</th><td class="blank"></td></tr>
<tr><th>3.4 On-chain / Off-chain Details</th><td class="blank"></td></tr>
</table>

<h2>SECTION 4 — SUSPICION NARRATIVE</h2>
<p style="font-size:9pt;">Describe the relevant facts, observed behaviour, identified indicators, and any applicable red flags.</p>
<div class="narrative-box"></div>

<h2>SECTION 5 — MLRO DETERMINATION</h2>
<p>☐ File STR &nbsp;&nbsp; ☐ Do not file &nbsp;&nbsp; ☐ Additional information required</p>
<p><strong>MLRO Signature:</strong> <span class="sig-line"></span></p>
<p><strong>Name:</strong> <span class="sig-line"></span></p>
<p><strong>Date:</strong> <span class="sig-line"></span></p>

<p class="ref">PVARA No Objection Certificate Regulations 2025, Annex A — Form A7<br>
Document Code: PVARA/REG/AML-REG/2025-1 &middot; <a href="https://pvara.gov.pk">pvara.gov.pk</a></p>
</body>
</html>"""


@router.get("/templates/form-a5")
async def download_form_a5_template():
    """Download blank Form A5 template as PDF (public, no auth)."""
    pdf_bytes = html_to_pdf(_blank_form_a5_html())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="PVARA-Form-A5-Template.pdf"'},
    )


@router.get("/templates/form-a6")
async def download_form_a6_template():
    """Download blank Form A6 template as PDF (public, no auth)."""
    pdf_bytes = html_to_pdf(_blank_form_a6_html())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="PVARA-Form-A6-Template.pdf"'},
    )


@router.get("/templates/form-a7")
async def download_form_a7_template():
    """Download blank Form A7 (ISAR) template as PDF (public, no auth)."""
    pdf_bytes = html_to_pdf(_blank_form_a7_html())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="PVARA-Form-A7-ISAR-Template.pdf"'},
    )
