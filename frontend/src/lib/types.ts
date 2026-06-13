/** Shared TypeScript types for CIP frontend. */

export interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  timestamp: string;
  created_at?: string;
}

export interface ScreeningResult {
  id: string;
  tenantId: string;
  screenedEntityName: string;
  screenedEntityType?: string;
  overallStatus?: string;
  source?: string;
  matchScore?: number;
  matches?: Array<{
    source: string;
    matched_name: string;
    score: number;
    list_entry_id?: string;
  }>;
  dispositionStatus: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface Alert {
  id: string;
  tenantId: string;
  sourceType?: string;
  sourceId?: string;
  source?: string;
  severity: string;
  status: string;
  summary: string;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
  [key: string]: unknown;
}

export interface SearchResult {
  type: "customer" | "wallet" | "case" | "isar" | "alert";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
