// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Result Screen
// ---------------------------------------------------------------------------

import { StepResult, CipKycResult } from '../types';

export interface ResultScreenOptions {
  onContinue?: () => void;
  onRetry?: () => void;
}

/**
 * Render a step result screen (success or failure).
 */
export function createStepResultScreen(
  result: StepResult,
  options: ResultScreenOptions,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cip-kyc-result';

  if (result.passed) {
    // ---- Success
    root.appendChild(createIcon('success', '\u2713'));

    const title = document.createElement('div');
    title.className = 'cip-kyc-result-title';
    title.textContent = 'Step completed successfully';
    root.appendChild(title);

    // Show extracted data if any
    const dataKeys = Object.keys(result.data || {});
    if (dataKeys.length > 0) {
      const dataContainer = document.createElement('div');
      dataContainer.className = 'cip-kyc-result-data';
      dataKeys.forEach((key) => {
        const value = result.data[key];
        if (value === null || value === undefined) return;
        const row = document.createElement('div');
        row.className = 'cip-kyc-result-row';
        const label = document.createElement('span');
        label.className = 'cip-kyc-result-label';
        label.textContent = formatLabel(key);
        const val = document.createElement('span');
        val.className = 'cip-kyc-result-value';
        val.textContent = String(value);
        row.appendChild(label);
        row.appendChild(val);
        dataContainer.appendChild(row);
      });
      root.appendChild(dataContainer);
    }

    if (options.onContinue) {
      const btn = document.createElement('button');
      btn.className = 'cip-kyc-btn cip-kyc-btn--primary';
      btn.textContent = 'Continue';
      btn.addEventListener('click', options.onContinue);
      root.appendChild(btn);
    }
  } else {
    // ---- Failure
    root.appendChild(createIcon('error', '\u2717'));

    const title = document.createElement('div');
    title.className = 'cip-kyc-result-title';
    title.textContent = 'Verification failed';
    root.appendChild(title);

    // Error messages
    if (result.errors && result.errors.length > 0) {
      const msg = document.createElement('div');
      msg.className = 'cip-kyc-result-message';
      msg.textContent = result.errors.join('. ');
      root.appendChild(msg);
    }

    // Quality issues
    if (result.quality && result.quality.issues.length > 0) {
      const qualityEl = document.createElement('div');
      qualityEl.className = 'cip-kyc-quality';
      result.quality.issues.forEach((issue) => {
        const item = document.createElement('div');
        item.className = 'cip-kyc-quality-item';
        item.textContent = issue.message;
        qualityEl.appendChild(item);
      });
      root.appendChild(qualityEl);
    }

    if (options.onRetry) {
      const btn = document.createElement('button');
      btn.className = 'cip-kyc-btn cip-kyc-btn--primary';
      btn.textContent = 'Retry';
      btn.addEventListener('click', options.onRetry);
      root.appendChild(btn);
    }
  }

  return root;
}

/**
 * Render the final completion screen.
 */
export function createCompleteScreen(
  result: CipKycResult,
  onDone?: () => void,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cip-kyc-result';

  // Icon based on status
  const iconType =
    result.status === 'approved'
      ? 'success'
      : result.status === 'rejected'
        ? 'error'
        : 'pending';
  const iconChar =
    result.status === 'approved'
      ? '\u2713'
      : result.status === 'rejected'
        ? '\u2717'
        : '\u23F3';

  root.appendChild(createIcon(iconType, iconChar));

  const title = document.createElement('div');
  title.className = 'cip-kyc-result-title';
  title.textContent = 'Verification Complete';
  root.appendChild(title);

  const message = document.createElement('div');
  message.className = 'cip-kyc-result-message';
  if (result.status === 'approved') {
    message.textContent = 'Your identity has been verified.';
  } else if (result.status === 'rejected') {
    message.textContent = 'Verification could not be completed.';
  } else {
    message.textContent = 'Your verification is being reviewed.';
  }
  root.appendChild(message);

  // Data summary
  const data = result.data;
  if (data) {
    const dataContainer = document.createElement('div');
    dataContainer.className = 'cip-kyc-result-data';

    const entries: [string, any][] = [
      ['Full Name', data.fullName],
      ['CNIC Number', data.cnicNumber],
      ['Date of Birth', data.dateOfBirth],
      ['Gender', data.gender],
      ['Face Match', data.faceMatchScore !== undefined ? `${data.faceMatchScore}%` : undefined],
      ['Liveness', data.livenessScore !== undefined ? `${data.livenessScore}%` : undefined],
    ];

    entries.forEach(([label, value]) => {
      if (value === null || value === undefined) return;
      const row = document.createElement('div');
      row.className = 'cip-kyc-result-row';
      const lbl = document.createElement('span');
      lbl.className = 'cip-kyc-result-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'cip-kyc-result-value';
      val.textContent = String(value);
      row.appendChild(lbl);
      row.appendChild(val);
      dataContainer.appendChild(row);
    });

    root.appendChild(dataContainer);
  }

  // Status badge
  const badge = document.createElement('div');
  badge.style.marginTop = '8px';
  badge.style.padding = '6px 16px';
  badge.style.borderRadius = '20px';
  badge.style.fontSize = '13px';
  badge.style.fontWeight = '600';
  if (result.status === 'approved') {
    badge.style.background = 'rgba(34,197,94,0.15)';
    badge.style.color = '#22C55E';
    badge.textContent = `Risk Tier: ${result.riskTier}`;
  } else if (result.status === 'rejected') {
    badge.style.background = 'rgba(239,68,68,0.15)';
    badge.style.color = '#EF4444';
    badge.textContent = `Status: ${result.kycStatus}`;
  } else {
    badge.style.background = 'rgba(242,138,23,0.15)';
    badge.style.color = '#F28A17';
    badge.textContent = 'Under Review';
  }
  root.appendChild(badge);

  if (onDone) {
    const btn = document.createElement('button');
    btn.className = 'cip-kyc-btn cip-kyc-btn--primary';
    btn.textContent = 'Done';
    btn.style.marginTop = '8px';
    btn.addEventListener('click', onDone);
    root.appendChild(btn);
  }

  return root;
}

// ---- Helpers -------------------------------------------------------------

function createIcon(type: 'success' | 'error' | 'pending', char: string): HTMLElement {
  const icon = document.createElement('div');
  icon.className = `cip-kyc-result-icon cip-kyc-result-icon--${type}`;
  icon.textContent = char;
  return icon;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
