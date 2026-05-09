/**
 * ExerciseMotionSnapshot
 *
 * 3-panel bold stick-figure grid: Start → Mid → End.
 *
 * Art style: thick rounded strokes (sw=6), filled circular head, filled joint
 * circles at every limb bend-point — matching the "pivot stickman" look.
 *
 * Props:
 *   exerciseName — pose lookup + intensity classification
 *   color        — stroke / fill colour (default "#e2e8f0")
 *   glow         — neon panel border + box-shadow
 *   className    — extra wrapper classes
 *
 * Intensity animations (active session only, when glow=true):
 *   strenuous → subtle CSS tremor
 *   relaxed   → slow gentle sway + slightly thinner strokes
 *
 * Muscle glow — pulsating SVG ellipse on MID frame only (from PoseData).
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

// ─── Bold anatomical stick figure ─────────────────────────────────────────────
//
// Visual anatomy rules:
//  • Head: large filled circle (r ≈ 8–9)
//  • Limbs: thick polylines with round caps/joins (sw = 5.5–6.5)
//  • Joints: filled circles at every intermediate polyline point
//    (radius ≈ sw × 0.55) — creates the "pivot" look from the reference image
//  • Muscle glow: pulsating ellipse on MID frame

function StickFigure({
  pose,
  color,
  sw,           // stroke width
  showMuscleGlow,
}: {
  pose: PoseData;
  color: string;
  sw: number;
  showMuscleGlow: boolean;
}) {
  const { head, lines, muscleGlow } = pose;
  const jointR = sw * 0.52;

  // Collect all intermediate bend points (joints)
  const joints: [number, number][] = [];
  for (const pts of lines) {
    for (let i = 1; i < pts.length - 1; i++) {
      joints.push(pts[i]);
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Muscle group glow (mid frame only) */}
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

      {/* Limb segments */}
      {lines.map((pts, i) => (
        <polyline
          key={i}
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Joint circles (pivot dots) */}
      {joints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={jointR} fill={color} />
      ))}

      {/* Head — solid filled circle */}
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r ?? 8}
        fill={color}
      />
    </svg>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const PANEL_LABELS = ["Start", "Mid", "End"] as const;

function SnapshotPanel({
  pose,
  label,
  color,
  glow,
  sw,
  showMuscleGlow,
}: {
  pose: PoseData;
  label: (typeof PANEL_LABELS)[number];
  color: string;
  glow: boolean;
  sw: number;
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
          sw={sw}
          showMuscleGlow={showMuscleGlow && label === "Mid"}
        />
      </div>
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: glow ? hexToRgba(color, 0.75) : "rgba(148,163,184,0.65)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── CSS keyframes (injected once) ───────────────────────────────────────────

const KEYFRAMES = `
  @keyframes muscleGlowPulse {
    0%, 100% { opacity: 0.07; }
    50%       { opacity: 0.36; }
  }
  @keyframes strenuousTremble {
    0%,100% { transform: translate(0,0)         rotate(0deg);    }
    20%     { transform: translate(-1px, 0.5px) rotate(-0.4deg); }
    40%     { transform: translate( 1px, 0)     rotate( 0.4deg); }
    60%     { transform: translate(-0.5px,1px)  rotate(-0.2deg); }
    80%     { transform: translate( 0.5px,-0.5px) rotate(0.2deg); }
  }
  @keyframes relaxedSway {
    0%,100% { transform: translateY(0);    }
    50%     { transform: translateY(1.5px);}
  }
`;
let injected = false;
function injectKF() {
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
  injectKF();

  const [start, mid, end] = getPoseSet(exerciseName);
  const intensity = getExerciseIntensity(exerciseName);

  // Stroke width varies by intensity
  const sw = intensity === "relaxed" ? 5 : intensity === "strenuous" ? 6.5 : 6;

  // Personality animation — only during active session (glow=true)
  const animStyle: React.CSSProperties = glow
    ? intensity === "strenuous"
      ? { animation: "strenuousTremble 0.18s linear infinite" }
      : intensity === "relaxed"
        ? { animation: "relaxedSway 3s ease-in-out infinite" }
        : {}
    : {};

  return (
    <div className={`flex gap-2 ${className}`} style={animStyle}>
      <SnapshotPanel pose={start} label="Start" color={color} glow={glow} sw={sw} showMuscleGlow={false} />
      <SnapshotPanel pose={mid}   label="Mid"   color={color} glow={glow} sw={sw} showMuscleGlow={glow}  />
      <SnapshotPanel pose={end}   label="End"   color={color} glow={glow} sw={sw} showMuscleGlow={false} />
    </div>
  );
}
