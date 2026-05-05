/**
 * Skill Tree — SVG-based interactive branching tech-tree
 *
 * Features:
 *   • Pan (drag) + pinch-to-zoom + scroll-wheel zoom
 *   • Glassmorphism circle nodes with progress rings
 *   • Glowing colour-coded connection lines (glow = mastered)
 *   • Click any node → floating overlay with stats + Train Now button
 *   • Zoom-in / Zoom-out / Reset-view toolbar buttons
 *   • Equipment Specialty section below the tree (unchanged)
 */

import {
  useMemo, useState, useRef, useEffect, useCallback,
} from "react";
import { Link, useLocation } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import {
  ALL_SKILL_NODES,
  EQUIPMENT_SPECIALTIES,
  TOTAL_SKILL_COUNT,
  evaluateSkillTree,
  getEquipmentMasteriesForLevel,
  type EvaluatedSkill,
  type SkillBranch,
  type SkillType,
  type EquipmentTag,
} from "@/lib/skill-tree";
import { cn } from "@/lib/utils";
import {
  Star, Lock, ZoomIn, ZoomOut, Maximize2,
  Play, Dumbbell, ArrowUp, Zap, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_R   = 28;
const GOLD     = "#eab308";
const MUTED    = "#6b7280";

const BRANCH_COLOR: Record<SkillBranch, string> = {
  PUSH: "#f97316",
  PULL: "#3b82f6",
  CORE: "#a855f7",
  LEGS: "#10b981",
};

function nodeColor(id: string): string {
  if (id.startsWith("push")) return BRANCH_COLOR.PUSH;
  if (id.startsWith("pull")) return BRANCH_COLOR.PULL;
  if (id.startsWith("core")) return BRANCH_COLOR.CORE;
  if (id.startsWith("legs")) return BRANCH_COLOR.LEGS;
  return MUTED;
}

// ─── Node positions (SVG coordinate space) ───────────────────────────────────

const NODE_POS: Record<string, { x: number; y: number }> = {
  // ── PUSH (main x=155, overhead/hspu x=272) ──
  "push-1":    { x: 155, y: 100 },
  "push-2":    { x: 155, y: 222 },
  "push-3":    { x: 155, y: 344 },
  "push-4":    { x: 155, y: 466 },
  "push-5":    { x: 155, y: 588 },
  "push-oh-1": { x: 272, y: 222 },
  "push-oh-2": { x: 272, y: 344 },
  "push-hs":   { x: 272, y: 588 },
  // ── PULL (shared x=490, FL x=402, MU x=490, EXP x=578) ──
  "pull-1":    { x: 490, y: 100 },
  "pull-2":    { x: 490, y: 222 },
  "pull-fl-1": { x: 402, y: 344 },
  "pull-fl-2": { x: 402, y: 466 },
  "pull-fl-3": { x: 402, y: 588 },
  "pull-mu-1": { x: 490, y: 344 },
  "pull-mu-2": { x: 490, y: 466 },
  "pull-mu-3": { x: 490, y: 588 },
  "pull-exp-1":{ x: 578, y: 344 },
  "pull-exp-2":{ x: 578, y: 466 },
  // ── CORE (main x=800, static-holds x=912) ──
  "core-1":    { x: 800, y: 100 },
  "core-2":    { x: 800, y: 222 },
  "core-3":    { x: 800, y: 344 },
  "core-4":    { x: 800, y: 466 },
  "core-5":    { x: 800, y: 588 },
  "core-sh-1": { x: 912, y: 222 },
  "core-sh-2": { x: 912, y: 344 },
  // ── LEGS (main x=1100, unilateral x=1212) ──
  "legs-1":    { x: 1100, y: 100 },
  "legs-2":    { x: 1100, y: 222 },
  "legs-3":    { x: 1100, y: 344 },
  "legs-4":    { x: 1100, y: 466 },
  "legs-5":    { x: 1100, y: 588 },
  "legs-uni-1":{ x: 1212, y: 344 },
  "legs-uni-2":{ x: 1212, y: 466 },
};

// ─── Edges [fromId, toId] ─────────────────────────────────────────────────────

const EDGES: [string, string][] = [
  // PUSH main
  ["push-1", "push-2"], ["push-2", "push-3"],
  ["push-3", "push-4"], ["push-4", "push-5"],
  // PUSH side paths
  ["push-1", "push-oh-1"], ["push-oh-1", "push-oh-2"],
  ["push-4", "push-hs"],
  // PULL shared
  ["pull-1", "pull-2"],
  // PULL 3-way fork from pull-2
  ["pull-2", "pull-fl-1"], ["pull-2", "pull-mu-1"], ["pull-2", "pull-exp-1"],
  ["pull-fl-1", "pull-fl-2"], ["pull-fl-2", "pull-fl-3"],
  ["pull-mu-1", "pull-mu-2"], ["pull-mu-2", "pull-mu-3"],
  ["pull-exp-1", "pull-exp-2"],
  // CORE main
  ["core-1", "core-2"], ["core-2", "core-3"],
  ["core-3", "core-4"], ["core-4", "core-5"],
  // CORE side path
  ["core-1", "core-sh-1"], ["core-sh-1", "core-sh-2"],
  // LEGS main
  ["legs-1", "legs-2"], ["legs-2", "legs-3"],
  ["legs-3", "legs-4"], ["legs-4", "legs-5"],
  // LEGS side path
  ["legs-2", "legs-uni-1"], ["legs-uni-1", "legs-uni-2"],
];

// ─── Section labels (x, label, color) ────────────────────────────────────────

const SECTION_LABELS = [
  { x: 213,  label: "PUSH", color: BRANCH_COLOR.PUSH },
  { x: 490,  label: "PULL", color: BRANCH_COLOR.PULL },
  { x: 856,  label: "CORE", color: BRANCH_COLOR.CORE },
  { x: 1156, label: "LEGS", color: BRANCH_COLOR.LEGS },
];

// Section dividers at these x values
const DIVIDERS = [340, 660, 960];

// Path sub-labels (small guides)
const PATH_LABELS = [
  { x: 272,  y: 182, text: "Overhead",     color: BRANCH_COLOR.PUSH },
  { x: 272,  y: 548, text: "HSPU",         color: BRANCH_COLOR.PUSH },
  { x: 402,  y: 308, text: "Front Lever",  color: BRANCH_COLOR.PULL },
  { x: 490,  y: 308, text: "Muscle-Up",    color: BRANCH_COLOR.PULL },
  { x: 578,  y: 308, text: "Explosive",    color: BRANCH_COLOR.PULL },
  { x: 912,  y: 182, text: "Static Holds", color: BRANCH_COLOR.CORE },
  { x: 1212, y: 308, text: "Unilateral",   color: BRANCH_COLOR.LEGS },
];

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function StarShape({ cx, cy }: { cx: number; cy: number }) {
  const R = 10; const r = 4.5;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const radius = i % 2 === 0 ? R : r;
    return `${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill="white" opacity={0.95} />;
}

function LockShape({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <path
        d={`M ${cx - 7} ${cy - 1} V ${cy - 10} A 7 7 0 0 1 ${cx + 7} ${cy - 10} V ${cy - 1}`}
        fill="none" stroke={MUTED} strokeWidth={3} strokeLinecap="round"
      />
      <rect x={cx - 9} y={cy - 1} width={18} height={13} rx={3} fill={MUTED} opacity={0.7} />
      <circle cx={cx} cy={cy + 5} r={2.5} fill="#1e293b" />
    </>
  );
}

// ─── ConnectorPath ────────────────────────────────────────────────────────────

function ConnectorPath({
  fromId, toId, skillMap, hoveredId,
}: {
  fromId: string; toId: string;
  skillMap: Map<string, EvaluatedSkill>;
  hoveredId: string | null;
}) {
  const p1 = NODE_POS[fromId];
  const p2 = NODE_POS[toId];
  if (!p1 || !p2) return null;

  const fromSkill = skillMap.get(fromId);
  const mastered  = fromSkill?.status === "mastered";
  const color     = nodeColor(fromId);

  // Brighten this edge when either endpoint is hovered
  const lit = hoveredId === fromId || hoveredId === toId;

  // Start below source node, end above target node
  const x1 = p1.x; const y1 = p1.y + NODE_R + 2;
  const x2 = p2.x; const y2 = p2.y - NODE_R - 2;
  const midY = (p1.y + p2.y) / 2;

  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  if (mastered) {
    return (
      <g style={{ transition: "opacity 0.15s" }}>
        {/* Outer glow — expands on hover */}
        <path d={d} fill="none" stroke={color} strokeWidth={lit ? 20 : 12}
          opacity={lit ? 0.18 : 0.06} strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s, opacity 0.15s" }} />
        {/* Inner glow */}
        <path d={d} fill="none" stroke={color} strokeWidth={lit ? 8 : 6}
          opacity={lit ? 0.55 : 0.18} strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s, opacity 0.15s" }} />
        {/* Solid line */}
        <path d={d} fill="none" stroke={color} strokeWidth={lit ? 3.5 : 2.5}
          opacity={lit ? 1 : 0.9} strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s" }} />
      </g>
    );
  }

  return (
    <path d={d} fill="none"
      stroke={lit ? color : "#1e293b"}
      strokeWidth={lit ? 2 : 1.5}
      strokeDasharray="9 5"
      opacity={lit ? 0.55 : 0.85}
      strokeLinecap="round"
      style={{ transition: "stroke 0.15s, opacity 0.15s" }}
    />
  );
}

// ─── GlassNode ────────────────────────────────────────────────────────────────

function GlassNode({
  nodeId, skill, isHovered, onClick, onHover,
}: {
  nodeId: string;
  skill: EvaluatedSkill;
  isHovered: boolean;
  onClick: (skill: EvaluatedSkill, e: React.MouseEvent) => void;
  onHover: (id: string | null) => void;
}) {
  const pos = NODE_POS[nodeId];
  if (!pos) return null;
  const { x, y } = pos;
  const color = nodeColor(nodeId);

  const isMastered = skill.status === "mastered";
  const isLocked   = skill.status === "locked";
  const isUnlocked = skill.status === "unlocked";

  const pct = skill.masteryRequirement.minQualifyingSessions > 0
    ? Math.min(1, skill.progress.qualifyingSessions / skill.masteryRequirement.minQualifyingSessions)
    : 0;

  const RING_R  = NODE_R + 8;
  const CIRC    = 2 * Math.PI * RING_R;

  // Clamp title length for the label below
  const shortTitle = skill.title.length > 13 ? skill.title.slice(0, 12) + "…" : skill.title;

  // CSS scale-around-center via transformOrigin
  const scale = isHovered ? "scale(1.12)" : "scale(1)";

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(skill, e); }}
      onMouseEnter={() => onHover(nodeId)}
      onMouseLeave={() => onHover(null)}
      style={{
        cursor: "pointer",
        transformOrigin: `${x}px ${y}px`,
        transform: scale,
        transition: "transform 0.14s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      role="button"
      aria-label={skill.title}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(skill, e as unknown as React.MouseEvent); }}
    >
      {/* Enlarged invisible hit area — ≥44px touch target */}
      <circle cx={x} cy={y} r={NODE_R + 16} fill="transparent" />

      {/* Hover outer pulse ring */}
      {isHovered && (
        <circle cx={x} cy={y} r={NODE_R + 20}
          fill="none"
          stroke={isMastered ? GOLD : color}
          strokeWidth={1.5}
          opacity={0.22}
        />
      )}

      {/* Mastered: double gold glow rings */}
      {isMastered && (
        <>
          <circle cx={x} cy={y} r={NODE_R + 14} fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2 : 1} opacity={isHovered ? 0.28 : 0.12} />
          <circle cx={x} cy={y} r={NODE_R + 7}  fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2.5 : 1.5} opacity={isHovered ? 0.65 : 0.35} />
        </>
      )}

      {/* Unlocked: track ring + progress arc */}
      {isUnlocked && (
        <>
          <circle cx={x} cy={y} r={RING_R}
            fill="none" stroke={color} strokeWidth={3} opacity={isHovered ? 0.3 : 0.15} />
          {pct > 0 && (
            <circle cx={x} cy={y} r={RING_R}
              fill="none" stroke={color} strokeWidth={3}
              strokeDasharray={`${pct * CIRC} ${CIRC}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${x} ${y})`}
              opacity={isHovered ? 1 : 0.9}
            />
          )}
        </>
      )}

      {/* Main glass circle */}
      <circle cx={x} cy={y} r={NODE_R}
        fill={isMastered ? GOLD : isLocked ? "#080f1a" : "rgba(15,23,42,0.92)"}
        stroke={isMastered ? "#f59e0b" : isLocked ? "#1e293b" : color}
        strokeWidth={isMastered ? (isHovered ? 3 : 2) : isLocked ? 1.5 : (isHovered ? 3.5 : 2.5)}
        opacity={isLocked ? 0.5 : 1}
      />

      {/* Glass highlight shimmer */}
      {!isLocked && (
        <ellipse
          cx={x} cy={y - NODE_R * 0.3}
          rx={NODE_R * 0.44} ry={NODE_R * 0.2}
          fill="white" opacity={isHovered ? 0.14 : 0.07}
        />
      )}

      {/* Icon */}
      {isMastered && <StarShape cx={x} cy={y} />}
      {isLocked    && <LockShape cx={x} cy={y} />}
      {isUnlocked  && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontWeight="800" fill={color}
          fontFamily="ui-monospace, monospace">
          L{skill.level}
        </text>
      )}

      {/* Label below node */}
      <text x={x} y={y + NODE_R + 14} textAnchor="middle"
        fontSize={8}
        fill={isLocked ? "#374151" : isHovered ? (isMastered ? GOLD : color) : "#9ca3af"}
        fontWeight={isUnlocked || isHovered ? "600" : "400"}
        fontFamily="ui-sans-serif, system-ui, sans-serif">
        {shortTitle}
      </text>
    </g>
  );
}

// ─── SkillOverlay (floating info panel) ──────────────────────────────────────

const OVERLAY_W = 244;

function SkillOverlay({
  skill, screenX, screenY, containerW, containerH, color, onClose,
}: {
  skill: EvaluatedSkill;
  screenX: number; screenY: number;
  containerW: number; containerH: number;
  color: string;
  onClose: () => void;
}) {
  const OVERLAY_H_EST = 300;
  let left = screenX + 44;
  if (left + OVERLAY_W > containerW - 8) left = screenX - OVERLAY_W - 24;
  let top  = screenY - OVERLAY_H_EST / 2;
  if (top < 8) top = 8;
  if (top + OVERLAY_H_EST > containerH - 8) top = containerH - OVERLAY_H_EST - 8;

  const isMastered = skill.status === "mastered";
  const isLocked   = skill.status === "locked";
  const isStatic   = (skill.type as SkillType) === "static";
  const req  = skill.masteryRequirement;
  const prog = skill.progress;

  const masteryPct = Math.min(100,
    req.minQualifyingSessions > 0
      ? Math.round((prog.qualifyingSessions / req.minQualifyingSessions) * 100)
      : 100,
  );

  const prereqNode = isLocked && skill.prerequisiteId
    ? ALL_SKILL_NODES.find((n) => n.id === skill.prerequisiteId) ?? null
    : null;

  const workoutUrl = `/workout?exercise=${encodeURIComponent(skill.exercises[0])}`;

  return (
    <div
      style={{
        position:  "absolute",
        left,
        top,
        width:     OVERLAY_W,
        zIndex:    60,
        boxShadow: isLocked
          ? "0 0 24px rgba(0,0,0,0.85), 0 4px 20px rgba(0,0,0,0.6)"
          : `0 0 24px ${color}28, 0 0 8px ${color}12, 0 4px 24px rgba(0,0,0,0.75)`,
      }}
      className="bg-zinc-900/96 border border-zinc-700/60 rounded-2xl p-4 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isLocked ? "#4b5563" : color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider truncate"
            style={{ color: isLocked ? "#6b7280" : color }}>
            Level {skill.level} · {skill.levelName}
          </span>
        </div>
        <button onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none shrink-0 w-5 h-5 flex items-center justify-center">
          ×
        </button>
      </div>

      {/* Type badges */}
      <div className="flex items-center gap-1.5 mb-2">
        {(skill.type as SkillType) === "static" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-900/50 text-cyan-300 border border-cyan-700/40">
            🧲 Static Hold
          </span>
        )}
        {(skill.type as SkillType) === "explosive" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/40">
            ⚡ Explosive
          </span>
        )}
        {isLocked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/50">
            🔒 Locked
          </span>
        )}
        {isMastered && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/40">
            ★ Mastered
          </span>
        )}
      </div>

      <p className="font-bold text-sm text-white mb-0.5 leading-tight">{skill.title}</p>
      {skill.pathLabel && (
        <p className="text-[10px] text-zinc-500 mb-2">{skill.pathLabel}</p>
      )}

      {/* "Why" section — always visible */}
      <div className="rounded-lg px-2.5 py-2 mb-3 border"
        style={{
          borderColor: isLocked ? "#27272a" : `${color}30`,
          backgroundColor: isLocked ? "rgba(39,39,42,0.4)" : `${color}0d`,
        }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
          style={{ color: isLocked ? "#6b7280" : color }}>
          {isLocked ? "🔒 Locked" : "Why train this?"}
        </p>
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          {isLocked
            ? "Master the prerequisite skill to unlock this node."
            : skill.description}
        </p>
      </div>

      {/* Mastery progress */}
      {!isLocked && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide">Mastery</span>
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: isMastered ? GOLD : color }}>
              {isMastered ? "✓ Complete" : `${masteryPct}%`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${masteryPct}%`, backgroundColor: isMastered ? GOLD : color }} />
          </div>
          <p className="text-[9px] text-zinc-600 mt-1">
            {req.description}
          </p>
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {prog.qualifyingSessions}/{req.minQualifyingSessions} qualifying sessions
          </p>
        </div>
      )}

      {/* Best session stats */}
      {!isLocked && (prog.bestReps > 0 || prog.bestFormScore > 0) && (
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 px-3 py-2 mb-3 space-y-1">
          {isStatic && prog.bestReps > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-cyan-400/80 font-medium">⏱ Best Hold</span>
              <span className="text-[10px] font-bold text-cyan-300 tabular-nums">{prog.bestReps}s</span>
            </div>
          )}
          {!isStatic && prog.bestReps > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-zinc-400">🏆 Best Reps</span>
              <span className="text-[10px] font-bold text-zinc-200 tabular-nums">{prog.bestReps}</span>
            </div>
          )}
          {prog.bestFormScore > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-zinc-400">🎯 Form Score</span>
              <span className="text-[10px] font-bold text-zinc-200 tabular-nums">
                {Math.round(prog.bestFormScore)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Locked: prerequisite */}
      {isLocked && prereqNode && (
        <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-3 py-2 mb-3">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wide mb-0.5">Requires</p>
          <p className="text-[11px] font-semibold text-zinc-300">{prereqNode.title}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">{prereqNode.masteryRequirement.description}</p>
        </div>
      )}

      {/* Train Now / Practice button */}
      {!isLocked && (
        <Link href={workoutUrl}>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: isMastered ? "#d97706" : color }}
          >
            {isMastered ? "Practice Again →" : "Train Now →"}
          </button>
        </Link>
      )}
    </div>
  );
}

// ─── TreeCanvas ───────────────────────────────────────────────────────────────

interface OverlayState {
  skill:   EvaluatedSkill;
  screenX: number;
  screenY: number;
}

function TreeCanvas({ evaluated }: { evaluated: EvaluatedSkill[] }) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [pan,  setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 900, h: 560 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isPanning     = useRef(false);
  const lastPos       = useRef({ x: 0, y: 0 });
  const didDrag       = useRef(false);
  const downPos       = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const zoomRef       = useRef(zoom);
  zoomRef.current     = zoom;
  const panRef        = useRef(pan);
  panRef.current      = pan;

  // Build a nodeId → EvaluatedSkill map for quick lookups
  const skillMap = useMemo(() => {
    const m = new Map<string, EvaluatedSkill>();
    for (const s of evaluated) m.set(s.id, s);
    return m;
  }, [evaluated]);

  // Set initial pan to center the tree when container mounts
  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const TREE_W = 1320; const TREE_H = 680;
    const INIT_ZOOM = Math.min(0.88, (width - 32) / TREE_W);
    setPan({
      x: (width  - TREE_W * INIT_ZOOM) / 2,
      y: Math.max(16, (height - TREE_H * INIT_ZOOM) / 2),
    });
    setZoom(INIT_ZOOM);
  }, []);

  useEffect(() => {
    // Initial reset after a tick to let layout settle
    const t = setTimeout(resetView, 80);
    return () => clearTimeout(t);
  }, [resetView]);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.max(0.3, Math.min(3.5, z * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Non-passive touch listener for pinch-to-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (lastPinchDist.current !== null) {
          const factor = dist / lastPinchDist.current;
          setZoom((z) => Math.max(0.3, Math.min(3.5, z * factor)));
        }
        lastPinchDist.current = dist;
      }
    };
    const onTouchEnd = () => { lastPinchDist.current = null; };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend",  onTouchEnd,  { passive: true  });
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend",  onTouchEnd);
    };
  }, []);

  // Pointer drag for panning
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isPanning.current = true;
    didDrag.current   = false;
    lastPos.current   = { x: e.clientX, y: e.clientY };
    downPos.current   = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (overlay) setOverlay(null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    const totalD = Math.abs(e.clientX - downPos.current.x) + Math.abs(e.clientY - downPos.current.y);
    if (totalD > 4) didDrag.current = true;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp() {
    isPanning.current = false;
  }

  // Node click handler
  function handleNodeClick(skill: EvaluatedSkill, e: React.MouseEvent) {
    if (didDrag.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos   = NODE_POS[skill.id];
    if (!pos) return;
    const screenX = pos.x * zoom + pan.x;
    const screenY = pos.y * zoom + pan.y;
    setContainerSize({ w: rect.width, h: rect.height });
    setOverlay({ skill, screenX, screenY });
  }

  const overlayColor = overlay ? nodeColor(overlay.skill.id) : "#6b7280";

  return (
    <div className="relative" style={{ height: "calc(100vh - 200px)", minHeight: 420 }}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5">
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          className="w-8 h-8 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
          className="w-8 h-8 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Reset view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SVG pan/zoom canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden rounded-2xl border border-border/30 bg-zinc-950/80"
        style={{ cursor: isPanning.current ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width="100%" height="100%">
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* ── Section dividers ── */}
            {DIVIDERS.map((dx) => (
              <line key={dx} x1={dx} y1={0} x2={dx} y2={680}
                stroke="#1e293b" strokeWidth={1} strokeDasharray="6 6" opacity={0.7} />
            ))}

            {/* ── Branch section labels ── */}
            {SECTION_LABELS.map(({ x, label, color }) => (
              <text key={label} x={x} y={32} textAnchor="middle"
                fontSize={12} fontWeight="800" fill={color}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                letterSpacing="0.1em" opacity={0.85}>
                {label}
              </text>
            ))}

            {/* ── Path sub-labels ── */}
            {PATH_LABELS.map(({ x, y, text, color }) => (
              <text key={text} x={x} y={y} textAnchor="middle"
                fontSize={7.5} fill={color} opacity={0.55}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontStyle="italic">
                {text}
              </text>
            ))}

            {/* ── Edges (drawn first, under nodes) ── */}
            {EDGES.map(([from, to]) => (
              <ConnectorPath
                key={`${from}-${to}`}
                fromId={from}
                toId={to}
                skillMap={skillMap}
                hoveredId={hoveredId}
              />
            ))}

            {/* ── Nodes ── */}
            {Object.keys(NODE_POS).map((nodeId) => {
              const skill = skillMap.get(nodeId);
              if (!skill) return null;
              return (
                <GlassNode
                  key={nodeId}
                  nodeId={nodeId}
                  skill={skill}
                  isHovered={hoveredId === nodeId}
                  onClick={handleNodeClick}
                  onHover={setHoveredId}
                />
              );
            })}
          </g>
        </svg>

        {/* ── Overlay ── */}
        {overlay && (
          <SkillOverlay
            skill={overlay.skill}
            screenX={overlay.screenX}
            screenY={overlay.screenY}
            containerW={containerSize.w}
            containerH={containerSize.h}
            color={overlayColor}
            onClose={() => setOverlay(null)}
          />
        )}

        {/* ── Hint ── */}
        <p className="absolute bottom-3 left-3 text-[10px] text-zinc-600 pointer-events-none select-none">
          Drag to pan · Scroll or pinch to zoom · Tap a node for details
        </p>
      </div>
    </div>
  );
}

// ─── Equipment Specialty ──────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     "bg-slate-700 text-slate-200",
  Novice:       "bg-sky-900 text-sky-200",
  Intermediate: "bg-indigo-900 text-indigo-200",
  Advanced:     "bg-amber-900 text-amber-200",
  Elite:        "bg-rose-900 text-rose-200",
};

function EquipmentTagIcon({ tag, color, size = 18 }: { tag: EquipmentTag; color: string; size?: number }) {
  if (tag === "rings") {
    return (
      <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
        <circle cx={0} cy={0} r={8} fill="none" stroke={color} strokeWidth={2.5} />
      </svg>
    );
  }
  if (tag === "weighted") {
    return (
      <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
        <circle cx={-5.5} cy={0} r={3.5} fill={color} />
        <rect x={-2} y={-1.5} width={4} height={3} fill={color} />
        <circle cx={5.5} cy={0} r={3.5} fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <line x1={-9} y1={0} x2={9} y2={0} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={-9} y={-4} width={3} height={8} rx={1} fill={color} />
      <rect x={6}  y={-4} width={3} height={8} rx={1} fill={color} />
    </svg>
  );
}

function SpecialtyNodeCard({ skill, isLast }: { skill: EvaluatedSkill; isLast: boolean }) {
  const tag  = skill.equipmentTag!;
  const spec = EQUIPMENT_SPECIALTIES[tag];
  const req  = skill.masteryRequirement;
  const { qualifyingSessions, bestReps, bestFormScore } = skill.progress;
  const progressPct = Math.min(100, (qualifyingSessions / req.minQualifyingSessions) * 100);
  const isLocked   = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  const workoutUrl = `/workout?exercise=${encodeURIComponent(skill.exercises[0])}`;

  return (
    <div className="relative flex flex-col items-center">
      {!isLast && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-5 z-0"
          style={{ backgroundColor: isMastered ? spec.color : "hsl(var(--border))" }}
        />
      )}
      <div
        className={cn(
          "relative w-full rounded-xl border p-3 transition-all z-10",
          isLocked && "border border-border/40 bg-card/30 opacity-60",
          !isLocked && !isMastered && "border border-border bg-card hover:border-primary/20",
        )}
        style={isMastered ? { borderWidth: 2, borderColor: spec.color, backgroundColor: spec.bgColor } : {}}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {isMastered
              ? <Star className="w-4 h-4 fill-current shrink-0" style={{ color: spec.color }} />
              : isLocked
              ? <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              : <div className="w-4 h-4 rounded-full border-2 shrink-0" style={{ borderColor: spec.color }} />
            }
            <span className={cn("font-semibold text-[13px] leading-tight", isLocked && "text-muted-foreground")}>
              {skill.title}
            </span>
          </div>
          <Badge className={cn("text-[10px] px-1.5 py-0.5 shrink-0 font-medium", LEVEL_COLORS[skill.levelName])}>
            {skill.levelName}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
          {isLocked ? "🔒 Master the previous skill to unlock." : skill.description}
        </p>
        {!isLocked && (
          <div className="mb-2 rounded-md bg-secondary/50 px-2 py-1.5">
            <p className="text-[11px] font-medium text-foreground/80">{req.description}</p>
          </div>
        )}
        {!isLocked && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Sessions</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: isMastered ? spec.color : undefined }}>
                {qualifyingSessions}/{req.minQualifyingSessions}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: spec.color }} />
            </div>
            {(bestReps > 0 || bestFormScore > 0) && (
              <div className="flex gap-3 mt-1.5">
                {bestReps > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Best: <span className="text-foreground font-medium">
                      {(skill.type as SkillType) === "static" ? `${bestReps}s hold` : `${bestReps} reps`}
                    </span>
                  </span>
                )}
                {bestFormScore > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Form: <span className="text-foreground font-medium">{Math.round(bestFormScore)}%</span>
                  </span>
                )}
              </div>
            )}
            {isMastered && (
              <div className="mt-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: spec.color }}>
                <Star className="w-3 h-3 fill-current" /> Mastered
              </div>
            )}
          </div>
        )}
        {!isLocked && (
          <Button asChild size="sm" variant="outline"
            className="mt-2.5 w-full h-7 text-[11px] gap-1.5"
            style={isMastered ? { borderColor: spec.color, color: spec.color } : {}}>
            <Link href={workoutUrl}>
              <Play className="w-3 h-3 fill-current" />
              Start Workout
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function DoubleMasteryBanner({ evaluated }: { evaluated: EvaluatedSkill[] }) {
  const doubleMasteries = useMemo(() => {
    const result: Array<{ branch: SkillBranch; level: number; tags: EquipmentTag[] }> = [];
    const branches: SkillBranch[] = ["PUSH", "PULL"];
    for (const branch of branches) {
      for (let level = 1; level <= 5; level++) {
        const tags = getEquipmentMasteriesForLevel(branch, level, evaluated);
        if (tags.length >= 2) result.push({ branch, level, tags });
      }
    }
    return result;
  }, [evaluated]);

  if (doubleMasteries.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center gap-3">
      <Star className="w-5 h-5 fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          Double {doubleMasteries.length === 1 ? "Mastery" : "Masteries"} Achieved!
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doubleMasteries
            .map(({ branch, level, tags }) =>
              `${branch} L${level}: ${tags.map((t) => EQUIPMENT_SPECIALTIES[t].shortLabel).join(" + ")}`)
            .join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

function EquipmentSpecialtyColumn({ tag, skills }: { tag: EquipmentTag; skills: EvaluatedSkill[] }) {
  const spec          = EQUIPMENT_SPECIALTIES[tag];
  const masteredCount = skills.filter((s) => s.status === "mastered").length;

  return (
    <div className="flex flex-col gap-0">
      <div className="rounded-xl border-2 p-3 mb-5 flex items-center justify-between"
        style={{ borderColor: spec.color, backgroundColor: spec.bgColor }}>
        <div className="flex items-center gap-2">
          <EquipmentTagIcon tag={tag} color={spec.color} />
          <span className="font-bold text-base" style={{ color: spec.color }}>{spec.label}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {masteredCount}/{skills.length}
        </span>
      </div>
      <div className="flex flex-col gap-5">
        {skills.map((skill, i) => (
          <SpecialtyNodeCard key={skill.id} skill={skill} isLast={i === skills.length - 1} />
        ))}
      </div>
    </div>
  );
}

function EquipmentSpecialtySection({ evaluated }: { evaluated: EvaluatedSkill[] }) {
  const specialtyGroups = useMemo(() => {
    const tags: EquipmentTag[] = ["bar", "rings", "weighted"];
    return tags.map((tag) => ({
      tag,
      skills: evaluated
        .filter((s) => s.equipmentSpecialty && s.equipmentTag === tag)
        .sort((a, b) => a.branch.localeCompare(b.branch) || a.level - b.level),
    }));
  }, [evaluated]);

  const masteredSpecialty = evaluated.filter((s) => s.equipmentSpecialty && s.status === "mastered").length;
  const totalSpecialty    = evaluated.filter((s) => s.equipmentSpecialty).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Equipment Specialty Paths</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Parallel paths that unlock after mastering foundational movements. Complete the same
            level across multiple paths to earn Double Mastery.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tabular-nums">
            {masteredSpecialty}
            <span className="text-muted-foreground text-base font-normal">/{totalSpecialty}</span>
          </p>
          <p className="text-xs text-muted-foreground">Specialty Mastered</p>
        </div>
      </div>
      <DoubleMasteryBanner evaluated={evaluated} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {specialtyGroups.map(({ tag, skills }) => (
          <EquipmentSpecialtyColumn key={tag} tag={tag} skills={skills} />
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkillTreeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="w-full rounded-2xl" style={{ height: "calc(100vh - 200px)", minHeight: 420 }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillTreePage() {
  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const evaluated = useMemo(() => {
    if (!sessions) return null;
    return evaluateSkillTree(sessions);
  }, [sessions]);

  const totalMastered = evaluated?.filter(
    (s) => s.status === "mastered" && !s.equipmentSpecialty,
  ).length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skill Tree</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Four branches of calisthenics mastery. Tap any node for details. Drag to pan, scroll to zoom.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {totalMastered}
              <span className="text-muted-foreground text-base font-normal">
                /{TOTAL_SKILL_COUNT}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">Skills Mastered</p>
          </div>
          <Button asChild>
            <Link href="/workout">Train Now</Link>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
            <Star className="w-2.5 h-2.5 fill-white text-white" />
          </span>
          Mastered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-2 border-primary" />
          In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center">
            <Lock className="w-2 h-2 text-zinc-500" />
          </span>
          Locked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-0.5 rounded-full bg-primary" />
          Mastered connection
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-0.5 rounded-full border-t border-dashed border-zinc-600" />
          Locked connection
        </span>
      </div>

      {/* SVG Tree */}
      {isLoading || !evaluated ? (
        <SkillTreeSkeleton />
      ) : (
        <>
          <TreeCanvas evaluated={evaluated} />

          <div className="border-t border-border/40 pt-8">
            <EquipmentSpecialtySection evaluated={evaluated} />
          </div>
        </>
      )}
    </div>
  );
}
