/**
 * Skill Tree — Radial hub-and-spoke SVG tech-tree
 *
 * Layout: 4 branches (PUSH/PULL/CORE/LEGS) radiate N/E/S/W from a central hub.
 * Features:
 *   • Pan (pointer drag) + pinch-to-zoom + scroll-wheel zoom
 *   • Smart zoom: labels hidden at zoom < 0.48, mastery icons always shown
 *   • Framer Motion overlay with spring bounce + tree backdrop blur
 *   • Glowing direction-aware Bézier connectors (glow = mastered)
 *   • Hover: scale 1.12 + brightened connected edges
 *   • Auto-Center button — snaps view to first in-progress node
 *   • Equipment Specialty section below
 */

import {
  useMemo, useState, useRef, useEffect, useCallback,
} from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
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
  Star, Lock, ZoomIn, ZoomOut, Maximize2, Crosshair, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_R   = 28;
const HUB_R    = 38;
const GAP      = 150;    // pixels between each level
const SIDE     = 165;    // side-branch offset (perpendicular)
const HUB_X    = 1500;
const HUB_Y    = 1500;
const GOLD     = "#eab308";
const MUTED    = "#6b7280";
const HIT_R    = NODE_R + 14;  // ≥44px touch target

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

// ─── Radial Node Positions ────────────────────────────────────────────────────
// Hub at (1500, 1500).
// PUSH radiates NORTH  (y decreasing)
// PULL radiates EAST   (x increasing)
// CORE radiates SOUTH  (y increasing)
// LEGS radiates WEST   (x decreasing)

const NODE_POS: Record<string, { x: number; y: number }> = {
  // ── PUSH (north) ──────────────────────────────────────────────────
  "push-1":    { x: HUB_X,        y: HUB_Y - GAP * 1 },       // 1350
  "push-2":    { x: HUB_X,        y: HUB_Y - GAP * 2 },       // 1200
  "push-3":    { x: HUB_X,        y: HUB_Y - GAP * 3 },       // 1050
  "push-4":    { x: HUB_X,        y: HUB_Y - GAP * 4 },       //  900
  "push-5":    { x: HUB_X,        y: HUB_Y - GAP * 5 },       //  750
  // Overhead/HSPU side branch (+SIDE east)
  "push-oh-1": { x: HUB_X + SIDE, y: HUB_Y - GAP * 2 },       // (1665, 1200)
  "push-oh-2": { x: HUB_X + SIDE, y: HUB_Y - GAP * 3 },       // (1665, 1050)
  "push-hs":   { x: HUB_X + SIDE, y: HUB_Y - GAP * 5 },       // (1665,  750)

  // ── PULL (east) ───────────────────────────────────────────────────
  "pull-1":    { x: HUB_X + GAP * 1, y: HUB_Y },               // 1650
  "pull-2":    { x: HUB_X + GAP * 2, y: HUB_Y },               // 1800
  // Three-way fork from pull-2: FL up, MU center, EXP down
  "pull-fl-1": { x: HUB_X + GAP * 3, y: HUB_Y - SIDE },       // (1950, 1335)
  "pull-fl-2": { x: HUB_X + GAP * 4, y: HUB_Y - SIDE },       // (2100, 1335)
  "pull-fl-3": { x: HUB_X + GAP * 5, y: HUB_Y - SIDE },       // (2250, 1335)
  "pull-mu-1": { x: HUB_X + GAP * 3, y: HUB_Y },               // (1950, 1500)
  "pull-mu-2": { x: HUB_X + GAP * 4, y: HUB_Y },               // (2100, 1500)
  "pull-mu-3": { x: HUB_X + GAP * 5, y: HUB_Y },               // (2250, 1500)
  "pull-exp-1":{ x: HUB_X + GAP * 3, y: HUB_Y + SIDE },       // (1950, 1665)
  "pull-exp-2":{ x: HUB_X + GAP * 4, y: HUB_Y + SIDE },       // (2100, 1665)

  // ── CORE (south) ──────────────────────────────────────────────────
  "core-1":    { x: HUB_X,        y: HUB_Y + GAP * 1 },       // 1650
  "core-2":    { x: HUB_X,        y: HUB_Y + GAP * 2 },       // 1800
  "core-3":    { x: HUB_X,        y: HUB_Y + GAP * 3 },       // 1950
  "core-4":    { x: HUB_X,        y: HUB_Y + GAP * 4 },       // 2100
  "core-5":    { x: HUB_X,        y: HUB_Y + GAP * 5 },       // 2250
  // Static Holds side branch (-SIDE west)
  "core-sh-1": { x: HUB_X - SIDE, y: HUB_Y + GAP * 2 },       // (1335, 1800)
  "core-sh-2": { x: HUB_X - SIDE, y: HUB_Y + GAP * 3 },       // (1335, 1950)

  // ── LEGS (west) ───────────────────────────────────────────────────
  "legs-1":    { x: HUB_X - GAP * 1, y: HUB_Y },               // 1350
  "legs-2":    { x: HUB_X - GAP * 2, y: HUB_Y },               // 1200
  "legs-3":    { x: HUB_X - GAP * 3, y: HUB_Y },               // 1050
  "legs-4":    { x: HUB_X - GAP * 4, y: HUB_Y },               //  900
  "legs-5":    { x: HUB_X - GAP * 5, y: HUB_Y },               //  750
  // Unilateral side branch (-SIDE north)
  "legs-uni-1":{ x: HUB_X - GAP * 3, y: HUB_Y - SIDE },       // (1050, 1335)
  "legs-uni-2":{ x: HUB_X - GAP * 4, y: HUB_Y - SIDE },       //  (900, 1335)
};

// Hub-to-branch edges (visual only, no lock state)
const HUB_EDGES: Array<{ toId: string; branch: SkillBranch }> = [
  { toId: "push-1", branch: "PUSH" },
  { toId: "pull-1", branch: "PULL" },
  { toId: "core-1", branch: "CORE" },
  { toId: "legs-1", branch: "LEGS" },
];

// Skill-to-skill edges (prerequisite connections)
const EDGES: [string, string][] = [
  // PUSH main
  ["push-1", "push-2"], ["push-2", "push-3"],
  ["push-3", "push-4"], ["push-4", "push-5"],
  // PUSH side
  ["push-1", "push-oh-1"], ["push-oh-1", "push-oh-2"],
  ["push-4", "push-hs"],
  // PULL shared
  ["pull-1", "pull-2"],
  // PULL 3-way fork
  ["pull-2", "pull-fl-1"], ["pull-2", "pull-mu-1"], ["pull-2", "pull-exp-1"],
  ["pull-fl-1", "pull-fl-2"], ["pull-fl-2", "pull-fl-3"],
  ["pull-mu-1", "pull-mu-2"], ["pull-mu-2", "pull-mu-3"],
  ["pull-exp-1", "pull-exp-2"],
  // CORE main
  ["core-1", "core-2"], ["core-2", "core-3"],
  ["core-3", "core-4"], ["core-4", "core-5"],
  // CORE side
  ["core-1", "core-sh-1"], ["core-sh-1", "core-sh-2"],
  // LEGS main
  ["legs-1", "legs-2"], ["legs-2", "legs-3"],
  ["legs-3", "legs-4"], ["legs-4", "legs-5"],
  // LEGS side
  ["legs-2", "legs-uni-1"], ["legs-uni-1", "legs-uni-2"],
];

// Section labels (positioned at branch tips + outward)
const SECTION_LABELS = [
  { x: HUB_X,            y: HUB_Y - GAP * 5 - 52, label: "PUSH", color: BRANCH_COLOR.PUSH, anchor: "middle" },
  { x: HUB_X + GAP * 5 + 64, y: HUB_Y,            label: "PULL", color: BRANCH_COLOR.PULL, anchor: "start" },
  { x: HUB_X,            y: HUB_Y + GAP * 5 + 56, label: "CORE", color: BRANCH_COLOR.CORE, anchor: "middle" },
  { x: HUB_X - GAP * 5 - 64, y: HUB_Y,            label: "LEGS", color: BRANCH_COLOR.LEGS, anchor: "end" },
];

// Sub-path labels
const PATH_LABELS = [
  { x: HUB_X + SIDE + 12, y: HUB_Y - GAP * 1.6,   text: "Overhead / HSPU", color: BRANCH_COLOR.PUSH },
  { x: HUB_X + GAP * 3,   y: HUB_Y - SIDE - 32,    text: "Front Lever",     color: BRANCH_COLOR.PULL },
  { x: HUB_X + GAP * 3,   y: HUB_Y - 32,            text: "Muscle-Up",      color: BRANCH_COLOR.PULL },
  { x: HUB_X + GAP * 3,   y: HUB_Y + SIDE + 22,     text: "Explosive",      color: BRANCH_COLOR.PULL },
  { x: HUB_X - SIDE - 12, y: HUB_Y + GAP * 1.6,    text: "Static Holds",   color: BRANCH_COLOR.CORE },
  { x: HUB_X - GAP * 3,   y: HUB_Y - SIDE - 32,    text: "Unilateral",     color: BRANCH_COLOR.LEGS },
];

// ─── Bezier path builder (direction-aware) ───────────────────────────────────

function makeBezier(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (absDx >= absDy) {
    // Primarily horizontal: exit right, arrive right
    cp1x = midX; cp1y = y1;
    cp2x = midX; cp2y = y2;
  } else {
    // Primarily vertical: exit downward/upward, arrive same
    cp1x = x1; cp1y = midY;
    cp2x = x2; cp2y = midY;
  }
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

// Compute the edge start/end offset from a node center in the direction of travel
function edgePoints(p1: { x: number; y: number }, p2: { x: number; y: number }, r1: number, r2: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  return {
    x1: p1.x + nx * (r1 + 2), y1: p1.y + ny * (r1 + 2),
    x2: p2.x - nx * (r2 + 2), y2: p2.y - ny * (r2 + 2),
  };
}

// ─── ConnectorPath ────────────────────────────────────────────────────────────

function ConnectorPath({
  fromPos, toPos, color, mastered, lit,
  fromR = NODE_R, toR = NODE_R,
}: {
  fromPos: { x: number; y: number };
  toPos:   { x: number; y: number };
  color: string;
  mastered: boolean;
  lit: boolean;
  fromR?: number;
  toR?: number;
}) {
  const { x1, y1, x2, y2 } = edgePoints(fromPos, toPos, fromR, toR);
  const d = makeBezier(x1, y1, x2, y2);

  if (mastered) {
    return (
      <g>
        <path d={d} fill="none" stroke={color}
          strokeWidth={lit ? 22 : 12} opacity={lit ? 0.22 : 0.06}
          strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s, opacity 0.15s" }} />
        <path d={d} fill="none" stroke={color}
          strokeWidth={lit ? 10 : 6}  opacity={lit ? 0.55 : 0.18}
          strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s, opacity 0.15s" }} />
        <path d={d} fill="none" stroke={color}
          strokeWidth={lit ? 3.5 : 2.5} opacity={lit ? 1 : 0.9}
          strokeLinecap="round"
          style={{ transition: "stroke-width 0.15s" }} />
      </g>
    );
  }

  return (
    <path d={d} fill="none"
      stroke={lit ? color : "#1e293b"}
      strokeWidth={lit ? 2 : 1.5}
      strokeDasharray="8 5"
      opacity={lit ? 0.55 : 0.9}
      strokeLinecap="round"
      style={{ transition: "stroke 0.15s, opacity 0.15s" }}
    />
  );
}

// ─── Hub visual ───────────────────────────────────────────────────────────────

function HubNode() {
  return (
    <g>
      {/* Animated pulse rings */}
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R + 22} fill="none"
        stroke="white" strokeWidth={1} opacity={0.04} />
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R + 12} fill="none"
        stroke="white" strokeWidth={1.5} opacity={0.08} />
      {/* Main circle */}
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R}
        fill="rgba(15,23,42,0.96)"
        stroke="white"
        strokeWidth={2}
        opacity={0.9}
      />
      {/* Shimmer */}
      <ellipse cx={HUB_X} cy={HUB_Y - HUB_R * 0.32}
        rx={HUB_R * 0.4} ry={HUB_R * 0.18}
        fill="white" opacity={0.1} />
      {/* Label */}
      <text x={HUB_X} y={HUB_Y - 3} textAnchor="middle"
        fontSize={7.5} fontWeight="800" fill="white" opacity={0.85}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.06em">
        CORE
      </text>
      <text x={HUB_X} y={HUB_Y + 8} textAnchor="middle"
        fontSize={7.5} fontWeight="800" fill="white" opacity={0.85}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.06em">
        STRENGTH
      </text>
    </g>
  );
}

// ─── SVG icon helpers ─────────────────────────────────────────────────────────

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

// ─── GlassNode ────────────────────────────────────────────────────────────────

function GlassNode({
  nodeId, skill, isHovered, showLabel, onClick, onHover,
}: {
  nodeId:    string;
  skill:     EvaluatedSkill;
  isHovered: boolean;
  showLabel: boolean;
  onClick:   (skill: EvaluatedSkill, e: React.MouseEvent) => void;
  onHover:   (id: string | null) => void;
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

  const RING_R = NODE_R + 8;
  const CIRC   = 2 * Math.PI * RING_R;

  const shortTitle = skill.title.length > 13 ? skill.title.slice(0, 12) + "…" : skill.title;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(skill, e); }}
      onMouseEnter={() => onHover(nodeId)}
      onMouseLeave={() => onHover(null)}
      style={{
        cursor: "pointer",
        transformOrigin: `${x}px ${y}px`,
        transform: isHovered ? "scale(1.12)" : "scale(1)",
        transition: "transform 0.14s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      role="button"
      aria-label={skill.title}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(skill, e as unknown as React.MouseEvent);
      }}
    >
      {/* Touch target */}
      <circle cx={x} cy={y} r={HIT_R} fill="transparent" />

      {/* Hover pulse ring */}
      {isHovered && (
        <circle cx={x} cy={y} r={NODE_R + 20} fill="none"
          stroke={isMastered ? GOLD : color} strokeWidth={1.5} opacity={0.25} />
      )}

      {/* Mastered glow rings */}
      {isMastered && (
        <>
          <circle cx={x} cy={y} r={NODE_R + 14} fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2 : 1} opacity={isHovered ? 0.3 : 0.12} />
          <circle cx={x} cy={y} r={NODE_R + 7}  fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2.5 : 1.5} opacity={isHovered ? 0.65 : 0.35} />
        </>
      )}

      {/* Progress ring (unlocked) */}
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
        strokeWidth={
          isMastered ? (isHovered ? 3 : 2)
          : isLocked  ? 1.5
          : (isHovered ? 3.5 : 2.5)
        }
        opacity={isLocked ? 0.5 : 1}
      />

      {/* Highlight shimmer */}
      {!isLocked && (
        <ellipse
          cx={x} cy={y - NODE_R * 0.3}
          rx={NODE_R * 0.44} ry={NODE_R * 0.2}
          fill="white" opacity={isHovered ? 0.14 : 0.07}
        />
      )}

      {/* Status icon */}
      {isMastered && <StarShape cx={x} cy={y} />}
      {isLocked    && <LockShape cx={x} cy={y} />}
      {isUnlocked  && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontWeight="800" fill={color}
          fontFamily="ui-monospace, monospace">
          L{skill.level}
        </text>
      )}

      {/* Progress % badge — shown even at low zoom when unlocked */}
      {isUnlocked && pct > 0 && !showLabel && (
        <text x={x} y={y + NODE_R + 11} textAnchor="middle"
          fontSize={7} fill={color} opacity={0.75} fontFamily="ui-monospace, monospace">
          {Math.round(pct * 100)}%
        </text>
      )}

      {/* Label — only when zoomed in enough */}
      {showLabel && (
        <text x={x} y={y + NODE_R + 13} textAnchor="middle"
          fontSize={8}
          fill={isLocked ? "#374151" : isHovered ? (isMastered ? GOLD : color) : "#9ca3af"}
          fontWeight={isUnlocked || isHovered ? "600" : "400"}
          fontFamily="ui-sans-serif, system-ui, sans-serif">
          {shortTitle}
        </text>
      )}
    </g>
  );
}

// ─── Skill Overlay (Framer Motion) ───────────────────────────────────────────

const OVERLAY_W = 252;

function SkillOverlay({
  skill, screenX, screenY, containerW, containerH, color, onClose,
}: {
  skill:      EvaluatedSkill;
  screenX:    number; screenY:    number;
  containerW: number; containerH: number;
  color:      string;
  onClose:    () => void;
}) {
  const OVERLAY_H_EST = 340;
  let left = screenX + 48;
  if (left + OVERLAY_W > containerW - 8) left = screenX - OVERLAY_W - 28;
  left = Math.max(8, left);
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
    <motion.div
      key={skill.id}
      initial={{ scale: 0.82, opacity: 0, y: 12 }}
      animate={{ scale: 1,    opacity: 1, y: 0 }}
      exit={{    scale: 0.82, opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      style={{
        position:  "absolute",
        left, top,
        width:     OVERLAY_W,
        zIndex:    60,
        boxShadow: isLocked
          ? "0 0 32px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.6)"
          : `0 0 32px ${color}30, 0 0 10px ${color}14, 0 6px 28px rgba(0,0,0,0.8)`,
      }}
      className="bg-zinc-900/97 border border-zinc-700/60 rounded-2xl p-4 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isLocked ? "#4b5563" : color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider truncate"
            style={{ color: isLocked ? "#6b7280" : color }}>
            Level {skill.level} · {skill.levelName}
          </span>
        </div>
        <button onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none shrink-0 w-6 h-6 flex items-center justify-center">
          ×
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
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

      {/* Title */}
      <p className="font-bold text-sm text-white mb-0.5 leading-tight">{skill.title}</p>
      {skill.pathLabel && (
        <p className="text-[10px] text-zinc-500 mb-2">{skill.pathLabel}</p>
      )}

      {/* "Why train this?" */}
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
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${masteryPct}%`, backgroundColor: isMastered ? GOLD : color }} />
          </div>
          <p className="text-[9px] text-zinc-600 mt-1">{req.description}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {prog.qualifyingSessions}/{req.minQualifyingSessions} qualifying sessions
          </p>
        </div>
      )}

      {/* Stats */}
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

      {/* Locked prerequisite */}
      {isLocked && prereqNode && (
        <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-3 py-2 mb-3">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wide mb-0.5">Requires</p>
          <p className="text-[11px] font-semibold text-zinc-300">{prereqNode.title}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">{prereqNode.masteryRequirement.description}</p>
        </div>
      )}

      {/* CTA button */}
      {!isLocked && (
        <Link href={workoutUrl}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: isMastered ? "#d97706" : color }}
          >
            {isMastered ? "Practice Again →" : "Train Now →"}
          </button>
        </Link>
      )}
    </motion.div>
  );
}

// ─── TreeCanvas ───────────────────────────────────────────────────────────────

interface OverlayState {
  skill:   EvaluatedSkill;
  screenX: number;
  screenY: number;
}

function TreeCanvas({ evaluated }: { evaluated: EvaluatedSkill[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan,  setPan]         = useState({ x: 0, y: 0 });
  const [zoom, setZoom]        = useState(0.52);
  const [overlay, setOverlay]  = useState<OverlayState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 900, h: 560 });

  const isPanning     = useRef(false);
  const lastPos       = useRef({ x: 0, y: 0 });
  const didDrag       = useRef(false);
  const downPos       = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const zoomRef       = useRef(zoom);
  zoomRef.current     = zoom;
  const panRef        = useRef(pan);
  panRef.current      = pan;

  const skillMap = useMemo(() => {
    const m = new Map<string, EvaluatedSkill>();
    for (const s of evaluated) m.set(s.id, s);
    return m;
  }, [evaluated]);

  // First in-progress skill (for auto-center)
  const inProgressId = useMemo(() => {
    const order = [...EDGES.map(([a]) => a), ...EDGES.map(([, b]) => b)];
    const unique = [...new Set(order)];
    return unique.find((id) => skillMap.get(id)?.status === "unlocked") ?? null;
  }, [skillMap]);

  // Center view on a given SVG point
  const centerOn = useCallback((svgX: number, svgY: number, targetZoom?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const z = targetZoom ?? zoomRef.current;
    setPan({
      x: width  / 2 - svgX * z,
      y: height / 2 - svgY * z,
    });
    if (targetZoom !== undefined) setZoom(targetZoom);
  }, []);

  // Initial view — fit entire tree centered on hub
  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setContainerSize({ w: width, h: height });
    const TREE_SPAN = 1620; // bounding span of radial tree
    const z = Math.min(0.72, (Math.min(width, height) - 60) / TREE_SPAN);
    centerOn(HUB_X, HUB_Y, z);
  }, [centerOn]);

  useEffect(() => {
    const t = setTimeout(resetView, 80);
    return () => clearTimeout(t);
  }, [resetView]);

  // Auto-center on first in-progress skill
  const autoCenter = useCallback(() => {
    if (!inProgressId) { resetView(); return; }
    const pos = NODE_POS[inProgressId];
    if (!pos) { resetView(); return; }
    centerOn(pos.x, pos.y, Math.max(zoomRef.current, 0.7));
  }, [inProgressId, centerOn, resetView]);

  // Non-passive wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // Zoom toward cursor position
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => {
        const newZ = Math.max(0.22, Math.min(4, z * factor));
        // Adjust pan so zoom anchors at cursor
        setPan((p) => ({
          x: mouseX - (mouseX - p.x) * (newZ / z),
          y: mouseY - (mouseY - p.y) * (newZ / z),
        }));
        return newZ;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Pinch-to-zoom (non-passive touch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastPinchDist.current !== null) {
        const factor = dist / lastPinchDist.current;
        setZoom((z) => Math.max(0.22, Math.min(4, z * factor)));
      }
      lastPinchDist.current = dist;
    };
    const onEnd = () => { lastPinchDist.current = null; };
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend",  onEnd,  { passive: true });
    return () => {
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend",  onEnd);
    };
  }, []);

  // Pointer drag pan
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

  function onPointerUp() { isPanning.current = false; }

  // Node click → open overlay
  function handleNodeClick(skill: EvaluatedSkill, _e: React.MouseEvent) {
    if (didDrag.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = NODE_POS[skill.id];
    if (!pos) return;
    setContainerSize({ w: rect.width, h: rect.height });
    setOverlay({
      skill,
      screenX: pos.x * zoom + pan.x,
      screenY: pos.y * zoom + pan.y,
    });
  }

  const showLabel = zoom >= 0.48;
  const overlayColor = overlay ? nodeColor(overlay.skill.id) : "#6b7280";

  return (
    <div className="relative" style={{ height: "calc(100vh - 210px)", minHeight: 430 }}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5">
        <button
          onClick={autoCenter}
          className="w-8 h-8 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Auto-center on in-progress skill"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
          className="w-8 h-8 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.22, z * 0.8))}
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

      {/* SVG canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden rounded-2xl border border-border/30 bg-zinc-950/80"
        style={{ cursor: isPanning.current ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          width="100%" height="100%"
          style={{
            filter: overlay ? "blur(1.5px)" : "none",
            transition: "filter 0.22s ease",
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* ── Hub spoke lines (behind everything) ── */}
            {HUB_EDGES.map(({ toId, branch }) => {
              const toPos = NODE_POS[toId];
              if (!toPos) return null;
              const fromSkill = skillMap.get(toId);
              const mastered = fromSkill?.status === "mastered";
              const lit = hoveredId === toId;
              return (
                <ConnectorPath
                  key={`hub-${toId}`}
                  fromPos={{ x: HUB_X, y: HUB_Y }}
                  toPos={toPos}
                  color={BRANCH_COLOR[branch]}
                  mastered={mastered}
                  lit={lit}
                  fromR={HUB_R}
                />
              );
            })}

            {/* ── Skill edges ── */}
            {EDGES.map(([fromId, toId]) => {
              const fromPos = NODE_POS[fromId];
              const toPos   = NODE_POS[toId];
              if (!fromPos || !toPos) return null;
              const fromSkill = skillMap.get(fromId);
              const mastered = fromSkill?.status === "mastered";
              const lit = hoveredId === fromId || hoveredId === toId;
              return (
                <ConnectorPath
                  key={`${fromId}-${toId}`}
                  fromPos={fromPos}
                  toPos={toPos}
                  color={nodeColor(fromId)}
                  mastered={mastered}
                  lit={lit}
                />
              );
            })}

            {/* ── Hub ── */}
            <HubNode />

            {/* ── Section labels ── */}
            {SECTION_LABELS.map(({ x, y, label, color, anchor }) => (
              <text key={label} x={x} y={y} textAnchor={anchor as "middle" | "start" | "end"}
                dominantBaseline="central"
                fontSize={13} fontWeight="800" fill={color}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                letterSpacing="0.1em" opacity={0.88}>
                {label}
              </text>
            ))}

            {/* ── Path sub-labels (only when zoomed in) ── */}
            {showLabel && PATH_LABELS.map(({ x, y, text, color }) => (
              <text key={text} x={x} y={y} textAnchor="middle"
                fontSize={8} fill={color} opacity={0.55}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontStyle="italic">
                {text}
              </text>
            ))}

            {/* ── Skill nodes ── */}
            {Object.keys(NODE_POS).map((nodeId) => {
              const skill = skillMap.get(nodeId);
              if (!skill) return null;
              return (
                <GlassNode
                  key={nodeId}
                  nodeId={nodeId}
                  skill={skill}
                  isHovered={hoveredId === nodeId}
                  showLabel={showLabel}
                  onClick={handleNodeClick}
                  onHover={setHoveredId}
                />
              );
            })}
          </g>
        </svg>

        {/* ── Overlay with AnimatePresence for mount/unmount ── */}
        <AnimatePresence>
          {overlay && (
            <SkillOverlay
              key={overlay.skill.id}
              skill={overlay.skill}
              screenX={overlay.screenX}
              screenY={overlay.screenY}
              containerW={containerSize.w}
              containerH={containerSize.h}
              color={overlayColor}
              onClose={() => setOverlay(null)}
            />
          )}
        </AnimatePresence>

        {/* Hint */}
        <p className="absolute bottom-3 left-3 text-[10px] text-zinc-600 pointer-events-none select-none">
          Drag to pan · Scroll or pinch to zoom · Tap node for details · {
            zoom < 0.48 ? "Zoom in to see labels" : "Tap ✛ to snap to active skill"
          }
        </p>
      </div>
    </div>
  );
}

// ─── Equipment Specialty (unchanged below the tree) ───────────────────────────

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
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-5 z-0"
          style={{ backgroundColor: isMastered ? spec.color : "hsl(var(--border))" }} />
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
    for (const branch of ["PUSH", "PULL"] as SkillBranch[]) {
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
            Parallel paths that unlock after mastering foundational movements.
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skill Tree</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Four branches radiate from your Core Strength hub. Tap any node · drag to explore · pinch to zoom.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {totalMastered}
              <span className="text-muted-foreground text-base font-normal">/{TOTAL_SKILL_COUNT}</span>
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
        {[
          { color: BRANCH_COLOR.PUSH, label: "Push" },
          { color: BRANCH_COLOR.PULL, label: "Pull" },
          { color: BRANCH_COLOR.CORE, label: "Core" },
          { color: BRANCH_COLOR.LEGS, label: "Legs" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
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
          <Lock className="w-3 h-3 text-zinc-600" />
          Locked
        </span>
      </div>

      {/* Tree */}
      {isLoading || !evaluated ? (
        <Skeleton className="w-full rounded-2xl" style={{ height: "calc(100vh - 210px)", minHeight: 430 }} />
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
