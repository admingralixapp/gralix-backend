/**
 * SkillMap — SVG-based dashboard widget
 *
 * Visualises all 20 skill nodes across the four branches in a compact
 * 4-column × 5-row grid with connector lines.
 *
 * States
 *  locked       → grayscale circle + lock icon (not clickable)
 *  unlocked     → branch-coloured hollow circle; progress ring if sessions > 0
 *  mastered     → gold-filled circle + star
 *
 * Clicking an unlocked/mastered node navigates to /workout?exercise=<name>
 * so the workout page can pre-select the right exercise.
 */

import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import {
  SKILL_TREE_BRANCHES,
  evaluateSkillTree,
  type SkillBranch,
  type EvaluatedSkill,
} from "@/lib/skill-tree";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Layout constants ─────────────────────────────────────────────────────────

const BRANCHES: SkillBranch[] = ["PUSH", "PULL", "CORE", "LEGS"];

/** Centre-x for each of the 4 branch columns */
const COL_X = [65, 195, 325, 455];
/** Centre-y for each of the 5 level rows */
const ROW_Y = [52, 114, 176, 238, 300];

const NODE_R  = 15;   // node circle radius
const RING_R  = 21;   // progress-ring radius (outside node)
const RING_SW = 3;    // progress-ring stroke-width
const RING_CIRC = 2 * Math.PI * (RING_R - RING_SW / 2); // ≈ 113

const SVG_W = 520;
const SVG_H = 340;

// ─── Colours ──────────────────────────────────────────────────────────────────

const BRANCH_COLOR: Record<SkillBranch, string> = {
  PUSH: "#f97316", // orange-500
  PULL: "#3b82f6", // blue-500
  CORE: "#a855f7", // purple-500
  LEGS: "#10b981", // emerald-500
};

const GOLD   = "#eab308";
const GRAY   = "#374151";
const MUTED  = "#6b7280";

// ─── Tiny SVG icons ───────────────────────────────────────────────────────────

function StarShape({ cx, cy }: { cx: number; cy: number }) {
  const R = 8;   // outer radius
  const r = 3.5; // inner radius
  const pts = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const radius = i % 2 === 0 ? R : r;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
  return <polygon points={pts} fill="white" />;
}

function LockShape({ cx, cy }: { cx: number; cy: number }) {
  // Shackle arc
  const bx = cx - 5, bx2 = cx + 5;
  const bodyTop = cy - 1;
  return (
    <>
      {/* shackle */}
      <path
        d={`M ${bx} ${bodyTop} V ${cy - 8} A 5 5 0 0 1 ${bx2} ${cy - 8} V ${bodyTop}`}
        fill="none"
        stroke={MUTED}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* body */}
      <rect x={cx - 6} y={bodyTop} width={12} height={9} rx={2} fill={MUTED} />
      {/* keyhole dot */}
      <circle cx={cx} cy={bodyTop + 4.5} r={1.5} fill={GRAY} />
    </>
  );
}

// ─── Single node ──────────────────────────────────────────────────────────────

function SkillNode({
  skill,
  cx,
  cy,
  branchColor,
  onNavigate,
}: {
  skill: EvaluatedSkill;
  cx: number;
  cy: number;
  branchColor: string;
  onNavigate: () => void;
}) {
  const { status, progress, masteryRequirement: req } = skill;
  const pct = Math.min(
    1,
    req.minQualifyingSessions > 0
      ? progress.qualifyingSessions / req.minQualifyingSessions
      : 0,
  );

  const isLocked    = status === "locked";
  const isMastered  = status === "mastered";
  const hasProgress = status === "unlocked" && progress.qualifyingSessions > 0;
  const isUnlocked  = status === "unlocked"; // covers hasProgress too

  const clickable = !isLocked;

  return (
    <g
      onClick={clickable ? onNavigate : undefined}
      style={{ cursor: clickable ? "pointer" : "default" }}
      role={clickable ? "button" : undefined}
      aria-label={skill.title}
    >
      {/* Invisible wider hit area */}
      <circle cx={cx} cy={cy} r={RING_R + 6} fill="transparent" />

      {/* ── Progress ring track (always render if unlocked) ─────────── */}
      {isUnlocked && (
        <circle
          cx={cx} cy={cy}
          r={RING_R - RING_SW / 2}
          fill="none"
          stroke={branchColor}
          strokeWidth={RING_SW}
          opacity={0.18}
        />
      )}

      {/* ── Progress arc fill ────────────────────────────────────────── */}
      {hasProgress && (
        <circle
          cx={cx} cy={cy}
          r={RING_R - RING_SW / 2}
          fill="none"
          stroke={branchColor}
          strokeWidth={RING_SW}
          strokeDasharray={`${pct * RING_CIRC} ${RING_CIRC}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}

      {/* ── Mastered outer glow ring ─────────────────────────────────── */}
      {isMastered && (
        <circle
          cx={cx} cy={cy}
          r={RING_R}
          fill="none"
          stroke={GOLD}
          strokeWidth={2}
          opacity={0.35}
        />
      )}

      {/* ── Node fill circle ─────────────────────────────────────────── */}
      <circle
        cx={cx} cy={cy}
        r={NODE_R}
        fill={isMastered ? GOLD : isLocked ? GRAY : "#0f172a"}
        stroke={isMastered ? GOLD : isLocked ? "#4b5563" : branchColor}
        strokeWidth={isMastered || isLocked ? 0 : 2}
        opacity={isLocked ? 0.55 : 1}
      />

      {/* ── Inner icon ───────────────────────────────────────────────── */}
      {isMastered && <StarShape cx={cx} cy={cy} />}
      {isLocked    && <LockShape cx={cx} cy={cy} />}
      {isUnlocked  && (
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight="700"
          fill={branchColor}
          fontFamily="ui-monospace, monospace"
        >
          L{skill.level}
        </text>
      )}
    </g>
  );
}

// ─── Connector line between two vertically adjacent nodes ────────────────────

function Connector({
  cx, y1, y2,
  mastered,
  branchColor,
}: {
  cx: number; y1: number; y2: number;
  mastered: boolean;
  branchColor: string;
}) {
  return (
    <line
      x1={cx} y1={y1 + NODE_R}
      x2={cx} y2={y2 - NODE_R}
      stroke={mastered ? branchColor : "#1e293b"}
      strokeWidth={mastered ? 2 : 1.5}
      strokeDasharray={mastered ? undefined : "4 3"}
    />
  );
}

// ─── Skeleton while loading ───────────────────────────────────────────────────

export function SkillMapSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4 px-2">
      {BRANCHES.map((b) => (
        <div key={b} className="flex flex-col items-center gap-3">
          <Skeleton className="h-5 w-12 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export function SkillMap() {
  const [, navigate] = useLocation();

  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const evaluated = useMemo(() => {
    if (!sessions) return null;
    return evaluateSkillTree(sessions);
  }, [sessions]);

  const byBranch = useMemo(() => {
    if (!evaluated) return null;
    return BRANCHES.map((branch) => ({
      branch,
      color: BRANCH_COLOR[branch],
      skills: evaluated.filter((s) => s.branch === branch),
    }));
  }, [evaluated]);

  if (isLoading || !byBranch) return <SkillMapSkeleton />;

  const masteredCount = byBranch.reduce(
    (sum, b) => sum + b.skills.filter((s) => s.status === "mastered").length,
    0,
  );

  return (
    <div className="space-y-3">
      {/* Mini stats bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          {byBranch.map(({ branch, color, skills }) => {
            const m = skills.filter((s) => s.status === "mastered").length;
            return (
              <span key={branch} className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span style={{ color }} className="font-bold">{branch}</span>
                <span className="tabular-nums">{m}/5</span>
              </span>
            );
          })}
        </div>
        <span className="font-semibold tabular-nums text-foreground/80">
          {masteredCount}/20 mastered
        </span>
      </div>

      {/* SVG tree */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", height: "auto" }}
        aria-label="Skill map"
        className="overflow-visible"
      >
        {/* ── Branch column headers ───────────────────────────────────── */}
        {byBranch.map(({ branch, color }, bi) => (
          <text
            key={branch}
            x={COL_X[bi]}
            y={22}
            textAnchor="middle"
            fontSize={10}
            fontWeight="700"
            fill={color}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.08em"
          >
            {branch}
          </text>
        ))}

        {/* ── Connector lines ─────────────────────────────────────────── */}
        {byBranch.map(({ branch, color, skills }, bi) =>
          skills.slice(0, -1).map((skill, si) => (
            <Connector
              key={`${branch}-conn-${si}`}
              cx={COL_X[bi]}
              y1={ROW_Y[si]}
              y2={ROW_Y[si + 1]}
              mastered={skill.status === "mastered"}
              branchColor={color}
            />
          )),
        )}

        {/* ── Skill nodes ─────────────────────────────────────────────── */}
        {byBranch.map(({ branch, color, skills }, bi) =>
          skills.map((skill, si) => {
            const primaryExercise = skill.exercises[0];
            const dest = `/workout?exercise=${encodeURIComponent(primaryExercise)}`;
            return (
              <SkillNode
                key={skill.id}
                skill={skill}
                cx={COL_X[bi]}
                cy={ROW_Y[si]}
                branchColor={color}
                onNavigate={() => navigate(dest)}
              />
            );
          }),
        )}

        {/* ── Legend ──────────────────────────────────────────────────── */}
        {(
          [
            { x: 20,  label: "Mastered",     fill: GOLD,      stroke: "none",    opacity: 1 },
            { x: 100, label: "In progress",  fill: "#0f172a", stroke: "#3b82f6", opacity: 1 },
            { x: 195, label: "Locked",       fill: GRAY,      stroke: "none",    opacity: 0.55 },
          ] satisfies { x: number; label: string; fill: string; stroke: string; opacity: number }[]
        ).map(({ x, label, fill, stroke, opacity }) => (
          <g key={label} transform={`translate(${x}, ${SVG_H - 16})`}>
            <circle
              r={5}
              fill={fill}
              stroke={stroke}
              strokeWidth={stroke !== "none" ? 1.5 : 0}
              opacity={opacity}
            />
            <text
              x={9} y={0}
              dominantBaseline="central"
              fontSize={8}
              fill={MUTED}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {label}
            </text>
          </g>
        ))}

        {/* ── "View full tree" link ────────────────────────────────────── */}
        <text
          x={SVG_W - 10}
          y={SVG_H - 16}
          textAnchor="end"
          fontSize={8}
          fill="#3b82f6"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/skill-tree")}
        >
          View full tree →
        </text>
      </svg>
    </div>
  );
}
