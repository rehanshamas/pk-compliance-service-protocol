// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Document Capture Step
// ---------------------------------------------------------------------------

import { ApiClient } from '../api-client';
import { requestCamera, captureFrame, stopCamera } from '../camera';
import { createCaptureScreen } from '../ui/capture-screen';
import { createStepResultScreen } from '../ui/result-screen';
import { setContent, ContainerRefs } from '../ui/container';
import { StepResult, DEFAULT_STRINGS } from '../types';

/**
 * Run the document capture flow for a given side (front or back).
 *
 * Resolves when the user completes or the step fails definitively.
 * The returned StepResult comes from the backend.
 */
export async function captureDocument(
  side: 'front' | 'back',
  apiClient: ApiClient,
  sessionId: string,
  containerRefs: ContainerRefs,
  strings: Record<string, string>,
): Promise<StepResult> {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };
  const instructionKey = side === 'front' ? 'doc.front.instruction' : 'doc.back.instruction';
  const stepName = side === 'front' ? 'document_front' : 'document_back';

  return new Promise<StepResult>(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    let capturedBlob: Blob | null = null;

    const cleanup = () => {
      if (stream) {
        stopCamera(stream);
        stream = null;
      }
    };

    // Start camera
    try {
      stream = await requestCamera('environment');
    } catch (err) {
      reject(err);
      return;
    }

    const screen = createCaptureScreen({
      overlay: 'document',
      instruction: mergedStrings[instructionKey],
      mirror: false,

      onCapture: async () => {
        if (!stream) return;
        try {
          capturedBlob = await captureFrame(screen.video);

          // Show preview
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

        screen.showLoading('Analyzing document...');

        try {
          const result = await apiClient.processFrame(sessionId, stepName, capturedBlob);
          cleanup();

          if (result.passed) {
            // Show success with extracted data
            const resultScreen = createStepResultScreen(result, {
              onContinue: () => resolve(result),
            });
            setContent(containerRefs, resultScreen);
          } else {
            // Show failure with quality issues and retry
            if (result.quality && result.quality.issues.length > 0) {
              screen.hideLoading();
              screen.showPreview(URL.createObjectURL(capturedBlob));
              screen.showQualityIssues(result.quality.issues);
              screen.showRetakeOnly();
            } else {
              const resultScreen = createStepResultScreen(result, {
                onRetry: () => {
                  // Restart the flow
                  captureDocument(side, apiClient, sessionId, containerRefs, strings)
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

    // Attach stream to video
    screen.video.srcObject = stream;
    setContent(containerRefs, screen.root);
  });
}
