// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Main Entry Point
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { KycContainer } from './components/KycContainer';
import { CompletionScreen } from './components/CompletionScreen';
import { DocumentCapture } from './steps/DocumentCapture';
import { SelfieCapture } from './steps/SelfieCapture';
import { LivenessCheck } from './steps/LivenessCheck';
import { DocumentInHand } from './steps/DocumentInHand';
import { ApiClient } from './api-client';
import {
  CipKycProps,
  CipKycResult,
  CipKycError,
  StepDef,
  StepResult,
  DEFAULT_BRANDING,
  DEFAULT_STRINGS,
} from './types';

type FlowState = 'loading' | 'permission' | 'running' | 'complete' | 'error';

/**
 * CipKyc — the main SDK component for React Native.
 *
 * Usage:
 * ```tsx
 * <CipKyc
 *   apiKey="your-api-key"
 *   sessionId="session-id-from-backend"
 *   onComplete={(result) => console.log(result)}
 *   onError={(err) => console.error(err)}
 *   onCancel={() => navigation.goBack()}
 * />
 * ```
 */
export function CipKyc(props: CipKycProps) {
  const {
    apiKey,
    sessionId,
    apiBaseUrl = 'https://api.cip.app',
    verificationLevel: configLevel = 'basic',
    branding,
    strings = {},
    onComplete,
    onStepComplete,
    onError,
    onCancel,
  } = props;

  const mergedBranding = useMemo(
    () => ({ ...DEFAULT_BRANDING, ...branding }),
    [branding],
  );
  const mergedStrings = useMemo(
    () => ({ ...DEFAULT_STRINGS, ...strings }),
    [strings],
  );

  const apiClient = useMemo(
    () => new ApiClient(apiBaseUrl, apiKey),
    [apiBaseUrl, apiKey],
  );

  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [finalResult, setFinalResult] = useState<CipKycResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Camera permission
  const [permission, requestPermission] = useCameraPermissions();

  // ---- Initialize session ------------------------------------------------

  useEffect(() => {
    initSession();
  }, []);

  const initSession = useCallback(async () => {
    setFlowState('loading');

    try {
      const session = await apiClient.getSession(sessionId);
      const level = session.verificationLevel || configLevel;
      const stepList = buildStepList(level, mergedStrings);
      setSteps(stepList);

      // Mark already-completed steps
      const completed = new Set<string>();
      if (session.completedSteps) {
        session.completedSteps.forEach((s) => completed.add(s));
      }
      setCompletedSteps(completed);

      // Find first incomplete step
      const firstIncomplete = stepList.findIndex((s) => !completed.has(s.id));
      if (firstIncomplete === -1) {
        // All done already
        await fetchAndShowComplete();
        return;
      }

      setCurrentStepIndex(firstIncomplete);

      // Check camera permission
      if (!permission?.granted) {
        setFlowState('permission');
      } else {
        setFlowState('running');
      }
    } catch (err: any) {
      handleError(err);
    }
  }, [apiClient, sessionId, configLevel, mergedStrings, permission]);

  // ---- Permission handling -----------------------------------------------

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    if (result.granted) {
      setFlowState('running');
    } else {
      handleError({
        code: 'CAMERA_DENIED',
        message: mergedStrings['error.camera.denied'],
      });
    }
  }, [requestPermission, mergedStrings]);

  // When permission changes and we're waiting for it
  useEffect(() => {
    if (flowState === 'permission' && permission?.granted) {
      setFlowState('running');
    }
  }, [permission, flowState]);

  // ---- Step handling -----------------------------------------------------

  const handleStepResult = useCallback(
    async (step: string, result: StepResult) => {
      // Mark step completed
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(step);
        return next;
      });

      // Fire callback
      onStepComplete?.(step, result.data);

      // Complete step on backend (non-fatal if it fails)
      try {
        await apiClient.completeStep(sessionId, step);
      } catch {
        // Backend may have already marked it
      }

      // Check if verification is fully complete
      if (result.isComplete) {
        await fetchAndShowComplete();
        return;
      }

      // Move to next step
      const nextIndex = currentStepIndex + 1;
      if (nextIndex >= steps.length) {
        await fetchAndShowComplete();
      } else {
        setCurrentStepIndex(nextIndex);
      }
    },
    [currentStepIndex, steps, apiClient, sessionId, onStepComplete],
  );

  const handleStepError = useCallback(
    (err: any) => {
      handleError(err);
    },
    [],
  );

  // ---- Completion --------------------------------------------------------

  const fetchAndShowComplete = useCallback(async () => {
    let result: CipKycResult;

    try {
      const session = await apiClient.getSession(sessionId);
      result = {
        sessionId,
        status: mapStatus(session.status),
        kycStatus: session.status,
        riskTier: (session as any).riskTier || 'unknown',
        customerId: (session as any).customerId || null,
        data: (session as any).data || {},
      };
    } catch {
      result = {
        sessionId,
        status: 'pending',
        kycStatus: 'pending',
        riskTier: 'unknown',
        customerId: null,
        data: {},
      };
    }

    setFinalResult(result);
    setFlowState('complete');
    onComplete?.(result);
  }, [apiClient, sessionId, onComplete]);

  // ---- Error handling ----------------------------------------------------

  const handleError = useCallback(
    (err: any) => {
      const error: CipKycError = {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message || 'An unexpected error occurred.',
        step: steps[currentStepIndex]?.id,
      };

      setErrorMessage(error.message);
      setFlowState('error');
      onError?.(error);
    },
    [steps, currentStepIndex, onError],
  );

  // ---- Cancel handling ---------------------------------------------------

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Verification',
      mergedStrings['cancel.confirm'],
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => onCancel?.(),
        },
      ],
    );
  }, [mergedStrings, onCancel]);

  // ---- Render ------------------------------------------------------------

  const stepLabels = steps.map((s) => s.label);
  const stepIds = steps.map((s) => s.id);

  // Loading state
  if (flowState === 'loading') {
    return (
      <KycContainer
        branding={mergedBranding}
        title={mergedStrings['header.title']}
        currentStep={0}
        totalSteps={0}
        stepLabels={[]}
        completedSteps={completedSteps}
        stepIds={[]}
        onCancel={handleCancel}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={mergedBranding.primaryColor} />
          <Text style={[styles.loadingText, { color: mergedBranding.textColor }]}>
            Initializing verification...
          </Text>
        </View>
      </KycContainer>
    );
  }

  // Permission request state
  if (flowState === 'permission') {
    return (
      <KycContainer
        branding={mergedBranding}
        title={mergedStrings['header.title']}
        currentStep={0}
        totalSteps={steps.length}
        stepLabels={stepLabels}
        completedSteps={completedSteps}
        stepIds={stepIds}
        onCancel={handleCancel}
      >
        <View style={styles.centered}>
          <Text style={[styles.permissionTitle, { color: mergedBranding.textColor }]}>
            Camera Access Required
          </Text>
          <Text style={styles.permissionSubtitle}>
            We need camera access to verify your identity. Your photos are securely processed and
            never stored on your device.
          </Text>
          <TouchableOpacity
            onPress={handleRequestPermission}
            style={[
              styles.permissionButton,
              {
                backgroundColor: mergedBranding.primaryColor,
                borderRadius: mergedBranding.borderRadius,
              },
            ]}
          >
            <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>
        </View>
      </KycContainer>
    );
  }

  // Error state
  if (flowState === 'error') {
    return (
      <KycContainer
        branding={mergedBranding}
        title={mergedStrings['header.title']}
        currentStep={currentStepIndex}
        totalSteps={steps.length}
        stepLabels={stepLabels}
        completedSteps={completedSteps}
        stepIds={stepIds}
        onCancel={handleCancel}
      >
        <View style={styles.centered}>
          <View style={styles.errorIconCircle}>
            <Text style={styles.errorIcon}>{'\u2717'}</Text>
          </View>
          <Text style={[styles.errorTitle, { color: mergedBranding.textColor }]}>
            Something went wrong
          </Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={() => {
              setErrorMessage('');
              setFlowState('running');
            }}
            style={[
              styles.retryButton,
              {
                backgroundColor: mergedBranding.primaryColor,
                borderRadius: mergedBranding.borderRadius,
              },
            ]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onCancel?.()} style={styles.cancelLink}>
            <Text style={[styles.cancelLinkText, { color: mergedBranding.primaryColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </KycContainer>
    );
  }

  // Completion state
  if (flowState === 'complete' && finalResult) {
    return (
      <KycContainer
        branding={mergedBranding}
        title={mergedStrings['header.title']}
        currentStep={steps.length}
        totalSteps={steps.length}
        stepLabels={stepLabels}
        completedSteps={completedSteps}
        stepIds={stepIds}
      >
        <CompletionScreen
          result={finalResult}
          branding={mergedBranding}
          strings={mergedStrings}
          onDone={() => onComplete?.(finalResult)}
        />
      </KycContainer>
    );
  }

  // Running state — render current step
  const currentStep = steps[currentStepIndex];

  return (
    <KycContainer
      branding={mergedBranding}
      title={mergedStrings['header.title']}
      currentStep={currentStepIndex}
      totalSteps={steps.length}
      stepLabels={stepLabels}
      completedSteps={completedSteps}
      stepIds={stepIds}
      onCancel={handleCancel}
    >
      {renderStep(currentStep?.id, {
        apiClient,
        sessionId,
        branding: mergedBranding,
        strings: mergedStrings,
        onResult: (result: StepResult) => handleStepResult(currentStep.id, result),
        onError: handleStepError,
      })}
    </KycContainer>
  );
}

// ---- Step rendering --------------------------------------------------------

interface StepProps {
  apiClient: ApiClient;
  sessionId: string;
  branding: Required<typeof DEFAULT_BRANDING>;
  strings: Record<string, string>;
  onResult: (result: StepResult) => void;
  onError: (error: any) => void;
}

function renderStep(stepId: string | undefined, props: StepProps): React.ReactNode {
  switch (stepId) {
    case 'document_front':
      return <DocumentCapture side="front" {...props} />;
    case 'document_back':
      return <DocumentCapture side="back" {...props} />;
    case 'selfie':
      return <SelfieCapture {...props} />;
    case 'liveness':
      return <LivenessCheck {...props} />;
    case 'document_in_hand':
      return <DocumentInHand {...props} />;
    default:
      return null;
  }
}

// ---- Helpers ---------------------------------------------------------------

function buildStepList(
  level: 'basic' | 'advanced',
  strings: Record<string, string>,
): StepDef[] {
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

function mapStatus(status: string): 'approved' | 'rejected' | 'pending' {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'verified' || s === 'completed') return 'approved';
  if (s === 'rejected' || s === 'failed') return 'rejected';
  return 'pending';
}

// ---- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    color: '#EF4444',
    fontSize: 36,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    padding: 8,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// ---- Re-exports ------------------------------------------------------------

export type {
  CipKycProps,
  CipBranding,
  CipKycResult,
  CipKycError,
  StepResult,
  SessionInfo,
  QualityReport,
  QualityIssue,
  StepDef,
} from './types';

export { DEFAULT_BRANDING, DEFAULT_STRINGS } from './types';
export { ApiClient } from './api-client';
