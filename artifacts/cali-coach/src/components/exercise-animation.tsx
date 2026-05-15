/**
 * ExerciseAnimation — self-contained looping puppet preview.
 * Renders the 3-frame pose animation for any exercise using the same
 * data that the Animation Lab edits and saves.
 */
import { useState, useEffect } from "react";
import {
  getPoseSet,
  getWorldObjects,
  type PoseData,
  type EnvAnchor,
} from "@/lib/exercise-poses";

const PLAY_SEQ = [0, 1, 2, 1] as const;
const FRAME_MS  = 1100;

// ── Minimal env renderer (matches anim-lab visual style) ────────────────────

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
            <line key={i} x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5}
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

// ── Stick-figure frame renderer ──────────────────────────────────────────────

function PuppetFrame({ pose, color }: { pose: PoseData; color: string }) {
  return (
    <>
      {/* Limbs */}
      {pose.lines.map((line, li) =>
        line.slice(0, -1).map((_, pi) => {
          const isHandSeg = pi === line.length - 2 && line.length >= 4;
          return (
            <line key={`${li}-${pi}`}
              x1={line[pi][0]}    y1={line[pi][1]}
              x2={line[pi + 1][0]} y2={line[pi + 1][1]}
              stroke={color}
              strokeWidth={isHandSeg ? 3.5 : 6}
              strokeLinecap="round" />
          );
        })
      )}
      {/* Joint dots */}
      {pose.lines.flatMap((line, li) =>
        line.map(([x, y], pi) => {
          const isKnuckle = pi === line.length - 1 && line.length >= 4;
          return (
            <circle key={`d-${li}-${pi}`}
              cx={x} cy={y}
              r={isKnuckle ? 2.0 : 2.8}
              fill={color}
              opacity={isKnuckle ? 0.9 : 0.6} />
          );
        })
      )}
      {/* Head halo + core */}
      <circle cx={pose.head.cx} cy={pose.head.cy}
        r={(pose.head.r ?? 7) + 2}
        fill="rgba(34,197,94,0.07)" stroke={color} strokeWidth={2.5} />
      <circle cx={pose.head.cx} cy={pose.head.cy} r={2.5} fill={color} opacity={0.5} />
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
  const [seqIdx, setSeqIdx] = useState(0);

  useEffect(() => {
    setSeqIdx(0);
    const id = setInterval(() => setSeqIdx(i => (i + 1) % PLAY_SEQ.length), FRAME_MS);
    return () => clearInterval(id);
  }, [exerciseName]);

  const poses = getPoseSet(exerciseName);
  const envs  = getWorldObjects(exerciseName);
  const pose  = poses[PLAY_SEQ[seqIdx]];

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
        <PuppetFrame pose={pose} color={color} />
      </svg>
    </div>
  );
}
