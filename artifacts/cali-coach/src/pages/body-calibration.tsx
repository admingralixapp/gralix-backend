import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { useSaveCalibration } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getCameraFacing } from "@/lib/workout-preferences";
import { Activity, CheckCircle2, RefreshCw, ArrowLeft, Ruler } from "lucide-react";

// ── Landmark indices ───────────────────────────────────────────────────────────
const LM_NOSE  = 0;
const LM_L_SH  = 11;
const LM_R_SH  = 12;
const LM_L_WR  = 15;
const LM_R_WR  = 16;
const LM_L_HI  = 23;
const LM_R_HI  = 24;
const LM_L_AN  = 27;
const LM_R_AN  = 28;

const CALIB_VIS       = 0.5;
const HOLD_DURATION_MS = 3000;

type Landmark = { x: number; y: number; z?: number; visibility?: number };

function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function detectTPose(lms: Landmark[]): boolean {
  const L_SH = lms[LM_L_SH], R_SH = lms[LM_R_SH];
  const L_WR = lms[LM_L_WR], R_WR = lms[LM_R_WR];
  const L_HI = lms[LM_L_HI], R_HI = lms[LM_R_HI];
  const L_AN = lms[LM_L_AN], R_AN = lms[LM_R_AN];
  const NOSE = lms[LM_NOSE];
  const keyLms = [L_SH, R_SH, L_WR, R_WR, L_HI, R_HI, L_AN, R_AN, NOSE];
  if (keyLms.some(lm => !lm || (lm.visibility ?? 1) < CALIB_VIS)) return false;
  if (Math.abs(L_WR.y - L_SH.y) > 0.12) return false;
  if (Math.abs(R_WR.y - R_SH.y) > 0.12) return false;
  const shoulderSpan = Math.abs(R_SH.x - L_SH.x);
  const wristSpan    = Math.abs(R_WR.x - L_WR.x);
  if (wristSpan < shoulderSpan * 1.4) return false;
  if (L_AN.y < L_HI.y + 0.05) return false;
  if (R_AN.y < R_HI.y + 0.05) return false;
  return true;
}

function TPoseSilhouette({ detected }: { detected: boolean }) {
  const color = detected ? "#22c55e" : "rgba(255,255,255,0.30)";
  return (
    <svg
      viewBox="0 0 120 240"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      style={{ height: "68%", filter: detected ? "drop-shadow(0 0 14px #22c55e)" : undefined }}
      aria-hidden
    >
      <circle cx="60" cy="14" r="12" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="26" x2="60" y2="42" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="4"  y1="60" x2="116" y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="42" x2="60" y2="136" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="60" x2="4"   y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="4"  y1="60" x2="4"   y2="100" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="60" y1="60" x2="116" y2="60" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="116" y1="60" x2="116" y2="100" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="40" y1="136" x2="80" y2="136" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="40" y1="136" x2="30" y2="230" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="80" y1="136" x2="90" y2="230" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

type CalibPhase = "loading" | "detecting" | "holding" | "done" | "saved";

export function BodyCalibration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const saveCalibration = useSaveCalibration();

  const [phase,     setPhase]     = useState<CalibPhase>("loading");
  const [countdown, setCountdown] = useState(3);
  const [isSaving,  setIsSaving]  = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef      = useRef<number>(0);
  const holdStartRef  = useRef<number>(0);
  const lastTimeRef   = useRef<number>(-1);
  const capturedRef   = useRef<{
    wingspan: number; height: number; shoulderWidth: number;
    torsoLength: number; legLength: number;
  } | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);

  // ── Load MediaPipe ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
      );
      const lm = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode:    "VIDEO",
        numPoses:       1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence:      0.5,
      });
      if (!cancelled) {
        landmarkerRef.current = lm;
        setPhase("detecting");
        startCamera();
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const facingMode = getCameraFacing() === "user" ? "user" : "environment";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        frameRef.current = requestAnimationFrame(runLoop);
      }
    } catch {
      toast({ title: "Camera access denied", description: "Allow camera access and try again.", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detection loop ──────────────────────────────────────────────────────────
  const runLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const lm     = landmarkerRef.current;
    if (!video || !canvas || !lm) {
      frameRef.current = requestAnimationFrame(runLoop);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) { frameRef.current = requestAnimationFrame(runLoop); return; }

    if (video.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = video.currentTime;
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth)  canvas.width  = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let results;
        try { results = lm.detectForVideo(video, performance.now()); } catch {
          frameRef.current = requestAnimationFrame(runLoop); return;
        }

        if (results.landmarks?.length > 0) {
          const landmarks = results.landmarks[0];
          const du = new DrawingUtils(ctx);
          du.drawLandmarks(landmarks, { radius: 4, color: "#22c55e", lineWidth: 2 });
          du.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#22c55e", lineWidth: 2 });

          const inTPose = detectTPose(landmarks);
          const now = Date.now();

          if (inTPose) {
            if (holdStartRef.current === 0) holdStartRef.current = now;
            const elapsed   = now - holdStartRef.current;
            const remaining = Math.max(0, Math.ceil((HOLD_DURATION_MS - elapsed) / 1000));
            setCountdown(remaining);
            setPhase("holding");

            if (elapsed >= HOLD_DURATION_MS) {
              // ── Capture body proportions ─────────────────────────────────
              const L_SH = landmarks[LM_L_SH], R_SH = landmarks[LM_R_SH];
              const L_WR = landmarks[LM_L_WR], R_WR = landmarks[LM_R_WR];
              const L_HI = landmarks[LM_L_HI], R_HI = landmarks[LM_R_HI];
              const L_AN = landmarks[LM_L_AN], R_AN = landmarks[LM_R_AN];
              const NOSE = landmarks[LM_NOSE];

              const midSH = { x: (L_SH.x + R_SH.x) / 2, y: (L_SH.y + R_SH.y) / 2 };
              const midHI = { x: (L_HI.x + R_HI.x) / 2, y: (L_HI.y + R_HI.y) / 2 };
              const midAN = { x: (L_AN.x + R_AN.x) / 2, y: (L_AN.y + R_AN.y) / 2 };

              capturedRef.current = {
                wingspan:     dist(L_WR, R_WR),
                height:       dist(NOSE, midAN),
                shoulderWidth: dist(L_SH, R_SH),
                torsoLength:  dist(midSH, midHI),
                legLength:    dist(midHI, midAN),
              };

              setPhase("done");
              cancelAnimationFrame(frameRef.current);
              return;
            }
          } else {
            holdStartRef.current = 0;
            setPhase("detecting");
            setCountdown(3);
          }
        } else {
          holdStartRef.current = 0;
          setPhase("detecting");
        }
        ctx.restore?.();
      }
    }
    frameRef.current = requestAnimationFrame(runLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Save calibration to DB ──────────────────────────────────────────────────
  async function handleSave() {
    const data = capturedRef.current;
    if (!data) return;
    setIsSaving(true);
    try {
      await saveCalibration.mutateAsync({
        data: { ...data, capturedAt: new Date().toISOString() },
      });
      setPhase("saved");
    } catch {
      toast({ title: "Failed to save calibration", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Retry ───────────────────────────────────────────────────────────────────
  function handleRetry() {
    capturedRef.current = null;
    holdStartRef.current = 0;
    setPhase("detecting");
    setCountdown(3);
    frameRef.current = requestAnimationFrame(runLoop);
  }

  const detected = phase === "holding" || phase === "done";

  return (
    <div className="min-h-full bg-black text-white flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 z-10 relative">
        <button
          onClick={() => setLocation("/settings")}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Body Calibration</h1>
        </div>
      </div>

      {/* ── Saved confirmation ──────────────────────────────────────────────── */}
      {phase === "saved" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.5)" }}
          >
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-primary mb-2">Calibrated!</h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              Your body proportions have been saved. Workouts will now start immediately — no more T-Pose required.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => setLocation("/workout")}
              className="w-full py-3.5 rounded-xl bg-primary text-black font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Start a Workout
            </button>
            <button
              onClick={() => setLocation("/settings")}
              className="w-full py-3 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/[0.06] transition-colors"
            >
              Back to Settings
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Camera + overlay ─────────────────────────────────────────── */}
          <div className="relative flex-1 overflow-hidden bg-zinc-900" style={{ minHeight: 400 }}>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none -scale-x-100"
            />

            {/* T-Pose silhouette guide */}
            {(phase === "detecting" || phase === "holding") && (
              <TPoseSilhouette detected={detected} />
            )}

            {/* Top instruction banner */}
            {(phase === "detecting" || phase === "holding") && (
              <div className="absolute top-0 inset-x-0 flex justify-center pt-5 pointer-events-none">
                <div
                  className="px-5 py-3 rounded-2xl text-center backdrop-blur-sm"
                  style={{ background: "rgba(0,0,0,0.70)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <p className="text-sm font-semibold text-white/90">
                    Stand in a T-Pose — arms fully outstretched
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Keep your full body visible including feet
                  </p>
                </div>
              </div>
            )}

            {/* Status pill / countdown */}
            <div className="absolute bottom-0 inset-x-0 flex justify-center pb-6 pointer-events-none">
              {phase === "loading" && (
                <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-black/60 border border-white/15">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-semibold text-white/70">Loading AI…</span>
                </div>
              )}
              {phase === "detecting" && (
                <div
                  className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.6)" }}
                >
                  ○ Waiting for T-Pose…
                </div>
              )}
              {phase === "holding" && (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest"
                    style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.5)", color: "#86efac" }}
                  >
                    ● Hold still…
                  </div>
                  <div
                    className="text-7xl font-black tabular-nums leading-none"
                    style={{ color: "#22c55e", textShadow: "0 0 24px rgba(34,197,94,0.7)" }}
                  >
                    {countdown}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Done panel ───────────────────────────────────────────────── */}
          {phase === "done" && capturedRef.current && (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/8 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-bold text-primary">Proportions Captured</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-white/60">
                  <div className="flex justify-between">
                    <span>Wingspan</span>
                    <span className="font-mono text-white/80">{(capturedRef.current.wingspan * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Height</span>
                    <span className="font-mono text-white/80">{(capturedRef.current.height * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shoulder width</span>
                    <span className="font-mono text-white/80">{(capturedRef.current.shoulderWidth * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Torso length</span>
                    <span className="font-mono text-white/80">{(capturedRef.current.torsoLength * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leg length</span>
                    <span className="font-mono text-white/80">{(capturedRef.current.legLength * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/[0.06] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Redo
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-2 flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" />Save Calibration</>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
