// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Main Entry Point
// ---------------------------------------------------------------------------

import {
  CipKycConfig,
  CipKycResult,
  CipKycError,
  CipBranding,
  StepDef,
  DEFAULT_BRANDING,
  DEFAULT_STRINGS,
} from './types';
import { ApiClient } from './api-client';
import { stopCamera } from './camera';
import { injectStyles, removeStyles } from './ui/styles';
import {
  createContainer,
  destroyContainer,
  setContent,
  showLoading,
  ContainerRefs,
} from './ui/container';
import { renderStepper, updateStepper } from './ui/stepper';
import { createCompleteScreen } from './ui/result-screen';
import { captureDocument } from './steps/document-capture';
import { captureSelfie } from './steps/selfie-capture';
import { checkLiveness } from './steps/liveness-check';
import { captureDocumentInHand } from './steps/document-in-hand';

/**
 * CipKyc — the main SDK class.
 *
 * Usage:
 * ```ts
 * const kyc = new CipKyc({
 *   apiKey: 'your-api-key',
 *   sessionId: 'session-id-from-backend',
 *   onComplete: (result) => console.log(result),
 *   onError: (err) => console.error(err),
 * });
 * await kyc.start();
 * ```
 */
export class CipKyc {
  private config: CipKycConfig;
  private apiClient: ApiClient;
  private containerRefs: ContainerRefs | null = null;
  private steps: StepDef[] = [];
  private completedSteps: Set<string> = new Set();
  private currentStepIndex: number = -1;
  private destroyed: boolean = false;

  constructor(config: CipKycConfig) {
    if (!config.apiKey) throw new Error('CipKyc: apiKey is required');
    if (!config.sessionId) throw new Error('CipKyc: sessionId is required');

    this.config = {
      apiBaseUrl: 'https://api.cip.app',
      verificationLevel: 'basic',
      locale: 'en',
      ...config,
    };

    this.apiClient = new ApiClient(this.config.apiBaseUrl!, this.config.apiKey);
  }

  // ---- Public API --------------------------------------------------------

  /**
   * Start the KYC verification flow.
   * Creates the UI, fetches session info, and begins the first step.
   */
  async start(): Promise<void> {
    if (this.destroyed) {
      throw new Error('CipKyc: instance has been destroyed. Create a new one.');
    }

    try {
      // 1. Inject styles
      injectStyles(this.config.branding || {});

      // 2. Create UI container
      this.containerRefs = createContainer(this.config);

      // 3. Show loading while fetching session
      showLoading(this.containerRefs, 'Initializing verification...');

      // 4. Fetch session details
      const session = await this.apiClient.getSession(this.config.sessionId);

      // Use server-provided verification level if available, else config
      const level = session.verificationLevel || this.config.verificationLevel || 'basic';

      // 5. Determine steps
      this.steps = this.buildStepList(level);

      // Mark already-completed steps
      if (session.completedSteps) {
        session.completedSteps.forEach((s) => this.completedSteps.add(s));
      }

      // Find the first incomplete step
      this.currentStepIndex = this.steps.findIndex(
        (s) => !this.completedSteps.has(s.id),
      );
      if (this.currentStepIndex === -1) {
        // All steps already done — show complete
        await this.showComplete();
        return;
      }

      // 6. Render stepper
      this.renderStepper();

      // 7. Run the first step
      await this.runCurrentStep();
    } catch (err: any) {
      this.handleError(err);
    }
  }

  /**
   * Destroy the SDK instance: stop camera, remove DOM, clean up.
   */
  destroy(): void {
    this.destroyed = true;
    destroyContainer();
    removeStyles();
    this.containerRefs = null;
  }

  // ---- Step routing ------------------------------------------------------

  private async runCurrentStep(): Promise<void> {
    if (this.destroyed || !this.containerRefs) return;

    const step = this.steps[this.currentStepIndex];
    if (!step) {
      await this.showComplete();
      return;
    }

    this.renderStepper();

    const strings = { ...DEFAULT_STRINGS, ...this.config.strings };

    try {
      let result;

      switch (step.id) {
        case 'document_front':
          result = await captureDocument(
            'front',
            this.apiClient,
            this.config.sessionId,
            this.containerRefs,
            strings,
          );
          break;

        case 'document_back':
          result = await captureDocument(
            'back',
            this.apiClient,
            this.config.sessionId,
            this.containerRefs,
            strings,
          );
          break;

        case 'selfie':
          result = await captureSelfie(
            this.apiClient,
            this.config.sessionId,
            this.containerRefs,
            strings,
          );
          break;

        case 'liveness':
          result = await checkLiveness(
            this.apiClient,
            this.config.sessionId,
            this.containerRefs,
            strings,
          );
          break;

        case 'document_in_hand':
          result = await captureDocumentInHand(
            this.apiClient,
            this.config.sessionId,
            this.containerRefs,
            strings,
          );
          break;

        default:
          throw { code: 'UNKNOWN_STEP', message: `Unknown step: ${step.id}` };
      }

      // Step completed
      this.completedSteps.add(step.id);

      // Notify callback
      if (this.config.onStepComplete) {
        this.config.onStepComplete(step.id, result);
      }

      // Complete step on backend
      try {
        await this.apiClient.completeStep(this.config.sessionId, step.id);
      } catch {
        // Non-fatal — backend may have already marked it
      }

      // Check if the session is fully complete
      if (result && result.isComplete) {
        await this.showComplete();
        return;
      }

      // Move to next step
      this.currentStepIndex++;
      if (this.currentStepIndex >= this.steps.length) {
        await this.showComplete();
      } else {
        await this.runCurrentStep();
      }
    } catch (err: any) {
      this.handleError(err);
    }
  }

  // ---- Completion --------------------------------------------------------

  private async showComplete(): Promise<void> {
    if (!this.containerRefs) return;

    // Update stepper to show all done
    this.currentStepIndex = this.steps.length;
    this.renderStepper();

    // Fetch final session state
    let finalResult: CipKycResult;
    try {
      const session = await this.apiClient.getSession(this.config.sessionId);
      finalResult = {
        sessionId: this.config.sessionId,
        status: mapStatus(session.status),
        kycStatus: session.status,
        riskTier: (session as any).riskTier || 'unknown',
        customerId: (session as any).customerId || null,
        data: (session as any).data || {},
      };
    } catch {
      // Fallback result
      finalResult = {
        sessionId: this.config.sessionId,
        status: 'pending',
        kycStatus: 'pending',
        riskTier: 'unknown',
        customerId: null,
        data: {},
      };
    }

    const screen = createCompleteScreen(finalResult, () => {
      if (this.config.onComplete) {
        this.config.onComplete(finalResult);
      }
      this.destroy();
    });

    setContent(this.containerRefs, screen);

    // Also fire callback immediately for programmatic consumers
    if (this.config.onComplete) {
      this.config.onComplete(finalResult);
    }
  }

  // ---- Stepper -----------------------------------------------------------

  private renderStepper(): void {
    if (!this.containerRefs) return;
    updateStepper(
      this.containerRefs.root,
      this.steps,
      this.currentStepIndex,
      this.completedSteps,
    );
  }

  // ---- Step list building ------------------------------------------------

  private buildStepList(level: 'basic' | 'advanced'): StepDef[] {
    const strings = { ...DEFAULT_STRINGS, ...this.config.strings };
    const steps: StepDef[] = [
      { id: 'document_front', label: strings['step.document'] },
      { id: 'document_back', label: strings['step.document'] + ' (Back)' },
      { id: 'selfie', label: strings['step.selfie'] },
    ];

    if (level === 'advanced') {
      steps.push(
        { id: 'liveness', label: strings['step.liveness'] },
        { id: 'document_in_hand', label: strings['step.doc_in_hand'] },
      );
    }

    return steps;
  }

  // ---- Error handling ----------------------------------------------------

  private handleError(err: any): void {
    const error: CipKycError = {
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message || 'An unexpected error occurred.',
      step: this.steps[this.currentStepIndex]?.id,
    };

    if (this.config.onError) {
      this.config.onError(error);
    }

    // Show error in UI if container exists
    if (this.containerRefs) {
      const errorEl = document.createElement('div');
      errorEl.className = 'cip-kyc-result';
      errorEl.innerHTML = `
        <div class="cip-kyc-result-icon cip-kyc-result-icon--error">\u2717</div>
        <div class="cip-kyc-result-title">Something went wrong</div>
        <div class="cip-kyc-result-message">${escapeHtml(error.message)}</div>
      `;

      const retryBtn = document.createElement('button');
      retryBtn.className = 'cip-kyc-btn cip-kyc-btn--primary';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => this.runCurrentStep());
      errorEl.appendChild(retryBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'cip-kyc-btn cip-kyc-btn--secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        if (this.config.onCancel) this.config.onCancel();
        this.destroy();
      });
      errorEl.appendChild(cancelBtn);

      setContent(this.containerRefs, errorEl);
    }
  }
}

// ---- Helpers -------------------------------------------------------------

function mapStatus(status: string): 'approved' | 'rejected' | 'pending' {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'verified' || s === 'completed') return 'approved';
  if (s === 'rejected' || s === 'failed') return 'rejected';
  return 'pending';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Re-exports ----------------------------------------------------------

export type {
  CipKycConfig,
  CipBranding,
  CipKycResult,
  CipKycError,
  StepResult,
} from './types';
