// ---------------------------------------------------------------------------
// CIP KYC Web SDK — Camera Management
// ---------------------------------------------------------------------------

import { CipKycError } from './types';

export type CameraFacing = 'user' | 'environment';

/**
 * Request camera access with the specified facing mode.
 * Returns a MediaStream that can be attached to a <video> element.
 */
export async function requestCamera(facing: CameraFacing): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw buildCameraError(
      'CAMERA_UNAVAILABLE',
      'Camera API is not available on this device or browser.',
    );
  }

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: facing,
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw buildCameraError(
        'CAMERA_PERMISSION_DENIED',
        'Camera access was denied. Please allow camera access and try again.',
      );
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      throw buildCameraError(
        'CAMERA_NOT_FOUND',
        'No camera found on this device.',
      );
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      throw buildCameraError(
        'CAMERA_IN_USE',
        'Camera is already in use by another application.',
      );
    }
    throw buildCameraError('CAMERA_ERROR', err.message || 'Failed to access camera.');
  }
}

/**
 * Capture the current video frame as a JPEG Blob.
 */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(buildCameraError('CAPTURE_ERROR', 'Failed to create canvas context.'));
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(buildCameraError('CAPTURE_ERROR', 'Failed to capture frame.'));
        }
      },
      'image/jpeg',
      0.9,
    );
  });
}

/**
 * Stop all tracks on a MediaStream (releases camera).
 */
export function stopCamera(stream: MediaStream): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

// ---- Internal helpers ----------------------------------------------------

function buildCameraError(code: string, message: string): CipKycError {
  return { code, message };
}
