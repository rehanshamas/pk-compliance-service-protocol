// ---------------------------------------------------------------------------
// CIP KYC Web SDK — CSS-in-JS Styles
// ---------------------------------------------------------------------------

import { CipBranding, DEFAULT_BRANDING } from '../types';

const STYLE_ID = 'cip-kyc-styles';

/** Inject SDK styles into the document head. Idempotent — removes old styles first. */
export function injectStyles(branding: CipBranding): void {
  removeStyles();

  const b = { ...DEFAULT_BRANDING, ...branding };

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildCSS(b);
  document.head.appendChild(style);
}

/** Remove injected SDK styles */
export function removeStyles(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}

function buildCSS(b: Required<CipBranding>): string {
  return `
/* ===== CIP KYC SDK Root Variables ===== */
.cip-kyc {
  --cip-primary: ${b.primaryColor};
  --cip-bg: ${b.backgroundColor};
  --cip-text: ${b.textColor};
  --cip-text-muted: ${hexToMuted(b.textColor)};
  --cip-font: ${b.fontFamily};
  --cip-radius: ${b.borderRadius};
  --cip-success: #22C55E;
  --cip-error: #EF4444;
  --cip-surface: ${hexToSurface(b.backgroundColor)};
}

/* ===== Container ===== */
.cip-kyc {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 480px;
  background: var(--cip-bg);
  color: var(--cip-text);
  font-family: var(--cip-font);
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cip-kyc *, .cip-kyc *::before, .cip-kyc *::after {
  box-sizing: border-box;
}

/* Fullscreen overlay mode */
.cip-kyc--overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
}

/* ===== Header ===== */
.cip-kyc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cip-surface);
  flex-shrink: 0;
}

.cip-kyc-header-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: contain;
}

.cip-kyc-header-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--cip-text);
}

.cip-kyc-cancel {
  background: none;
  border: none;
  color: var(--cip-text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  line-height: 1;
}
.cip-kyc-cancel:hover {
  background: var(--cip-surface);
  color: var(--cip-text);
}

/* ===== Stepper ===== */
.cip-kyc-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 16px;
  flex-shrink: 0;
}

.cip-kyc-step {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--cip-text-muted);
  transition: color 0.2s;
}

.cip-kyc-step--active {
  color: var(--cip-primary);
  font-weight: 600;
}

.cip-kyc-step--done {
  color: var(--cip-success);
}

.cip-kyc-step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--cip-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.2s;
}

.cip-kyc-step--active .cip-kyc-step-dot {
  border-color: var(--cip-primary);
  background: var(--cip-primary);
  color: #fff;
}

.cip-kyc-step--done .cip-kyc-step-dot {
  border-color: var(--cip-success);
  background: var(--cip-success);
  color: #fff;
}

.cip-kyc-step-connector {
  width: 24px;
  height: 2px;
  background: var(--cip-text-muted);
  opacity: 0.3;
  border-radius: 1px;
}

.cip-kyc-step--done + .cip-kyc-step-connector {
  background: var(--cip-success);
  opacity: 0.7;
}

/* ===== Content Area ===== */
.cip-kyc-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ===== Camera View ===== */
.cip-kyc-camera-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #000;
}

.cip-kyc-camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cip-kyc-camera-video--mirror {
  transform: scaleX(-1);
}

/* ===== Overlays ===== */
.cip-kyc-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cip-kyc-overlay svg {
  width: 100%;
  height: 100%;
}

/* ===== Instruction Bar ===== */
.cip-kyc-instruction {
  padding: 12px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--cip-text);
  background: var(--cip-surface);
  flex-shrink: 0;
}

/* ===== Controls ===== */
.cip-kyc-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  flex-shrink: 0;
}

/* ===== Buttons ===== */
.cip-kyc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--cip-font);
  border: none;
  border-radius: var(--cip-radius);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  min-width: 120px;
}
.cip-kyc-btn:active {
  transform: scale(0.97);
}
.cip-kyc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cip-kyc-btn--primary {
  background: var(--cip-primary);
  color: #fff;
}
.cip-kyc-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.cip-kyc-btn--secondary {
  background: var(--cip-surface);
  color: var(--cip-text);
}
.cip-kyc-btn--secondary:hover:not(:disabled) {
  opacity: 0.8;
}

.cip-kyc-btn--capture {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--cip-primary);
  border: 4px solid rgba(255,255,255,0.3);
  padding: 0;
  min-width: unset;
}
.cip-kyc-btn--capture:hover:not(:disabled) {
  border-color: rgba(255,255,255,0.6);
}

/* ===== Preview Image ===== */
.cip-kyc-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ===== Result Screen ===== */
.cip-kyc-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  gap: 16px;
}

.cip-kyc-result-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.cip-kyc-result-icon--success {
  background: rgba(34,197,94,0.15);
  color: var(--cip-success);
}

.cip-kyc-result-icon--error {
  background: rgba(239,68,68,0.15);
  color: var(--cip-error);
}

.cip-kyc-result-icon--pending {
  background: rgba(242,138,23,0.15);
  color: var(--cip-primary);
}

.cip-kyc-result-title {
  font-size: 18px;
  font-weight: 700;
}

.cip-kyc-result-message {
  font-size: 14px;
  color: var(--cip-text-muted);
  max-width: 300px;
}

.cip-kyc-result-data {
  width: 100%;
  max-width: 320px;
  text-align: left;
}

.cip-kyc-result-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--cip-surface);
  font-size: 13px;
}

.cip-kyc-result-label {
  color: var(--cip-text-muted);
}

.cip-kyc-result-value {
  font-weight: 600;
  color: var(--cip-text);
}

/* ===== Quality Issues ===== */
.cip-kyc-quality {
  padding: 12px;
  background: rgba(239,68,68,0.1);
  border-radius: var(--cip-radius);
  max-width: 320px;
  width: 100%;
}

.cip-kyc-quality-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--cip-error);
  padding: 4px 0;
}

/* ===== Loading Spinner ===== */
.cip-kyc-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--cip-surface);
  border-top-color: var(--cip-primary);
  border-radius: 50%;
  animation: cip-spin 0.8s linear infinite;
}

@keyframes cip-spin {
  to { transform: rotate(360deg); }
}

.cip-kyc-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.cip-kyc-loading-text {
  font-size: 14px;
  color: var(--cip-text-muted);
}

/* ===== Responsive ===== */
@media (max-width: 480px) {
  .cip-kyc-stepper {
    gap: 2px;
    padding: 8px 12px;
  }
  .cip-kyc-step-label {
    display: none;
  }
  .cip-kyc-step-connector {
    width: 16px;
  }
}
`;
}

// ---- Color helpers -------------------------------------------------------

function hexToMuted(hex: string): string {
  // Returns an rgba version at 60% opacity
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)` : 'rgba(245,245,245,0.6)';
}

function hexToSurface(hex: string): string {
  // Lighten background slightly for surface elements
  const rgb = hexToRgb(hex);
  if (!rgb) return 'rgba(255,255,255,0.08)';
  return `rgba(${Math.min(rgb.r + 20, 255)}, ${Math.min(rgb.g + 20, 255)}, ${Math.min(rgb.b + 20, 255)}, 1)`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
