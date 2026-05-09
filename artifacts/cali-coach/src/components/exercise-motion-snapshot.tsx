/**
 * ExerciseMotionSnapshot
 *
 * Renders a 3-panel stick-figure grid showing the Start → Mid → End
 * positions of any exercise. Each panel is a clean SVG on a dark card.
 *
 * Props:
 *   exerciseName — used to look up the pose set
 *   color        — stroke colour for the stick figure (default: "#e2e8f0")
 *   glow         — when true, adds a neon border + box-shadow in the same colour
 *   className    — extra classes on the outer wrapper
 */

import { getPoseSet, type PoseData } from "@/lib/exercise-poses";

// ─── Single stick figure SVG ─────────────────────────────────────────────────

function StickFigure({ pose, color }: { pose: PoseData; color: string }) {
  const { head, lines } = pose;
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r ?? 7}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {lines.map((pts, i) => (
        <polyline
          key={i}
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
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
}: {
  pose: PoseData;
  label: (typeof PANEL_LABELS)[number];
  color: string;
  glow: boolean;
}) {
  const glowRgba = hexToRgba(color, 0.35);
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
        <StickFigure pose={pose} color={color} />
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
  const [start, mid, end] = getPoseSet(exerciseName);
  return (
    <div className={`flex gap-2.5 ${className}`}>
      <SnapshotPanel pose={start} label="Start" color={color} glow={glow} />
      <SnapshotPanel pose={mid}   label="Mid"   color={color} glow={glow} />
      <SnapshotPanel pose={end}   label="End"   color={color} glow={glow} />
    </div>
  );
}
