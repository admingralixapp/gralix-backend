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
  getNamedPoseSet,
  getWorldObjects,
  type NamedPoseData,
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

/** Interpolate an array of 2D points between two keyframes. */
function lerpLine(
  a: [number, number][],
  b: [number, number][],
  t: number,
): [number, number][] {
  const len = Math.min(a.length, b.length);
  return Array.from({ length: len }, (_, i) => [
    lerp(a[i]![0], b[i]![0], t),
    lerp(a[i]![1], b[i]![1], t),
  ] as [number, number]);
}

/**
 * Strictly key-based interpolation — leftArm→leftArm, rightLeg→rightLeg.
 *
 * There is no spatial sorting, no dynamic mapping, no threshold comparison.
 * Because joints are identified by name rather than array position or
 * coordinate proximity, limb crossing is mathematically impossible regardless
 * of how close the knee or elbow coordinates get during the animation loop.
 */
function lerpPose(from: NamedPoseData, to: NamedPoseData, rawT: number): NamedPoseData {
  const t = easeInOutCubic(rawT);
  return {
    head: {
      cx: lerp(from.head.cx, to.head.cx, t),
      cy: lerp(from.head.cy, to.head.cy, t),
      r:  lerp(from.head.r,  to.head.r,  t),
    },
    spine:    lerpLine(from.spine,    to.spine,    t),
    leftArm:  lerpLine(from.leftArm,  to.leftArm,  t),
    rightArm: lerpLine(from.rightArm, to.rightArm, t),
    leftLeg:  lerpLine(from.leftLeg,  to.leftLeg,  t),
    rightLeg: lerpLine(from.rightLeg, to.rightLeg, t),
    muscleGlow: from.muscleGlow,
  };
}

// ── Environment SVG ──────────────────────────────────────────────────────────

function EnvSVG({ env }: { env: EnvAnchor }) {
  const rot = env.rotation ?? 0;
  const cx  = (env.x1 + env.x2) / 2;
  const cy  = (env.y1 + env.y2) / 2;
  const tr  = rot !== 0 ? `rotate(${rot}, ${cx}, ${cy})` : undefined;

  if (env.type === "floor") {
    return (
      <g transform={tr}>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#475569" strokeWidth={2} strokeLinecap="round" opacity={0.45} />
      </g>
    );
  }
  if (env.type === "bar") {
    const ticks = 9;
    const step = (env.x2 - env.x1 - 8) / (ticks - 1);
    return (
      <g transform={tr}>
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
      <g transform={tr}>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#475569" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      </g>
    );
  }
  if (env.type === "box") {
    return (
      <g transform={tr}>
        <rect
          x={env.x1} y={env.y1}
          width={env.x2 - env.x1} height={env.y2 - env.y1}
          fill="#1e293b" stroke="#475569" strokeWidth={1.5} opacity={0.5} rx={1}
        />
      </g>
    );
  }
  return null;
}

// ── Puppet frame renderer ────────────────────────────────────────────────────

/**
 * Render a NamedPoseData skeleton in a fixed back-to-front depth order.
 *
 * Draw order: spine → rightLeg → rightArm → leftLeg → leftArm → head
 *
 * Right-side limbs are painted first (behind); left-side limbs are painted
 * last (in front).  Because the order is hardcoded to named keys and never
 * derived from runtime coordinates, there is zero z-order flicker even when
 * limbs pass through each other's screen positions.
 */
function PuppetFrame({ pose, color }: { pose: NamedPoseData; color: string }) {
  const drawOrder: [string, [number, number][]][] = [
    ["spine",    pose.spine],
    ["rightLeg", pose.rightLeg],
    ["rightArm", pose.rightArm],
    ["leftLeg",  pose.leftLeg],
    ["leftArm",  pose.leftArm],
  ];

  return (
    <>
      {/* Limb segments — drawn back-to-front by named key */}
      {drawOrder.map(([key, line]) =>
        line.slice(0, -1).map((_, pi) => {
          const isHandSeg = pi === line.length - 2 && line.length >= 4;
          return (
            <line key={`${key}-${pi}`}
              x1={line[pi]![0]}     y1={line[pi]![1]}
              x2={line[pi + 1]![0]} y2={line[pi + 1]![1]}
              stroke={color}
              strokeWidth={isHandSeg ? 3.5 : 6}
              strokeLinecap="round" />
          );
        })
      )}
      {/* Joint dots — same depth order */}
      {drawOrder.flatMap(([key, line]) =>
        line.map(([x, y], pi) => {
          const isKnuckle = pi === line.length - 1 && line.length >= 4;
          return (
            <circle key={`d-${key}-${pi}`}
              cx={x} cy={y}
              r={isKnuckle ? 2.0 : 2.8}
              fill={color}
              opacity={isKnuckle ? 0.9 : 0.6} />
          );
        })
      )}
      {/* Head halo + core */}
      <circle
        cx={pose.head.cx} cy={pose.head.cy}
        r={pose.head.r + 2}
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
  const poses = getNamedPoseSet(exerciseName);
  const envs  = getWorldObjects(exerciseName);

  // Live-rendered interpolated pose — starts at keyframe 0.
  const [renderedPose, setRenderedPose] = useState<NamedPoseData>(() => poses[SEQ[0]]);

  // Mutable playback state lives in a ref so the RAF callback always has
  // the latest values without triggering re-renders.
  const seqIdxRef  = useRef<SeqIdx>(0);
  const startRef   = useRef<number | null>(null);
  const rafRef     = useRef<number>(0);

  useEffect(() => {
    const currentPoses = getNamedPoseSet(exerciseName);

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
