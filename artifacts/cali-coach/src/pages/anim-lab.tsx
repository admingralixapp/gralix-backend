import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Play, Square, Save, RotateCcw, X, Copy, Check, Minus, Plus, Clipboard, ChevronDown, Camera, RotateCw } from "lucide-react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import {
  getPoseSet,
  getMobilityExerciseNames,
  getWorldObjects,
  type PoseData,
  type EnvAnchor,
} from "@/lib/exercise-poses";

// ── Types ───────────────────────────────────────────────────────────────────

type FrameIdx = 0 | 1 | 2;
type DragState = { isHead: boolean; indices: { lineIdx: number; pointIdx: number }[] };

const FRAME_LABELS = ["Start", "Mid", "End"] as const;
const FRAME_COLORS: [string, string, string] = ["#22c55e", "#facc15", "#fb923c"];
const PLAY_SEQ: FrameIdx[] = [0, 1, 2, 1];

// ── Base Templates ───────────────────────────────────────────────────────────

const BASE_TEMPLATES: Record<string, PoseData> = {
  "Standing Neutral": {
    head: { cx: 50, cy: 16, r: 6 },
    lines: [
      [[50, 22], [50, 50]],
      [[50, 28], [40, 40], [34, 50]],
      [[50, 28], [60, 40], [66, 50]],
      [[50, 50], [44, 68], [42, 84]],
      [[50, 50], [56, 68], [58, 84]],
    ],
  },
  "Plank Position": {
    head: { cx: 18, cy: 44, r: 5.5 },
    lines: [
      [[24, 47], [63, 43]],
      [[24, 47], [15, 59]],
      [[24, 47], [20, 61]],
      [[63, 43], [69, 57], [71, 71]],
      [[63, 43], [65, 59], [66, 74]],
    ],
  },
  "Hanging (Dead Hang)": {
    head: { cx: 50, cy: 22, r: 6 },
    lines: [
      [[50, 28], [50, 56]],
      [[50, 30], [36, 16], [30, 8]],
      [[50, 30], [64, 16], [70, 8]],
      [[50, 56], [44, 73], [42, 87]],
      [[50, 56], [56, 73], [58, 87]],
    ],
  },
};

// ── Utilities ───────────────────────────────────────────────────────────────

function cloneFrame(f: PoseData): PoseData {
  return JSON.parse(JSON.stringify(f));
}

function svgPoint(e: React.PointerEvent, svgEl: SVGSVGElement): [number, number] {
  const rect = svgEl.getBoundingClientRect();
  const rx = ((e.clientX - rect.left) / rect.width) * 100;
  const ry = ((e.clientY - rect.top) / rect.height) * 100;
  const x = Math.round(Math.max(0, Math.min(100, rx)) * 2) / 2;
  const y = Math.round(Math.max(0, Math.min(100, ry)) * 2) / 2;
  return [x, y];
}

function findMatching(pose: PoseData, tx: number, ty: number) {
  const out: { lineIdx: number; pointIdx: number }[] = [];
  pose.lines.forEach((line, li) =>
    line.forEach(([x, y], pi) => {
      if (x === tx && y === ty) out.push({ lineIdx: li, pointIdx: pi });
    })
  );
  return out;
}

type JointInfo = {
  x: number; y: number; isHinge: boolean;
  /** Present only for the last point of each line — which line index to extend */
  extendLineIdx?: number;
};

/**
 * Returns all unique joint positions for the pose.
 * `isHinge = true` marks the intermediate points of multi-point lines —
 * these are ELBOWS (middle of arm chains) and KNEES (middle of leg chains).
 * Endpoint joints are shoulders, wrists, hips and ankles.
 * `extendLineIdx` is set on the LAST point of each line, indicating it can
 * be extended with a new joint (wrist→hand, ankle→foot, etc.).
 */
function uniqueJoints(pose: PoseData): JointInfo[] {
  // Collect keys for every intermediate (hinge) point in multi-point lines
  const hingeKeys = new Set<string>();
  pose.lines.forEach(line => {
    if (line.length >= 3) {
      for (let i = 1; i < line.length - 1; i++) {
        hingeKeys.add(`${line[i][0]},${line[i][1]}`);
      }
    }
  });

  // Map: "x,y" -> extendLineIdx for the LAST point of each line
  const extendMap = new Map<string, number>();
  pose.lines.forEach((line, li) => {
    if (line.length >= 2) {
      const [lx, ly] = line[line.length - 1];
      const k = `${lx},${ly}`;
      // Only tag if not already a hinge (i.e. it's a true terminal)
      if (!hingeKeys.has(k)) extendMap.set(k, li);
    }
  });

  const seen = new Set<string>();
  const out: JointInfo[] = [];
  pose.lines.forEach(line =>
    line.forEach(([x, y]) => {
      const k = `${x},${y}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({
          x, y,
          isHinge:       hingeKeys.has(k),
          extendLineIdx: extendMap.get(k),
        });
      }
    })
  );
  return out;
}

// ── Landmark → PoseData ──────────────────────────────────────────────────────

type LM = { x: number; y: number };

function landmarksToFrame(lms: LM[]): PoseData | null {
  if (lms.length < 29) return null;
  const R = (n: number) => Math.round(n * 2) / 2;
  const lmX  = (i: number) => R((1 - lms[i]!.x) * 100); // mirror so figure faces right
  const lmY  = (i: number) => R(lms[i]!.y * 100);
  const lmPt = (i: number): [number, number] => [lmX(i), lmY(i)];
  const midPt = (a: number, b: number): [number, number] => [
    R((lmX(a) + lmX(b)) / 2),
    R((lmY(a) + lmY(b)) / 2),
  ];
  const neck = midPt(11, 12);
  const hips = midPt(23, 24);
  return {
    head: { cx: lmX(0), cy: lmY(0), r: 6 },
    lines: [
      [neck, hips],
      [neck, lmPt(13), lmPt(15)],
      [neck, lmPt(14), lmPt(16)],
      [hips, lmPt(25), lmPt(27)],
      [hips, lmPt(26), lmPt(28)],
    ],
  };
}

// ── Skeleton rotation ─────────────────────────────────────────────────────────

function rotatePose(pose: PoseData, deg: number): PoseData {
  if (deg === 0) return pose;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const allPts: [number, number][] = [
    [pose.head.cx, pose.head.cy],
    ...pose.lines.flatMap(line => line),
  ];
  const cxA = allPts.reduce((s, p) => s + p[0], 0) / allPts.length;
  const cyA = allPts.reduce((s, p) => s + p[1], 0) / allPts.length;
  const rot = (x: number, y: number): [number, number] => {
    const dx = x - cxA, dy = y - cyA;
    return [
      Math.round((cxA + dx * cos - dy * sin) * 2) / 2,
      Math.round((cyA + dx * sin + dy * cos) * 2) / 2,
    ];
  };
  const [nhx, nhy] = rot(pose.head.cx, pose.head.cy);
  return {
    head: { ...pose.head, cx: nhx, cy: nhy },
    lines: pose.lines.map(line => line.map(([x, y]) => rot(x, y))),
    muscleGlow: pose.muscleGlow
      ? (() => {
          const [gx, gy] = rot(pose.muscleGlow!.cx, pose.muscleGlow!.cy);
          return { ...pose.muscleGlow!, cx: gx, cy: gy };
        })()
      : undefined,
  };
}

// ── Environment Renderer (matches mobility.tsx visual exactly) ───────────────

function EnvSVG({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    const ticks = 12;
    const step = (env.x2 - env.x1) / ticks;
    return (
      <g>
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 2 + i * step;
          return <line key={i} x1={x} y1={env.y1} x2={x - 4} y2={env.y1 + 6}
            stroke="#475569" strokeWidth={0.7} opacity={0.3} strokeLinecap="round" />;
        })}
        <line x1={env.x1} y1={env.y1 + 1.2} x2={env.x2} y2={env.y2 + 1.2}
          stroke="#0f172a" strokeWidth={2} opacity={0.25} strokeLinecap="round" />
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  }
  if (env.type === "bar") {
    const ticks = 9;
    const step = (env.x2 - env.x1 - 8) / (ticks - 1);
    return (
      <g>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#94a3b8" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 4 + i * step;
          return <line key={i} x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5}
            stroke="#475569" strokeWidth={1} opacity={0.4} />;
        })}
        <line x1={env.x1} y1={env.y1 - 4} x2={env.x1} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
        <line x1={env.x2} y1={env.y1 - 4} x2={env.x2} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
      </g>
    );
  }
  if (env.type === "wall") {
    const ticks = 8;
    const step = (env.y2 - env.y1) / ticks;
    const onRight = env.x1 > 50;
    return (
      <g opacity={0.5}>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: ticks - 1 }).map((_, i) => {
          const y = env.y1 + (i + 1) * step;
          return <line key={i} x1={env.x1} y1={y} x2={env.x1 + (onRight ? -6 : 6)} y2={y}
            stroke="#64748b" strokeWidth={0.8} opacity={0.35} />;
        })}
      </g>
    );
  }
  return null;
}

// ── Ghost skeleton (other two frames shown faintly) ─────────────────────────

function GhostSkeleton({ pose, color }: { pose: PoseData; color: string }) {
  return (
    <>
      {pose.lines.map((pts, li) =>
        pts.slice(0, -1).map((_, pi) => (
          <line key={`${li}-${pi}`}
            x1={pts[pi][0]} y1={pts[pi][1]} x2={pts[pi + 1][0]} y2={pts[pi + 1][1]}
            stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.12} />
        ))
      )}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
        fill="none" stroke={color} strokeWidth={2} opacity={0.12} />
    </>
  );
}

// ── Active skeleton (neon, matches mobility look) ───────────────────────────

function LiveSkeleton({ pose, color }: { pose: PoseData; color: string }) {
  const pts = pose.lines.flatMap(l => l);
  return (
    <>
      {/* Limb segments */}
      {pose.lines.map((line, li) =>
        line.slice(0, -1).map((_, pi) => (
          <line key={`${li}-${pi}`}
            x1={line[pi][0]} y1={line[pi][1]} x2={line[pi + 1][0]} y2={line[pi + 1][1]}
            stroke={color} strokeWidth={6} strokeLinecap="round" />
        ))
      )}
      {/* Joint dots */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.8} fill={color} opacity={0.6} />
      ))}
      {/* Head halo */}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
        fill="rgba(34,197,94,0.07)" stroke={color} strokeWidth={2.5} />
      {/* Head core */}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={2.5} fill={color} opacity={0.5} />
    </>
  );
}

// ── Mini thumbnail ──────────────────────────────────────────────────────────

function Thumbnail({
  pose, env, color, active, onClick,
  label,
}: {
  pose: PoseData; env?: EnvAnchor; color: string; active: boolean;
  onClick: () => void; label: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, aspectRatio: "1/1", background: "#0b1120", borderRadius: 8,
        cursor: "pointer", border: `2px solid ${active ? color : "#1e293b"}`,
        overflow: "hidden", position: "relative", transition: "border-color 0.15s",
        boxShadow: active ? `0 0 10px ${color}44` : "none",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible" }}>
        {env && <EnvSVG env={env} />}
        {pose.lines.map((line, li) =>
          line.slice(0, -1).map((_, pi) => (
            <line key={`${li}-${pi}`}
              x1={line[pi][0]} y1={line[pi][1]} x2={line[pi + 1][0]} y2={line[pi + 1][1]}
              stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
          ))
        )}
        <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
          fill="none" stroke={color} strokeWidth={2.5} opacity={0.9} />
      </svg>
      <div style={{
        position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center",
        fontSize: 9, color, opacity: 0.8, fontWeight: 600, letterSpacing: "0.06em",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Number Input row helper ─────────────────────────────────────────────────

function NumField({
  label, value, onChange, step = 0.5,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <button
          onClick={() => onChange(Math.round((value - step) * 10) / 10)}
          style={{ width: 22, height: 26, background: "#1e293b", border: "1px solid #334155", borderRight: "none", borderRadius: "4px 0 0 4px", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Minus size={10} />
        </button>
        <input
          type="number"
          value={value}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: 46, height: 26, textAlign: "center",
            background: "#1e293b", border: "1px solid #334155",
            color: "#f8fafc", fontSize: 12, fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={() => onChange(Math.round((value + step) * 10) / 10)}
          style={{ width: 22, height: 26, background: "#1e293b", border: "1px solid #334155", borderLeft: "none", borderRadius: "0 4px 4px 0", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Plus size={10} />
        </button>
      </div>
    </label>
  );
}

// ── Main AnimLab Page ────────────────────────────────────────────────────────

export function AnimLabPage() {
  const exerciseNames = getMobilityExerciseNames();

  const [exercise, setExercise] = useState<string>(
    exerciseNames[2] ?? exerciseNames[0] ?? "Wrist Extension Stretch"
  );

  const initFrames = (name: string): [PoseData, PoseData, PoseData] => {
    const ps = getPoseSet(name);
    // Guard: if any frame is undefined (e.g. during HMR module reload), fall back
    // to the first defined frame so JSON.parse never receives undefined.
    const fallback = ps[0] ?? ps[1] ?? ps[2];
    if (!fallback) throw new Error(`No pose data found for exercise: "${name}"`);
    return [
      cloneFrame(ps[0] ?? fallback),
      cloneFrame(ps[1] ?? fallback),
      cloneFrame(ps[2] ?? fallback),
    ];
  };

  const [frames, setFrames] = useState<[PoseData, PoseData, PoseData]>(() => initFrames(exercise));
  const [activeFrame, setActiveFrame] = useState<FrameIdx>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seqIdx, setSeqIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedFrame, setCopiedFrame] = useState<PoseData | null>(null);
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false);
  const [worldObjects, setWorldObjects] = useState<EnvAnchor[]>(() => getWorldObjects(exercise));
  const [savingEnv, setSavingEnv] = useState(false);
  const [envSaveMsg, setEnvSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeFameRef = useRef<FrameIdx>(activeFrame);
  const envDragRef = useRef<{ idx: number; svgStartX: number; svgStartY: number; origObj: EnvAnchor } | null>(null);

  // ── Camera capture ──────────────────────────────────────────────────────────
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasLandmarks, setHasLandmarks] = useState(false);
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [flashActive, setFlashActive]   = useState(false);
  const videoRef           = useRef<HTMLVideoElement>(null);
  const camCanvasRef       = useRef<HTMLCanvasElement>(null);
  const landmarkerRef      = useRef<PoseLandmarker | null>(null);
  const camFrameRef        = useRef<number>(0);
  const lastCamTimeRef     = useRef<number>(-1);
  const latestLandmarksRef = useRef<LM[] | null>(null);
  const camStreamRef         = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef          = useRef<AudioContext | null>(null);

  // ── Global rotation ──────────────────────────────────────────────────────────
  const [rotationDeg, setRotationDeg] = useState(0);

  activeFameRef.current = activeFrame;


  // ── Exercise change ──────────────────────────────────────────────────────
  useEffect(() => {
    setFrames(initFrames(exercise));
    setActiveFrame(0);
    setIsPlaying(false);
    setSaveMsg(null);
    dragRef.current = null;
    setWorldObjects(getWorldObjects(exercise));
    setEnvSaveMsg(null);
    envDragRef.current = null;
    setCameraOpen(false);
    setRotationDeg(0);
  }, [exercise]);

  // ── Play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setSeqIdx(i => (i + 1) % PLAY_SEQ.length), 1100);
    return () => clearInterval(id);
  }, [isPlaying]);

  const displayFrame: FrameIdx = isPlaying ? PLAY_SEQ[seqIdx] : activeFrame;
  const activePose = frames[displayFrame];

  // ── Global pointer-up (catches drag release anywhere) ───────────────────
  useEffect(() => {
    const up = () => { dragRef.current = null; envDragRef.current = null; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // ── Pointer handlers ─────────────────────────────────────────────────────

  const onJointDown = useCallback((
    e: React.PointerEvent<SVGCircleElement>,
    x: number, y: number,
  ) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      isHead: false,
      indices: findMatching(frames[activeFameRef.current], x, y),
    };
  }, [isPlaying, frames]);

  const onHeadDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { isHead: true, indices: [] };
  }, [isPlaying]);

  const onSvgMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const [nx, ny] = svgPoint(e, svgRef.current);

    // ── Env object drag (takes priority) ────────────────────────────────────
    const envDrag = envDragRef.current;
    if (envDrag) {
      const { idx, svgStartX, svgStartY, origObj } = envDrag;
      const dx = nx - svgStartX;
      const dy = ny - svgStartY;
      setWorldObjects(prev => {
        const next = [...prev];
        const obj = { ...origObj };
        if (obj.type === "floor") {
          const newY = Math.round(Math.max(5, Math.min(95, origObj.y1 + dy)) * 2) / 2;
          obj.y1 = newY; obj.y2 = newY;
        } else if (obj.type === "wall") {
          const newX = Math.round(Math.max(5, Math.min(95, origObj.x1 + dx)) * 2) / 2;
          obj.x1 = newX; obj.x2 = newX;
        } else {
          const w = origObj.x2 - origObj.x1;
          const h = origObj.y2 - origObj.y1;
          const newX1 = Math.round(Math.max(0, Math.min(100 - w, origObj.x1 + dx)) * 2) / 2;
          const newY1 = Math.round(Math.max(0, Math.min(100 - h, origObj.y1 + dy)) * 2) / 2;
          obj.x1 = newX1; obj.x2 = newX1 + w;
          obj.y1 = newY1; obj.y2 = newY1 + h;
        }
        next[idx] = obj;
        return next;
      });
      return;
    }

    // ── Skeleton joint drag ──────────────────────────────────────────────────
    // Capture the ref value synchronously — the setFrames updater runs
    // asynchronously and dragRef.current may be null by then (cleared by pointerup).
    const drag = dragRef.current;
    if (!drag) return;
    const fi = activeFameRef.current;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const frame = cloneFrame(prev[fi]);
      if (drag.isHead) {
        frame.head.cx = nx;
        frame.head.cy = ny;
      } else {
        for (const { lineIdx, pointIdx } of drag.indices) {
          frame.lines[lineIdx][pointIdx] = [nx, ny];
        }
      }
      next[fi] = frame;
      return next;
    });
  }, []);

  // ── Extend / remove joint helpers ───────────────────────────────────────

  /**
   * Append a new terminal joint to line `lineIdx` of the active frame.
   * Direction is extrapolated from the last two points of that line.
   * Length of the new segment equals the length of the last existing segment
   * (clamped to 8–15 units) for a natural feel.
   */
  const extendLine = useCallback((lineIdx: number) => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const frame = cloneFrame(prev[activeFameRef.current]);
      const line = frame.lines[lineIdx];
      if (line.length < 2) return prev;

      const [ax, ay] = line[line.length - 2];
      const [bx, by] = line[line.length - 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // New segment same length as last (clamp 8–15 units)
      const seg = Math.min(15, Math.max(8, len));
      const nx = Math.round((bx + (dx / len) * seg) * 2) / 2;
      const ny = Math.round((by + (dy / len) * seg) * 2) / 2;

      frame.lines[lineIdx] = [...line, [nx, ny]];
      next[activeFameRef.current] = frame;
      return next;
    });
  }, []);

  /**
   * Remove the last point from line `lineIdx` (minimum 2 points kept).
   */
  const trimLine = useCallback((lineIdx: number) => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const frame = cloneFrame(prev[activeFameRef.current]);
      if (frame.lines[lineIdx].length > 2) {
        frame.lines[lineIdx] = frame.lines[lineIdx].slice(0, -1);
      }
      next[activeFameRef.current] = frame;
      return next;
    });
  }, []);

  // ── Muscle glow helpers ──────────────────────────────────────────────────

  const updateGlowField = (field: "cx" | "cy" | "rx" | "ry", val: number) => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      next[activeFrame] = cloneFrame(prev[activeFrame]);
      next[activeFrame].muscleGlow![field] = val;
      return next;
    });
  };

  const toggleGlow = () => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const f = cloneFrame(prev[activeFrame]);
      if (f.muscleGlow) { delete f.muscleGlow; }
      else { f.muscleGlow = { cx: 50, cy: 50, rx: 15, ry: 10 }; }
      next[activeFrame] = f;
      return next;
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/poses/${encodeURIComponent(exercise)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSaveMsg({ ok: true, text: "Written to exercise-poses.ts — Vite HMR reloading skeleton." });
    } catch (err: unknown) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFrames(initFrames(exercise));
    setSaveMsg(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(frames, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Copy / Paste frame ───────────────────────────────────────────────────

  const handleCopyCurrentFrame = () => {
    setCopiedFrame(cloneFrame(frames[activeFrame]));
    setPasteMenuOpen(false);
  };

  const handlePasteToFrame = (targetIdx: FrameIdx) => {
    if (!copiedFrame) return;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      next[targetIdx] = cloneFrame(copiedFrame);
      return next;
    });
    setActiveFrame(targetIdx);
    setPasteMenuOpen(false);
  };

  // ── Apply base template to current frame ─────────────────────────────────

  const handleApplyTemplate = (templateName: string) => {
    const tpl = BASE_TEMPLATES[templateName];
    if (!tpl) return;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      next[activeFrame] = cloneFrame(tpl);
      return next;
    });
  };

  // ── World Objects ─────────────────────────────────────────────────────────

  const handleToggleObject = (type: EnvAnchor["type"]) => {
    setWorldObjects(prev => {
      if (prev.some(o => o.type === type)) return prev.filter(o => o.type !== type);
      const defaults: Record<string, EnvAnchor> = {
        floor: { type: "floor", x1: 4,  y1: 85, x2: 96, y2: 85 },
        wall:  { type: "wall",  x1: 90, y1: 4,  x2: 90, y2: 96 },
        bar:   { type: "bar",   x1: 20, y1: 10, x2: 80, y2: 10 },
        box:   { type: "box",   x1: 50, y1: 50, x2: 80, y2: 70 },
      };
      return [...prev, defaults[type]];
    });
    setEnvSaveMsg(null);
  };

  const handleSnapBarToHands = () => {
    const barIdx = worldObjects.findIndex(o => o.type === "bar");
    if (barIdx === -1) return;
    const terminals = frames[activeFrame].lines.map(line => line[line.length - 1]);
    const sorted = [...terminals].sort((a, b) => a[1] - b[1]);
    const top = sorted.slice(0, Math.min(2, sorted.length));
    if (!top.length) return;
    const avgX = top.reduce((s, p) => s + p[0], 0) / top.length;
    const avgY = top.reduce((s, p) => s + p[1], 0) / top.length;
    const snappedY = Math.round(avgY * 2) / 2;
    const bar = worldObjects[barIdx];
    const w = bar.x2 - bar.x1;
    const newX1 = Math.round(Math.max(0, Math.min(100 - w, avgX - w / 2)) * 2) / 2;
    setWorldObjects(prev => {
      const next = [...prev];
      next[barIdx] = { ...bar, x1: newX1, x2: newX1 + w, y1: snappedY, y2: snappedY };
      return next;
    });
  };

  const handleSnapFloorToFeet = () => {
    const floorIdx = worldObjects.findIndex(o => o.type === "floor");
    if (floorIdx === -1) return;
    const terminals = frames[activeFrame].lines.map(line => line[line.length - 1]);
    const maxY = Math.max(...terminals.map(p => p[1]));
    const snappedY = Math.round(maxY * 2) / 2;
    setWorldObjects(prev => {
      const next = [...prev];
      next[floorIdx] = { ...prev[floorIdx], y1: snappedY, y2: snappedY };
      return next;
    });
  };

  const handleSaveEnv = async () => {
    setSavingEnv(true);
    setEnvSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/poses/${encodeURIComponent(exercise)}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects: worldObjects }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setEnvSaveMsg({ ok: true, text: "World objects saved to source." });
    } catch (err: unknown) {
      setEnvSaveMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingEnv(false);
    }
  };

  // ── Apply rotation ────────────────────────────────────────────────────────
  const handleApplyRotation = (allFrames: boolean) => {
    if (rotationDeg === 0) return;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      if (allFrames) {
        next[0] = rotatePose(prev[0], rotationDeg);
        next[1] = rotatePose(prev[1], rotationDeg);
        next[2] = rotatePose(prev[2], rotationDeg);
      } else {
        next[activeFrame] = rotatePose(prev[activeFrame], rotationDeg);
      }
      return next;
    });
    setRotationDeg(0);
  };

  // ── Camera detection loop ─────────────────────────────────────────────────
  const camLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = camCanvasRef.current;
    const lm     = landmarkerRef.current;
    if (!video || !canvas || !lm) { camFrameRef.current = requestAnimationFrame(camLoop); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { camFrameRef.current = requestAnimationFrame(camLoop); return; }
    if (video.currentTime !== lastCamTimeRef.current) {
      lastCamTimeRef.current = video.currentTime;
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let results;
        try { results = lm.detectForVideo(video, performance.now()); }
        catch { camFrameRef.current = requestAnimationFrame(camLoop); return; }
        if (results.landmarks?.length > 0) {
          latestLandmarksRef.current = results.landmarks[0]!;
          setHasLandmarks(true);
          const du = new DrawingUtils(ctx);
          du.drawLandmarks(results.landmarks[0]!, { radius: 4, color: "#22c55e", lineWidth: 2 });
          du.drawConnectors(results.landmarks[0]!, PoseLandmarker.POSE_CONNECTIONS, { color: "#22c55e", lineWidth: 2 });
        } else {
          latestLandmarksRef.current = null;
          setHasLandmarks(false);
        }
      }
    }
    camFrameRef.current = requestAnimationFrame(camLoop);
  }, []);

  const snapToFrame = useCallback(() => {
    const lms = latestLandmarksRef.current;
    if (!lms) return;
    const frame = landmarksToFrame(lms);
    if (!frame) return;
    const fi = activeFameRef.current;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      next[fi] = frame;
      return next;
    });
    setIsPlaying(false);
  }, []);

  // ── Countdown snap — 3s timer with beep/shutter audio + flash ────────────
  const startCountdownSnap = useCallback(() => {
    if (countdownIntervalRef.current !== null) return; // already counting

    // Lazy-init AudioContext on user gesture (browser policy)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    const playBeep = () => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.13);
    };

    const playShutter = () => {
      // Noise burst (mechanical click body)
      const bufLen = Math.floor(ctx.sampleRate * 0.06);
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.25));
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const ng  = ctx.createGain(); ng.gain.value = 0.55;
      src.connect(ng); ng.connect(ctx.destination); src.start();
      // High transient click layered on top
      const osc = ctx.createOscillator();
      const og  = ctx.createGain();
      osc.connect(og); og.connect(ctx.destination);
      osc.frequency.value = 2800;
      og.gain.setValueAtTime(0.35, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.07);
    };

    let count = 3;
    setCountdown(count);
    playBeep();

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playBeep();
      } else {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
        setCountdown(null);

        // ── Capture at tick-zero ──────────────────────────────────────────
        const lms = latestLandmarksRef.current;
        if (lms) {
          playShutter();
          setFlashActive(true);
          setTimeout(() => setFlashActive(false), 600);
          const frame = landmarksToFrame(lms);
          if (frame) {
            const fi = activeFameRef.current;
            setFrames(prev => {
              const next = [...prev] as [PoseData, PoseData, PoseData];
              next[fi] = frame;
              return next;
            });
            setIsPlaying(false);
          }
          // Close overlay after flash settles
          setTimeout(() => setCameraOpen(false), 800);
        }
      }
    }, 1000);
  }, []);

  // ── Camera lifecycle — starts when overlay opens, cleans up when closed ───
  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraStatus("loading");
    setHasLandmarks(false);
    (async () => {
      if (!landmarkerRef.current) {
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
          );
          if (cancelled) return;
          landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO", numPoses: 1,
            minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
          });
        } catch {
          if (!cancelled) setCameraStatus("error");
          return;
        }
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        camStreamRef.current = stream;
        const vid = videoRef.current;
        if (vid) { vid.srcObject = stream; await vid.play(); }
        if (!cancelled) {
          setCameraStatus("ready");
          lastCamTimeRef.current = -1;
          camFrameRef.current = requestAnimationFrame(camLoop);
        }
      } catch {
        if (!cancelled) setCameraStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(camFrameRef.current);
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      latestLandmarksRef.current = null;
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
      setFlashActive(false);
    };
  }, [cameraOpen, camLoop]);

  // ── Joints for handles ───────────────────────────────────────────────────

  const joints = uniqueJoints(activePose);
  const displayPose = rotationDeg !== 0 ? rotatePose(activePose, rotationDeg) : activePose;

  // ── Render ───────────────────────────────────────────────────────────────

  const panelBg = "#111827";
  const borderCol = "#1e293b";
  const mutedText = "#64748b";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#0f172a", color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 18px", borderBottom: `1px solid ${borderCol}`,
        flexShrink: 0, background: panelBg,
      }}>
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
          🎯 Animation Lab
        </span>

        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          style={{
            background: "#1e293b", color: "#f8fafc",
            border: `1px solid #334155`, borderRadius: 6,
            padding: "5px 10px", fontSize: 13, cursor: "pointer", maxWidth: 300,
          }}
        >
          {exerciseNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <span style={{ fontSize: 11, color: mutedText, marginLeft: 4 }}>
          Drag joints •{" "}
          <span style={{ color: "#22d3ee" }}>Cyan = elbow/knee</span> •{" "}
          <span style={{ color: "#22c55e" }}>⊕ = add joint (wrist/ankle/hand/foot)</span> •{" "}
          <span style={{ color: "#f87171" }}>⊖ = remove tip</span>
        </span>

        <Link
          href="/"
          style={{
            marginLeft: "auto", color: mutedText, display: "flex",
            alignItems: "center", gap: 4, textDecoration: "none", fontSize: 12,
          }}
        >
          <X size={13} /> Exit Lab
        </Link>
      </div>

      {/* ── Main columns ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: Canvas ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 14, padding: "20px 24px",
          flexShrink: 0, borderRight: `1px solid ${borderCol}`,
        }}>

          {/* Frame tabs */}
          <div style={{ display: "flex", gap: 6 }}>
            {FRAME_LABELS.map((name, idx) => {
              const active = !isPlaying && activeFrame === (idx as FrameIdx);
              return (
                <button
                  key={name}
                  onClick={() => { setActiveFrame(idx as FrameIdx); setIsPlaying(false); }}
                  style={{
                    padding: "5px 16px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${active ? FRAME_COLORS[idx] : "#334155"}`,
                    background: active ? `${FRAME_COLORS[idx]}18` : "transparent",
                    color: active ? FRAME_COLORS[idx] : mutedText,
                  }}
                >
                  {["▶", "◉", "◀"][idx]} {name}
                </button>
              );
            })}
          </div>

          {/* SVG Canvas */}
          <div style={{
            width: 460, height: 460,
            background: "#080e1a",
            borderRadius: 14,
            border: `1px solid ${borderCol}`,
            position: "relative",
            boxShadow: `inset 0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(34,197,94,0.04)`,
            flexShrink: 0,
          }}>
            {/* Status badge */}
            <div style={{
              position: "absolute", top: 8, right: 10, zIndex: 10,
              fontSize: 10, padding: "2px 9px", borderRadius: 20,
              background: "#0f172a",
              color: isPlaying ? "#22c55e" : FRAME_COLORS[activeFrame],
              border: `1px solid ${isPlaying ? "#22c55e33" : `${FRAME_COLORS[activeFrame]}33`}`,
            }}>
              {isPlaying ? `▶ ${FRAME_LABELS[displayFrame]}` : `✎ ${FRAME_LABELS[activeFrame]}`}
            </div>

            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              width="100%" height="100%"
              style={{
                display: "block", overflow: "visible",
                cursor: dragRef.current ? "grabbing" : "crosshair",
                filter: `drop-shadow(0 0 10px ${FRAME_COLORS[displayFrame]}66)`,
              }}
              onPointerMove={onSvgMove}
            >
              <defs>
                <filter id="jglow" x="-150%" y="-150%" width="400%" height="400%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Grid (faint) */}
              {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
                <g key={v} opacity={0.06}>
                  <line x1={v} y1={0} x2={v} y2={100} stroke="#94a3b8" strokeWidth={0.5} />
                  <line x1={0} y1={v} x2={100} y2={v} stroke="#94a3b8" strokeWidth={0.5} />
                </g>
              ))}

              {/* Environment anchors */}
              {worldObjects.map((wo, i) => <EnvSVG key={i} env={wo} />)}

              {/* Ghost frames */}
              {!isPlaying && ([0, 1, 2] as FrameIdx[])
                .filter(i => i !== activeFrame)
                .map(i => (
                  <GhostSkeleton key={i} pose={frames[i]} color={FRAME_COLORS[i]} />
                ))}

              {/* Active skeleton */}
              <LiveSkeleton pose={displayPose} color={FRAME_COLORS[displayFrame]} />

              {/* Draggable joint handles
                  - Cyan  (#22d3ee) = hinge joints → ELBOWS / KNEES (mid of chain)
                  - Green / frame colour = endpoint joints (shoulders, wrists, hips, ankles)
                  - "+" circle = extend this limb by adding a new joint beyond the tip
                  - "−" circle = remove the tip joint (trim back one step) */}
              {!isPlaying && rotationDeg === 0 && joints.map(({ x, y, isHinge, extendLineIdx }) => {
                // Direction vector for placing the +/- buttons relative to this joint.
                // For terminals, use the last-segment direction; default to pointing up.
                let btnDx = 0, btnDy = -1;
                if (extendLineIdx !== undefined) {
                  const line = activePose.lines[extendLineIdx];
                  if (line.length >= 2) {
                    const [ax, ay] = line[line.length - 2];
                    const ddx = x - ax;
                    const ddy = y - ay;
                    const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                    btnDx = ddx / dlen;
                    btnDy = ddy / dlen;
                  }
                }
                // Offset the +/- buttons 8 units beyond the joint tip
                const btnX = Math.round((x + btnDx * 8) * 10) / 10;
                const btnY = Math.round((y + btnDy * 8) * 10) / 10;
                // "−" trim button is perpendicular, 6 units beside the joint
                const perpX = Math.round((x - btnDy * 6) * 10) / 10;
                const perpY = Math.round((y + btnDx * 6) * 10) / 10;

                return (
                  <g key={`${x},${y}`}>
                    {isHinge && (
                      <circle cx={x} cy={y} r={7}
                        fill="none" stroke="#22d3ee" strokeWidth={1}
                        opacity={0.35} style={{ pointerEvents: "none" }} />
                    )}

                    {/* Main draggable joint */}
                    <circle
                      cx={x} cy={y}
                      r={isHinge ? 5 : 4.2}
                      fill={isHinge ? "#22d3ee" : FRAME_COLORS[activeFrame]}
                      stroke={isHinge ? "#0e7490" : "#0b1120"}
                      strokeWidth={1.5}
                      filter="url(#jglow)"
                      style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
                      onPointerDown={e => onJointDown(e, x, y)}
                    />

                    {/* "+" Extend button — only on terminal (non-hinge) endpoints */}
                    {!isHinge && extendLineIdx !== undefined && (
                      <g
                        style={{ cursor: "pointer" }}
                        onClick={() => extendLine(extendLineIdx)}
                      >
                        {/* Button background */}
                        <circle cx={btnX} cy={btnY} r={4.5}
                          fill="#052e16" stroke="#22c55e" strokeWidth={1.2} opacity={0.92} />
                        {/* "+" cross */}
                        <line x1={btnX - 2} y1={btnY} x2={btnX + 2} y2={btnY}
                          stroke="#22c55e" strokeWidth={1.2} strokeLinecap="round" />
                        <line x1={btnX} y1={btnY - 2} x2={btnX} y2={btnY + 2}
                          stroke="#22c55e" strokeWidth={1.2} strokeLinecap="round" />
                      </g>
                    )}

                    {/* "−" Trim button — only on extendable terminals that have > 2 pts */}
                    {!isHinge && extendLineIdx !== undefined &&
                      activePose.lines[extendLineIdx].length > 2 && (
                      <g
                        style={{ cursor: "pointer" }}
                        onClick={() => trimLine(extendLineIdx)}
                      >
                        <circle cx={perpX} cy={perpY} r={4.5}
                          fill="#1c0505" stroke="#f87171" strokeWidth={1.2} opacity={0.92} />
                        <line x1={perpX - 2} y1={perpY} x2={perpX + 2} y2={perpY}
                          stroke="#f87171" strokeWidth={1.2} strokeLinecap="round" />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Head drag handle */}
              {!isPlaying && rotationDeg === 0 && (
                <circle
                  cx={activePose.head.cx} cy={activePose.head.cy}
                  r={(activePose.head.r ?? 7) + 5}
                  fill="transparent"
                  stroke={FRAME_COLORS[activeFrame]}
                  strokeWidth={1.5}
                  strokeDasharray="3 2.5"
                  style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
                  onPointerDown={onHeadDown}
                />
              )}

              {/* muscleGlow indicator */}
              {!isPlaying && activePose.muscleGlow && (
                <ellipse
                  cx={activePose.muscleGlow.cx} cy={activePose.muscleGlow.cy}
                  rx={activePose.muscleGlow.rx} ry={activePose.muscleGlow.ry}
                  fill="none"
                  stroke="#a855f7" strokeWidth={0.8}
                  strokeDasharray="2 2" opacity={0.5}
                />
              )}

              {/* ── World Object drag handles ─────────────────────────────── */}
              {!isPlaying && worldObjects.map((obj, idx) => {
                const handleX = obj.type === "wall" ? obj.x1 : (obj.x1 + obj.x2) / 2;
                const handleY = obj.type === "floor" ? obj.y1 : obj.type === "bar" ? obj.y1 : (obj.y1 + obj.y2) / 2;
                const handleColor = obj.type === "bar" ? "#94a3b8" : obj.type === "wall" ? "#64748b" : "#64748b";
                return (
                  <g key={`env-handle-${idx}`}>
                    {/* Ghost line/shape for visual reference */}
                    {obj.type === "floor" && (
                      <line x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2}
                        stroke="#64748b" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.4}
                        style={{ pointerEvents: "none" }} />
                    )}
                    {obj.type === "wall" && (
                      <line x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2}
                        stroke="#64748b" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.4}
                        style={{ pointerEvents: "none" }} />
                    )}
                    {obj.type === "bar" && (
                      <line x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2}
                        stroke="#94a3b8" strokeWidth={2.5} strokeDasharray="3 2" opacity={0.45}
                        style={{ pointerEvents: "none" }} />
                    )}
                    {obj.type === "box" && (
                      <rect x={obj.x1} y={obj.y1} width={obj.x2 - obj.x1} height={obj.y2 - obj.y1}
                        fill="none" stroke="#64748b" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.4}
                        style={{ pointerEvents: "none" }} />
                    )}
                    {/* Drag handle circle */}
                    <circle
                      cx={handleX} cy={handleY}
                      r={5}
                      fill={handleColor}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      opacity={0.85}
                      style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
                      onPointerDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!svgRef.current) return;
                        const [sx, sy] = svgPoint(e, svgRef.current);
                        envDragRef.current = { idx, svgStartX: sx, svgStartY: sy, origObj: { ...obj } };
                      }}
                    />
                    {/* Label */}
                    <text x={handleX + 7} y={handleY + 3}
                      fill="#94a3b8" fontSize={5} style={{ pointerEvents: "none", userSelect: "none" }}>
                      {obj.type}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Play / Reset controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setIsPlaying(p => !p); setSeqIdx(0); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 22px", borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: "pointer", border: "none",
                background: isPlaying ? "#374151" : "#22c55e",
                color: isPlaying ? "#9ca3af" : "#000",
                transition: "all 0.15s",
              }}
            >
              {isPlaying ? <><Square size={12} /> Stop</> : <><Play size={12} /> Play Loop</>}
            </button>

            <button
              onClick={handleReset}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                background: "transparent", color: mutedText,
                border: `1px solid #334155`,
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>

            <button
              onClick={() => setCameraOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                background: "transparent", color: "#7dd3fc",
                border: "1px solid #1e4a6a",
              }}
            >
              <Camera size={13} /> Camera
            </button>
          </div>

          {/* Joint colour legend */}
          <div style={{
            display: "flex", gap: 14, alignItems: "center", marginTop: 8,
            padding: "6px 12px", borderRadius: 8,
            background: "#080e1a", border: "1px solid #1e293b",
            fontSize: 10.5, color: mutedText,
          }}>
            <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Joints:</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={11} height={11}><circle cx={5.5} cy={5.5} r={5.5} fill={FRAME_COLORS[activeFrame]} /></svg>
              Shoulder / Hip (drag)
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={13} height={13}>
                <circle cx={6.5} cy={6.5} r={6.5} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.4} />
                <circle cx={6.5} cy={6.5} r={5} fill="#22d3ee" />
              </svg>
              <span style={{ color: "#22d3ee", fontWeight: 600 }}>Elbow / Knee</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={13} height={13}>
                <circle cx={6.5} cy={6.5} r={4.5} fill="#052e16" stroke="#22c55e" strokeWidth={1.2} />
                <line x1={4.5} y1={6.5} x2={8.5} y2={6.5} stroke="#22c55e" strokeWidth={1.2} strokeLinecap="round" />
                <line x1={6.5} y1={4.5} x2={6.5} y2={8.5} stroke="#22c55e" strokeWidth={1.2} strokeLinecap="round" />
              </svg>
              <span style={{ color: "#22c55e", fontWeight: 600 }}>+ Add joint</span>
              — wrist / ankle / hand / foot
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={13} height={13}>
                <circle cx={6.5} cy={6.5} r={4.5} fill="#1c0505" stroke="#f87171" strokeWidth={1.2} />
                <line x1={4.5} y1={6.5} x2={8.5} y2={6.5} stroke="#f87171" strokeWidth={1.2} strokeLinecap="round" />
              </svg>
              <span style={{ color: "#f87171", fontWeight: 600 }}>− Remove tip</span>
            </span>
          </div>
        </div>

        {/* ── RIGHT: Controls Panel ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", gap: 0,
          overflowY: "auto", padding: 20, minWidth: 0, background: panelBg,
        }}>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
              background: saving ? "#374151" : "#22c55e",
              color: saving ? "#9ca3af" : "#000",
              fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              marginBottom: 6,
            }}
          >
            <Save size={14} />
            {saving ? "Writing to source…" : "Update Exercise Database"}
          </button>

          {saveMsg && (
            <p style={{
              fontSize: 12, marginBottom: 12,
              color: saveMsg.ok ? "#22c55e" : "#f87171",
              lineHeight: 1.5, padding: "6px 10px",
              background: saveMsg.ok ? "#052e1680" : "#450a0a80",
              borderRadius: 6,
            }}>
              {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.text}
            </p>
          )}

          {/* ── Automation Tools ── */}
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${borderCol}` }}>
            <p style={{
              fontSize: 10, color: mutedText, marginBottom: 10,
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
            }}>
              Automation Tools
            </p>

            {/* Capture from Camera */}
            <button
              onClick={() => setCameraOpen(true)}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 7,
                border: "1px solid #1e4a6a", background: "#0c2233", color: "#7dd3fc",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                marginBottom: 14,
              }}
            >
              <Camera size={13} /> Capture Pose from Camera
            </button>

            {/* Global Rotation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
                <RotateCw size={11} /> Global Rotation
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: FRAME_COLORS[activeFrame] }}>
                {rotationDeg}°
                {rotationDeg !== 0 && (
                  <span style={{ color: "#facc15", fontWeight: 400, fontSize: 10, marginLeft: 5 }}>preview</span>
                )}
              </span>
            </div>
            <input
              type="range"
              min={0} max={359} step={1}
              value={rotationDeg}
              onChange={e => setRotationDeg(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 8, accentColor: FRAME_COLORS[activeFrame] }}
            />
            {rotationDeg !== 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleApplyRotation(false)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
                    background: FRAME_COLORS[activeFrame], color: "#000",
                    fontWeight: 700, fontSize: 11, cursor: "pointer",
                  }}
                >
                  Apply to {FRAME_LABELS[activeFrame]}
                </button>
                <button
                  onClick={() => handleApplyRotation(true)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 6,
                    border: `1px solid ${FRAME_COLORS[activeFrame]}66`,
                    background: "transparent", color: FRAME_COLORS[activeFrame],
                    fontWeight: 700, fontSize: 11, cursor: "pointer",
                  }}
                >
                  Apply to All 3
                </button>
                <button
                  onClick={() => setRotationDeg(0)}
                  style={{
                    padding: "6px 10px", borderRadius: 6, border: "1px solid #334155",
                    background: "transparent", color: "#64748b",
                    fontSize: 11, cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* ── World Objects ── */}
          <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: `1px solid ${borderCol}` }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              World Objects
            </p>

            {/* Toggle buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {(["floor", "wall", "bar", "box"] as const).map(type => {
                const active = worldObjects.some(o => o.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleObject(type)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      fontWeight: 600, border: `1px solid ${active ? "#22c55e88" : "#334155"}`,
                      background: active ? "#052e1680" : "#1e293b",
                      color: active ? "#22c55e" : "#94a3b8",
                      textTransform: "capitalize",
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Snap helpers */}
            {worldObjects.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {worldObjects.some(o => o.type === "bar") && (
                  <button
                    onClick={handleSnapBarToHands}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      background: "#0f2a3a", border: "1px solid #1e4a6a", color: "#7dd3fc", fontWeight: 600,
                    }}
                  >
                    ↑ Snap Bar to Hands
                  </button>
                )}
                {worldObjects.some(o => o.type === "floor") && (
                  <button
                    onClick={handleSnapFloorToFeet}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      background: "#0f2a3a", border: "1px solid #1e4a6a", color: "#7dd3fc", fontWeight: 600,
                    }}
                  >
                    ↓ Snap Floor to Feet
                  </button>
                )}
              </div>
            )}

            {/* Coord readout */}
            {worldObjects.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {worldObjects.map((o, i) => (
                  <p key={i} style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>
                    {o.type}: x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2}
                  </p>
                ))}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSaveEnv}
              disabled={savingEnv}
              style={{
                width: "100%", padding: "8px 0", borderRadius: 7, border: "none",
                background: savingEnv ? "#374151" : "#1e3a5f",
                color: savingEnv ? "#9ca3af" : "#7dd3fc",
                fontWeight: 700, fontSize: 12, cursor: savingEnv ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Save size={12} />
              {savingEnv ? "Saving…" : "Save World Objects"}
            </button>

            {envSaveMsg && (
              <p style={{
                fontSize: 11, marginTop: 6,
                color: envSaveMsg.ok ? "#22c55e" : "#f87171",
                padding: "5px 8px",
                background: envSaveMsg.ok ? "#052e1680" : "#450a0a80",
                borderRadius: 6,
              }}>
                {envSaveMsg.ok ? "✓ " : "✗ "}{envSaveMsg.text}
              </p>
            )}
          </div>

          {/* Frame thumbnails */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Frame Previews — click to edit
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {FRAME_LABELS.map((name, idx) => (
                <Thumbnail
                  key={name}
                  pose={frames[idx]}
                  env={worldObjects[0]}
                  color={FRAME_COLORS[idx]}
                  active={!isPlaying && activeFrame === idx}
                  onClick={() => { setActiveFrame(idx as FrameIdx); setIsPlaying(false); }}
                  label={name}
                />
              ))}
            </div>
          </div>

          {/* ── Copy / Paste Frame ── */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Copy / Paste Frame
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Copy button */}
              <button
                onClick={handleCopyCurrentFrame}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  background: "#1e293b", color: "#f8fafc",
                  border: `1px solid #334155`,
                  fontWeight: 600,
                }}
              >
                <Copy size={11} />
                Copy {FRAME_LABELS[activeFrame]}
              </button>

              {/* Paste dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setPasteMenuOpen(o => !o)}
                  disabled={!copiedFrame}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: copiedFrame ? "pointer" : "not-allowed",
                    background: copiedFrame ? "#1e293b" : "#111827",
                    color: copiedFrame ? "#f8fafc" : "#475569",
                    border: `1px solid ${copiedFrame ? "#22c55e55" : "#334155"}`,
                    fontWeight: 600,
                  }}
                >
                  <Clipboard size={11} />
                  Paste to Frame…
                  <ChevronDown size={10} />
                </button>
                {pasteMenuOpen && copiedFrame && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                    background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 160, overflow: "hidden",
                  }}>
                    {([0, 1, 2] as FrameIdx[]).map(idx => (
                      <button
                        key={idx}
                        onClick={() => handlePasteToFrame(idx)}
                        style={{
                          width: "100%", padding: "9px 14px", textAlign: "left",
                          background: idx === activeFrame ? "#0f172a" : "transparent",
                          color: FRAME_COLORS[idx], fontSize: 12, fontWeight: 600,
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 8,
                          borderBottom: idx < 2 ? "1px solid #334155" : "none",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0f172a"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = idx === activeFrame ? "#0f172a" : "transparent"; }}
                      >
                        <span style={{ opacity: 0.6 }}>{["▶", "◉", "◀"][idx]}</span>
                        {FRAME_LABELS[idx]} {idx === activeFrame ? "(current)" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {copiedFrame && (
                <span style={{ fontSize: 10, color: "#22c55e", opacity: 0.8 }}>
                  ✓ Frame copied
                </span>
              )}
            </div>
          </div>

          {/* ── Base Templates ── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Base Templates → snap {FRAME_LABELS[activeFrame]} frame
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.keys(BASE_TEMPLATES).map(name => (
                <button
                  key={name}
                  onClick={() => handleApplyTemplate(name)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                    background: "#1e293b", color: "#cbd5e1",
                    border: "1px solid #334155", fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#22c55e88";
                    (e.currentTarget as HTMLButtonElement).style.color = "#22c55e";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#334155";
                    (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1";
                  }}
                >
                  {name === "Standing Neutral" ? "🧍" : name === "Plank Position" ? "🏋️" : "🏗️"} {name}
                </button>
              ))}
            </div>
          </div>

          {/* Head controls */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Head — {FRAME_LABELS[activeFrame]}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["cx", "cy", "r"] as const).map(field => (
                <NumField
                  key={field}
                  label={field}
                  value={frames[activeFrame].head[field] ?? 7}
                  onChange={val => {
                    setFrames(prev => {
                      const next = [...prev] as [PoseData, PoseData, PoseData];
                      next[activeFrame] = cloneFrame(prev[activeFrame]);
                      next[activeFrame].head[field] = val;
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Muscle glow */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <p style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                Muscle Glow — {FRAME_LABELS[activeFrame]}
              </p>
              <button
                onClick={toggleGlow}
                style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                  background: frames[activeFrame].muscleGlow ? "#7c1d1d" : "#14532d",
                  color: frames[activeFrame].muscleGlow ? "#fca5a5" : "#86efac",
                }}
              >
                {frames[activeFrame].muscleGlow ? "Remove" : "+ Add"}
              </button>
            </div>
            {frames[activeFrame].muscleGlow && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["cx", "cy", "rx", "ry"] as const).map(field => (
                  <NumField
                    key={field}
                    label={field}
                    value={frames[activeFrame].muscleGlow![field]}
                    onChange={val => updateGlowField(field, val)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Coordinate readout */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                All Frames — Raw Coordinates
              </p>
              <button
                onClick={handleCopyJson}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, padding: "2px 10px", borderRadius: 4, cursor: "pointer",
                  background: "transparent",
                  color: copied ? "#22c55e" : mutedText,
                  border: `1px solid ${copied ? "#22c55e" : "#334155"}`,
                }}
              >
                {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy JSON</>}
              </button>
            </div>
            <pre style={{
              flex: 1, overflow: "auto", background: "#080e1a", borderRadius: 8,
              padding: 12, fontSize: 10.5, color: "#94a3b8", lineHeight: 1.65,
              border: `1px solid ${borderCol}`, margin: 0, minHeight: 180,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}>
              {frames.map((f, i) => `/* ${FRAME_LABELS[i]} */\n${JSON.stringify(f, null, 2)}`).join("\n\n")}
            </pre>
          </div>
        </div>
      </div>

      {/* ── Camera Capture Overlay ── */}
      {cameraOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.9)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 14,
        }}>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
            Capturing into{" "}
            <span style={{ color: FRAME_COLORS[activeFrame], fontWeight: 700 }}>
              {FRAME_LABELS[activeFrame]}
            </span>{" "}
            frame — stand in view and pose, then click Snap
          </p>

          {/* Video + skeleton overlay */}
          <div style={{
            position: "relative", borderRadius: 14, overflow: "hidden",
            border: `2px solid ${hasLandmarks ? "#22c55e55" : "#1e293b"}`,
            boxShadow: hasLandmarks ? "0 0 32px #22c55e22" : "none",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}>
            <video
              ref={videoRef}
              playsInline muted
              style={{
                display: "block", width: 560, height: 420,
                objectFit: "cover", transform: "scaleX(-1)",
              }}
            />
            <canvas
              ref={camCanvasRef}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                transform: "scaleX(-1)", pointerEvents: "none",
              }}
            />

            {/* Loading spinner */}
            {cameraStatus === "loading" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(8,14,26,0.88)", color: "#64748b",
                fontSize: 13, gap: 12,
              }}>
                <div style={{
                  width: 30, height: 30,
                  border: "3px solid #1e293b",
                  borderTop: "3px solid #22c55e",
                  borderRadius: "50%",
                  animation: "camSpin 0.8s linear infinite",
                }} />
                Loading pose detection…
              </div>
            )}

            {/* Error state */}
            {cameraStatus === "error" && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(8,14,26,0.92)", color: "#f87171", fontSize: 13,
              }}>
                Camera access denied or unavailable.
              </div>
            )}

            {/* Live indicator */}
            {cameraStatus === "ready" && (
              <div style={{
                position: "absolute", top: 10, left: 12,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, color: hasLandmarks ? "#22c55e" : "#64748b",
                background: "rgba(0,0,0,0.6)", padding: "3px 9px", borderRadius: 20,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: hasLandmarks ? "#22c55e" : "#475569",
                  boxShadow: hasLandmarks ? "0 0 6px #22c55e" : "none",
                }} />
                {hasLandmarks ? "Pose detected" : "No pose detected"}
              </div>
            )}

            {/* ── Countdown overlay ── */}
            {countdown !== null && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.25)",
                pointerEvents: "none",
              }}>
                <span
                  key={countdown}
                  style={{
                    fontSize: 160, fontWeight: 900, lineHeight: 1,
                    color: "#22c55e",
                    textShadow: "0 0 50px #22c55e, 0 0 120px #22c55e88, 0 0 200px #22c55e44",
                    animation: "countPulse 0.95s ease-out forwards",
                    display: "block", userSelect: "none",
                  }}
                >
                  {countdown}
                </span>
              </div>
            )}

            {/* ── Flash overlay ── */}
            {flashActive && (
              <div style={{
                position: "absolute", inset: 0,
                background: "white",
                animation: "flashFade 0.6s ease-out forwards",
                pointerEvents: "none",
              }} />
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={startCountdownSnap}
              disabled={!hasLandmarks || countdown !== null}
              style={{
                padding: "10px 28px", borderRadius: 9, border: "none",
                background: countdown !== null ? "#ca8a04" : hasLandmarks ? "#22c55e" : "#1a3326",
                color: countdown !== null ? "#fff" : hasLandmarks ? "#000" : "#4a7a5a",
                fontWeight: 800, fontSize: 14,
                cursor: hasLandmarks && countdown === null ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s",
              }}
            >
              <Camera size={15} />
              {countdown !== null ? `${countdown}…` : `Snap to ${FRAME_LABELS[activeFrame]}`}
            </button>

            <button
              onClick={() => setCameraOpen(false)}
              style={{
                padding: "10px 20px", borderRadius: 9,
                border: "1px solid #334155", background: "transparent",
                color: "#94a3b8", fontSize: 13, cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <p style={{
            fontSize: 11, color: "#475569",
            maxWidth: 480, textAlign: "center", lineHeight: 1.65, margin: 0,
          }}>
            Switch frames below without closing — camera stays live.
            Each Snap overwrites that frame's skeleton with your live pose.
          </p>

          {/* Frame switcher — switch target frame while camera is open */}
          <div style={{ display: "flex", gap: 6 }}>
            {FRAME_LABELS.map((name, idx) => {
              const active = activeFrame === (idx as FrameIdx);
              return (
                <button
                  key={name}
                  onClick={() => { setActiveFrame(idx as FrameIdx); setIsPlaying(false); }}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12,
                    fontWeight: active ? 700 : 400, cursor: "pointer",
                    border: `1.5px solid ${active ? FRAME_COLORS[idx] : "#334155"}`,
                    background: active ? `${FRAME_COLORS[idx]}18` : "transparent",
                    color: active ? FRAME_COLORS[idx] : "#64748b",
                  }}
                >
                  {["▶", "◉", "◀"][idx]} {name}
                </button>
              );
            })}
          </div>

          <style>{`
            @keyframes camSpin    { to { transform: rotate(360deg); } }
            @keyframes countPulse { 0% { transform: scale(1.5); opacity: 0.5; } 12% { transform: scale(1.0); opacity: 1; } 80% { transform: scale(1.0); opacity: 1; } 100% { transform: scale(0.85); opacity: 0.3; } }
            @keyframes flashFade  { 0% { opacity: 1; } 100% { opacity: 0; } }
          `}</style>
        </div>
      )}
    </div>
  );
}
