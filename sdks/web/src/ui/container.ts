// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Main UI Container
// ---------------------------------------------------------------------------

import { CipBranding, CipKycConfig, DEFAULT_BRANDING, DEFAULT_STRINGS } from '../types';

const ROOT_ID = 'cip-kyc-root';

export interface ContainerRefs {
  root: HTMLElement;
  header: HTMLElement;
  stepperSlot: HTMLElement;
  content: HTMLElement;
}

/**
 * Create the main SDK container and mount it into the DOM.
 *
 * If `config.containerId` is provided, the SDK mounts inside that element.
 * Otherwise it creates a fullscreen overlay.
 */
export function createContainer(config: CipKycConfig): ContainerRefs {
  // Remove any previous instance
  destroyContainer();

  const branding: Required<CipBranding> = { ...DEFAULT_BRANDING, ...config.branding };
  const strings = { ...DEFAULT_STRINGS, ...config.strings };

  // Root
  const root = document.createElement('div');
  root.className = 'cip-kyc';
  root.id = ROOT_ID;

  if (!config.containerId) {
    root.classList.add('cip-kyc--overlay');
  }

  // ---- Header
  const header = document.createElement('div');
  header.className = 'cip-kyc-header';

  if (branding.logo) {
    const logo = document.createElement('img');
    logo.className = 'cip-kyc-header-logo';
    logo.src = branding.logo;
    logo.alt = branding.companyName;
    header.appendChild(logo);
  }

  const title = document.createElement('span');
  title.className = 'cip-kyc-header-title';
  title.textContent = branding.companyName
    ? `${branding.companyName} - ${strings['header.title']}`
    : strings['header.title'];
  header.appendChild(title);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cip-kyc-cancel';
  cancelBtn.innerHTML = '&#x2715;';
  cancelBtn.setAttribute('aria-label', 'Cancel verification');
  cancelBtn.addEventListener('click', () => {
    if (config.onCancel) {
      config.onCancel();
    }
  });
  header.appendChild(cancelBtn);

  root.appendChild(header);

  // ---- Stepper slot
  const stepperSlot = document.createElement('div');
  stepperSlot.className = 'cip-kyc-stepper';
  root.appendChild(stepperSlot);

  // ---- Content area
  const content = document.createElement('div');
  content.className = 'cip-kyc-content';
  root.appendChild(content);

  // ---- Mount
  if (config.containerId) {
    const target = document.getElementById(config.containerId);
    if (target) {
      target.innerHTML = '';
      target.appendChild(root);
    } else {
      // Fallback: append to body
      document.body.appendChild(root);
    }
  } else {
    document.body.appendChild(root);
  }

  return { root, header, stepperSlot, content };
}

/**
 * Remove the SDK container from the DOM.
 */
export function destroyContainer(): void {
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Replace the content area's children.
 */
export function setContent(refs: ContainerRefs, element: HTMLElement): void {
  refs.content.innerHTML = '';
  refs.content.appendChild(element);
}

/**
 * Show a loading state in the content area.
 */
export function showLoading(refs: ContainerRefs, message?: string): void {
  const loading = document.createElement('div');
  loading.className = 'cip-kyc-loading';
  loading.innerHTML = `
    <div class="cip-kyc-spinner"></div>
    <div class="cip-kyc-loading-text">${message || 'Loading...'}</div>
  `;
  setContent(refs, loading);
}
