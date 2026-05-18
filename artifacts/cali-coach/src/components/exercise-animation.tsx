/**
 * ExerciseAnimation — self-contained looping puppet preview with smooth LERP.
 *
 * Interpolates every joint coordinate between keyframes using ease-in-out cubic
 * easing driven by requestAnimationFrame. No jump-cuts.
 *
 * Sequence: Start → Mid → End → Mid → Start (seamless loop)
 * Each transition: TRANSITION_MS (1 500 ms)
 */
import { useState, useEffect, useRef } from "react";
import {
  getPoseSet,
  getWorldObjects,
  type PoseData,
  type EnvAnchor,
} from "@/lib/exercise-poses";

// ── Playback constants ───────────────────────────────────────────────────────

/** Keyframe indices visited in order (loops back to 0 seamlessly). */
const SEQ = [0, 1, 2, 1] as const;
type SeqIdx = 0 | 1 | 2 | 3;

/** Duration (ms) of each keyframe-to-keyframe transition. */
const TRANSITION_MS = 1500;

// ── Math helpers ─────────────────────────────────────────────────────────────

/** Ease-in-out cubic: slow start, fast middle, slow end. */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pure spatial-sort line mapping — completely label-blind.
 *
 * For each paired limb group (arms 1↔2, legs 3↔4) we sort BOTH frames'
 * lines by their centroid X and map in sorted order:
 *
 *   leftmost-in-A  → leftmost-in-B
 *   rightmost-in-A → rightmost-in-B
 *
 * This is unconditionally correct regardless of how the line arrays were
 * indexed when the pose was saved — no spine reference, no threshold, no
 * side comparison that can disagree between frames.  The leftmost hand in
 * frame A will always travel to the leftmost hand position in frame B by
 * the shortest horizontal path, eliminating every cross-body artefact.
 *
 * Returns result[i] = which index in `to.lines` to use for `from.lines[i]`.
 */
function optimalLineMap(from: PoseData, to: PoseData): number[] {
  const map = from.lines.map((_, i) => i);
  if (from.lines.length !== 5 || to.lines.length !== 5) return map;

  /**
   * Anatomical key X for a limb line.
   *
   * Limb lines share a common origin point (neck for arms, hip for legs).
   * Using the whole-line centroid dilutes the signal with that shared point
   * and makes both legs cluster near x=50 in push-up / squat poses —
   * causing the sort order to flip when knees come close together.
   *
   * Instead we use point[1] — the FIRST BRANCHING JOINT (elbow / knee).
   * This is always anatomically on one side and is far more stable across
   * frames than the centroid.  Falls back to point[0] for short lines.
   */
  const limbKeyX = (line: [number, number][]) =>
    (line[1] ?? line[0])?.[0] ?? 50;

  const sortPairByX = (
    lines: typeof from.lines,
    a: number,
    b: number,
  ): [number, number] => {
    const xa = limbKeyX(lines[a] ?? []);
    const xb = limbKeyX(lines[b] ?? []);
    return xa <= xb ? [a, b] : [b, a];
  };

  const mapPair = (a: number, b: number) => {
    if (!from.lines[a] || !from.lines[b] || !to.lines[a] || !to.lines[b]) return;
    const [fLeft, fRight] = sortPairByX(from.lines, a, b);
    const [tLeft, tRight] = sortPairByX(to.lines,   a, b);
    map[fLeft]  = tLeft;   // leftmost  → leftmost
    map[fRight] = tRight;  // rightmost → rightmost
  };

  mapPair(1, 2); // arms
  mapPair(3, 4); // legs
  return map;
}

/** Interpolate every joint in two PoseData frames, t ∈ [0, 1]. */
function lerpPose(from: PoseData, to: PoseData, rawT: number): PoseData {
  const t      = easeInOutCubic(rawT);
  const lineMap = optimalLineMap(from, to);
  return {
    head: {
      cx: lerp(from.head.cx, to.head.cx, t),
      cy: lerp(from.head.cy, to.head.cy, t),
      r:  lerp(from.head.r ?? 7, to.head.r ?? 7, t),
    },
    lines: from.lines.map((fromLine, li) => {
      const toLine = to.lines[lineMap[li] ?? li];
      if (!toLine) return fromLine;
      // Use the shorter line's length so we never access undefined points.
      const len = Math.min(fromLine.length, toLine.length);
      return Array.from({ length: len }, (_, pi) => [
        lerp(fromLine[pi]![0], toLine[pi]![0], t),
        lerp(fromLine[pi]![1], toLine[pi]![1], t),
      ] as [number, number]);
    }),
  };
}

// ── Environment SVG ──────────────────────────────────────────────────────────

function EnvSVG({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    return (
      <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
        stroke="#475569" strokeWidth={2} strokeLinecap="round" opacity={0.45} />
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
          return (
            <line key={i}
              x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5}
              stroke="#475569" strokeWidth={1} opacity={0.4} />
          );
        })}
      </g>
    );
  }
  if (env.type === "wall") {
    return (
      <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
        stroke="#475569" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
    );
  }
  if (env.type === "box") {
    return (
      <rect
        x={env.x1} y={env.y1}
        width={env.x2 - env.x1} height={env.y2 - env.y1}
        fill="#1e293b" stroke="#475569" strokeWidth={1.5} opacity={0.5} rx={1}
      />
    );
  }
  return null;
}

// ── Puppet frame renderer ────────────────────────────────────────────────────

/**
 * Render pose lines in a stable depth order so limbs never visually z-flicker
 * when they pass close to each other.
 *
 * Draw order (back → front):
 *   0  spine         — always behind everything
 *   4  right leg     — larger knee-X (anatomically right/back for side view)
 *   2  right arm     — larger elbow-X
 *   3  left  leg     — smaller knee-X (front)
 *   1  left  arm     — smaller elbow-X (front, on top)
 *
 * For non-standard skeletons the natural array order is used unchanged.
 */
const DRAW_ORDER_5 = [0, 4, 2, 3, 1] as const;

function PuppetFrame({ pose, color }: { pose: PoseData; color: string }) {
  const drawOrder =
    pose.lines.length === 5
      ? DRAW_ORDER_5.filter(i => i < pose.lines.length)
      : pose.lines.map((_, i) => i);

  return (
    <>
      {/* Limb segments — drawn back-to-front */}
      {drawOrder.map(li => {
        const line = pose.lines[li]!;
        return line.slice(0, -1).map((_, pi) => {
          const isHandSeg = pi === line.length - 2 && line.length >= 4;
          return (
            <line key={`${li}-${pi}`}
              x1={line[pi]![0]}     y1={line[pi]![1]}
              x2={line[pi + 1]![0]} y2={line[pi + 1]![1]}
              stroke={color}
              strokeWidth={isHandSeg ? 3.5 : 6}
              strokeLinecap="round" />
          );
        });
      })}
      {/* Joint dots — same depth order */}
      {drawOrder.flatMap(li => {
        const line = pose.lines[li]!;
        return line.map(([x, y], pi) => {
          const isKnuckle = pi === line.length - 1 && line.length >= 4;
          return (
            <circle key={`d-${li}-${pi}`}
              cx={x} cy={y}
              r={isKnuckle ? 2.0 : 2.8}
              fill={color}
              opacity={isKnuckle ? 0.9 : 0.6} />
          );
        });
      })}
      {/* Head halo + core */}
      <circle
        cx={pose.head.cx} cy={pose.head.cy}
        r={(pose.head.r ?? 7) + 2}
        fill="rgba(34,197,94,0.07)" stroke={color} strokeWidth={2.5} />
      <circle
        cx={pose.head.cx} cy={pose.head.cy}
        r={2.5} fill={color} opacity={0.5} />
    </>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

interface ExerciseAnimationProps {
  exerciseName: string;
  /** Neon line colour — defaults to primary green */
  color?: string;
  /** Square pixel size of the SVG container */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ExerciseAnimation({
  exerciseName,
  color = "#22c55e",
  size = 200,
  className,
  style,
}: ExerciseAnimationProps) {
  const poses = getPoseSet(exerciseName);
  const envs  = getWorldObjects(exerciseName);

  // Live-rendered interpolated pose — starts at keyframe 0.
  const [renderedPose, setRenderedPose] = useState<PoseData>(() => poses[SEQ[0]]);

  // Mutable playback state lives in a ref so the RAF callback always has
  // the latest values without triggering re-renders.
  const seqIdxRef  = useRef<SeqIdx>(0);
  const startRef   = useRef<number | null>(null);
  const rafRef     = useRef<number>(0);

  useEffect(() => {
    const currentPoses = getPoseSet(exerciseName);

    // Reset on exercise change.
    seqIdxRef.current = 0;
    startRef.current  = null;
    setRenderedPose(currentPoses[SEQ[0]]);

    function tick(now: number) {
      // Initialise start timestamp on first frame.
      if (startRef.current === null) startRef.current = now;

      let elapsed = now - startRef.current;

      // Advance through as many completed transitions as needed
      // (handles tab sleep / slow frames gracefully).
      while (elapsed >= TRANSITION_MS) {
        elapsed -= TRANSITION_MS;
        startRef.current = now - elapsed;
        seqIdxRef.current = ((seqIdxRef.current + 1) % SEQ.length) as SeqIdx;
      }

      const fromIdx = SEQ[seqIdxRef.current];
      const toIdx   = SEQ[((seqIdxRef.current + 1) % SEQ.length) as SeqIdx];
      const t       = elapsed / TRANSITION_MS;

      setRenderedPose(lerpPose(currentPoses[fromIdx], currentPoses[toIdx], t));
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [exerciseName]);

  return (
    <div
      className={className}
      style={{ width: size, height: size, flexShrink: 0, ...style }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{
          display: "block",
          filter: `drop-shadow(0 0 10px ${color}44)`,
        }}
      >
        {envs.map((env, i) => <EnvSVG key={i} env={env} />)}
        <PuppetFrame pose={renderedPose} color={color} />
      </svg>
    </div>
  );
}
