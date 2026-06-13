// ---------------------------------------------------------------------------
// CIP KYC Web SDK — API Client
// ---------------------------------------------------------------------------

import { CipKycError, SessionInfo, StepResult } from './types';

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  // ---- Session -----------------------------------------------------------

  /** Fetch session details for verification */
  async getSession(sessionId: string): Promise<SessionInfo> {
    const res = await this.request<SessionInfo>(
      'GET',
      `/api/v1/kyc-sessions/${sessionId}/verify`,
    );
    return res;
  }

  // ---- Frame processing --------------------------------------------------

  /** Send a single captured frame for a given step */
  async processFrame(
    sessionId: string,
    step: string,
    imageBlob: Blob,
  ): Promise<StepResult> {
    const form = new FormData();
    form.append('step', step);
    form.append('frame', imageBlob, `${step}.jpg`);

    const res = await this.request<StepResult>(
      'POST',
      `/api/v1/kyc-sessions/${sessionId}/process-frame`,
      form,
    );
    return res;
  }

  // ---- Liveness ----------------------------------------------------------

  /** Send multiple frames captured during the liveness challenge */
  async processLiveness(
    sessionId: string,
    frames: Blob[],
  ): Promise<StepResult> {
    const form = new FormData();
    frames.forEach((blob, i) => {
      form.append('frames', blob, `liveness_${i}.jpg`);
    });

    const res = await this.request<StepResult>(
      'POST',
      `/api/v1/kyc-sessions/${sessionId}/process-liveness`,
      form,
    );
    return res;
  }

  // ---- Step completion ---------------------------------------------------

  /** Mark a step as complete on the backend */
  async completeStep(
    sessionId: string,
    step: string,
  ): Promise<StepResult> {
    const res = await this.request<StepResult>(
      'POST',
      `/api/v1/kyc-sessions/${sessionId}/complete-step`,
      JSON.stringify({ step }),
      { 'Content-Type': 'application/json' },
    );
    return res;
  }

  // ---- Internal ----------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: FormData | string | null,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      Accept: 'application/json',
      ...extraHeaders,
    };

    const init: RequestInit = { method, headers };

    if (body) {
      init.body = body;
      // Do NOT set Content-Type for FormData — browser sets boundary automatically
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw this.buildError('NETWORK_ERROR', 'Network error. Please check your connection.');
    }

    if (!res.ok) {
      let msg = `Request failed with status ${res.status}`;
      try {
        const json = await res.json();
        if (json.message) msg = json.message;
        if (json.detail) msg = json.detail;
      } catch {
        // ignore parse failure
      }
      throw this.buildError(`HTTP_${res.status}`, msg);
    }

    const json = await res.json();
    return json as T;
  }

  private buildError(code: string, message: string): CipKycError {
    return { code, message };
  }
}
