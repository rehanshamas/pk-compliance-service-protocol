// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Step Progress Indicator
// ---------------------------------------------------------------------------

import { StepDef } from '../types';

/**
 * Render the horizontal step indicator.
 *
 * @param steps        - ordered list of step definitions
 * @param currentIndex - index of the currently active step (-1 for none)
 * @param completedIds - set of step IDs that have been completed
 */
export function renderStepper(
  steps: StepDef[],
  currentIndex: number,
  completedIds: Set<string>,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cip-kyc-stepper';

  steps.forEach((step, idx) => {
    // Connector between steps
    if (idx > 0) {
      const connector = document.createElement('div');
      connector.className = 'cip-kyc-step-connector';
      if (completedIds.has(steps[idx - 1].id)) {
        connector.classList.add('cip-kyc-step-connector--done');
      }
      wrapper.appendChild(connector);
    }

    const el = document.createElement('div');
    el.className = 'cip-kyc-step';

    const isDone = completedIds.has(step.id);
    const isActive = idx === currentIndex;

    if (isDone) el.classList.add('cip-kyc-step--done');
    if (isActive) el.classList.add('cip-kyc-step--active');

    // Dot
    const dot = document.createElement('div');
    dot.className = 'cip-kyc-step-dot';
    if (isDone) {
      dot.innerHTML = svgCheck();
    } else {
      dot.textContent = String(idx + 1);
    }
    el.appendChild(dot);

    // Label
    const label = document.createElement('span');
    label.className = 'cip-kyc-step-label';
    label.textContent = step.label;
    el.appendChild(label);

    wrapper.appendChild(el);
  });

  return wrapper;
}

/**
 * Update an existing stepper element in-place.
 */
export function updateStepper(
  container: HTMLElement,
  steps: StepDef[],
  currentIndex: number,
  completedIds: Set<string>,
): void {
  const stepperEl = container.querySelector('.cip-kyc-stepper');
  if (!stepperEl) return;

  const newStepper = renderStepper(steps, currentIndex, completedIds);
  stepperEl.replaceWith(newStepper);
}

// ---- Helpers -------------------------------------------------------------

function svgCheck(): string {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
