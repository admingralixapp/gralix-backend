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
 * Tooltip behaviour:
 *  Desktop hover  → floating info tooltip (unpinned)
 *  Click / Tap    → pins tooltip; shows "Start Workout" + "Close" buttons
 *  Click-away     → unpins / hides tooltip
 */

import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import {
  SKILL_TREE_BRANCHES,
  TOTAL_SKILL_COUNT,
  ALL_SKILL_NODES,
  EQUIPMENT_SPECIALTIES,
  evaluateSkillTree,
  type SkillBranch,
  type EvaluatedSkill,
  type SkillType,
  type EquipmentTag,
} from "@/lib/skill-tree";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Layout ───────────────────────────────────────────────────────────────────

const BRANCHES: SkillBranch[] = ["PUSH", "PULL", "CORE", "LEGS"];

const COL = {
  PUSH:        73,
  PUSH_HSPU:  108,
  PULL_SHARED: 218,
  PULL_FL:    188,
  PULL_MU:    248,
  SPEC_BAR:   288,
  SPEC_RINGS: 312,
  SPEC_WGT:   336,
  CORE:       415,
  LEGS:       548,
} as const;

const ROW_Y = [52, 114, 176, 238, 300] as const;

const NODE_R  = 15;
const RING_R  = 21;
const RING_SW = 3;
const RING_CIRC = 2 * Math.PI * (RING_R - RING_SW / 2);
const SPEC_R  = 9;  // radius for equipment specialty nodes

const SVG_W = 618;
const SVG_H = 355;

// Equipment specialty node colours (match EQUIPMENT_SPECIALTIES)
const SPEC_COLOR: Record<EquipmentTag, string> = {
  bar:      "#f97316",
  rings:    "#06b6d4",
  weighted: "#8b5cf6",
};

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

// ─── Tooltip state ────────────────────────────────────────────────────────────

interface TooltipState {
  skill: EvaluatedSkill;
  branch: SkillBranch;
  /** Pixel offset from wrapper top-left */
  left: number;
  top: number;
  /** true = pinned (tap/click); false = hover-only */
  pinned: boolean;
}

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

// ─── Equipment specialty SVG helpers ─────────────────────────────────────────

/** Tiny icon rendered inside a specialty node, centered at (cx, cy). */
function SpecEquipIcon({
  cx, cy, tag, fill,
}: { cx: number; cy: number; tag: EquipmentTag; fill: string }) {
  if (tag === "rings") {
    return <circle cx={cx} cy={cy} r={5} fill="none" stroke={fill} strokeWidth={1.8} />;
  }
  if (tag === "weighted") {
    return (
      <>
        <circle cx={cx - 3.5} cy={cy} r={2.5} fill={fill} />
        <circle cx={cx + 3.5} cy={cy} r={2.5} fill={fill} />
        <line x1={cx - 1} y1={cy} x2={cx + 1} y2={cy} stroke={fill} strokeWidth={1.5} />
      </>
    );
  }
  return (
    <>
      <line x1={cx - 5.5} y1={cy} x2={cx + 5.5} y2={cy} stroke={fill} strokeWidth={1.8} />
      <line x1={cx - 5.5} y1={cy - 2.5} x2={cx - 5.5} y2={cy + 2.5} stroke={fill} strokeWidth={1.8} />
      <line x1={cx + 5.5} y1={cy - 2.5} x2={cx + 5.5} y2={cy + 2.5} stroke={fill} strokeWidth={1.8} />
    </>
  );
}

function SpecialtyNodeSvg({
  skill, cx, cy, equipmentTag,
  onHover, onLeave, onTap,
}: {
  skill: EvaluatedSkill; cx: number; cy: number; equipmentTag: EquipmentTag;
  onHover: () => void;
  onLeave: () => void;
  onTap:   () => void;
}) {
  const color  = SPEC_COLOR[equipmentTag];
  const { status, progress, masteryRequirement: req } = skill;
  const pct    = Math.min(1, req.minQualifyingSessions > 0
    ? progress.qualifyingSessions / req.minQualifyingSessions : 0);
  const isMastered  = status === "mastered";
  const isLocked    = status === "locked";
  const hasProgress = status === "unlocked" && progress.qualifyingSessions > 0;
  const circ        = 2 * Math.PI * (SPEC_R - 1);

  return (
    <g onMouseEnter={onHover} onMouseLeave={onLeave} onClick={onTap}
      style={{ cursor: isLocked ? "default" : "pointer" }}>
      {/* Wide invisible hit area */}
      <circle cx={cx} cy={cy} r={SPEC_R + 5} fill="transparent" />

      {/* Progress ring */}
      {hasProgress && (
        <circle cx={cx} cy={cy} r={SPEC_R - 1}
          fill="none" stroke={color} strokeWidth={1.5}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.55} />
      )}

      {/* Main circle */}
      <circle cx={cx} cy={cy} r={SPEC_R}
        fill={isMastered ? color : isLocked ? "#1e293b" : "#0f172a"}
        stroke={isMastered ? "none" : isLocked ? "#334155" : color}
        strokeWidth={1.5}
        opacity={isLocked ? 0.5 : 1} />

      {/* Equipment icon */}
      {!isLocked && (
        <SpecEquipIcon cx={cx} cy={cy} tag={equipmentTag}
          fill={isMastered ? "white" : color} />
      )}
      {isLocked && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize={7} fill="#4b5563">—</text>
      )}

      {/* Gold dot badge when mastered */}
      {isMastered && (
        <circle cx={cx + SPEC_R - 2} cy={cy - SPEC_R + 2} r={3}
          fill="#eab308" stroke="#0f172a" strokeWidth={0.8} />
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SkillNodeSvg({
  skill, cx, cy, branchColor,
  onHover, onLeave, onTap,
}: {
  skill: EvaluatedSkill; cx: number; cy: number;
  branchColor: string;
  onHover: (cx: number, cy: number) => void;
  onLeave: () => void;
  onTap:   (cx: number, cy: number) => void;
}) {
  const { status, progress, masteryRequirement: req } = skill;
  const pct = Math.min(1, req.minQualifyingSessions > 0
    ? progress.qualifyingSessions / req.minQualifyingSessions : 0);

  const isLocked   = status === "locked";
  const isMastered = status === "mastered";
  const hasProgress = status === "unlocked" && progress.qualifyingSessions > 0;
  const isUnlocked  = status === "unlocked";

  return (
    <g
      onMouseEnter={() => onHover(cx, cy)}
      onMouseLeave={onLeave}
      onClick={(e) => { e.stopPropagation(); onTap(cx, cy); }}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={skill.title}
    >
      {/* Enlarged hit area */}
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
  return (
    <line x1={x1} y1={dy1} x2={x2} y2={dy2}
      stroke={mastered ? branchColor : "#1e293b"}
      strokeWidth={mastered ? 2 : 1.5}
      strokeDasharray={mastered ? undefined : "4 3"} />
  );
}

// ─── Tooltip pop-up ───────────────────────────────────────────────────────────

const TOOLTIP_W = 192;

function SkillTooltip({
  tooltip,
  containerW,
  containerH,
  allSkills,
  onClose,
  onStart,
}: {
  tooltip: TooltipState;
  containerW: number;
  containerH: number;
  allSkills: EvaluatedSkill[];
  onClose: () => void;
  onStart: () => void;
}) {
  const { skill, branch, left, top, pinned } = tooltip;
  const color      = BRANCH_COLOR[branch];
  const req        = skill.masteryRequirement;
  const prog       = skill.progress;
  const isLocked   = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  const isStatic   = (skill.type as SkillType) === "static";
  const isExplosive = (skill.type as SkillType) === "explosive";

  const masteryPct = Math.min(
    100,
    req.minQualifyingSessions > 0
      ? Math.round((prog.qualifyingSessions / req.minQualifyingSessions) * 100)
      : 100,
  );

  // Resolve prerequisite node for locked skills
  const prereqNode = isLocked && skill.prerequisiteId
    ? ALL_SKILL_NODES.find((n) => n.id === skill.prerequisiteId) ?? null
    : null;
  const prereqEvaluated = prereqNode
    ? allSkills.find((s) => s.id === prereqNode.id) ?? null
    : null;

  // Flip horizontally if too close to right edge
  const flipX = left + TOOLTIP_W + 16 > containerW;
  // Estimate tooltip height for vertical flip
  const tooltipEstH = isLocked ? 170 : pinned ? 195 : 150;
  const flipY = top + tooltipEstH > containerH;

  const style: React.CSSProperties = {
    position:      "absolute",
    width:         TOOLTIP_W,
    zIndex:        50,
    left:          flipX ? left - TOOLTIP_W - 12 : left + 20,
    top:           flipY ? top - tooltipEstH + 10 : top - 10,
    pointerEvents: pinned ? "auto" : "none",
    boxShadow:     isLocked
      ? `0 0 10px 2px #52525233, 0 4px 16px rgba(0,0,0,0.7)`
      : `0 0 14px 3px ${color}33, 0 4px 20px rgba(0,0,0,0.6)`,
  };

  return (
    <div
      style={style}
      className="bg-zinc-900 border border-zinc-700/60 rounded-xl p-3 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header: branch dot + level + type tag ── */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isLocked ? MUTED : color }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide truncate"
            style={{ color: isLocked ? MUTED : color }}
          >
            Level {skill.level} · {skill.levelName}
          </span>
        </div>
        {isStatic && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/40 shrink-0">
            🧲 Static
          </span>
        )}
        {isExplosive && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/60 text-orange-300 border border-orange-700/40 shrink-0">
            ⚡ Explosive
          </span>
        )}
        {isLocked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/60 shrink-0">
            🔒 Locked
          </span>
        )}
      </div>

      {/* ── Title ── */}
      <p className="text-xs font-bold text-white leading-tight mb-1">
        {skill.title}
      </p>

      {/* ── Description (always shown) ── */}
      <p className="text-[10px] text-zinc-400 leading-relaxed mb-2 line-clamp-2">
        {skill.description}
      </p>

      {/* ── LOCKED: prerequisite requirement ── */}
      {isLocked && prereqNode && (
        <div className="rounded-lg bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-2 mb-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wide mb-0.5">
            Prerequisite
          </p>
          <p className="text-[10px] font-semibold text-zinc-200 leading-snug">
            {prereqNode.title}
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5">
            {prereqNode.masteryRequirement.description}
          </p>
          {prereqEvaluated && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-zinc-600">Their progress</span>
                <span className="font-medium"
                  style={{ color: prereqEvaluated.status === "mastered" ? GOLD : MUTED }}>
                  {prereqEvaluated.status === "mastered"
                    ? "✓ Mastered"
                    : `${Math.min(100, Math.round((prereqEvaluated.progress.qualifyingSessions / prereqEvaluated.masteryRequirement.minQualifyingSessions) * 100))}%`}
                </span>
              </div>
              <div className="h-0.5 rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((prereqEvaluated.progress.qualifyingSessions / prereqEvaluated.masteryRequirement.minQualifyingSessions) * 100))}%`,
                    backgroundColor: prereqEvaluated.status === "mastered" ? GOLD : MUTED,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UNLOCKED / MASTERED: mastery progress bar ── */}
      {!isLocked && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide">
              Mastery
            </span>
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: isMastered ? GOLD : color }}
            >
              {isMastered ? "✓ Mastered" : `${masteryPct}%`}
            </span>
          </div>
          <div className="h-1 rounded-full bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:           `${masteryPct}%`,
                backgroundColor: isMastered ? GOLD : color,
              }}
            />
          </div>
          <div className="text-[9px] text-zinc-600 mt-0.5">
            {prog.qualifyingSessions}/{req.minQualifyingSessions} qualifying sessions
          </div>
        </div>
      )}

      {/* ── Context-aware stats ── */}
      {!isLocked && (isStatic || isExplosive || prog.bestReps > 0 || prog.bestFormScore > 0) && (
        <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/40 px-2.5 py-1.5 mb-2 space-y-1">
          {isStatic && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-cyan-400/80 font-medium">⏱ Best Hold Time</span>
              <span className="text-[10px] font-bold text-cyan-300 tabular-nums">
                {prog.bestReps > 0 ? `${prog.bestReps}s` : "—"}
              </span>
            </div>
          )}
          {isExplosive && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-orange-400/80 font-medium">💥 Highest Reps</span>
                <span className="text-[10px] font-bold text-orange-300 tabular-nums">
                  {prog.bestReps > 0 ? `${prog.bestReps} reps` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-cyan-400/80 font-medium">👻 Ghost Sync</span>
                <span className="text-[10px] font-bold text-cyan-300 tabular-nums">
                  {prog.bestFormScore > 0 ? `${Math.round(prog.bestFormScore)}%` : "—"}
                </span>
              </div>
            </>
          )}
          {!isStatic && !isExplosive && prog.bestReps > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-zinc-400 font-medium">🏆 Best Reps</span>
              <span className="text-[10px] font-bold text-zinc-200 tabular-nums">
                {prog.bestReps} reps
              </span>
            </div>
          )}
          {!isStatic && prog.bestFormScore > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-zinc-400 font-medium">
                {isExplosive ? "" : "🎯 Form Score"}
              </span>
              {!isExplosive && (
                <span className="text-[10px] font-bold text-zinc-200 tabular-nums">
                  {Math.round(prog.bestFormScore)}%
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Pinned actions: Start Workout (not for locked) ── */}
      {pinned && !isLocked && (
        <div className="flex gap-1">
          <button
            onClick={onStart}
            className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: color }}
          >
            Start Workout
          </button>
          <button
            onClick={onClose}
            className="text-[10px] font-medium py-1.5 px-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Pinned close for locked ── */}
      {pinned && isLocked && (
        <button
          onClick={onClose}
          className="w-full text-[10px] font-medium py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
        >
          Close
        </button>
      )}
    </div>
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
  const svgRef     = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 355 });

  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const evaluated = useRef<EvaluatedSkill[] | null>(null);
  evaluated.current = sessions ? evaluateSkillTree(sessions) : null;

  const byBranch = evaluated.current
    ? BRANCHES.map((branch) => ({
        branch,
        color: BRANCH_COLOR[branch],
        // Specialty nodes are shown in a separate strip — exclude from core branch lists
        skills: evaluated.current!.filter((s) => s.branch === branch && !s.equipmentSpecialty),
      }))
    : null;

  // Convert SVG coordinate → pixel offset relative to wrapper
  const getPixelPos = useCallback((cx: number, cy: number) => {
    const svg     = svgRef.current;
    const wrapper = wrapperRef.current;
    if (!svg || !wrapper) return { left: cx, top: cy };
    const pt  = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { left: cx, top: cy };
    const screen = pt.matrixTransform(ctm);
    const rect   = wrapper.getBoundingClientRect();
    setContainerSize({ w: rect.width, h: rect.height });
    return { left: screen.x - rect.left, top: screen.y - rect.top };
  }, []);

  function branchOf(skill: EvaluatedSkill): SkillBranch {
    return skill.branch as SkillBranch;
  }

  function handleHover(skill: EvaluatedSkill, cx: number, cy: number) {
    if (tooltip?.pinned) return; // don't override a pinned tooltip
    const pos = getPixelPos(cx, cy);
    setTooltip({ skill, branch: branchOf(skill), ...pos, pinned: false });
  }

  function handleLeave() {
    if (tooltip?.pinned) return;
    setTooltip(null);
  }

  function handleTap(skill: EvaluatedSkill, cx: number, cy: number) {
    // If already pinned on same unlocked/mastered skill → navigate
    if (tooltip?.pinned && tooltip.skill.id === skill.id && skill.status !== "locked") {
      navigate(`/workout?exercise=${encodeURIComponent(skill.exercises[0])}`);
      return;
    }
    // Pin the tooltip for all statuses (locked shows prereq info)
    const pos = getPixelPos(cx, cy);
    setTooltip({ skill, branch: branchOf(skill), ...pos, pinned: true });
  }

  function handleStart() {
    if (!tooltip) return;
    navigate(`/workout?exercise=${encodeURIComponent(tooltip.skill.exercises[0])}`);
    setTooltip(null);
  }

  function handleClickAway() {
    if (tooltip?.pinned) setTooltip(null);
    else setTooltip(null);
  }

  if (isLoading || !byBranch) return <SkillMapSkeleton />;

  const masteredCount = byBranch.reduce(
    (sum, b) => sum + b.skills.filter((s) => s.status === "mastered").length, 0);

  // ── PULL sub-paths ──────────────────────────────────────────────────────────
  const pullAll    = byBranch.find((b) => b.branch === "PULL")!.skills;
  const pullColor  = BRANCH_COLOR.PULL;
  const pullShared = pullAll.filter((s) => !s.path || s.path === "shared").slice(0, 2);
  const pullFL     = pullAll.filter((s) => s.path === "front-lever");
  const pullMU     = pullAll.filter((s) => s.path === "muscle-up");

  // ── PULL specialty paths (branch from pull-2) ──────────────────────────────
  const pullSpecBar = evaluated.current!
    .filter((s) => s.branch === "PULL" && s.equipmentSpecialty && s.equipmentTag === "bar")
    .sort((a, b) => a.level - b.level);
  const pullSpecRings = evaluated.current!
    .filter((s) => s.branch === "PULL" && s.equipmentSpecialty && s.equipmentTag === "rings")
    .sort((a, b) => a.level - b.level);
  const pullSpecWgt = evaluated.current!
    .filter((s) => s.branch === "PULL" && s.equipmentSpecialty && s.equipmentTag === "weighted")
    .sort((a, b) => a.level - b.level);

  // ── PUSH sub-paths ──────────────────────────────────────────────────────────
  const pushAll   = byBranch.find((b) => b.branch === "PUSH")!.skills;
  const pushColor = BRANCH_COLOR.PUSH;
  const pushMain  = pushAll.filter((s) => !s.path || s.path === "main").slice(0, 5);
  const pushHSPU  = pushAll.filter((s) => s.path === "hspu").slice(0, 1);

  // ── CORE & LEGS (linear) ────────────────────────────────────────────────────
  const coreSkills = byBranch.find((b) => b.branch === "CORE")!.skills.slice(0, 5);
  const legsSkills = byBranch.find((b) => b.branch === "LEGS")!.skills.slice(0, 5);
  const coreColor  = BRANCH_COLOR.CORE;
  const legsColor  = BRANCH_COLOR.LEGS;

  function nodeProps(skill: EvaluatedSkill, cx: number, cy: number) {
    return {
      skill,
      cx,
      cy,
      branchColor: BRANCH_COLOR[skill.branch as SkillBranch],
      onHover: () => handleHover(skill, cx, cy),
      onLeave: handleLeave,
      onTap:   () => handleTap(skill, cx, cy),
    };
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

      {/* SVG + tooltip wrapper */}
      <div ref={wrapperRef} className="relative" onClick={handleClickAway}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto" }}
          aria-label="Skill map"
          className="overflow-visible"
        >
          {/* ── Column headers ──────────────────────────────────────────── */}
          {(
            [
              { x: COL.PUSH,        label: "PUSH", color: pushColor  },
              { x: COL.PULL_SHARED, label: "PULL", color: pullColor  },
              { x: COL.CORE,        label: "CORE", color: coreColor  },
              { x: COL.LEGS,        label: "LEGS", color: legsColor  },
            ] as const
          ).map(({ x, label, color }) => (
            <text key={label} x={x} y={22} textAnchor="middle" fontSize={10} fontWeight="700"
              fill={color} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
              {label}
            </text>
          ))}
          {/* Specialty section label */}
          <text x={(COL.SPEC_BAR + COL.SPEC_WGT) / 2} y={22}
            textAnchor="middle" fontSize={8} fontWeight="600"
            fill={MUTED} fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.07em">
            SPEC
          </text>

          {/* ── PUSH connectors ──────────────────────────────────────────── */}
          {pushMain.slice(0, -1).map((skill, si) => (
            <Connector key={`push-conn-${si}`}
              x1={COL.PUSH} y1={ROW_Y[si]} x2={COL.PUSH} y2={ROW_Y[si + 1]}
              mastered={skill.status === "mastered"} branchColor={pushColor} />
          ))}
          {pushHSPU.length > 0 && pushMain.length >= 5 && (
            <Connector
              x1={COL.PUSH} y1={ROW_Y[3]} x2={COL.PUSH_HSPU} y2={ROW_Y[4]}
              mastered={pushMain[3]?.status === "mastered"} branchColor={pushColor} />
          )}

          {/* ── PULL connectors ──────────────────────────────────────────── */}
          {pullShared.slice(0, -1).map((skill, si) => (
            <Connector key={`pull-shared-conn-${si}`}
              x1={COL.PULL_SHARED} y1={ROW_Y[si]} x2={COL.PULL_SHARED} y2={ROW_Y[si + 1]}
              mastered={skill.status === "mastered"} branchColor={pullColor} />
          ))}
          {pullShared.length >= 2 && (
            <>
              <Connector x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.PULL_FL} y2={ROW_Y[2]}
                mastered={pullShared[1]?.status === "mastered"} branchColor={pullColor} />
              <Connector x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.PULL_MU} y2={ROW_Y[2]}
                mastered={pullShared[1]?.status === "mastered"} branchColor={pullColor} />
            </>
          )}
          {pullFL.slice(0, -1).map((skill, si) => (
            <Connector key={`pull-fl-conn-${si}`}
              x1={COL.PULL_FL} y1={ROW_Y[si + 2]} x2={COL.PULL_FL} y2={ROW_Y[si + 3]}
              mastered={skill.status === "mastered"} branchColor={pullColor} />
          ))}
          {pullMU.slice(0, -1).map((skill, si) => (
            <Connector key={`pull-mu-conn-${si}`}
              x1={COL.PULL_MU} y1={ROW_Y[si + 2]} x2={COL.PULL_MU} y2={ROW_Y[si + 3]}
              mastered={skill.status === "mastered"} branchColor={pullColor} />
          ))}

          {/* ── PULL → specialty connectors (fork from pull-2) ─────────────── */}
          {pullShared.length >= 2 && (
            <>
              <Connector x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.SPEC_BAR}   y2={ROW_Y[2]}
                mastered={pullShared[1]?.status === "mastered"} branchColor={SPEC_COLOR.bar} />
              <Connector x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.SPEC_RINGS} y2={ROW_Y[2]}
                mastered={pullShared[1]?.status === "mastered"} branchColor={SPEC_COLOR.rings} />
              <Connector x1={COL.PULL_SHARED} y1={ROW_Y[1]} x2={COL.SPEC_WGT}   y2={ROW_Y[2]}
                mastered={pullShared[1]?.status === "mastered"} branchColor={SPEC_COLOR.weighted} />
            </>
          )}
          {pullSpecBar.slice(0, -1).map((skill, si) => (
            <Connector key={`spec-bar-conn-${si}`}
              x1={COL.SPEC_BAR} y1={ROW_Y[si + 2]} x2={COL.SPEC_BAR} y2={ROW_Y[si + 3]}
              mastered={skill.status === "mastered"} branchColor={SPEC_COLOR.bar} />
          ))}
          {pullSpecRings.slice(0, -1).map((skill, si) => (
            <Connector key={`spec-rings-conn-${si}`}
              x1={COL.SPEC_RINGS} y1={ROW_Y[si + 2]} x2={COL.SPEC_RINGS} y2={ROW_Y[si + 3]}
              mastered={skill.status === "mastered"} branchColor={SPEC_COLOR.rings} />
          ))}
          {pullSpecWgt.slice(0, -1).map((skill, si) => (
            <Connector key={`spec-wgt-conn-${si}`}
              x1={COL.SPEC_WGT} y1={ROW_Y[si + 2]} x2={COL.SPEC_WGT} y2={ROW_Y[si + 3]}
              mastered={skill.status === "mastered"} branchColor={SPEC_COLOR.weighted} />
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
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.PUSH, ROW_Y[si])} />
          ))}
          {pushHSPU.map((skill) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.PUSH_HSPU, ROW_Y[4])} />
          ))}

          {/* ── PULL shared nodes ────────────────────────────────────────── */}
          {pullShared.map((skill, si) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.PULL_SHARED, ROW_Y[si])} />
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

          {/* ── PULL FL nodes ─────────────────────────────────────────────── */}
          {pullFL.map((skill, si) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.PULL_FL, ROW_Y[si + 2])} />
          ))}

          {/* ── PULL MU nodes ─────────────────────────────────────────────── */}
          {pullMU.map((skill, si) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.PULL_MU, ROW_Y[si + 2])} />
          ))}

          {/* ── PULL specialty column sub-headers ────────────────────────────── */}
          {([
            { col: COL.SPEC_BAR,   tag: "bar"      as EquipmentTag, label: "BAR" },
            { col: COL.SPEC_RINGS, tag: "rings"    as EquipmentTag, label: "RNG" },
            { col: COL.SPEC_WGT,   tag: "weighted" as EquipmentTag, label: "WGT" },
          ]).map(({ col, tag, label }) => (
            <text key={label} x={col} y={ROW_Y[2] - SPEC_R - 7}
              textAnchor="middle" fontSize={6.5} fontWeight="700"
              fill={SPEC_COLOR[tag]}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              letterSpacing="0.04em">
              {label}
            </text>
          ))}

          {/* ── PULL specialty nodes ─────────────────────────────────────────── */}
          {pullSpecBar.map((skill, si) => (
            <SpecialtyNodeSvg key={skill.id} skill={skill}
              cx={COL.SPEC_BAR} cy={ROW_Y[si + 2]} equipmentTag="bar"
              onHover={() => handleHover(skill, COL.SPEC_BAR, ROW_Y[si + 2])}
              onLeave={handleLeave}
              onTap={() => handleTap(skill, COL.SPEC_BAR, ROW_Y[si + 2])} />
          ))}
          {pullSpecRings.map((skill, si) => (
            <SpecialtyNodeSvg key={skill.id} skill={skill}
              cx={COL.SPEC_RINGS} cy={ROW_Y[si + 2]} equipmentTag="rings"
              onHover={() => handleHover(skill, COL.SPEC_RINGS, ROW_Y[si + 2])}
              onLeave={handleLeave}
              onTap={() => handleTap(skill, COL.SPEC_RINGS, ROW_Y[si + 2])} />
          ))}
          {pullSpecWgt.map((skill, si) => (
            <SpecialtyNodeSvg key={skill.id} skill={skill}
              cx={COL.SPEC_WGT} cy={ROW_Y[si + 2]} equipmentTag="weighted"
              onHover={() => handleHover(skill, COL.SPEC_WGT, ROW_Y[si + 2])}
              onLeave={handleLeave}
              onTap={() => handleTap(skill, COL.SPEC_WGT, ROW_Y[si + 2])} />
          ))}

          {/* ── CORE nodes ───────────────────────────────────────────────── */}
          {coreSkills.map((skill, si) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.CORE, ROW_Y[si])} />
          ))}

          {/* ── LEGS nodes ───────────────────────────────────────────────── */}
          {legsSkills.map((skill, si) => (
            <SkillNodeSvg key={skill.id} {...nodeProps(skill, COL.LEGS, ROW_Y[si])} />
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
            style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); navigate("/skill-tree"); }}>
            View full tree →
          </text>
        </svg>

        {/* ── Floating tooltip ──────────────────────────────────────────────── */}
        {tooltip && (
          <SkillTooltip
            tooltip={tooltip}
            containerW={containerSize.w}
            containerH={containerSize.h}
            allSkills={evaluated.current ?? []}
            onClose={() => setTooltip(null)}
            onStart={handleStart}
          />
        )}
      </div>
    </div>
  );
}
