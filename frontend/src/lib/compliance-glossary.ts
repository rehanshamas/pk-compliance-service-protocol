/**
 * Compliance term definitions for tooltips and usage guides.
 * Pakistan Virtual Assets Act 2026 / FCA terminology.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Optional longer guidance for contextual help panels */
  guidance?: string;
}

export const COMPLIANCE_GLOSSARY: Record<string, GlossaryEntry> = {
  ISAR: {
    term: "ISAR",
    definition:
      "Internal Suspicious Activity Report. Internal document recording suspicion of money laundering or terrorist financing before deciding whether to file an STR.",
    guidance:
      "Create an ISAR when you identify suspicious activity. The MLRO reviews and approves before filing as an STR. Drafts can be saved.",
  },
  STR: {
    term: "STR",
    definition:
      "Suspicious Transaction Report. Mandatory filing to FMU when a VASP has reasonable grounds to suspect money laundering or terrorist financing.",
    guidance: "STRs are filed via goAML after MLRO approval. Each STR links to an approved ISAR.",
  },
  CTR: {
    term: "CTR",
    definition:
      "Currency Transaction Report. Required for cash transactions exceeding the prescribed threshold (e.g., PKR 2M).",
    guidance: "CTRs are filed for large cash movements. Unlike STRs, they are threshold-based rather than suspicion-based.",
  },
  EDD: {
    term: "EDD",
    definition:
      "Enhanced Due Diligence. Additional checks for higher-risk customers (PEPs, high-risk jurisdictions, complex structures).",
    guidance:
      "EDD applies when risk scoring flags a customer as high risk. It may include source-of-funds verification and senior management approval.",
  },
  CDD: {
    term: "CDD",
    definition:
      "Customer Due Diligence. Standard identity verification and risk assessment when onboarding a customer.",
    guidance: "CDD includes document verification, CNIC/NADRA check, and risk tier assignment.",
  },
  KYC: {
    term: "KYC",
    definition:
      "Know Your Customer. Process of verifying a customer's identity before providing virtual asset services.",
    guidance: "KYC combines document upload, OCR, face matching, liveness, and NADRA verification.",
  },
  MLRO: {
    term: "MLRO",
    definition:
      "Money Laundering Reporting Officer. Designated officer responsible for receiving internal reports and filing STRs.",
    guidance: "The MLRO approves or rejects ISARs before they become STRs. They must be independent and have adequate authority.",
  },
  disposition: {
    term: "Disposition",
    definition:
      "Decision on a sanctions screening match: True Positive (confirmed hit), False Positive (no match), or Escalate (needs review).",
    guidance:
      "Every screening match must be dispositioned. True Positives may require enhanced monitoring or STR filing. Document your rationale.",
  },
  true_positive: {
    term: "True Positive",
    definition: "Screening match confirmed as a real hit against the watchlist. Requires further action.",
  },
  false_positive: {
    term: "False Positive",
    definition: "Screening match determined to be a false alarm (similar name, different person).",
  },
  escalated: {
    term: "Escalated",
    definition: "Screening match forwarded for senior review. Used when the analyst is uncertain.",
  },
  NADRA: {
    term: "NADRA",
    definition:
      "National Database and Registration Authority. Government authority for CNIC verification in Pakistan.",
    guidance: "NADRA Verisys confirms identity against the national database. Required for KYC in Pakistan.",
  },
  PEP: {
    term: "PEP",
    definition:
      "Politically Exposed Person. Individual in a prominent public position. Higher AML risk; requires EDD.",
    guidance: "PEP screening is separate from sanctions. PEP status triggers enhanced due diligence.",
  },
  OFAC: {
    term: "OFAC",
    definition: "Office of Foreign Assets Control (US). Sanctions list including SDN and Specially Designated Nationals.",
  },
  VASP: {
    term: "VASP",
    definition:
      "Virtual Asset Service Provider. Entity that offers exchange, transfer, or custodian services for virtual assets.",
  },
  goAML: {
    term: "goAML",
    definition: "FMU's online system for filing STRs, CTRs, and other regulatory reports in Pakistan.",
  },
  Form_A5: {
    term: "Form A5",
    definition: "Outsourcing register. Lists outsourced compliance functions (e.g., screening, analytics).",
  },
  Form_A6: {
    term: "Form A6",
    definition: "Annual return. Yearly reporting of compliance metrics, filings, and training to the regulator.",
  },
};

export type GlossaryKey = keyof typeof COMPLIANCE_GLOSSARY;

export function getGlossaryEntry(key: string): GlossaryEntry | undefined {
  return COMPLIANCE_GLOSSARY[key];
}
