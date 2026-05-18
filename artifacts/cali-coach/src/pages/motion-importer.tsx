// ── Motion Importer ──────────────────────────────────────────────────────────
// Video-to-Skeleton automated data importer.
// Processes MP4/MOV through MediaPipe, normalises + smooths landmarks,
// lets the developer pick 3 key frames, then commits them to the exercise DB.

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Link } from "wouter";
import {
  X, Upload, Play, Square, Check, Loader, ChevronRight, Video,
  RefreshCw, Database,
} from "lucide-react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { getMobilityExerciseNames, getSkillExerciseNames, type PoseData } from "@/lib/exercise-poses";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "loading_model" | "processing" | "done";
type LM = { x: number; y: number };
type SlotIdx = 0 | 1 | 2;

const MAX_FRAMES  = 120;          // cap to keep processing reasonable
const FRAME_COLORS: [string, string, string] = ["#22c55e", "#facc15", "#fb923c"];
const SLOT_LABELS = ["Start", "Mid", "End"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
  });
}

function landmarksToFrame(lms: LM[]): PoseData | null {
  if (lms.length < 29) return null;
  const R    = (n: number) => Math.round(n * 2) / 2;
  const lmX  = (i: number) => R((1 - lms[i]!.x) * 100);   // mirror so puppet faces right
  const lmY  = (i: number) => R(lms[i]!.y * 100);
  const pt   = (i: number): [number, number] => [lmX(i), lmY(i)];
  const mid  = (a: number, b: number): [number, number] => [
    R((lmX(a) + lmX(b)) / 2),
    R((lmY(a) + lmY(b)) / 2),
  ];
  const neck = mid(11, 12);
  const hips = mid(23, 24);
  return {
    head:  { cx: lmX(0), cy: lmY(0), r: 6 },
    lines: [
      [neck, hips],
      [neck, pt(13), pt(15), mid(17, 19)],   // left  arm + hand
      [neck, pt(14), pt(16), mid(18, 20)],   // right arm + hand
      [hips, pt(25), pt(27)],
      [hips, pt(26), pt(28)],
    ],
  };
}

// ── Normalization pipeline ────────────────────────────────────────────────────

function medianOf(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

export function normalizePoses(rawPoses: PoseData[]): PoseData[] {
  if (rawPoses.length === 0) return [];

  // Anchor: spine = lines[0]: [0]=neck, [1]=hips
  const hipXs     = rawPoses.map(f => f.lines[0]![1]![0]);
  const hipYs     = rawPoses.map(f => f.lines[0]![1]![1]);
  const spineLens = rawPoses.map(f => {
    const [nx, ny] = f.lines[0]![0]!;
    const [hx, hy] = f.lines[0]![1]!;
    return Math.sqrt((nx - hx) ** 2 + (ny - hy) ** 2);
  });

  const medHipX  = medianOf(hipXs);
  const medHipY  = medianOf(hipYs);
  const medSpine = medianOf(spineLens);

  const TARGET_HIP_X = 50;
  const TARGET_HIP_Y = 72;
  const TARGET_SPINE = 25;
  const scale = medSpine > 1 ? TARGET_SPINE / medSpine : 1;
  const dx = TARGET_HIP_X - medHipX;
  const dy = TARGET_HIP_Y - medHipY;

  const txPt = ([px, py]: [number, number]): [number, number] => {
    const sx = px + dx, sy = py + dy;
    return [
      Math.round((TARGET_HIP_X + (sx - TARGET_HIP_X) * scale) * 2) / 2,
      Math.round((TARGET_HIP_Y + (sy - TARGET_HIP_Y) * scale) * 2) / 2,
    ];
  };

  // Apply centering + scale
  const transformed: PoseData[] = rawPoses.map(f => {
    const [hcx, hcy] = txPt([f.head.cx, f.head.cy]);
    return {
      head:  { cx: hcx, cy: hcy, r: Math.max(4, Math.round(f.head.r * scale * 2) / 2) },
      lines: f.lines.map(line => line.map(txPt)) as Array<[number, number][]>,
    };
  });

  // ── Weighted moving average smoothing (window = 3, weights 0.25/0.5/0.25) ──
  if (transformed.length < 3) return transformed;

  const smooth = (vals: number[]) =>
    vals.map((v, i) =>
      i === 0 || i === vals.length - 1
        ? v
        : vals[i - 1]! * 0.25 + v * 0.5 + vals[i + 1]! * 0.25
    );

  const result: PoseData[] = transformed.map(f =>
    JSON.parse(JSON.stringify(f)) as PoseData
  );

  // Head smoothing
  const hcxS = smooth(transformed.map(f => f.head.cx));
  const hcyS = smooth(transformed.map(f => f.head.cy));
  result.forEach((f, i) => { f.head.cx = hcxS[i]!; f.head.cy = hcyS[i]!; });

  // Per-line, per-point smoothing over time
  const numLines = transformed[0]!.lines.length;
  for (let li = 0; li < numLines; li++) {
    const numPts = transformed[0]!.lines[li]!.length;
    for (let pi = 0; pi < numPts; pi++) {
      const xS = smooth(transformed.map(f => f.lines[li]?.[pi]?.[0] ?? 0));
      const yS = smooth(transformed.map(f => f.lines[li]?.[pi]?.[1] ?? 0));
      result.forEach((f, i) => {
        if (f.lines[li]?.[pi]) f.lines[li]![pi] = [xS[i]!, yS[i]!];
      });
    }
  }

  return result;
}

// ── Rep-key-frame auto-detection ─────────────────────────────────────────────
// Tracks average skeleton height as the motion signal; finds the frame of
// maximum deviation from frame-0 as the "MID" peak.

function detectRepKeyFrames(frames: PoseData[]): [number, number, number] {
  if (frames.length < 3) return [0, Math.floor(frames.length / 2), frames.length - 1];

  const signal = frames.map(f => {
    const allPts = f.lines.flatMap(l => l);
    return allPts.reduce((s, p) => s + p[1], 0) / (allPts.length || 1);
  });

  const startVal = signal[0]!;
  let midIdx = 1, maxDev = 0;
  signal.forEach((v, i) => {
    if (i === 0 || i === frames.length - 1) return;
    const dev = Math.abs(v - startVal);
    if (dev > maxDev) { maxDev = dev; midIdx = i; }
  });

  return [0, midIdx, frames.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton renderer (minimal, matches anim-lab Sprint-14 style)
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonSVG = memo(function SkeletonSVG({
  pose, color, size = 100,
}: { pose: PoseData; color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible", display: "block" }}>
      {/* Limb segments */}
      {pose.lines.map((line, li) =>
        line.slice(0, -1).map((_, pi) => {
          const isHandSeg = pi === line.length - 2 && line.length >= 4;
          return (
            <line key={`${li}-${pi}`}
              x1={line[pi]![0]} y1={line[pi]![1]}
              x2={line[pi + 1]![0]} y2={line[pi + 1]![1]}
              stroke={color} strokeWidth={isHandSeg ? 3 : 5.5} strokeLinecap="round" />
          );
        })
      )}
      {/* Joints */}
      {pose.lines.flatMap((line, li) =>
        line.map(([x, y], pi) => {
          const isKnuckle = pi === line.length - 1 && line.length >= 4;
          return (
            <circle key={`${li}-${pi}`} cx={x} cy={y}
              r={isKnuckle ? 1.8 : 2.5}
              fill={color} opacity={isKnuckle ? 0.9 : 0.6} />
          );
        })
      )}
      {/* Head */}
      <circle cx={pose.head.cx} cy={pose.head.cy}
        r={(pose.head.r ?? 6) + 1.5}
        fill={`${color}12`} stroke={color} strokeWidth={2} />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Frame Thumbnail — a tiny 36×36 SVG snapshot used in the scrubber
// ─────────────────────────────────────────────────────────────────────────────

const FrameThumb = memo(function FrameThumb({
  pose, color, isAssigned, assignLabel, isActive, onClick,
}: {
  pose: PoseData; color: string; isAssigned: boolean;
  assignLabel?: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title={assignLabel}
      style={{
        position: "relative", width: 36, height: 36, borderRadius: 4,
        background: "#080e1a", flexShrink: 0,
        border: `1.5px solid ${isAssigned ? color : isActive ? "#334155" : "#1e293b"}`,
        cursor: "pointer", overflow: "hidden",
        boxShadow: isAssigned ? `0 0 6px ${color}66` : "none",
        transition: "border-color 0.1s, box-shadow 0.1s",
      }}
    >
      <svg viewBox="5 10 90 85" width="100%" height="100%" style={{ display: "block" }}>
        {pose.lines.map((line, li) =>
          line.slice(0, -1).map((_, pi) => (
            <line key={`${li}-${pi}`}
              x1={line[pi]![0]} y1={line[pi]![1]}
              x2={line[pi + 1]![0]} y2={line[pi + 1]![1]}
              stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
          ))
        )}
        <circle cx={pose.head.cx} cy={pose.head.cy}
          r={(pose.head.r ?? 6)} fill="none" stroke={color} strokeWidth={2.5} opacity={0.85} />
      </svg>
      {isAssigned && assignLabel && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          textAlign: "center", fontSize: 7, fontWeight: 800,
          color, background: `${color}22`, lineHeight: "11px",
        }}>
          {assignLabel[0]}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function MotionImporterPage() {
  const mobilityNames = getMobilityExerciseNames();
  const skillNames    = getSkillExerciseNames();

  // ── Core state ────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<Phase>("idle");
  const [videoFile, setVideoFile]       = useState<File | null>(null);
  const [videoUrl, setVideoUrl]         = useState<string | null>(null);
  const [rawFrameCount, setRawFrameCount]  = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [statusMsg, setStatusMsg]       = useState("");
  const [frames, setFrames]             = useState<PoseData[]>([]);
  const [slots, setSlots]               = useState<[number, number, number]>([0, 0, 0]);
  const [activeSlot, setActiveSlot]     = useState<SlotIdx>(0);
  const [scrubIdx, setScrubIdx]         = useState(0);
  const [playingPuppet, setPlayingPuppet] = useState(false);
  const [puppetSeq, setPuppetSeq]       = useState(0);
  const [commitCategory, setCommitCategory] = useState<"mobility" | "skill">("mobility");
  const [commitExercise, setCommitExercise] = useState(() => mobilityNames[0] ?? "");
  const [commitState, setCommitState]   = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [commitMsg, setCommitMsg]       = useState("");
  const [dragOver, setDragOver]         = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null);
  const offscreenRef  = useRef<HTMLVideoElement | null>(null);    // hidden processing video
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const cancelledRef  = useRef(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // ── Puppet play loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!playingPuppet) return;
    const id = setInterval(() => setPuppetSeq(s => (s + 1) % 3), 1000);
    return () => clearInterval(id);
  }, [playingPuppet]);

  const PLAY_SEQ = [0, 1, 2] as const;
  const puppetPoseIdx = slots[PLAY_SEQ[puppetSeq % 3]!];
  const puppetPose    = frames[puppetPoseIdx];

  // ── File ingestion ────────────────────────────────────────────────────────
  const ingestFile = useCallback((file: File) => {
    if (!file.type.match(/video\/(mp4|quicktime|mov|webm)/i) &&
        !file.name.match(/\.(mp4|mov|webm)$/i)) {
      alert("Please upload an MP4, MOV, or WebM video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setPhase("idle");   // show the video preview + ready to process
    setFrames([]);
    setCommitState("idle");
    setCommitMsg("");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) ingestFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) ingestFile(file);
  };

  // ── Processing pipeline ───────────────────────────────────────────────────
  const startProcessing = useCallback(async () => {
    if (!videoUrl) return;
    cancelledRef.current = false;
    setPhase("loading_model");
    setStatusMsg("Initialising MediaPipe…");
    setProcessedCount(0);
    setFrames([]);
    setCommitState("idle");

    try {
      // Init MediaPipe (reuse cached instance)
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
        );
        if (cancelledRef.current) return;
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minTrackingConfidence:      0.45,
        });
      }
      if (cancelledRef.current) return;

      // Create hidden video element for seeking
      const vid = document.createElement("video");
      vid.crossOrigin = "anonymous";
      vid.muted = true;
      vid.playsInline = true;
      vid.src = videoUrl;
      offscreenRef.current = vid;
      await new Promise<void>((res, rej) => {
        vid.addEventListener("loadedmetadata", () => res(), { once: true });
        vid.addEventListener("error", rej, { once: true });
        vid.load();
      });
      if (cancelledRef.current) return;

      const duration = vid.duration;
      const targetFps = Math.min(10, MAX_FRAMES / duration);
      const frameInterval = 1 / targetFps;
      const totalFrames = Math.min(MAX_FRAMES, Math.floor(duration * targetFps));

      setRawFrameCount(totalFrames);
      setPhase("processing");
      setStatusMsg(`Extracting ${totalFrames} frames at ${targetFps.toFixed(1)} fps…`);

      // Set up offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width  = 640;
      canvas.height = 360;
      const ctx2d = canvas.getContext("2d")!;

      const collected: LM[][] = [];

      for (let fi = 0; fi < totalFrames; fi++) {
        if (cancelledRef.current) return;

        const seekTime = fi * frameInterval;
        await seekTo(vid, seekTime);
        if (cancelledRef.current) return;

        ctx2d.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const tsMs = Math.floor(seekTime * 1000);

        let results;
        try {
          results = landmarkerRef.current!.detectForVideo(vid, tsMs);
        } catch {
          setProcessedCount(fi + 1);
          continue;
        }

        if (results.landmarks?.length > 0) {
          collected.push(results.landmarks[0]!);
        }

        setProcessedCount(fi + 1);
      }

      if (cancelledRef.current) return;

      setStatusMsg("Normalising skeleton…");

      // Convert → normalise → smooth
      const rawPoses = collected
        .map(lms => landmarksToFrame(lms))
        .filter((p): p is PoseData => p !== null);

      const normalised = normalizePoses(rawPoses);

      if (normalised.length === 0) {
        setStatusMsg("⚠ No pose detected in video. Try a clip with a clearer full-body view.");
        setPhase("idle");
        return;
      }

      const autoSlots = detectRepKeyFrames(normalised);
      setFrames(normalised);
      setSlots(autoSlots);
      setScrubIdx(autoSlots[1]);   // start scrubber at mid-rep
      setPhase("done");
      setStatusMsg(`Processed ${normalised.length} frames — rep detected.`);

    } catch (err) {
      if (!cancelledRef.current) {
        setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
        setPhase("idle");
      }
    }
  }, [videoUrl]);

  const cancelProcessing = () => {
    cancelledRef.current = true;
    setPhase("idle");
    setStatusMsg("");
  };

  // ── Commit ────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (frames.length === 0) return;
    setCommitState("saving");
    const payload = [frames[slots[0]]!, frames[slots[1]]!, frames[slots[2]]!];
    try {
      const res = await fetch(`/api/admin/poses/${encodeURIComponent(commitExercise)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: payload }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setCommitState("ok");
      setCommitMsg(`Saved to "${commitExercise}" — Vite HMR will reload the skeleton.`);
    } catch (err) {
      setCommitState("error");
      setCommitMsg(err instanceof Error ? err.message : String(err));
    }
  };

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const bg      = "#0f172a";
  const panel   = "#111827";
  const border  = "#1e293b";
  const muted   = "#64748b";

  // ── Progress fraction ────────────────────────────────────────────────────
  const progress = rawFrameCount > 0 ? processedCount / rawFrameCount : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: bg, color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 18px", borderBottom: `1px solid ${border}`,
        flexShrink: 0, background: panel,
      }}>
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15 }}>
          🎬 Motion Importer
        </span>
        <span style={{ fontSize: 11, color: muted, marginLeft: 4 }}>
          Video → Skeleton → Exercise Database
        </span>

        {phase === "done" && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: muted }}>Commit to:</span>

            {/* Category toggle */}
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${border}` }}>
              {(["mobility", "skill"] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setCommitCategory(cat);
                    setCommitExercise(cat === "mobility" ? (mobilityNames[0] ?? "") : (skillNames[0] ?? ""));
                    setCommitState("idle");
                  }}
                  style={{
                    padding: "5px 11px", border: "none", cursor: "pointer", fontSize: 11,
                    fontWeight: 700, letterSpacing: "0.04em",
                    background: commitCategory === cat
                      ? (cat === "skill" ? "#4c1d95" : "#14532d")
                      : "#1e293b",
                    color: commitCategory === cat
                      ? (cat === "skill" ? "#c4b5fd" : "#86efac")
                      : "#64748b",
                    transition: "background 0.15s",
                  }}
                >
                  {cat === "mobility" ? "Mobility" : "Skill Tree"}
                </button>
              ))}
            </div>

            {/* Exercise dropdown — list changes with category */}
            <select
              value={commitExercise}
              onChange={e => { setCommitExercise(e.target.value); setCommitState("idle"); }}
              style={{
                background: commitCategory === "skill" ? "#1e1040" : "#1e293b",
                color: "#f8fafc",
                border: `1px solid ${commitCategory === "skill" ? "#4c1d95" : border}`,
                borderRadius: 6, padding: "5px 10px", fontSize: 12,
                cursor: "pointer", maxWidth: 240,
              }}
            >
              {(commitCategory === "mobility" ? mobilityNames : skillNames)
                .map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            {/* Commit button */}
            <button
              onClick={handleCommit}
              disabled={commitState === "saving" || !commitExercise}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 18px", borderRadius: 8, border: "none",
                background: commitState === "ok" ? "#166534" : "#22c55e",
                color: commitState === "ok" ? "#86efac" : "#000",
                fontWeight: 800, fontSize: 13, cursor: "pointer",
                opacity: !commitExercise ? 0.5 : 1,
              }}
            >
              {commitState === "saving" ? (
                <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
              ) : commitState === "ok" ? (
                <><Check size={13} /> Saved!</>
              ) : (
                <><Database size={13} /> Commit to Exercise DB</>
              )}
            </button>
          </div>
        )}

        <Link
          href="/"
          style={{
            marginLeft: phase === "done" ? 8 : "auto",
            color: muted, display: "flex", alignItems: "center",
            gap: 4, textDecoration: "none", fontSize: 12,
          }}
        >
          <X size={13} /> Exit
        </Link>
      </div>

      {/* ── Main body ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ── IDLE: upload drop zone ── */}
        {phase === "idle" && !videoFile && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 480, borderRadius: 16, padding: "60px 40px",
                border: `2px dashed ${dragOver ? "#22c55e" : "#334155"}`,
                background: dragOver ? "#052e1633" : "#0b1120",
                textAlign: "center", cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#052e16", border: "2px solid #166534",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Upload size={28} color="#22c55e" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                  Drop a video here
                </div>
                <div style={{ fontSize: 12, color: muted }}>
                  MP4, MOV, or WebM · one full rep preferred
                </div>
              </div>
              <div style={{
                padding: "9px 28px", borderRadius: 8, background: "#22c55e",
                color: "#000", fontWeight: 700, fontSize: 13,
              }}>
                Browse File
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}

        {/* ── Video selected, ready to process ── */}
        {(phase === "idle" || phase === "loading_model" || phase === "processing") && videoFile && (
          <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>

            {/* Left: video preview */}
            <div style={{
              flex: "0 0 52%", display: "flex", flexDirection: "column",
              padding: 24, gap: 16, borderRight: `1px solid ${border}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: muted, letterSpacing: "0.06em" }}>
                SOURCE VIDEO
              </div>
              <div style={{ borderRadius: 10, overflow: "hidden", background: "#000", flex: 1, position: "relative" }}>
                {videoUrl && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    loop
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                )}
              </div>
              <div style={{ fontSize: 11, color: muted }}>
                {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setVideoFile(null); setVideoUrl(null); setPhase("idle"); }}
                  style={{
                    padding: "8px 16px", borderRadius: 7, border: `1px solid ${border}`,
                    background: "transparent", color: muted, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Change Video
                </button>
              </div>
            </div>

            {/* Right: processing controls + status */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: 40, gap: 24,
            }}>
              {phase === "idle" && (
                <>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "#052e16", border: "2px solid #166534",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Video size={30} color="#22c55e" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                      Ready to analyse
                    </div>
                    <div style={{ fontSize: 12, color: muted, maxWidth: 280, lineHeight: 1.6 }}>
                      MediaPipe will scan every frame, extract pose landmarks, then normalise
                      and smooth the skeleton data to match our puppet format.
                    </div>
                  </div>
                  <button
                    onClick={startProcessing}
                    style={{
                      padding: "12px 36px", borderRadius: 10, border: "none",
                      background: "#22c55e", color: "#000",
                      fontWeight: 800, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <Play size={16} /> Process Video
                  </button>
                </>
              )}

              {(phase === "loading_model" || phase === "processing") && (
                <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <Loader size={32} color="#22c55e" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      {phase === "loading_model" ? "Loading model…" : "Processing frames…"}
                    </div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {statusMsg}
                    </div>
                  </div>

                  {phase === "processing" && (
                    <>
                      {/* Progress bar */}
                      <div style={{ background: "#1e293b", borderRadius: 8, height: 8, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 8,
                          background: "linear-gradient(90deg, #22c55e, #16a34a)",
                          width: `${progress * 100}%`,
                          transition: "width 0.3s",
                        }} />
                      </div>
                      <div style={{ textAlign: "center", fontSize: 12, color: muted }}>
                        {processedCount} / {rawFrameCount} frames
                      </div>
                    </>
                  )}

                  <button
                    onClick={cancelProcessing}
                    style={{
                      padding: "8px 24px", borderRadius: 7, border: `1px solid ${border}`,
                      background: "transparent", color: muted,
                      fontSize: 12, cursor: "pointer", alignSelf: "center",
                    }}
                  >
                    <Square size={11} style={{ display: "inline", marginRight: 5 }} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DONE: preview + frame selection ── */}
        {phase === "done" && frames.length > 0 && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Left: original video */}
            <div style={{
              flex: "0 0 38%", display: "flex", flexDirection: "column",
              padding: "16px 20px", gap: 12, borderRight: `1px solid ${border}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: muted, letterSpacing: "0.06em" }}>
                SOURCE — {videoFile?.name}
              </div>
              <div style={{ borderRadius: 10, overflow: "hidden", background: "#000", flex: 1 }}>
                {videoUrl && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls loop playsInline
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                )}
              </div>
              <div style={{ fontSize: 10, color: muted }}>
                {frames.length} frames extracted · auto-normalised + smoothed
              </div>
              <button
                onClick={() => { setPhase("idle"); setFrames([]); cancelledRef.current = true; }}
                style={{
                  padding: "7px 14px", borderRadius: 6, border: `1px solid ${border}`,
                  background: "transparent", color: muted, fontSize: 11,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                }}
              >
                <RefreshCw size={11} /> Reprocess
              </button>
            </div>

            {/* Right: puppet preview + frame picker */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Top: puppet animation + scrub preview */}
              <div style={{
                display: "flex", gap: 0, borderBottom: `1px solid ${border}`,
                padding: "16px 20px", alignItems: "flex-start",
              }}>

                {/* Puppet animation */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: muted, letterSpacing: "0.06em", marginBottom: 10 }}>
                    PUPPET PREVIEW
                  </div>
                  <div style={{
                    background: "#080e1a", borderRadius: 12, position: "relative",
                    border: `1px solid ${border}`, display: "inline-flex",
                    flexDirection: "column", alignItems: "center", padding: "8px 12px", gap: 8,
                  }}>
                    {puppetPose ? (
                      <SkeletonSVG
                        pose={puppetPose}
                        color={FRAME_COLORS[PLAY_SEQ[puppetSeq % 3]!]}
                        size={160}
                      />
                    ) : (
                      <div style={{ width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 11 }}>
                        No pose
                      </div>
                    )}
                    <button
                      onClick={() => setPlayingPuppet(p => !p)}
                      style={{
                        padding: "4px 14px", borderRadius: 20,
                        border: `1px solid ${playingPuppet ? "#22c55e" : border}`,
                        background: playingPuppet ? "#052e16" : "transparent",
                        color: playingPuppet ? "#22c55e" : muted,
                        fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {playingPuppet ? <><Square size={9} /> Stop</> : <><Play size={9} /> Animate</>}
                    </button>
                  </div>
                </div>

                {/* 3 key frame slots */}
                <div style={{ flex: 1, paddingLeft: 24 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: muted,
                    letterSpacing: "0.06em", marginBottom: 10,
                  }}>
                    KEY FRAMES — click slot, then click a frame in the timeline
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {([0, 1, 2] as SlotIdx[]).map(si => {
                      const frameIdx = slots[si];
                      const pose = frames[frameIdx];
                      const color = FRAME_COLORS[si];
                      const isActive = activeSlot === si;
                      return (
                        <div
                          key={si}
                          onClick={() => setActiveSlot(si)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                            padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${isActive ? color : border}`,
                            background: isActive ? `${color}0f` : "#080e1a",
                            boxShadow: isActive ? `0 0 10px ${color}33` : "none",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{
                            fontSize: 9, fontWeight: 800, color,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                          }}>
                            {["▶ ", "◉ ", "◀ "][si]}{SLOT_LABELS[si]}
                          </div>
                          {pose ? (
                            <SkeletonSVG pose={pose} color={color} size={80} />
                          ) : (
                            <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 10 }}>
                              —
                            </div>
                          )}
                          <div style={{ fontSize: 9, color: muted }}>frame {frameIdx}</div>
                          {isActive && (
                            <div style={{
                              fontSize: 8, color, background: `${color}22`,
                              padding: "2px 6px", borderRadius: 10, marginTop: 2,
                            }}>
                              ← select in timeline
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Auto-detect button */}
                  <button
                    onClick={() => {
                      const auto = detectRepKeyFrames(frames);
                      setSlots(auto);
                      setScrubIdx(auto[1]);
                    }}
                    style={{
                      marginTop: 12, padding: "6px 14px", borderRadius: 6,
                      border: `1px solid ${border}`, background: "transparent",
                      color: muted, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <RefreshCw size={10} /> Auto-detect rep
                  </button>
                </div>
              </div>

              {/* Timeline scrubber */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "14px 20px",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: muted,
                  letterSpacing: "0.06em", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span>FRAME TIMELINE — {frames.length} frames</span>
                  <span style={{ color: FRAME_COLORS[activeSlot], fontSize: 9 }}>
                    assigning to {SLOT_LABELS[activeSlot]}
                  </span>
                </div>

                {/* Scrollable frame strip */}
                <div style={{
                  display: "flex", gap: 3, flexWrap: "wrap", alignContent: "flex-start",
                }}>
                  {frames.map((pose, fi) => {
                    const slotForFrame = ([0, 1, 2] as SlotIdx[]).find(si => slots[si] === fi);
                    return (
                      <FrameThumb
                        key={fi}
                        pose={pose}
                        color={slotForFrame !== undefined ? FRAME_COLORS[slotForFrame] : "#475569"}
                        isAssigned={slotForFrame !== undefined}
                        assignLabel={slotForFrame !== undefined ? SLOT_LABELS[slotForFrame] : undefined}
                        isActive={scrubIdx === fi}
                        onClick={() => {
                          setScrubIdx(fi);
                          const next = [...slots] as [number, number, number];
                          next[activeSlot] = fi;
                          setSlots(next);
                          // Advance to next slot for fast sequential assignment
                          setActiveSlot(((activeSlot + 1) % 3) as SlotIdx);
                        }}
                      />
                    );
                  })}
                </div>

                {/* Scrub frame preview */}
                {frames[scrubIdx] && (
                  <div style={{
                    marginTop: 14, display: "inline-flex", alignItems: "center", gap: 14,
                    background: "#080e1a", borderRadius: 10, padding: "10px 14px",
                    border: `1px solid ${border}`,
                  }}>
                    <SkeletonSVG pose={frames[scrubIdx]!} color="#94a3b8" size={60} />
                    <div style={{ fontSize: 11, color: muted }}>
                      Frame {scrubIdx} of {frames.length - 1}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Commit status bar ── */}
        {commitMsg && (
          <div style={{
            padding: "10px 18px", borderTop: `1px solid ${border}`,
            background: commitState === "ok" ? "#052e16" : "#1c0505",
            color: commitState === "ok" ? "#86efac" : "#fca5a5",
            fontSize: 12, display: "flex", alignItems: "center", gap: 8,
          }}>
            {commitState === "ok" ? <Check size={13} /> : <X size={13} />}
            {commitMsg}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
