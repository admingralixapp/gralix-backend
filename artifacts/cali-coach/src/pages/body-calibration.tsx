import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { useSaveCalibration } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getCameraFacing } from "@/lib/workout-preferences";
import { useMyProfile } from "@/lib/social";
import {
  Activity, CheckCircle2, RefreshCw, ArrowLeft, Ruler,
  Smartphone, MoveVertical, PersonStanding,
} from "lucide-react";

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

const CALIB_VIS        = 0.5;
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

// ── Biomechanics computation ───────────────────────────────────────────────────

interface RawCapture {
  wingspan: number; height: number; shoulderWidth: number;
  torsoLength: number; legLength: number;
}

interface Biometrics {
  wingspanCm:      number;
  shoulderWidthCm: number;
  torsoLengthCm:   number;
  legLengthCm:     number;
  apeIndex:        number;
  apeLabel:        string;
  apeInsight:      string;
  mechTip:         string;
}

function computeBiometrics(raw: RawCapture, userHeightCm: number): Biometrics {
  // Use the user's known height as the master scale.
  // raw.height is the nose→ankle normalised distance — treat it as 1:1 with
  // the user's real height so every other measurement scales proportionally.
  const scale = userHeightCm / raw.height; // cm per normalised unit

  const wingspanCm      = Math.round(raw.wingspan      * scale);
  const shoulderWidthCm = Math.round(raw.shoulderWidth * scale);
  const torsoLengthCm   = Math.round(raw.torsoLength   * scale);
  const legLengthCm     = Math.round(raw.legLength     * scale);

  // Ape Index = wingspan / height
  const apeIndex = parseFloat((raw.wingspan / raw.height).toFixed(2));
  const apeLabel = apeIndex > 1.02
    ? "Positive Ape Index"
    : apeIndex < 0.98
      ? "Negative Ape Index"
      : "Neutral Ape Index";
  const apeInsight = apeIndex > 1.02
    ? `${apeIndex} — Your wingspan exceeds your height. Longer reach gives a mechanical advantage for pulling movements (muscle-ups, front lever, pull-ups).`
    : apeIndex < 0.98
      ? `${apeIndex} — Your height exceeds your wingspan. Shorter levers reduce rotational torque — a mechanical advantage for pushing skills (planche, handstand push-up).`
      : `${apeIndex} — Balanced proportions. You have no strong bias toward push or pull mechanics.`;

  // Torso vs leg mechanical advantage tip
  const torsoRatio = torsoLengthCm / userHeightCm;
  const mechTip = torsoRatio < 0.30
    ? "Short torso gives a lower centre of gravity — excellent for planche holds and handstand balance."
    : torsoRatio > 0.38
      ? "Longer torso shifts your mass higher — prioritise hollow-body strength and scapular control for planche progressions."
      : "Balanced torso-to-leg ratio. Your proportions suit both pushing and pulling skill paths.";

  return { wingspanCm, shoulderWidthCm, torsoLengthCm, legLengthCm, apeIndex, apeLabel, apeInsight, mechTip };
}

// ── Setup tips shown before / during detection ────────────────────────────────

const SETUP_TIPS = [
  { icon: Smartphone,      text: "Place phone at hip height" },
  { icon: MoveVertical,    text: "Keep phone perfectly vertical — no tilt" },
  { icon: PersonStanding,  text: "Stand 2–3 metres back until your whole body is green" },
];

type CalibPhase = "loading" | "detecting" | "holding" | "done" | "saved";

export function BodyCalibration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const saveCalibration = useSaveCalibration();
  const { data: profile } = useMyProfile();

  const userHeightCm = profile?.heightCm ?? null;

  const [phase,     setPhase]     = useState<CalibPhase>("loading");
  const [countdown, setCountdown] = useState(3);
  const [isSaving,  setIsSaving]  = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef      = useRef<number>(0);
  const holdStartRef  = useRef<number>(0);
  const lastTimeRef   = useRef<number>(-1);
  const capturedRef   = useRef<RawCapture | null>(null);
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
          const landmarks = results.landmarks[0]!;
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
              const L_SH = landmarks[LM_L_SH]!, R_SH = landmarks[LM_R_SH]!;
              const L_WR = landmarks[LM_L_WR]!, R_WR = landmarks[LM_R_WR]!;
              const L_HI = landmarks[LM_L_HI]!, R_HI = landmarks[LM_R_HI]!;
              const L_AN = landmarks[LM_L_AN]!, R_AN = landmarks[LM_R_AN]!;
              const NOSE = landmarks[LM_NOSE]!;

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

  // Derive real-world biometrics only when we have both the capture and the user's height
  const bio = (phase === "done" || phase === "saved") && capturedRef.current && userHeightCm
    ? computeBiometrics(capturedRef.current, userHeightCm)
    : null;

  // Helpers for unit display
  function fmt(cm: number) {
    const ft  = Math.floor(cm / 30.48);
    const inch = Math.round((cm / 2.54) % 12);
    return `${cm} cm  ·  ${ft}'${inch}"`;
  }

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
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.5)" }}
          >
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-primary mb-1">Calibrated!</h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs mx-auto">
              Your biomechanical profile has been saved. Workouts will now start immediately — no more T-Pose required.
            </p>
          </div>

          {/* Show compact bio summary on saved screen */}
          {bio && (
            <div
              className="w-full max-w-sm rounded-2xl p-4 space-y-3 text-left"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Your Biomechanical Profile</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Wingspan",      `${bio.wingspanCm} cm`],
                  ["Shoulder Width",`${bio.shoulderWidthCm} cm`],
                  ["Torso Length",  `${bio.torsoLengthCm} cm`],
                  ["Leg Length",    `${bio.legLengthCm} cm`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-white/50">{label}</span>
                    <span className="font-mono text-white/80 font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2 text-xs text-white/70">
                <span className="text-primary font-bold">{bio.apeLabel}:</span>{" "}
                {bio.apeInsight}
              </div>
            </div>
          )}

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
          <div className="relative flex-1 overflow-hidden bg-zinc-900" style={{ minHeight: 340 }}>
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

            {/* Setup tips — shown during detecting phase */}
            {phase === "detecting" && (
              <div className="absolute top-3 inset-x-3 pointer-events-none">
                <div
                  className="rounded-2xl px-4 py-3 space-y-2"
                  style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(10px)" }}
                >
                  {SETUP_TIPS.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5 text-xs text-white/75">
                      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                  <div
                    className="mt-2 pt-2 text-center text-xs font-semibold text-white/90"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Stand in a T-Pose — arms fully outstretched
                  </div>
                </div>
              </div>
            )}

            {/* Holding banner */}
            {phase === "holding" && (
              <div className="absolute top-3 inset-x-3 pointer-events-none flex justify-center">
                <div
                  className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-center"
                  style={{ background: "rgba(0,0,0,0.70)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}
                >
                  <p className="text-white/90 font-bold">T-Pose detected — hold still</p>
                  <p className="text-white/50 text-xs mt-0.5">Keep your full body visible including feet</p>
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

          {/* ── Biomechanical Profile panel ───────────────────────────────── */}
          {phase === "done" && capturedRef.current && (
            <div className="px-4 py-4 space-y-3 overflow-y-auto">

              {/* Heading */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-bold text-primary">Biomechanical Profile</span>
              </div>

              {bio ? (
                <>
                  {/* Measurements grid */}
                  <div
                    className="rounded-xl p-4 space-y-2.5"
                    style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Measurements</p>
                    {[
                      ["Wingspan",      fmt(bio.wingspanCm)],
                      ["Shoulder Width",`${bio.shoulderWidthCm} cm`],
                      ["Torso Length",  `${bio.torsoLengthCm} cm`],
                      ["Leg Length",    `${bio.legLengthCm} cm`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center text-xs">
                        <span className="text-white/55">{label}</span>
                        <span className="font-mono text-white/90 font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ape Index card */}
                  <div
                    className="rounded-xl p-4 space-y-1.5"
                    style={{
                      background: bio.apeIndex >= 1.0
                        ? "rgba(6,182,212,0.07)"
                        : "rgba(168,85,247,0.07)",
                      border: `1px solid ${bio.apeIndex >= 1.0 ? "rgba(6,182,212,0.25)" : "rgba(168,85,247,0.25)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ape Index</p>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: bio.apeIndex >= 1.0 ? "rgba(6,182,212,0.15)" : "rgba(168,85,247,0.15)",
                          color: bio.apeIndex >= 1.0 ? "#22d3ee" : "#c084fc",
                        }}
                      >
                        {bio.apeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-white/65 leading-relaxed">{bio.apeInsight}</p>
                  </div>

                  {/* Mechanical Advantage tip */}
                  <div
                    className="rounded-xl p-4 space-y-1.5"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60">Mechanical Advantage</p>
                    <p className="text-xs text-white/65 leading-relaxed">{bio.mechTip}</p>
                  </div>
                </>
              ) : (
                /* Fallback if height not available (shouldn't happen after physical calibration) */
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-white/60">
                  {(["wingspan", "height", "shoulderWidth", "torsoLength", "legLength"] as const).map(key => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                      <span className="font-mono text-white/80">
                        {(capturedRef.current![key] * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
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
                    <><CheckCircle2 className="w-4 h-4" />Save Profile</>
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
