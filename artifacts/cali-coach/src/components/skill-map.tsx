/**
 * SkillMap — SVG-based dashboard widget
 *
 * Visualises skill nodes across the four branches.
 * PULL has a fork after Lv.2 into Static (Front Lever) and Explosive (Muscle-Up).
 * PUSH shows a satellite HSPU node branching from Diamond Push-Up.
 *
 * States
 *  locked       → grayscale circle + lock icon (not clickable)
 *  unlocked     → branch-coloured hollow circle; progress ring if sessions > 0
 *  mastered     → gold-filled circle + star
 *
 * Clicking an unlocked/mastered node navigates to /workout?exercise=<name>.
 */

import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import {
  SKILL_TREE_BRANCHES,
  TOTAL_SKILL_COUNT,
  evaluateSkillTree,
  type SkillBranch,
  type EvaluatedSkill,
} from "@/lib/skill-tree";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Layout ───────────────────────────────────────────────────────────────────

const BRANCHES: SkillBranch[] = ["PUSH", "PULL", "CORE", "LEGS"];

/**
 * Custom layout positions.
 * PULL gets a wide split column (shared + two sub-paths).
 * PUSH gets a satellite for HSPU.
 */

// Column centre-x values:
//   PUSH shared:    75
//   PUSH HSPU:     110  (satellite, parallel to push-5)
//   PULL shared:   225
//   PULL FL (static):  195
//   PULL MU (explo):   255
//   CORE:           395
//   LEGS:           530
const COL = {
  PUSH:      75,
  PUSH_HSPU: 110,
  PULL_SHARED: 225,
  PULL_FL:   195,
  PULL_MU:   255,
  CORE:      395,
  LEGS:      530,
} as const;

const ROW_Y = [52, 114, 176, 238, 300] as const;

const NODE_R  = 15;
const RING_R  = 21;
const RING_SW = 3;
const RING_CIRC = 2 * Math.PI * (RING_R - RING_SW / 2);

const SVG_W = 600;
const SVG_H = 355;

// ─── Colours ──────────────────────────────────────────────────────────────────

const BRANCH_COLOR: Record<SkillBranch, string> = {
  PUSH: "#f97316",
  PULL: "#3b82f6",
  CORE: "#a855f7",
  LEGS: "#10b981",
};

const GOLD  = "#eab308";
const GRAY  = "#374151";
const MUTED = "#6b7280";

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function StarShape({ cx, cy }: { cx: number; cy: number }) {
  const R = 8; const r = 3.5;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const radius = i % 2 === 0 ? R : r;
    return `${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill="white" />;
}

function LockShape({ cx, cy }: { cx: number; cy: number }) {
  const bx = cx - 5, bx2 = cx + 5, bodyTop = cy - 1;
  return (
    <>
      <path d={`M ${bx} ${bodyTop} V ${cy - 8} A 5 5 0 0 1 ${bx2} ${cy - 8} V ${bodyTop}`}
        fill="none" stroke={MUTED} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={cx - 6} y={bodyTop} width={12} height={9} rx={2} fill={MUTED} />
      <circle cx={cx} cy={bodyTop + 4.5} r={1.5} fill={GRAY} />
    </>
  );
}

function SkillNode({
  skill, cx, cy, branchColor, onNavigate,
}: {
  skill: EvaluatedSkill; cx: number; cy: number;
  branchColor: string; onNavigate: () => void;
}) {
  const { status, progress, masteryRequirement: req } = skill;
  const pct = Math.min(1, req.minQualifyingSessions > 0
    ? progress.qualifyingSessions / req.minQualifyingSessions : 0);

  const isLocked   = status === "locked";
  const isMastered = status === "mastered";
  const hasProgress = status === "unlocked" && progress.qualifyingSessions > 0;
  const isUnlocked  = status === "unlocked";
  const clickable   = !isLocked;

  return (
    <g onClick={clickable ? onNavigate : undefined}
      style={{ cursor: clickable ? "pointer" : "default" }}
      role={clickable ? "button" : undefined}
      aria-label={skill.title}>
      <circle cx={cx} cy={cy} r={RING_R + 6} fill="transparent" />

      {isUnlocked && (
        <circle cx={cx} cy={cy} r={RING_R - RING_SW / 2}
          fill="none" stroke={branchColor} strokeWidth={RING_SW} opacity={0.18} />
      )}
      {hasProgress && (
        <circle cx={cx} cy={cy} r={RING_R - RING_SW / 2}
          fill="none" stroke={branchColor} strokeWidth={RING_SW}
          strokeDasharray={`${pct * RING_CIRC} ${RING_CIRC}`}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      )}
      {isMastered && (
        <circle cx={cx} cy={cy} r={RING_R}
          fill="none" stroke={GOLD} strokeWidth={2} opacity={0.35} />
      )}
      <circle cx={cx} cy={cy} r={NODE_R}
        fill={isMastered ? GOLD : isLocked ? GRAY : "#0f172a"}
        stroke={isMastered ? GOLD : isLocked ? "#4b5563" : branchColor}
        strokeWidth={isMastered || isLocked ? 0 : 2}
        opacity={isLocked ? 0.55 : 1} />

      {isMastered && <StarShape cx={cx} cy={cy} />}
      {isLocked    && <LockShape cx={cx} cy={cy} />}
      {isUnlocked  && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize={9} fontWeight="700" fill={branchColor}
          fontFamily="ui-monospace, monospace">
          L{skill.level}
        </text>
      )}
    </g>
  );
}

function Connector({
  x1, y1, x2, y2, mastered, branchColor,
}: {
  x1: number; y1: number; x2: number; y2: number;
  mastered: boolean; branchColor: string;
}) {
  const dy1 = y1 + NODE_R;
  const dy2 = y2 - NODE_R;
  const isStraight = x1 === x2;

  if (isStraight) {
    return (
      <line x1={x1} y1={dy1} x2={x2} y2={dy2}
        stroke={mastered ? branchColor : "#1e293b"}
        strokeWidth={mastered ? 2 : 1.5}
        strokeDasharray={mastered ? undefined : "4 3"} />
    );
  }
  // Diagonal connector for fork transitions
  return (
    <line x1={x1} y1={dy1} x2={x2} y2={dy2}
      stroke={mastered ? branchColor : "#1e293b"}
      strokeWidth={mastered ? 2 : 1.5}
      strokeDasharray={mastered ? undefined : "4 3"} />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

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
    (sum, b) => sum + b.skills.filter((s) => s.status === "mastered").length, 0);

  // ── PULL sub-paths ──────────────────────────────────────────────────────────
  const pullAll   = byBranch.find((b) => b.branch === "PULL")!.skills;
  const pullColor = BRANCH_COLOR.PULL;
  // Shared: first 2 nodes (Lv.1 Lv.2)
  const pullShared = pullAll.filter((s) => !s.path || s.path === "shared").slice(0, 2);
  // Front Lever static path
  const pullFL     = pullAll.filter((s) => s.path === "front-lever");
  // Muscle-Up explosive path
  const pullMU     = pullAll.filter((s) => s.path === "muscle-up");

  // ── PUSH sub-paths ──────────────────────────────────────────────────────────
  const pushAll   = byBranch.find((b) => b.branch === "PUSH")!.skills;
  const pushColor = BRANCH_COLOR.PUSH;
  // Standard path: first 5 (Lv.1–5)
  const pushMain  = pushAll.filter((s) => !s.path || s.path === "main").slice(0, 5);
  // HSPU satellite (parallel elite skill)
  const pushHSPU  = pushAll.filter((s) => s.path === "hspu").slice(0, 1);

  // ── CORE & LEGS (linear) ────────────────────────────────────────────────────
  const coreSkills = byBranch.find((b) => b.branch === "CORE")!.skills.slice(0, 5);
  const legsSkills = byBranch.find((b) => b.branch === "LEGS")!.skills.slice(0, 5);
  const coreColor  = BRANCH_COLOR.CORE;
  const legsColor  = BRANCH_COLOR.LEGS;

  function goTo(skill: EvaluatedSkill) {
    const dest = `/workout?exercise=${encodeURIComponent(skill.exercises[0])}`;
    navigate(dest);
  }

  return (
    <div className="space-y-3">
      {/* Mini stats bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          {byBranch.map(({ branch, color, skills }) => {
            const m = skills.filter((s) => s.status === "mastered").length;
            return (
              <span key={branch} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }} className="font-bold">{branch}</span>
                <span className="tabular-nums">{m}/{skills.length}</span>
              </span>
            );
          })}
        </div>
        <span className="font-semibold tabular-nums text-foreground/80">
          {masteredCount}/{TOTAL_SKILL_COUNT} mastered
        </span>
      </div>

      {/* SVG skill tree */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", height: "auto" }}
        aria-label="Skill map" className="overflow-visible">

        {/* ── Column headers ───────────────────────────────────────────── */}
        <text x={COL.PUSH} y={22} textAnchor="middle" fontSize={10} fontWeight="700"
          fill={pushColor} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
          PUSH
        </text>
        <text x={COL.PULL_SHARED} y={22} textAnchor="middle" fontSize={10} fontWeight="700"
          fill={pullColor} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
          PULL
        </text>
        <text x={COL.CORE} y={22} textAnchor="middle" fontSize={10} fontWeight="700"
          fill={coreColor} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
          CORE
        </text>
        <text x={COL.LEGS} y={22} textAnchor="middle" fontSize={10} fontWeight="700"
          fill={legsColor} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
          LEGS
        </text>

        {/* ── PUSH connectors ──────────────────────────────────────────── */}
        {pushMain.slice(0, -1).map((skill, si) => (
          <Connector key={`push-conn-${si}`}
            x1={COL.PUSH} y1={ROW_Y[si]} x2={COL.PUSH} y2={ROW_Y[si + 1]}
            mastered={skill.status === "mastered"} branchColor={pushColor} />
        ))}
        {/* HSPU satellite: fork from push-4 (index 3) to HSPU column at row 4 */}
        {pushHSPU.length > 0 && pushMain.length >= 5 && (
          <Connector
            x1={COL.PUSH} y1={ROW_Y[3]} x2={COL.PUSH_HSPU} y2={ROW_Y[4]}
            mastered={pushMain[3]?.status === "mastered"} branchColor={pushColor} />
        )}

        {/* ── PULL shared connectors (Lv.1 → Lv.2) ────────────────────── */}
        {pullShared.slice(0, -1).map((skill, si) => (
          <Connector key={`pull-shared-conn-${si}`}
            x1={COL.PULL_SHARED} y1={ROW_Y[si]} x2={COL.PULL_SHARED} y2={ROW_Y[si + 1]}
            mastered={skill.status === "mastered"} branchColor={pullColor} />
        ))}
        {/* Fork from shared Lv.2 (row 1) to FL (row 2) */}
        {pullShared.length >= 2 && (
          <Connector
            x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.PULL_FL} y2={ROW_Y[2]}
            mastered={pullShared[1]?.status === "mastered"} branchColor={pullColor} />
        )}
        {/* Fork from shared Lv.2 (row 1) to MU (row 2) */}
        {pullShared.length >= 2 && (
          <Connector
            x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.PULL_MU} y2={ROW_Y[2]}
            mastered={pullShared[1]?.status === "mastered"} branchColor={pullColor} />
        )}
        {/* FL vertical connectors (rows 2-4) */}
        {pullFL.slice(0, -1).map((skill, si) => (
          <Connector key={`pull-fl-conn-${si}`}
            x1={COL.PULL_FL} y1={ROW_Y[si + 2]} x2={COL.PULL_FL} y2={ROW_Y[si + 3]}
            mastered={skill.status === "mastered"} branchColor={pullColor} />
        ))}
        {/* MU vertical connectors (rows 2-4) */}
        {pullMU.slice(0, -1).map((skill, si) => (
          <Connector key={`pull-mu-conn-${si}`}
            x1={COL.PULL_MU} y1={ROW_Y[si + 2]} x2={COL.PULL_MU} y2={ROW_Y[si + 3]}
            mastered={skill.status === "mastered"} branchColor={pullColor} />
        ))}

        {/* ── CORE connectors ───────────────────────────────────────────── */}
        {coreSkills.slice(0, -1).map((skill, si) => (
          <Connector key={`core-conn-${si}`}
            x1={COL.CORE} y1={ROW_Y[si]} x2={COL.CORE} y2={ROW_Y[si + 1]}
            mastered={skill.status === "mastered"} branchColor={coreColor} />
        ))}

        {/* ── LEGS connectors ───────────────────────────────────────────── */}
        {legsSkills.slice(0, -1).map((skill, si) => (
          <Connector key={`legs-conn-${si}`}
            x1={COL.LEGS} y1={ROW_Y[si]} x2={COL.LEGS} y2={ROW_Y[si + 1]}
            mastered={skill.status === "mastered"} branchColor={legsColor} />
        ))}

        {/* ── PUSH nodes ───────────────────────────────────────────────── */}
        {pushMain.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.PUSH} cy={ROW_Y[si]}
            branchColor={pushColor} onNavigate={() => goTo(skill)} />
        ))}
        {pushHSPU.map((skill) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.PUSH_HSPU} cy={ROW_Y[4]}
            branchColor={pushColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* ── PULL shared nodes ────────────────────────────────────────── */}
        {pullShared.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.PULL_SHARED} cy={ROW_Y[si]}
            branchColor={pullColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* Path labels at fork */}
        {pullShared.length >= 2 && (
          <>
            <text x={COL.PULL_FL} y={ROW_Y[2] - NODE_R - 6}
              textAnchor="middle" fontSize={7} fill={MUTED}
              fontFamily="ui-sans-serif, system-ui, sans-serif">
              🧲 Static
            </text>
            <text x={COL.PULL_MU} y={ROW_Y[2] - NODE_R - 6}
              textAnchor="middle" fontSize={7} fill={MUTED}
              fontFamily="ui-sans-serif, system-ui, sans-serif">
              ⚡ Explo.
            </text>
          </>
        )}

        {/* ── PULL FL nodes (rows 2-4) ──────────────────────────────────── */}
        {pullFL.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.PULL_FL} cy={ROW_Y[si + 2]}
            branchColor={pullColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* ── PULL MU nodes (rows 2-4) ──────────────────────────────────── */}
        {pullMU.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.PULL_MU} cy={ROW_Y[si + 2]}
            branchColor={pullColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* ── CORE nodes ───────────────────────────────────────────────── */}
        {coreSkills.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.CORE} cy={ROW_Y[si]}
            branchColor={coreColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* ── LEGS nodes ───────────────────────────────────────────────── */}
        {legsSkills.map((skill, si) => (
          <SkillNode key={skill.id} skill={skill}
            cx={COL.LEGS} cy={ROW_Y[si]}
            branchColor={legsColor} onNavigate={() => goTo(skill)} />
        ))}

        {/* ── Legend ───────────────────────────────────────────────────── */}
        {(
          [
            { x: 20,  label: "Mastered",    fill: GOLD,      stroke: "none",    opacity: 1    },
            { x: 100, label: "In progress", fill: "#0f172a", stroke: "#3b82f6", opacity: 1    },
            { x: 195, label: "Locked",      fill: GRAY,      stroke: "none",    opacity: 0.55 },
          ] satisfies { x: number; label: string; fill: string; stroke: string; opacity: number }[]
        ).map(({ x, label, fill, stroke, opacity }) => (
          <g key={label} transform={`translate(${x}, ${SVG_H - 16})`}>
            <circle r={5} fill={fill} stroke={stroke}
              strokeWidth={stroke !== "none" ? 1.5 : 0} opacity={opacity} />
            <text x={9} y={0} dominantBaseline="central" fontSize={8}
              fill={MUTED} fontFamily="ui-sans-serif, system-ui, sans-serif">
              {label}
            </text>
          </g>
        ))}

        {/* ── "View full tree" link ─────────────────────────────────────── */}
        <text x={SVG_W - 10} y={SVG_H - 16} textAnchor="end" fontSize={8}
          fill="#3b82f6" fontFamily="ui-sans-serif, system-ui, sans-serif"
          style={{ cursor: "pointer" }} onClick={() => navigate("/skill-tree")}>
          View full tree →
        </text>
      </svg>
    </div>
  );
}
