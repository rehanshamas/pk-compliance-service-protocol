// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Liveness Check Step
// ---------------------------------------------------------------------------

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { StepResult as StepResultComponent } from '../components/StepResult';
import { ApiClient } from '../api-client';
import { CipBranding, StepResult, DEFAULT_STRINGS } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Phase = 'instruction' | 'capturing_blink' | 'capturing_turn' | 'uploading' | 'result';

interface LivenessCheckProps {
  apiClient: ApiClient;
  sessionId: string;
  branding: Required<CipBranding>;
  strings: Record<string, string>;
  onResult: (result: StepResult) => void;
  onError: (error: any) => void;
}

export function LivenessCheck({
  apiClient,
  sessionId,
  branding,
  strings,
  onResult,
  onError,
}: LivenessCheckProps) {
  const mergedStrings = { ...DEFAULT_STRINGS, ...strings };
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('instruction');
  const [instruction, setInstruction] = useState(mergedStrings['liveness.intro']);
  const [stepResult, setStepResult] = useState<StepResult | null>(null);
  const frameUris = useRef<string[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Start the liveness flow after a brief introduction
  useEffect(() => {
    if (phase === 'instruction') {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setPhase('capturing_blink');
          setInstruction(mergedStrings['liveness.blink']);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, mergedStrings]);

  // Blink capture: 4 frames at 500ms intervals
  useEffect(() => {
    if (phase !== 'capturing_blink') return;

    let frameCount = 0;
    const maxFrames = 4;
    const intervalMs = 500;

    const timer = setInterval(async () => {
      if (!isMounted.current || !cameraRef.current) return;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: true,
        });

        if (photo?.uri && isMounted.current) {
          frameUris.current.push(photo.uri);
          frameCount++;

          if (frameCount >= maxFrames) {
            clearInterval(timer);
            if (isMounted.current) {
              setPhase('capturing_turn');
              setInstruction(mergedStrings['liveness.turn']);
            }
          }
        }
      } catch {
        // Skip failed frame capture
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [phase, mergedStrings]);

  // Head turn capture: 5 frames at 400ms intervals
  useEffect(() => {
    if (phase !== 'capturing_turn') return;

    // Small delay before starting turn captures
    const startDelay = setTimeout(() => {
      let frameCount = 0;
      const maxFrames = 5;
      const intervalMs = 400;

      const timer = setInterval(async () => {
        if (!isMounted.current || !cameraRef.current) return;

        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            skipProcessing: true,
          });

          if (photo?.uri && isMounted.current) {
            frameUris.current.push(photo.uri);
            frameCount++;

            if (frameCount >= maxFrames) {
              clearInterval(timer);
              if (isMounted.current) {
                submitFrames();
              }
            }
          }
        } catch {
          // Skip failed frame capture
        }
      }, intervalMs);

      return () => clearInterval(timer);
    }, 500);

    return () => clearTimeout(startDelay);
  }, [phase]);

  const submitFrames = useCallback(async () => {
    setPhase('uploading');
    setInstruction(mergedStrings['liveness.processing']);

    try {
      const result = await apiClient.processLiveness(sessionId, frameUris.current);
      if (isMounted.current) {
        setStepResult(result);
        setPhase('result');
      }
    } catch (err) {
      if (isMounted.current) {
        onError(err);
      }
    }
  }, [apiClient, sessionId, mergedStrings, onError]);

  const handleContinue = useCallback(() => {
    if (stepResult) {
      onResult(stepResult);
    }
  }, [stepResult, onResult]);

  const handleRetry = useCallback(() => {
    frameUris.current = [];
    setStepResult(null);
    setPhase('instruction');
    setInstruction(mergedStrings['liveness.intro']);
  }, [mergedStrings]);

  // ---- Result phase ------------------------------------------------------

  if (phase === 'result' && stepResult) {
    return (
      <StepResultComponent
        result={stepResult}
        branding={branding}
        onContinue={handleContinue}
        onRetry={handleRetry}
      />
    );
  }

  // ---- Camera phases (instruction, blink, turn, uploading) ---------------

  const ovalWidth = SCREEN_WIDTH * 0.55;
  const ovalHeight = ovalWidth * 1.35;

  return (
    <View style={styles.container}>
      {/* Instruction */}
      <View style={styles.instructionBar}>
        <Text style={[styles.instructionText, { color: branding.textColor }]}>
          {instruction}
        </Text>
      </View>

      {/* Camera + overlay */}
      <View style={styles.cameraWrapper}>
        {phase === 'uploading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={branding.primaryColor} />
            <Text style={[styles.loadingText, { color: branding.textColor }]}>
              {mergedStrings['liveness.processing']}
            </Text>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              animateShutter={false}
            />
            {/* Face oval overlay */}
            <View style={styles.overlayContainer} pointerEvents="none">
              <View
                style={[
                  styles.faceOval,
                  {
                    width: ovalWidth,
                    height: ovalHeight,
                    borderColor: branding.primaryColor,
                    borderRadius: ovalWidth / 2,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>

      {/* Phase indicator */}
      <View style={styles.phaseIndicator}>
        <View style={styles.phaseDotsRow}>
          <View
            style={[
              styles.phaseDot,
              (phase === 'capturing_blink' || phase === 'capturing_turn' || phase === 'uploading') && {
                backgroundColor: branding.primaryColor,
              },
            ]}
          />
          <View
            style={[
              styles.phaseDot,
              (phase === 'capturing_turn' || phase === 'uploading') && {
                backgroundColor: branding.primaryColor,
              },
            ]}
          />
          <View
            style={[
              styles.phaseDot,
              phase === 'uploading' && { backgroundColor: branding.primaryColor },
            ]}
          />
        </View>
        <Text style={styles.phaseHint}>
          {phase === 'instruction' && 'Get ready...'}
          {phase === 'capturing_blink' && 'Capturing blink...'}
          {phase === 'capturing_turn' && 'Capturing head turn...'}
          {phase === 'uploading' && 'Processing...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  instructionBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 12,
    borderRadius: 16,
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  phaseIndicator: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  phaseDotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  phaseHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
});
