/**
 * ExerciseMotionSnapshot
 *
 * 3-panel stick-figure grid: Start → Mid → End.
 *
 * Props:
 *   exerciseName — used to look up pose set + intensity
 *   color        — stroke colour (default "#e2e8f0")
 *   glow         — neon panel border + box-shadow
 *   className    — extra wrapper classes
 *
 * Animations driven by exercise intensity:
 *   strenuous → subtle CSS tremble (muscle effort)
 *   relaxed   → softer stroke weight + slow sway
 *   neutral   → no animation
 *
 * Muscle glow — pulsating SVG ellipse on the MID frame only,
 * positioned over the primary muscle region defined in PoseData.
 */

import { getPoseSet, getExerciseIntensity, type PoseData } from "@/lib/exercise-poses";

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgbParts(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgbParts(hex)},${alpha})`;
}

// ─── SVG stick figure ─────────────────────────────────────────────────────────

function StickFigure({
  pose,
  color,
  strokeWidth,
  showMuscleGlow,
}: {
  pose: PoseData;
  color: string;
  strokeWidth: number;
  showMuscleGlow: boolean;
}) {
  const { head, lines, muscleGlow } = pose;
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Muscle group glow — pulsating ellipse on mid frame */}
      {showMuscleGlow && muscleGlow && (
        <ellipse
          cx={muscleGlow.cx}
          cy={muscleGlow.cy}
          rx={muscleGlow.rx}
          ry={muscleGlow.ry}
          fill={color}
          opacity={0}
          style={{ animation: "muscleGlowPulse 1.8s ease-in-out infinite" }}
        />
      )}

      {/* Head */}
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r ?? 7}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Body polylines */}
      {lines.map((pts, i) => (
        <polyline
          key={i}
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── Panel (figure + caption) ─────────────────────────────────────────────────

const PANEL_LABELS = ["Start", "Mid", "End"] as const;

function SnapshotPanel({
  pose,
  label,
  color,
  glow,
  strokeWidth,
  showMuscleGlow,
}: {
  pose: PoseData;
  label: (typeof PANEL_LABELS)[number];
  color: string;
  glow: boolean;
  strokeWidth: number;
  showMuscleGlow: boolean;
}) {
  const glowRgba   = hexToRgba(color, 0.35);
  const glowBorder = hexToRgba(color, 0.28);

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          background: glow
            ? `rgba(${hexToRgbParts(color)}, 0.05)`
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${glow ? glowBorder : "rgba(255,255,255,0.07)"}`,
          boxShadow: glow
            ? `0 0 18px ${glowRgba}, inset 0 0 10px ${hexToRgba(color, 0.08)}`
            : "none",
          aspectRatio: "1 / 1",
        }}
      >
        <StickFigure
          pose={pose}
          color={color}
          strokeWidth={strokeWidth}
          showMuscleGlow={showMuscleGlow && label === "Mid"}
        />
      </div>
      <span
        className="text-[10px] font-bold tracking-widest uppercase"
        style={{ color: glow ? hexToRgba(color, 0.75) : "rgba(148,163,184,0.65)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Keyframes injected once ──────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes muscleGlowPulse {
    0%, 100% { opacity: 0.08; }
    50%       { opacity: 0.38; }
  }
  @keyframes strenuousTremble {
    0%,100% { transform: translate(0,0)   rotate(0deg);    }
    20%     { transform: translate(-1px,0.5px) rotate(-0.4deg); }
    40%     { transform: translate(1px,0)  rotate(0.4deg);  }
    60%     { transform: translate(-0.5px,1px) rotate(-0.2deg); }
    80%     { transform: translate(0.5px,-0.5px) rotate(0.2deg); }
  }
  @keyframes relaxedSway {
    0%,100% { transform: translateY(0);   }
    50%     { transform: translateY(1.5px); }
  }
`;

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
  injected = true;
}

// ─── Public component ─────────────────────────────────────────────────────────

export function ExerciseMotionSnapshot({
  exerciseName,
  color = "#e2e8f0",
  glow = false,
  className = "",
}: {
  exerciseName: string;
  color?: string;
  glow?: boolean;
  className?: string;
}) {
  injectKeyframes();

  const [start, mid, end] = getPoseSet(exerciseName);
  const intensity = getExerciseIntensity(exerciseName);

  // Personality tweaks per intensity
  const strokeWidth = intensity === "relaxed" ? 1.9 : 2.4;

  // Animation only when glow is on (active session) — library cards stay static
  const animStyle: React.CSSProperties = glow
    ? intensity === "strenuous"
      ? { animation: "strenuousTremble 0.18s linear infinite" }
      : intensity === "relaxed"
        ? { animation: "relaxedSway 3s ease-in-out infinite" }
        : {}
    : {};

  return (
    <div className={`flex gap-2.5 ${className}`} style={animStyle}>
      <SnapshotPanel
        pose={start}
        label="Start"
        color={color}
        glow={glow}
        strokeWidth={strokeWidth}
        showMuscleGlow={false}
      />
      <SnapshotPanel
        pose={mid}
        label="Mid"
        color={color}
        glow={glow}
        strokeWidth={strokeWidth}
        showMuscleGlow={glow}
      />
      <SnapshotPanel
        pose={end}
        label="End"
        color={color}
        glow={glow}
        strokeWidth={strokeWidth}
        showMuscleGlow={false}
      />
    </div>
  );
}
