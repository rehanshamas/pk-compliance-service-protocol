/**
 * KYC/Customers API client. Phase 4.12 frontend integration.
 */

import { apiRequest, apiPostForm } from "./api";

export type KycStatus =
  | "initiated"
  | "documents_uploaded"
  | "identity_verified"
  | "liveness_checked"
  | "risk_scored"
  | "approved"
  | "rejected"
  | "edd_required"
  | "edd_in_progress"
  | "frozen";

export type RiskTier = "low" | "medium" | "high" | "prohibited";

export interface Customer {
  id: string;
  tenantId: string;
  externalRef: string | null;
  fullName: string;
  dob: string | null;
  nationality: string | null;
  cnicNumber: string | null;
  riskTier: RiskTier;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
}

export interface DocumentDetail {
  id: string;
  customerId: string;
  documentType: string;
  fileKey: string;
  contentType: string;
  fileSizeBytes: number;
  ocrData?: Record<string, unknown> | null;
  createdAt: string;
}

export interface VerificationResultDetail {
  id: string;
  verificationType: string;
  provider: string;
  status: string;
  confidenceScore: number | null;
  rawResponse?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateCustomerPayload {
  full_name: string;
  external_ref?: string;
  dob?: string;
  nationality?: string;
  cnic_number?: string;
}

export interface UpdateCustomerPayload {
  external_ref?: string;
  full_name?: string;
  dob?: string;
  nationality?: string;
  cnic_number?: string;
  risk_tier?: RiskTier;
  kyc_status?: KycStatus;
}

export async function listCustomers(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  risk_tier?: string;
}): Promise<CustomerListResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.status) search.set("status", params.status);
  if (params?.risk_tier) search.set("risk_tier", params.risk_tier);
  const qs = search.toString();
  return apiRequest<CustomerListResponse>(`/customers${qs ? `?${qs}` : ""}`);
}

export async function getCustomer(id: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${id}`);
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type DocumentType =
  | "cnic"
  | "passport"
  | "driving_license"
  | "selfie"
  | "proof_of_address"
  | "bank_statement";

export interface EddCaseDetail {
  id: string;
  customerId: string;
  sourceOfFunds: string | null;
  sourceOfFundsVerified: boolean;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getEddCase(customerId: string): Promise<EddCaseDetail | null> {
  try {
    return await apiRequest<EddCaseDetail>(`/customers/${customerId}/edd`);
  } catch {
    return null;
  }
}

export async function startEdd(customerId: string): Promise<EddCaseDetail> {
  return apiRequest<EddCaseDetail>(`/customers/${customerId}/start-edd`, {
    method: "POST",
  });
}

export async function submitSourceOfFunds(
  customerId: string,
  payload: { source_of_funds: string; source_of_funds_verified?: boolean }
): Promise<EddCaseDetail> {
  return apiRequest<EddCaseDetail>(`/customers/${customerId}/edd`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, source_of_funds_verified: payload.source_of_funds_verified ?? false }),
  });
}

export async function approveEdd(customerId: string, notes?: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${customerId}/edd/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes ?? null }),
  });
}

export async function rejectEdd(customerId: string, notes: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${customerId}/edd/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function uploadDocument(
  customerId: string,
  documentType: DocumentType,
  file: File
): Promise<DocumentDetail> {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);
  return apiPostForm<DocumentDetail>(`/customers/${customerId}/documents`, formData);
}

export async function listDocuments(customerId: string): Promise<{ items: DocumentDetail[] }> {
  return apiRequest<{ items: DocumentDetail[] }>(`/customers/${customerId}/documents`);
}

export async function listVerificationResults(
  customerId: string
): Promise<{ items: VerificationResultDetail[] }> {
  return apiRequest<{ items: VerificationResultDetail[] }>(
    `/customers/${customerId}/verification-results`
  );
}

export async function verifyNadra(
  customerId: string
): Promise<VerificationResultDetail> {
  return apiRequest<VerificationResultDetail>(
    `/customers/${customerId}/verify-nadra`,
    { method: "POST" }
  );
}

export async function scoreRisk(customerId: string): Promise<Customer> {
  return apiRequest<Customer>(`/customers/${customerId}/score-risk`, {
    method: "POST",
  });
}

export interface RunKycResponse {
  customer: Customer;
  stepsRun: string[];
  message: string;
}

export async function runKycPipeline(
  customerId: string
): Promise<RunKycResponse> {
  return apiRequest<RunKycResponse>(`/customers/${customerId}/run-kyc`, {
    method: "POST",
  });
}

// --- Asset Freeze (PVARA Reg. 12.2) ---

export interface FreezeRecord {
  id: string;
  tenantId: string;
  customerId: string;
  screeningResultId: string | null;
  alertId: string | null;
  freezeType: string;
  matchedList: string | null;
  matchedName: string | null;
  matchScore: number | null;
  status: string; // frozen | reported_to_fmu | unfrozen
  frozenAt: string;
  reportedToFmuAt: string | null;
  unfrozenAt: string | null;
  unfreezeReason: string | null;
  frozenBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FreezeRecordListResponse {
  items: FreezeRecord[];
  total: number;
}

export interface FreezeRequest {
  freeze_type: "tfs_sanctions" | "nacta" | "un" | "court_order";
  screening_result_id?: string;
  alert_id?: string;
  matched_list?: string;
  matched_name?: string;
  match_score?: number;
  notes?: string;
}

export interface UnfreezeRequest {
  reason: "fmu_order" | "court_order" | "false_positive_confirmed";
  notes?: string;
}

export async function freezeCustomer(
  customerId: string,
  payload: FreezeRequest
): Promise<FreezeRecord> {
  return apiRequest<FreezeRecord>(`/customers/${customerId}/freeze`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reportFreezeToFmu(
  customerId: string
): Promise<FreezeRecord> {
  return apiRequest<FreezeRecord>(
    `/customers/${customerId}/report-freeze-to-fmu`,
    { method: "POST" }
  );
}

export async function unfreezeCustomer(
  customerId: string,
  payload: UnfreezeRequest
): Promise<FreezeRecord> {
  return apiRequest<FreezeRecord>(`/customers/${customerId}/unfreeze`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listFreezeRecords(
  customerId: string
): Promise<FreezeRecordListResponse> {
  return apiRequest<FreezeRecordListResponse>(
    `/customers/${customerId}/freeze-records`
  );
}
