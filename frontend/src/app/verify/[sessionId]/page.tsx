"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Hosted KYC Verification Page
 *
 * This is the CIP-hosted page that VASPs redirect users to.
 * It embeds the Web SDK internally with CIP default branding.
 *
 * Flow:
 * 1. VASP creates session → gets redirect URL (this page)
 * 2. User lands here → page loads session details
 * 3. Web SDK handles: document capture, OCR, face match, liveness
 * 4. On completion → redirects to VASP callback URL
 *
 * For mobile: VASPs open this in a WebView. Camera works in WebView.
 * The mobile_callback_url uses a deep link (e.g., paisoapp://kyc-complete)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SessionData {
  session_id: string;
  status: string;
  current_step: string;
  liveness_required: boolean;
  customer_name: string | null;
  expires_at: string;
  completed_at: string | null;
  kyc_status: string | null;
  risk_tier: string | null;
  web_callback_url: string | null;
  mobile_callback_url: string | null;
}

export default function VerifyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const isMobile = searchParams.get("mobile") === "true";

  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sdkComplete, setSdkComplete] = useState(false);
  const [sdkResult, setSdkResult] = useState<any>(null);
  const sdkContainerRef = useRef<HTMLDivElement>(null);
  const sdkInstanceRef = useRef<any>(null);

  // Load session
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/kyc-sessions/${sessionId}/verify`);
        if (!res.ok) throw new Error("Session not found or expired");
        const data = await res.json();
        setSession(data);

        if (data.status === "expired") {
          setError("This verification session has expired. Please request a new one from the app.");
        } else if (data.status === "completed") {
          setSdkComplete(true);
          setSdkResult({
            status: data.kyc_status || "completed",
            riskTier: data.risk_tier,
          });
        }
      } catch (e: any) {
        setError(e.message || "Failed to load verification session");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  // Initialize Web SDK (embedded mode)
  useEffect(() => {
    if (!session || session.status === "expired" || session.status === "completed") return;
    if (!sdkContainerRef.current) return;

    // Dynamically import the Web SDK
    // In production, this would be: import { CipKyc } from '@cip/kyc-web-sdk';
    // For now, we inline the SDK behavior using the same API endpoints
    initializeInlineVerification();
  }, [session]);

  function initializeInlineVerification() {
    // This is a simplified inline version of the Web SDK for the hosted page.
    // In production, replace with the actual @cip/kyc-web-sdk import.
    // The hosted page IS the fallback for VASPs that don't use the SDK.
  }

  function handleRedirect() {
    const callbackUrl = isMobile ? session?.mobile_callback_url : session?.web_callback_url;
    if (callbackUrl) {
      const separator = callbackUrl.includes("?") ? "&" : "?";
      const redirectUrl = `${callbackUrl}${separator}session_id=${sessionId}&status=${sdkResult?.status || "completed"}&risk_tier=${sdkResult?.riskTier || "medium"}`;
      window.location.href = redirectUrl;
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading verification...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <div style={styles.errorIcon}>✕</div>
          <h2 style={styles.errorTitle}>Verification Unavailable</h2>
          <p style={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  if (sdkComplete) {
    const approved = sdkResult?.status === "approved";
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <div style={styles.logo}>
            <div style={styles.logoCircle}>C</div>
            <span style={styles.logoText}>CIP</span>
          </div>

          <div style={{ ...styles.statusIcon, backgroundColor: approved ? "#DCFCE7" : "#FEE2E2" }}>
            <span style={{ fontSize: 40, color: approved ? "#22C55E" : "#EF4444" }}>
              {approved ? "✓" : "✕"}
            </span>
          </div>

          <h2 style={styles.statusTitle}>
            {approved ? "Verification Complete" : "Verification Failed"}
          </h2>
          <p style={styles.statusMessage}>
            {approved
              ? "Your identity has been verified successfully."
              : "We couldn't verify your identity. Please contact support."}
          </p>

          {sdkResult?.data && (
            <div style={styles.dataCard}>
              {sdkResult.data.fullName && (
                <div style={styles.dataRow}>
                  <span style={styles.dataLabel}>Name</span>
                  <span style={styles.dataValue}>{sdkResult.data.fullName}</span>
                </div>
              )}
              {sdkResult.data.cnicNumber && (
                <div style={styles.dataRow}>
                  <span style={styles.dataLabel}>CNIC</span>
                  <span style={styles.dataValue}>{sdkResult.data.cnicNumber}</span>
                </div>
              )}
            </div>
          )}

          {(session?.web_callback_url || session?.mobile_callback_url) && (
            <button style={styles.primaryButton} onClick={handleRedirect}>
              Return to App
            </button>
          )}

          <p style={styles.poweredBy}>
            Powered by <strong>CIP</strong> — Compliance Infrastructure Platform
          </p>
        </div>
      </div>
    );
  }

  // ── Active Verification (inline SDK) ──
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoCircle}>C</div>
          <span style={styles.logoText}>CIP Identity Verification</span>
        </div>
        {session?.customer_name && (
          <p style={styles.welcomeText}>Hi {session.customer_name}, let's verify your identity</p>
        )}
      </div>

      <div style={styles.sdkContainer} ref={sdkContainerRef} id="cip-kyc-hosted">
        {/* Web SDK mounts here in production */}
        {/* For now: show the step-by-step capture UI */}
        <InlineVerification
          sessionId={sessionId}
          session={session!}
          apiBase={API_BASE}
          onComplete={(result) => {
            setSdkComplete(true);
            setSdkResult(result);
          }}
          onError={(err) => setError(err.message)}
        />
      </div>

      <p style={styles.footerText}>
        Your data is encrypted and processed securely. By continuing, you agree to CIP's privacy policy.
      </p>
    </div>
  );
}

// ── Inline Verification Component ──
// This replaces the Web SDK for the hosted page.
// Handles: document capture → selfie → liveness → document-in-hand

function InlineVerification({
  sessionId,
  session,
  apiBase,
  onComplete,
  onError,
}: {
  sessionId: string;
  session: SessionData;
  apiBase: string;
  onComplete: (result: any) => void;
  onError: (error: { message: string }) => void;
}) {
  const isAdvanced = session.liveness_required;
  const allSteps = isAdvanced
    ? ["document_front", "document_back", "selfie", "liveness", "document_in_hand"]
    : ["document_front", "document_back", "selfie"];

  const stepLabels: Record<string, string> = {
    document_front: "CNIC Front",
    document_back: "CNIC Back",
    selfie: "Selfie",
    liveness: "Liveness",
    document_in_hand: "ID in Hand",
  };

  const [currentIdx, setCurrentIdx] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stepResult, setStepResult] = useState<any>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentStep = allSteps[currentIdx];
  const isBack = currentStep === "selfie" || currentStep === "liveness" || currentStep === "document_in_hand";

  // Start camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [currentIdx]);

  async function startCamera() {
    try {
      stopCamera();
      const facing = isBack ? "user" : "environment";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCapturing(true);
      setStepResult(null);
      setStepErrors([]);
    } catch (err: any) {
      onError({ message: "Camera access denied. Please allow camera permissions." });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function captureAndProcess() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploading(true);
      setStepErrors([]);

      try {
        const formData = new FormData();
        formData.append("step", currentStep);
        formData.append("file", blob, `${currentStep}.jpg`);

        const res = await fetch(`${apiBase}/api/v1/kyc-sessions/${sessionId}/process-frame`, {
          method: "POST",
          body: formData,
        });
        const result = await res.json();

        if (result.passed) {
          setStepResult(result);
          setCapturing(false);
        } else {
          setStepErrors(result.errors || ["Verification failed. Please try again."]);
        }
      } catch (err: any) {
        setStepErrors([err.message || "Upload failed"]);
      } finally {
        setUploading(false);
      }
    }, "image/jpeg", 0.9);
  }

  async function captureLivenessFrames() {
    if (!videoRef.current || !canvasRef.current) return;

    setUploading(true);
    setStepErrors([]);

    const frames: Blob[] = [];
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Capture frames over 4 seconds
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
      );
      frames.push(blob);
    }

    try {
      const formData = new FormData();
      frames.forEach((f, i) => formData.append("files", f, `frame_${i}.jpg`));

      const res = await fetch(`${apiBase}/api/v1/kyc-sessions/${sessionId}/process-liveness`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (result.passed) {
        setStepResult(result);
        setCapturing(false);
      } else {
        setStepErrors(result.errors || ["Liveness check failed. Please try again."]);
      }
    } catch (err: any) {
      setStepErrors([err.message || "Liveness check failed"]);
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    if (currentIdx < allSteps.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // All steps done
      onComplete({
        status: stepResult?.sessionStatus === "completed" ? "approved" : "pending",
        riskTier: stepResult?.data?.riskTier || "medium",
        data: stepResult?.data || {},
      });
    }
  }

  const instructions: Record<string, string> = {
    document_front: "Position the FRONT of your CNIC within the frame",
    document_back: "Position the BACK of your CNIC within the frame",
    selfie: "Face the camera directly for a clear selfie",
    liveness: "Follow the instructions: blink naturally, then turn your head",
    document_in_hand: "Hold your CNIC next to your face",
  };

  return (
    <div style={styles.inlineContainer}>
      {/* Steps */}
      <div style={styles.stepsBar}>
        {allSteps.map((s, i) => (
          <div
            key={s}
            style={{
              ...styles.stepDot,
              backgroundColor: i < currentIdx ? "#22C55E" : i === currentIdx ? "#F28A17" : "#333",
              color: i <= currentIdx ? "#FFF" : "#666",
            }}
          >
            {i < currentIdx ? "✓" : i + 1}
          </div>
        ))}
      </div>

      <h3 style={styles.stepTitle}>{stepLabels[currentStep]}</h3>
      <p style={styles.instruction}>{instructions[currentStep]}</p>

      {/* Camera or Result */}
      {capturing ? (
        <div style={styles.cameraWrap}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              ...styles.video,
              transform: isBack ? "scaleX(-1)" : "none",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Overlay */}
          <div style={styles.overlay}>
            {currentStep.startsWith("document") && !currentStep.includes("hand") && (
              <div style={styles.docOutline} />
            )}
            {(currentStep === "selfie" || currentStep === "liveness") && (
              <div style={styles.faceOval} />
            )}
          </div>

          {uploading && (
            <div style={styles.uploadOverlay}>
              <div style={styles.spinner} />
              <p style={{ color: "#FFF", marginTop: 8 }}>Processing...</p>
            </div>
          )}

          {stepErrors.length > 0 && (
            <div style={styles.errorBar}>
              {stepErrors.map((e, i) => (
                <p key={i} style={styles.errorItem}>{e}</p>
              ))}
            </div>
          )}

          {/* Capture button */}
          {!uploading && (
            <button
              style={styles.captureButton}
              onClick={currentStep === "liveness" ? captureLivenessFrames : captureAndProcess}
            >
              {currentStep === "liveness" ? "Start Check" : "Capture"}
            </button>
          )}
        </div>
      ) : stepResult ? (
        <div style={styles.resultWrap}>
          <div style={{ ...styles.resultIcon, backgroundColor: stepResult.passed ? "#DCFCE7" : "#FEE2E2" }}>
            <span style={{ fontSize: 32, color: stepResult.passed ? "#22C55E" : "#EF4444" }}>
              {stepResult.passed ? "✓" : "✕"}
            </span>
          </div>

          {stepResult.data && Object.keys(stepResult.data).length > 0 && (
            <div style={styles.extractedData}>
              {Object.entries(stepResult.data).map(([k, v]) =>
                v ? (
                  <div key={k} style={styles.dataRow}>
                    <span style={styles.dataLabel}>{k.replace(/_/g, " ")}</span>
                    <span style={styles.dataValue}>{String(v)}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          <button style={styles.primaryButton} onClick={handleContinue}>
            {currentIdx < allSteps.length - 1 ? "Continue" : "Complete Verification"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0A0A0C",
    color: "#F5F5F5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    maxWidth: 440,
    textAlign: "center" as const,
  },
  header: {
    width: "100%",
    maxWidth: 500,
    padding: "20px 16px 0",
    textAlign: "center" as const,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F28A17",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 16,
    color: "#FFF",
  },
  logoText: { fontSize: 16, fontWeight: 700 },
  welcomeText: { fontSize: 14, color: "#707075", marginBottom: 16 },
  sdkContainer: { width: "100%", maxWidth: 500, flex: 1, padding: "0 16px" },
  footerText: { fontSize: 11, color: "#505055", padding: 16, textAlign: "center" as const, maxWidth: 400 },

  // Inline verification
  inlineContainer: { width: "100%" },
  stepsBar: { display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  },
  stepTitle: { fontSize: 18, fontWeight: 700, textAlign: "center" as const, marginBottom: 4 },
  instruction: { fontSize: 13, color: "#909095", textAlign: "center" as const, marginBottom: 16 },

  // Camera
  cameraWrap: { position: "relative" as const, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  video: { width: "100%", display: "block", borderRadius: 16 },
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none" as const,
  },
  docOutline: {
    width: "80%",
    aspectRatio: "1.586",
    border: "2px dashed rgba(242,138,23,0.6)",
    borderRadius: 12,
  },
  faceOval: {
    width: "50%",
    aspectRatio: "0.75",
    border: "2px dashed rgba(34,197,94,0.6)",
    borderRadius: "50%",
  },
  uploadOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    display: "block",
    width: "100%",
    padding: "14px",
    marginTop: 12,
    backgroundColor: "#F28A17",
    color: "#FFF",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  errorBar: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(239,68,68,0.9)",
    padding: "8px 12px",
  },
  errorItem: { fontSize: 12, color: "#FFF", margin: "2px 0" },

  // Result
  resultWrap: { display: "flex", flexDirection: "column" as const, alignItems: "center", padding: 20 },
  resultIcon: { width: 64, height: 64, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  extractedData: { width: "100%", backgroundColor: "#141416", borderRadius: 12, padding: 12, marginBottom: 16 },
  primaryButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#22C55E",
    color: "#FFF",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  dataCard: { width: "100%", maxWidth: 360, backgroundColor: "#141416", borderRadius: 12, padding: 16, marginBottom: 20 },
  dataRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2A2A2D" },
  dataLabel: { fontSize: 12, color: "#707075", textTransform: "capitalize" as const },
  dataValue: { fontSize: 13, fontWeight: 600 },

  // Status screens
  statusIcon: { width: 80, height: 80, borderRadius: 40, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  statusTitle: { fontSize: 22, fontWeight: 800, marginBottom: 8 },
  statusMessage: { fontSize: 14, color: "#909095", marginBottom: 24, lineHeight: 1.5 },
  errorIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#EF4444", marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  errorMessage: { fontSize: 14, color: "#909095" },
  poweredBy: { fontSize: 11, color: "#505055", marginTop: 32 },
  loadingText: { fontSize: 14, color: "#707075", marginTop: 12 },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #333",
    borderTop: "3px solid #F28A17",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
