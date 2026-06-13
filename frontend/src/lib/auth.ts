/**
 * Auth for CIP dashboard. Phase 2: real backend API.
 */

export type UserRole =
  | "mlro"
  | "compliance_officer"
  | "analyst"
  | "developer"
  | "platform_admin"
  | "platform_support";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

const AUTH_KEY = "cip_mock_auth";
const ACCESS_TOKEN_KEY = "cip_access_token";
const REFRESH_TOKEN_KEY = "cip_refresh_token";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuth(user: AuthUser, tokens?: { accessToken: string; refreshToken: string }): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  if (tokens) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Login via backend API. Throws on error. */
export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message || "Login failed";
      throw new Error(msg);
    }

    const payload = data as LoginResponse;
    return payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error(
        `Cannot reach backend at ${API_BASE}. Is it running? Check CORS if using a different origin.`
      );
    }
    throw err;
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === "platform_admin" || role === "platform_support";
}

/** @deprecated Use AuthUser. Kept for backward compatibility. */
export type MockUser = AuthUser;

/** @deprecated Use getStoredUser */
export const getMockUser = getStoredUser;

/** @deprecated Use storeAuth */
export const setMockUser = storeAuth;

/** @deprecated Use clearAuth */
export const clearMockUser = clearAuth;
