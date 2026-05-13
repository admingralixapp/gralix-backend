import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { useSaveCalibration } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getCameraFacing } from "@/lib/workout-preferences";
import { useMyProfile, useCompleteOnboarding } from "@/lib/social";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, RefreshCw, ArrowLeft, Ruler,
  Smartphone, MoveVertical, PersonStanding, Loader2,
} from "lucide-react";

// ── Landmark indices ──────────────────────────────────────────────────────────
const LM_NOSE = 0;
const LM_L_SH = 11; const LM_R_SH = 12;
const LM_L_WR = 15; const LM_R_WR = 16;
const LM_L_HI = 23; const LM_R_HI = 24;
const LM_L_AN = 27; const LM_R_AN = 28;

const CALIB_VIS        = 0.5;
const HOLD_DURATION_MS = 3000;

type Landmark = { x: number; y: number; z?: number; visibility?: number };
function dist(a: Landmark, b: Landmark) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Returns the angle (degrees) the arm makes from horizontal.
// MediaPipe landmark indices are from the PERSON's perspective, not the camera's.
// "Left" landmarks (11,15) appear on the camera's RIGHT side → higher x.
// "Right" landmarks (12,16) appear on the camera's LEFT side → lower x.
// So when arms are outstretched:
//   left wrist x  >  left shoulder x  (wrist further right in frame)
//   right wrist x <  right shoulder x (wrist further left in frame)
function armAngleDeg(shoulder: Landmark, wrist: Landmark, side: "left" | "right"): number {
  const dy = wrist.y - shoulder.y;
  const dx = side === "left"
    ? wrist.x - shoulder.x  // positive when left wrist is right of left shoulder ✓
    : shoulder.x - wrist.x; // positive when right wrist is left of right shoulder ✓
  if (dx <= 0) return 90;   // arm folded inward — reject
  return Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
}

function detectTPose(lms: Landmark[]): boolean {
  const L_SH = lms[LM_L_SH], R_SH = lms[LM_R_SH];
  const L_WR = lms[LM_L_WR], R_WR = lms[LM_R_WR];
  const L_HI = lms[LM_L_HI], R_HI = lms[LM_R_HI];
  const L_AN = lms[LM_L_AN], R_AN = lms[LM_R_AN];
  const NOSE = lms[LM_NOSE];
  const keys = [L_SH, R_SH, L_WR, R_WR, L_HI, R_HI, L_AN, R_AN, NOSE];
  if (keys.some(lm => !lm || (lm.visibility ?? 1) < CALIB_VIS)) return false;
  // ±15° from horizontal for both arms
  if (armAngleDeg(L_SH!, L_WR!, "left")  > 15) return false;
  if (armAngleDeg(R_SH!, R_WR!, "right") > 15) return false;
  // Wrist span must exceed shoulder span by ≥40% (arms truly outstretched)
  if (dist(R_WR!, L_WR!) < dist(R_SH!, L_SH!) * 1.4) return false;
  // Ankles must be below hips (standing, not crouching)
  if (L_AN!.y < L_HI!.y + 0.05 || R_AN!.y < R_HI!.y + 0.05) return false;
  return true;
}

// ── Ghost Guide — static, anatomically correct T-Pose target ─────────────────
// Arms are STRICTLY HORIZONTAL: all arm joints share the same y-coordinate (54).
// Path: L-wrist(2,54)→L-elbow(10,54)→L-shoulder(22,54)→R-shoulder(98,54)→R-elbow(110,54)→R-wrist(118,54)
function TPoseGhostGuide({ aligned }: { aligned: boolean }) {
  const bone  = aligned ? "rgba(34,197,94,0.60)" : "rgba(255,255,255,0.18)";
  const joint = aligned ? "#22c55e"              : "rgba(255,255,255,0.38)";
  const glow  = aligned ? "drop-shadow(0 0 14px rgba(34,197,94,0.80))" : undefined;
  const sw = 3.5; // strokeWidth
  const jR = 3.2; // joint dot radius

  // Joints — (x,y) for every labelled body point
  const J = {
    head:  [60, 16] as const,
    neck:  [60, 28] as const,
    // Arm joints — ALL at y=54 for perfectly horizontal arms
    lwr:   [2,  54] as const,
    lel:   [10, 54] as const,
    lsh:   [22, 54] as const,
    rsh:   [98, 54] as const,
    rel:   [110,54] as const,
    rwr:   [118,54] as const,
    // Torso
    mid:   [60, 54] as const, // shoulder midpoint
    lhi:   [44,132] as const,
    rhi:   [76,132] as const,
    hip:   [60,132] as const, // hip midpoint
    // Legs
    lkn:   [38,182] as const,
    rkn:   [82,182] as const,
    lan:   [34,232] as const,
    ran:   [86,232] as const,
  };

  const bones: Array<[readonly [number,number], readonly [number,number]]> = [
    // Head + neck
    [J.neck,  J.mid ],
    // Left arm — all at y=54 → strictly horizontal
    [J.lwr, J.lel], [J.lel, J.lsh],
    // Right arm — all at y=54 → strictly horizontal
    [J.rsh, J.rel], [J.rel, J.rwr],
    // Shoulder crossbar
    [J.lsh, J.rsh],
    // Torso
    [J.mid, J.hip],
    // Hip crossbar
    [J.lhi, J.rhi],
    // Left leg
    [J.lhi, J.lkn], [J.lkn, J.lan],
    // Right leg
    [J.rhi, J.rkn], [J.rkn, J.ran],
  ];

  const dots = [J.lwr, J.lel, J.lsh, J.rsh, J.rel, J.rwr,
                 J.lhi, J.rhi, J.lkn, J.rkn, J.lan, J.ran];

  return (
    <svg
      viewBox="0 0 120 240"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      style={{ height: "74%", filter: glow }}
      aria-hidden
    >
      {/* Head */}
      <circle cx={J.head[0]} cy={J.head[1]} r="10"
        fill="none" stroke={bone} strokeWidth={sw} strokeLinecap="round" />

      {/* Bones */}
      {bones.map(([a, b], i) => (
        <line key={i}
          x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={bone} strokeWidth={sw} strokeLinecap="round"
        />
      ))}

      {/* Joint dots */}
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={jR} fill={joint} />
      ))}
    </svg>
  );
}

// ── Biomechanics ──────────────────────────────────────────────────────────────
interface RawCapture {
  wingspan: number; height: number; shoulderWidth: number;
  torsoLength: number; legLength: number;
}
interface Bio {
  wingspanCm: number; shoulderWidthCm: number;
  torsoLengthCm: number; legLengthCm: number;
  apeIndex: number; apeLabel: string; apeInsight: string; mechTip: string;
}
function computeBio(raw: RawCapture, heightCm: number): Bio {
  const s             = heightCm / raw.height;
  const wingspanCm    = Math.round(raw.wingspan      * s);
  const shoulderWidthCm = Math.round(raw.shoulderWidth * s);
  const torsoLengthCm = Math.round(raw.torsoLength   * s);
  const legLengthCm   = Math.round(raw.legLength     * s);
  const apeIndex      = parseFloat((raw.wingspan / raw.height).toFixed(2));
  const apeLabel      = apeIndex > 1.02 ? "Positive Ape Index"
    : apeIndex < 0.98 ? "Negative Ape Index" : "Neutral Ape Index";
  const apeInsight    = apeIndex > 1.02
    ? `${apeIndex} — Wingspan exceeds height. Longer reach gives a mechanical advantage for pulling movements (muscle-ups, front lever, pull-ups).`
    : apeIndex < 0.98
      ? `${apeIndex} — Height exceeds wingspan. Shorter levers reduce torque — advantage for pushing skills (planche, HSPU).`
      : `${apeIndex} — Balanced proportions. No strong push/pull bias.`;
  const torsoRatio    = torsoLengthCm / heightCm;
  const mechTip       = torsoRatio < 0.30
    ? "Short torso gives a low centre of gravity — excellent for planche holds and handstand balance."
    : torsoRatio > 0.38
      ? "Longer torso shifts mass higher — prioritise hollow-body strength and scapular control for planche progressions."
      : "Balanced torso-to-leg ratio. Your proportions suit both push and pull skill paths.";
  return { wingspanCm, shoulderWidthCm, torsoLengthCm, legLengthCm, apeIndex, apeLabel, apeInsight, mechTip };
}
function fmtCm(cm: number) {
  const ft = Math.floor(cm / 30.48);
  const inch = Math.round((cm / 2.54) % 12);
  return `${cm} cm · ${ft}'${inch}"`;
}

// ── Setup tips ────────────────────────────────────────────────────────────────
const SETUP_TIPS = [
  { icon: Smartphone,     text: "Place phone at hip height" },
  { icon: MoveVertical,   text: "Keep phone perfectly vertical — no tilt" },
  { icon: PersonStanding, text: "Stand 2–3 metres back until your whole body is green" },
];

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ progress }: { progress: number }) {
  const r = 36; const circ = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke="#22c55e" strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dashoffset 0.1s linear", filter: "drop-shadow(0 0 6px #22c55e)" }}
      />
      <text x="44" y="49" textAnchor="middle" fill="#22c55e" fontSize="20" fontWeight="800" fontFamily="monospace">
        {Math.ceil((1 - progress) * (HOLD_DURATION_MS / 1000)) || "✓"}
      </text>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
type CapturePhase = "loading" | "detecting" | "holding" | "results";

export function BodyCalibration() {
  const [, setLocation]    = useLocation();
  const { toast }          = useToast();
  const qc                 = useQueryClient();
  const saveCalibration    = useSaveCalibration();
  const completeOnboarding = useCompleteOnboarding();
  const { data: profile }  = useMyProfile();

  // Snapshot the onboarding state at mount — used to decide nav after confirming
  const alreadyOnboarded = useRef(profile?.hasCompletedOnboarding ?? false);
  useEffect(() => {
    if (profile?.hasCompletedOnboarding) alreadyOnboarded.current = true;
  }, [profile?.hasCompletedOnboarding]);

  const userHeightCm = profile?.heightCm ?? null;

  const [phase,       setPhase]       = useState<CapturePhase>("loading");
  const [holdProgress, setHoldProgress] = useState(0);
  const [isSaving,    setIsSaving]    = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

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
        runningMode: "VIDEO", numPoses: 1,
        minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      if (!cancelled) { landmarkerRef.current = lm; setPhase("detecting"); startCamera(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const facing = getCameraFacing() === "user" ? "user" : "environment";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
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
    const video = videoRef.current, canvas = canvasRef.current, lm = landmarkerRef.current;
    if (!video || !canvas || !lm) { frameRef.current = requestAnimationFrame(runLoop); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { frameRef.current = requestAnimationFrame(runLoop); return; }

    if (video.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = video.currentTime;
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth)   canvas.width  = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let results;
        try { results = lm.detectForVideo(video, performance.now()); }
        catch { frameRef.current = requestAnimationFrame(runLoop); return; }

        if (results.landmarks?.length > 0) {
          const lmarks = results.landmarks[0]!;

          // Detect alignment FIRST — only draw the live skeleton when aligned
          // so the ghost guide remains the sole visual target until the user matches it.
          const inTPose = detectTPose(lmarks);
          if (inTPose) {
            const du = new DrawingUtils(ctx);
            du.drawLandmarks(lmarks, { radius: 4, color: "#22c55e", lineWidth: 2 });
            du.drawConnectors(lmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#22c55e", lineWidth: 2 });
          }

          const now = Date.now();

          if (inTPose) {
            if (holdStartRef.current === 0) holdStartRef.current = now;
            const elapsed   = now - holdStartRef.current;
            const progress  = Math.min(elapsed / HOLD_DURATION_MS, 1);
            setHoldProgress(progress);
            setPhase("holding");

            if (elapsed >= HOLD_DURATION_MS) {
              // ── Capture ─────────────────────────────────────────────────────
              const L_SH = lmarks[LM_L_SH]!, R_SH = lmarks[LM_R_SH]!;
              const L_WR = lmarks[LM_L_WR]!, R_WR = lmarks[LM_R_WR]!;
              const L_HI = lmarks[LM_L_HI]!, R_HI = lmarks[LM_R_HI]!;
              const L_AN = lmarks[LM_L_AN]!, R_AN = lmarks[LM_R_AN]!;
              const NOSE = lmarks[LM_NOSE]!;
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

              // Snapshot the skeleton canvas before stopping the stream
              const snap = canvas.toDataURL("image/jpeg", 0.82);
              setSnapshotUrl(snap);

              // Stop camera — no longer needed after capture
              cancelAnimationFrame(frameRef.current);
              streamRef.current?.getTracks().forEach(t => t.stop());

              setPhase("results");
              return;
            }
          } else {
            holdStartRef.current = 0;
            setHoldProgress(0);
            setPhase("detecting");
          }
        } else {
          holdStartRef.current = 0;
          setHoldProgress(0);
          setPhase("detecting");
        }
        ctx.restore?.();
      }
    }
    frameRef.current = requestAnimationFrame(runLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Redo capture ────────────────────────────────────────────────────────────
  function handleRedo() {
    capturedRef.current = null;
    holdStartRef.current = 0;
    setSnapshotUrl(null);
    setHoldProgress(0);
    setPhase("detecting");
    // Restart camera
    startCamera();
  }

  // ── Confirm & Continue ───────────────────────────────────────────────────────
  async function handleConfirm() {
    const data = capturedRef.current;
    if (!data || isSaving) return;
    setIsSaving(true);
    try {
      // 1. Persist biometric data
      await saveCalibration.mutateAsync({
        data: { ...data, capturedAt: new Date().toISOString() },
      });
      // 2. Mark onboarding complete — sets hasCompletedOnboarding = true in DB
      await completeOnboarding.mutateAsync();
      // 3. Flush the profile cache so the guard/tour see the updated state
      await qc.refetchQueries({ queryKey: ["/api/users/me"] });
      // 4. Navigate: back to settings for returning users, dashboard for first-timers
      setLocation(alreadyOnboarded.current ? "/settings" : "/");
    } catch {
      toast({ title: "Failed to save — please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const bio = capturedRef.current && userHeightCm
    ? computeBio(capturedRef.current, userHeightCm)
    : null;

  const isCapturing = phase !== "results";

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── STEP 1: Full-screen camera capture overlay ─────────────────────── */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Live camera feed */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
              playsInline muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none -scale-x-100"
            />

            {/* T-pose silhouette */}
            {(phase === "detecting" || phase === "holding") && (
              <TPoseGhostGuide aligned={phase === "holding"} />
            )}

            {/* ── Setup tips & instruction card (top) ── */}
            {phase !== "loading" && (
              <div className="absolute top-0 inset-x-0 px-4 pt-safe pt-5 z-10 pointer-events-none">
                <div
                  className="rounded-2xl px-4 py-3.5 space-y-2"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-0.5">
                    Setup Checklist
                  </p>
                  {SETUP_TIPS.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5 text-xs text-white/80">
                      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                  <div
                    className="text-xs font-semibold text-white/70 text-center pt-1.5 mt-0.5"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    Stand in a T-Pose — arms fully outstretched
                  </div>
                </div>
              </div>
            )}

            {/* ── Status / progress (centre-bottom) ── */}
            <div className="absolute bottom-0 inset-x-0 flex flex-col items-center gap-3 pb-12 pointer-events-none">
              {phase === "loading" && (
                <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-black/60 border border-white/15">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-semibold text-white/70">Loading AI model…</span>
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
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div
                    className="px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.5)", color: "#86efac" }}
                  >
                    ● T-Pose detected — hold still
                  </div>
                  <ProgressRing progress={holdProgress} />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 2: Biomechanical Results page ─────────────────────────────── */}
      <AnimatePresence>
        {phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } }}
            className="min-h-full bg-black text-white flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLocation(alreadyOnboarded.current ? "/settings" : "/")}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-primary" />
                  <h1 className="text-base font-bold">Biomechanical Profile</h1>
                </div>
              </div>

              {/* Skeleton snapshot thumbnail */}
              {snapshotUrl && (
                <div
                  className="w-14 h-20 rounded-xl overflow-hidden border"
                  style={{ border: "1px solid rgba(34,197,94,0.35)", background: "#000" }}
                >
                  <img
                    src={snapshotUrl}
                    alt="Captured T-pose"
                    className="w-full h-full object-cover -scale-x-100"
                  />
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">

              {/* Capture confirmed banner */}
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary">T-Pose captured successfully</span>
              </div>

              {bio ? (
                <>
                  {/* Measurements */}
                  <div
                    className="rounded-2xl p-4 space-y-2.5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1">Measurements</p>
                    {[
                      ["Wingspan",       fmtCm(bio.wingspanCm)],
                      ["Shoulder Width", `${bio.shoulderWidthCm} cm`],
                      ["Torso Length",   `${bio.torsoLengthCm} cm`],
                      ["Leg Length",     `${bio.legLengthCm} cm`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center text-sm">
                        <span className="text-white/55">{label}</span>
                        <span className="font-mono text-white/90 font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ape Index */}
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={{
                      background: bio.apeIndex >= 1.0 ? "rgba(6,182,212,0.07)" : "rgba(168,85,247,0.07)",
                      border: `1px solid ${bio.apeIndex >= 1.0 ? "rgba(6,182,212,0.28)" : "rgba(168,85,247,0.28)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Ape Index</p>
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
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

                  {/* Mechanical Advantage */}
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.22)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/55">Mechanical Advantage</p>
                    <p className="text-xs text-white/65 leading-relaxed">{bio.mechTip}</p>
                  </div>
                </>
              ) : (
                /* Height not available — show raw percentages as fallback */
                <div className="rounded-2xl p-4 space-y-2 text-xs text-white/60"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-1">Raw Proportions</p>
                  {(["wingspan", "height", "shoulderWidth", "torsoLength", "legLength"] as const).map(k => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="font-mono text-white/80">{(capturedRef.current![k] * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Note for new users */}
              {!alreadyOnboarded.current && (
                <p className="text-[11px] text-white/35 text-center px-4 leading-relaxed">
                  Confirm to continue to the app. You can recalibrate anytime from Settings.
                </p>
              )}
            </div>

            {/* ── Action buttons ── */}
            <div
              className="px-4 pt-3 pb-safe pb-6 flex gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
            >
              <button
                onClick={handleRedo}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/[0.06] transition-colors disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4" />
                Redo
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#000",
                  boxShadow: "0 4px 20px rgba(34,197,94,0.40)",
                }}
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" />{alreadyOnboarded.current ? "Save & Return" : "Confirm & Continue"}</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden video/canvas placeholders kept in DOM for the ref during results phase */}
      {phase === "results" && (
        <>
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </>
  );
}
