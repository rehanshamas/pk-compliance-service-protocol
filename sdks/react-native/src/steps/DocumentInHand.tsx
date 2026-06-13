// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Document-in-Hand Capture Step
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { CameraCapture } from '../components/CameraCapture';
import { StepResult as StepResultComponent } from '../components/StepResult';
import { ApiClient } from '../api-client';
import { CipBranding, StepResult, DEFAULT_STRINGS } from '../types';

type Phase = 'capturing' | 'reviewing' | 'uploading' | 'result';

interface DocumentInHandProps {
  apiClient: ApiClient;
  sessionId: string;
  branding: Required<CipBranding>;
  strings: Record<string, string>;
  onResult: (result: StepResult) => void;
  onError: (error: any) => void;
}

export function DocumentInHand({
  apiClient,
  sessionId,
  branding,
  strings,
  onResult,
  onError,
}: DocumentInHandProps) {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };
  const [phase, setPhase] = useState<Phase>('capturing');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [stepResult, setStepResult] = useState<StepResult | null>(null);

  const handleCapture = useCallback((uri: string) => {
    setCapturedUri(uri);
    setPhase('reviewing');
  }, []);

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
    setPhase('capturing');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!capturedUri) return;
    setPhase('uploading');

    try {
      const result = await apiClient.processFrame(sessionId, 'document_in_hand', capturedUri);
      setStepResult(result);
      setPhase('result');
    } catch (err) {
      onError(err);
      setPhase('capturing');
    }
  }, [capturedUri, apiClient, sessionId, onError]);

  const handleContinue = useCallback(() => {
    if (stepResult) {
      onResult(stepResult);
    }
  }, [stepResult, onResult]);

  const handleRetry = useCallback(() => {
    setCapturedUri(null);
    setStepResult(null);
    setPhase('capturing');
  }, []);

  // ---- Render by phase ---------------------------------------------------

  if (phase === 'capturing') {
    return (
      <CameraCapture
        facing="front"
        overlay="face_and_document"
        instruction={mergedStrings['doc_in_hand.instruction']}
        branding={branding}
        onCapture={handleCapture}
      />
    );
  }

  if (phase === 'reviewing') {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          {capturedUri && (
            <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>
        <View style={styles.reviewControls}>
          <TouchableOpacity
            onPress={handleRetake}
            style={[styles.secondaryButton, { borderColor: branding.primaryColor }]}
          >
            <Text style={[styles.secondaryButtonText, { color: branding.primaryColor }]}>
              {mergedStrings['capture.retake']}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.primaryButton, { backgroundColor: branding.primaryColor, borderRadius: branding.borderRadius }]}
          >
            <Text style={styles.primaryButtonText}>{mergedStrings['capture.use']}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'uploading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={branding.primaryColor} />
        <Text style={[styles.loadingText, { color: branding.textColor }]}>
          Verifying document in hand...
        </Text>
      </View>
    );
  }

  // phase === 'result'
  if (stepResult) {
    return (
      <StepResultComponent
        result={stepResult}
        branding={branding}
        onContinue={handleContinue}
        onRetry={handleRetry}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  reviewControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
});
