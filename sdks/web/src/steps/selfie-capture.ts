// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Selfie Capture Step
// ---------------------------------------------------------------------------

import { ApiClient } from '../api-client';
import { requestCamera, captureFrame, stopCamera } from '../camera';
import { createCaptureScreen } from '../ui/capture-screen';
import { createStepResultScreen } from '../ui/result-screen';
import { setContent, ContainerRefs } from '../ui/container';
import { StepResult, DEFAULT_STRINGS } from '../types';

/**
 * Run the selfie capture flow.
 * Opens the front camera with a face oval overlay.
 */
export async function captureSelfie(
  apiClient: ApiClient,
  sessionId: string,
  containerRefs: ContainerRefs,
  strings: Record<string, string>,
): Promise<StepResult> {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };

  return new Promise<StepResult>(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    let capturedBlob: Blob | null = null;

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
      instruction: mergedStrings['selfie.instruction'],
      mirror: true,

      onCapture: async () => {
        if (!stream) return;
        try {
          capturedBlob = await captureFrame(screen.video);
          const url = URL.createObjectURL(capturedBlob);
          screen.showPreview(url);
        } catch (err) {
          reject(err);
        }
      },

      onRetake: () => {
        capturedBlob = null;
        screen.showVideo();
      },

      onContinue: async () => {
        if (!capturedBlob) return;

        screen.showLoading('Verifying selfie...');

        try {
          const result = await apiClient.processFrame(sessionId, 'selfie', capturedBlob);
          cleanup();

          if (result.passed) {
            const resultScreen = createStepResultScreen(result, {
              onContinue: () => resolve(result),
            });
            setContent(containerRefs, resultScreen);
          } else {
            if (result.quality && result.quality.issues.length > 0) {
              screen.hideLoading();
              screen.showPreview(URL.createObjectURL(capturedBlob));
              screen.showQualityIssues(result.quality.issues);
              screen.showRetakeOnly();
            } else {
              const resultScreen = createStepResultScreen(result, {
                onRetry: () => {
                  captureSelfie(apiClient, sessionId, containerRefs, strings)
                    .then(resolve)
                    .catch(reject);
                },
              });
              setContent(containerRefs, resultScreen);
            }
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      },
    });

    screen.video.srcObject = stream;
    setContent(containerRefs, screen.root);
  });
}
