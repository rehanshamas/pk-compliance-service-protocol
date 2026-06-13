// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Liveness Check Step
// ---------------------------------------------------------------------------

import { ApiClient } from '../api-client';
import { requestCamera, captureFrame, stopCamera } from '../camera';
import { createCaptureScreen } from '../ui/capture-screen';
import { createStepResultScreen } from '../ui/result-screen';
import { setContent, ContainerRefs } from '../ui/container';
import { StepResult, DEFAULT_STRINGS } from '../types';

/**
 * Run the liveness challenge flow.
 *
 * 1. Blink detection — captures 3-5 frames over ~2 seconds
 * 2. Head turn — captures 3-5 frames over ~3 seconds
 * 3. Sends all frames to the liveness endpoint
 */
export async function checkLiveness(
  apiClient: ApiClient,
  sessionId: string,
  containerRefs: ContainerRefs,
  strings: Record<string, string>,
): Promise<StepResult> {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };

  return new Promise<StepResult>(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    const allFrames: Blob[] = [];

    const cleanup = () => {
      if (stream) {
        stopCamera(stream);
        stream = null;
      }
    };

    try {
      stream = await requestCamera('user');
    } catch (err) {
      reject(err);
      return;
    }

    const screen = createCaptureScreen({
      overlay: 'face',
      instruction: mergedStrings['liveness.blink'],
      mirror: true,
      onCapture: () => {},
      onRetake: () => {},
      onContinue: () => {},
    });

    // Hide manual controls — liveness uses auto-capture
    screen.hideControls();
    screen.video.srcObject = stream;
    setContent(containerRefs, screen.root);

    // Wait for video to start playing
    await waitForVideoReady(screen.video);

    try {
      // ---- Phase 1: Blink
      screen.setInstruction(mergedStrings['liveness.blink']);
      const blinkFrames = await captureFrameSequence(screen.video, 4, 500);
      allFrames.push(...blinkFrames);

      // ---- Phase 2: Head turn
      screen.setInstruction(mergedStrings['liveness.turn']);
      const turnFrames = await captureFrameSequence(screen.video, 5, 600);
      allFrames.push(...turnFrames);

      // ---- Submit
      screen.setInstruction(mergedStrings['liveness.processing']);
      screen.showLoading('Verifying liveness...');

      const result = await apiClient.processLiveness(sessionId, allFrames);
      cleanup();

      if (result.passed) {
        const resultScreen = createStepResultScreen(result, {
          onContinue: () => resolve(result),
        });
        setContent(containerRefs, resultScreen);
      } else {
        const resultScreen = createStepResultScreen(result, {
          onRetry: () => {
            checkLiveness(apiClient, sessionId, containerRefs, strings)
              .then(resolve)
              .catch(reject);
          },
        });
        setContent(containerRefs, resultScreen);
      }
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

// ---- Helpers -------------------------------------------------------------

/**
 * Capture a sequence of frames at the given interval.
 */
async function captureFrameSequence(
  video: HTMLVideoElement,
  count: number,
  intervalMs: number,
): Promise<Blob[]> {
  const frames: Blob[] = [];

  for (let i = 0; i < count; i++) {
    if (i > 0) {
      await delay(intervalMs);
    }
    const blob = await captureFrame(video);
    frames.push(blob);
  }

  return frames;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    const handler = () => {
      video.removeEventListener('loadeddata', handler);
      resolve();
    };
    video.addEventListener('loadeddata', handler);

    // Timeout fallback
    setTimeout(resolve, 3000);
  });
}
