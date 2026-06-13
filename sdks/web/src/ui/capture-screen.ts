// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Camera Capture Screen
// ---------------------------------------------------------------------------

import { CipBranding, DEFAULT_BRANDING } from '../types';

export type OverlayType = 'document' | 'face' | 'face_and_document';

export interface CaptureScreenOptions {
  /** 'document' rectangle, 'face' oval, or 'face_and_document' split */
  overlay: OverlayType;
  /** Instruction text shown below the camera */
  instruction: string;
  /** Mirror the video (true for front camera) */
  mirror?: boolean;
  /** Called when user taps capture */
  onCapture: () => void;
  /** Called when user taps retake (shown after capture) */
  onRetake: () => void;
  /** Called when user taps continue (shown after successful capture) */
  onContinue: () => void;
  /** Branding config */
  branding?: CipBranding;
}

/**
 * Build the capture screen DOM.
 * Returns an object with the root element and helper methods to control state.
 */
export function createCaptureScreen(options: CaptureScreenOptions) {
  const root = document.createElement('div');
  root.className = 'cip-kyc-content';

  // ---- Camera wrapper
  const cameraWrapper = document.createElement('div');
  cameraWrapper.className = 'cip-kyc-camera-wrapper';

  const video = document.createElement('video');
  video.className = 'cip-kyc-camera-video';
  if (options.mirror) video.classList.add('cip-kyc-camera-video--mirror');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.muted = true;
  cameraWrapper.appendChild(video);

  // Overlay
  const overlayEl = document.createElement('div');
  overlayEl.className = 'cip-kyc-overlay';
  overlayEl.innerHTML = buildOverlaySVG(options.overlay, options.branding);
  cameraWrapper.appendChild(overlayEl);

  // Preview image (hidden until capture)
  const preview = document.createElement('img');
  preview.className = 'cip-kyc-preview';
  preview.style.display = 'none';
  cameraWrapper.appendChild(preview);

  root.appendChild(cameraWrapper);

  // ---- Instruction
  const instruction = document.createElement('div');
  instruction.className = 'cip-kyc-instruction';
  instruction.textContent = options.instruction;
  root.appendChild(instruction);

  // ---- Quality feedback area (hidden by default)
  const qualityArea = document.createElement('div');
  qualityArea.style.display = 'none';
  qualityArea.style.padding = '0 16px';
  root.appendChild(qualityArea);

  // ---- Controls
  const controls = document.createElement('div');
  controls.className = 'cip-kyc-controls';

  const captureBtn = document.createElement('button');
  captureBtn.className = 'cip-kyc-btn cip-kyc-btn--capture';
  captureBtn.setAttribute('aria-label', 'Capture');
  captureBtn.innerHTML = '';
  captureBtn.addEventListener('click', options.onCapture);
  controls.appendChild(captureBtn);

  const retakeBtn = document.createElement('button');
  retakeBtn.className = 'cip-kyc-btn cip-kyc-btn--secondary';
  retakeBtn.textContent = 'Retake';
  retakeBtn.style.display = 'none';
  retakeBtn.addEventListener('click', options.onRetake);
  controls.appendChild(retakeBtn);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'cip-kyc-btn cip-kyc-btn--primary';
  continueBtn.textContent = 'Continue';
  continueBtn.style.display = 'none';
  continueBtn.addEventListener('click', options.onContinue);
  controls.appendChild(continueBtn);

  root.appendChild(controls);

  // ---- Loading state
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'cip-kyc-loading';
  loadingOverlay.style.display = 'none';
  loadingOverlay.style.position = 'absolute';
  loadingOverlay.style.inset = '0';
  loadingOverlay.style.background = 'rgba(10,10,12,0.85)';
  loadingOverlay.style.zIndex = '10';
  loadingOverlay.innerHTML = `
    <div class="cip-kyc-spinner"></div>
    <div class="cip-kyc-loading-text">Processing...</div>
  `;
  root.appendChild(loadingOverlay);

  return {
    root,
    video,
    preview,

    /** Show the captured image and hide video */
    showPreview(dataUrl: string) {
      preview.src = dataUrl;
      preview.style.display = 'block';
      video.style.display = 'none';
      overlayEl.style.display = 'none';
      captureBtn.style.display = 'none';
      retakeBtn.style.display = 'inline-flex';
      continueBtn.style.display = 'inline-flex';
    },

    /** Return to live video view */
    showVideo() {
      preview.style.display = 'none';
      video.style.display = 'block';
      overlayEl.style.display = 'block';
      captureBtn.style.display = 'inline-flex';
      retakeBtn.style.display = 'none';
      continueBtn.style.display = 'none';
      qualityArea.style.display = 'none';
      qualityArea.innerHTML = '';
    },

    /** Show loading overlay */
    showLoading(text?: string) {
      loadingOverlay.style.display = 'flex';
      const txt = loadingOverlay.querySelector('.cip-kyc-loading-text');
      if (txt) txt.textContent = text || 'Processing...';
    },

    /** Hide loading overlay */
    hideLoading() {
      loadingOverlay.style.display = 'none';
    },

    /** Update instruction text */
    setInstruction(text: string) {
      instruction.textContent = text;
    },

    /** Show quality issues */
    showQualityIssues(issues: { code: string; message: string; severity: string }[]) {
      qualityArea.innerHTML = '';
      if (issues.length === 0) {
        qualityArea.style.display = 'none';
        return;
      }
      qualityArea.style.display = 'block';
      const container = document.createElement('div');
      container.className = 'cip-kyc-quality';
      issues.forEach((issue) => {
        const item = document.createElement('div');
        item.className = 'cip-kyc-quality-item';
        item.textContent = issue.message;
        container.appendChild(item);
      });
      qualityArea.appendChild(container);
    },

    /** Switch to retake-only mode (no continue) */
    showRetakeOnly() {
      captureBtn.style.display = 'none';
      retakeBtn.style.display = 'inline-flex';
      continueBtn.style.display = 'none';
    },

    /** Hide all controls (for liveness auto-capture mode) */
    hideControls() {
      controls.style.display = 'none';
    },

    /** Show controls */
    showControls() {
      controls.style.display = 'flex';
    },

    /** Change overlay type */
    setOverlay(type: OverlayType) {
      overlayEl.innerHTML = buildOverlaySVG(type, options.branding);
    },
  };
}

// ---- Overlay SVG builders ------------------------------------------------

function buildOverlaySVG(type: OverlayType, branding?: CipBranding): string {
  const color = branding?.primaryColor || DEFAULT_BRANDING.primaryColor;

  switch (type) {
    case 'document':
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <!-- Semi-transparent mask -->
        <defs>
          <mask id="cip-doc-mask">
            <rect width="400" height="300" fill="white"/>
            <rect x="40" y="40" width="320" height="200" rx="12" fill="black"/>
          </mask>
        </defs>
        <rect width="400" height="300" fill="rgba(0,0,0,0.5)" mask="url(#cip-doc-mask)"/>
        <!-- Document outline -->
        <rect x="40" y="40" width="320" height="200" rx="12"
          fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="12 6"/>
        <!-- Corner accents -->
        <path d="M52 56 L52 48 a8 8 0 0 1 8 -8 L72 40" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M348 40 L356 40 a8 8 0 0 1 8 8 L364 56" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M52 232 L52 240 a8 8 0 0 0 8 8 L72 248" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M348 248 L356 248 a8 8 0 0 0 8 -8 L364 232" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>`;

    case 'face':
      return `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="cip-face-mask">
            <rect width="300" height="400" fill="white"/>
            <ellipse cx="150" cy="170" rx="90" ry="120" fill="black"/>
          </mask>
        </defs>
        <rect width="300" height="400" fill="rgba(0,0,0,0.5)" mask="url(#cip-face-mask)"/>
        <ellipse cx="150" cy="170" rx="90" ry="120"
          fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="10 5"/>
      </svg>`;

    case 'face_and_document':
      return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="cip-fad-mask">
            <rect width="400" height="400" fill="white"/>
            <ellipse cx="200" cy="130" rx="70" ry="90" fill="black"/>
            <rect x="80" y="260" width="240" height="120" rx="10" fill="black"/>
          </mask>
        </defs>
        <rect width="400" height="400" fill="rgba(0,0,0,0.5)" mask="url(#cip-fad-mask)"/>
        <!-- Face zone -->
        <ellipse cx="200" cy="130" rx="70" ry="90"
          fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="10 5"/>
        <text x="200" y="40" text-anchor="middle" fill="${color}" font-size="12" font-family="sans-serif">Face</text>
        <!-- Document zone -->
        <rect x="80" y="260" width="240" height="120" rx="10"
          fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="10 5"/>
        <text x="200" y="252" text-anchor="middle" fill="${color}" font-size="12" font-family="sans-serif">Document</text>
      </svg>`;

    default:
      return '';
  }
}
