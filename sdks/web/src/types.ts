// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Type Definitions
// ---------------------------------------------------------------------------

export interface CipKycConfig {
  /** API key issued by CIP for the VASP */
  apiKey: string;
  /** KYC session ID obtained from the CIP backend */
  sessionId: string;
  /** CIP backend base URL (default: https://api.cip.app) */
  apiBaseUrl?: string;
  /** DOM element ID to mount the SDK into (default: creates fullscreen overlay) */
  containerId?: string;
  /** Verification level — advanced adds liveness + document-in-hand */
  verificationLevel?: 'basic' | 'advanced';
  /** Visual branding overrides */
  branding?: CipBranding;
  /** Locale code (default: 'en') */
  locale?: string;
  /** Custom string overrides keyed by string ID */
  strings?: Record<string, string>;
  /** Fired when the entire verification flow completes */
  onComplete?: (result: CipKycResult) => void;
  /** Fired after each individual step completes */
  onStepComplete?: (step: string, data: any) => void;
  /** Fired on any error */
  onError?: (error: CipKycError) => void;
  /** Fired when the user cancels the flow */
  onCancel?: () => void;
}

export interface CipBranding {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  logo?: string;
  companyName?: string;
  fontFamily?: string;
  borderRadius?: string;
}

export interface CipKycResult {
  sessionId: string;
  status: 'approved' | 'rejected' | 'pending';
  kycStatus: string;
  riskTier: string;
  customerId: string | null;
  data: {
    fullName?: string;
    cnicNumber?: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    faceMatchScore?: number;
    livenessScore?: number;
  };
}

export interface CipKycError {
  code: string;
  message: string;
  step?: string;
}

export interface StepResult {
  step: string;
  passed: boolean;
  data: Record<string, any>;
  errors: string[];
  quality: QualityReport | null;
  sessionStatus: string;
  nextStep: string | null;
  isComplete: boolean;
}

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SessionInfo {
  id: string;
  status: string;
  verificationLevel: 'basic' | 'advanced';
  currentStep: string | null;
  completedSteps: string[];
  customer: {
    fullName?: string;
    cnicNumber?: string;
  } | null;
}

/** Internal step definition */
export interface StepDef {
  id: string;
  label: string;
}

/** Default branding values */
export const DEFAULT_BRANDING: Required<CipBranding> = {
  primaryColor: '#F28A17',
  backgroundColor: '#0A0A0C',
  textColor: '#F5F5F5',
  logo: '',
  companyName: 'CIP',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  borderRadius: '12px',
};

/** Default strings (English) */
export const DEFAULT_STRINGS: Record<string, string> = {
  'header.title': 'Identity Verification',
  'step.document': 'Document',
  'step.selfie': 'Selfie',
  'step.liveness': 'Liveness',
  'step.doc_in_hand': 'Doc-in-Hand',
  'step.complete': 'Complete',
  'doc.front.instruction': 'Position the front of your CNIC within the frame',
  'doc.back.instruction': 'Now flip your CNIC and capture the back',
  'selfie.instruction': 'Position your face within the oval',
  'liveness.blink': 'Blink your eyes naturally',
  'liveness.turn': 'Turn your head slowly to the left',
  'liveness.processing': 'Verifying liveness...',
  'doc_in_hand.instruction': 'Hold your CNIC next to your face',
  'capture.button': 'Capture',
  'capture.retake': 'Retake',
  'capture.continue': 'Continue',
  'capture.retry': 'Retry',
  'result.success': 'Step completed successfully',
  'result.fail': 'Verification failed',
  'result.complete.title': 'Verification Complete',
  'result.complete.approved': 'Your identity has been verified.',
  'result.complete.pending': 'Your verification is being reviewed.',
  'result.complete.rejected': 'Verification could not be completed.',
  'error.camera.denied': 'Camera access was denied. Please allow camera access and try again.',
  'error.camera.unavailable': 'No camera found on this device.',
  'error.network': 'Network error. Please check your connection and try again.',
  'cancel.confirm': 'Are you sure you want to cancel verification?',
};
