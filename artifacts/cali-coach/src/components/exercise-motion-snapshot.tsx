/**
 * ExerciseMotionSnapshot
 *
 * Renders a 3-panel stick-figure grid showing the Start → Mid → End
 * positions of any exercise. Each panel is a clean SVG on a dark card.
 */

import { getPoseSet, type PoseData } from "@/lib/exercise-poses";

// ─── Single panel stick figure ────────────────────────────────────────────────

function StickFigure({ pose, color = "#ffffff" }: { pose: PoseData; color?: string }) {
  const { head, lines } = pose;
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head */}
      <circle
        cx={head.cx}
        cy={head.cy}
        r={head.r ?? 7}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {/* Body polylines */}
      {lines.map((pts, i) => (
        <polyline
          key={i}
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
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
}: {
  pose: PoseData;
  label: (typeof PANEL_LABELS)[number];
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          aspectRatio: "1 / 1",
        }}
      >
        <StickFigure pose={pose} color="#e2e8f0" />
      </div>
      <span
        className="text-[10px] font-semibold tracking-wider uppercase"
        style={{ color: "rgba(148,163,184,0.7)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function ExerciseMotionSnapshot({
  exerciseName,
  className = "",
}: {
  exerciseName: string;
  className?: string;
}) {
  const [start, mid, end] = getPoseSet(exerciseName);
  return (
    <div className={`flex gap-2 ${className}`}>
      <SnapshotPanel pose={start} label="Start" />
      <SnapshotPanel pose={mid}   label="Mid"   />
      <SnapshotPanel pose={end}   label="End"   />
    </div>
  );
}
