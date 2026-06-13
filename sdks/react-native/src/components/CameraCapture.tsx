// ---------------------------------------------------------------------------
// CIP KYC React Native SDK — Camera Capture Component
// ---------------------------------------------------------------------------

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { CipBranding } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type OverlayType = 'document' | 'face' | 'face_and_document' | 'none';

interface CameraCaptureProps {
  facing: CameraType;
  overlay: OverlayType;
  instruction: string;
  branding: Required<CipBranding>;
  showControls?: boolean;
  onCapture: (uri: string) => void;
  onRetake?: () => void;
}

export interface CameraCaptureRef {
  takePicture: () => Promise<string | null>;
}

export function CameraCapture({
  facing,
  overlay,
  instruction,
  branding,
  showControls = true,
  onCapture,
  onRetake,
}: CameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        onCapture(photo.uri);
      }
    } catch (_err) {
      // Capture failed silently
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    onRetake?.();
  };

  return (
    <View style={styles.container}>
      {/* Instruction */}
      <View style={styles.instructionBar}>
        <Text style={[styles.instructionText, { color: branding.textColor }]}>
          {instruction}
        </Text>
      </View>

      {/* Camera or Preview */}
      <View style={styles.cameraWrapper}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            animateShutter={false}
          />
        )}

        {/* Overlay */}
        {!capturedUri && renderOverlay(overlay, branding)}
      </View>

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          {capturedUri ? (
            <View style={styles.reviewControls}>
              <TouchableOpacity
                onPress={handleRetake}
                style={[styles.secondaryButton, { borderColor: branding.primaryColor }]}
              >
                <Text style={[styles.secondaryButtonText, { color: branding.primaryColor }]}>
                  Retake
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCapture}
              disabled={isCapturing}
              style={[styles.captureButton, { borderColor: branding.primaryColor }]}
            >
              {isCapturing ? (
                <ActivityIndicator color={branding.primaryColor} />
              ) : (
                <View style={[styles.captureInner, { backgroundColor: branding.primaryColor }]} />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Expose a helper to take a picture programmatically (for liveness auto-capture).
 * This is a standalone function that takes a CameraView ref.
 */
export async function takePictureFromRef(
  cameraRef: React.RefObject<CameraView>,
): Promise<string | null> {
  if (!cameraRef.current) return null;
  try {
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7,
      skipProcessing: true,
    });
    return photo?.uri ?? null;
  } catch {
    return null;
  }
}

// ---- Overlay Rendering ---------------------------------------------------

function renderOverlay(type: OverlayType, branding: Required<CipBranding>) {
  switch (type) {
    case 'document':
      return <DocumentOverlay color={branding.primaryColor} />;
    case 'face':
      return <FaceOverlay color={branding.primaryColor} />;
    case 'face_and_document':
      return <FaceAndDocumentOverlay color={branding.primaryColor} />;
    default:
      return null;
  }
}

function DocumentOverlay({ color }: { color: string }) {
  const frameWidth = SCREEN_WIDTH * 0.85;
  const frameHeight = frameWidth * 0.63; // ID card aspect ratio ~85.6mm x 53.98mm

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      <View
        style={[
          styles.documentFrame,
          {
            width: frameWidth,
            height: frameHeight,
            borderColor: color,
            borderRadius: 12,
          },
        ]}
      >
        {/* Corner accents */}
        <View style={[styles.cornerTL, { borderColor: color }]} />
        <View style={[styles.cornerTR, { borderColor: color }]} />
        <View style={[styles.cornerBL, { borderColor: color }]} />
        <View style={[styles.cornerBR, { borderColor: color }]} />
      </View>
    </View>
  );
}

function FaceOverlay({ color }: { color: string }) {
  const ovalWidth = SCREEN_WIDTH * 0.55;
  const ovalHeight = ovalWidth * 1.35;

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      <View
        style={[
          styles.faceOval,
          {
            width: ovalWidth,
            height: ovalHeight,
            borderColor: color,
            borderRadius: ovalWidth / 2,
          },
        ]}
      />
    </View>
  );
}

function FaceAndDocumentOverlay({ color }: { color: string }) {
  const ovalWidth = SCREEN_WIDTH * 0.35;
  const ovalHeight = ovalWidth * 1.35;
  const docWidth = SCREEN_WIDTH * 0.35;
  const docHeight = docWidth * 0.63;

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      <View style={styles.dualOverlay}>
        {/* Face oval on left */}
        <View
          style={[
            styles.faceOval,
            {
              width: ovalWidth,
              height: ovalHeight,
              borderColor: color,
              borderRadius: ovalWidth / 2,
            },
          ]}
        />
        {/* Document outline on right */}
        <View
          style={[
            styles.documentFrame,
            {
              width: docWidth,
              height: docHeight,
              borderColor: color,
              borderRadius: 8,
              marginLeft: 16,
            },
          ]}
        />
      </View>
    </View>
  );
}

// ---- Styles --------------------------------------------------------------

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
    fontSize: 15,
    fontWeight: '500',
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
  preview: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentFrame: {
    borderWidth: 2,
    borderStyle: 'dashed',
    position: 'relative',
  },
  faceOval: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  dualOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Corner accents for document overlay
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  controls: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  reviewControls: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
