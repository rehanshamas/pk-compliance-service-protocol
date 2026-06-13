/**
 * Typed API client for CIP backend. Uses stored JWT for auth.
 * Base URL from NEXT_PUBLIC_API_URL or localhost:8000.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiError {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccess<T> {
  status: "success";
  data: T;
  meta?: { page?: number; per_page?: number; total?: number };
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cip_access_token");
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cip_refresh_token");
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (res.status === 401 && !skipAuth) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      const refreshed = await refreshAuth(refreshToken);
      if (refreshed) {
        return apiRequest<T>(path, options, false);
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cip:auth-expired"));
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as ApiError;
    const msg = body.error?.message || res.statusText;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.data ?? data;
}

/** POST FormData (e.g. multipart). Browser sets Content-Type with boundary. */
export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  skipAuth = false
): Promise<T> {
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {};
  if (!skipAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: formData });
  if (res.status === 401 && !skipAuth) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      const refreshed = await refreshAuth(refreshToken);
      if (refreshed) return apiPostForm<T>(path, formData, false);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cip:auth-expired"));
    }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error?.message || res.statusText);
  }
  const data = await res.json();
  return (data.data ?? data) as T;
}

/** Upload file (e.g. CSV). Does not set Content-Type — browser sets multipart boundary. */
export async function apiUploadFile<T>(
  path: string,
  file: File,
  skipAuth = false
): Promise<T> {
  const url = `${API_BASE}/api/v1${path}`;
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (!skipAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: formData });
  if (res.status === 401 && !skipAuth) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      const refreshed = await refreshAuth(refreshToken);
      if (refreshed) return apiUploadFile<T>(path, file, false);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cip:auth-expired"));
    }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error?.message || res.statusText);
  }
  const data = await res.json();
  return (data.data ?? data) as T;
}

// --- Billing API ---

export async function getBillingPlans() {
  return apiRequest<any[]>("/billing/plans");
}

export async function createBillingPlan(data: any) {
  return apiRequest<any>("/billing/plans", { method: "POST", body: JSON.stringify(data) });
}

export async function getMyUsage() {
  return apiRequest<any>("/billing/usage/me");
}

export async function getTenantSubscription(tenantId: string) {
  return apiRequest<any>(`/billing/subscriptions/${tenantId}`);
}

export async function createSubscription(data: any) {
  return apiRequest<any>("/billing/subscriptions", { method: "POST", body: JSON.stringify(data) });
}

export async function generateInvoice(tenantId: string) {
  return apiRequest<any>(`/billing/invoices/generate?tenant_id=${tenantId}`, { method: "POST" });
}

export async function getTenantInvoices(tenantId: string) {
  return apiRequest<any[]>(`/billing/invoices/${tenantId}`);
}

// --- Admin Settings API ---

export async function getSystemSettings(category?: string) {
  const params = category ? `?category=${category}` : "";
  return apiRequest<any>(`/admin/settings${params}`);
}

export async function updateSystemSettings(updates: Record<string, string>) {
  return apiRequest<any>("/admin/settings", { method: "PATCH", body: JSON.stringify(updates) });
}

async function refreshAuth(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.access_token && typeof window !== "undefined") {
      localStorage.setItem("cip_access_token", json.access_token);
      if (json.refresh_token)
        localStorage.setItem("cip_refresh_token", json.refresh_token);
      const user = json.user;
      if (user) {
        const stored = localStorage.getItem("cip_mock_auth");
        const parsed = stored ? JSON.parse(stored) : {};
        localStorage.setItem(
          "cip_mock_auth",
          JSON.stringify({
            ...parsed,
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            tenantId: user.tenantId || "",
            tenantName: user.tenantName || "Platform",
          })
        );
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
