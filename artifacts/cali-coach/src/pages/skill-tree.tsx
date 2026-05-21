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
import { useTranslation } from "react-i18next";
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
  Star, Lock, ZoomIn, ZoomOut, Maximize2, Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MasteryRequirement } from "@/lib/skill-tree";

// ─── i18n helpers ─────────────────────────────────────────────────────────────

const PATH_LABEL_I18N: Record<string, string> = {
  "Overhead Path":                  "skillTree.pathLabel.overhead",
  "Planche Path":                   "skillTree.pathLabel.planche",
  "Front Lever Path":               "skillTree.pathLabel.frontLever",
  "Muscle-Up Path":                 "skillTree.pathLabel.muscleUp",
  "Advanced Moves Path":            "skillTree.pathLabel.advancedMoves",
  "Hollow Holds Path":              "skillTree.pathLabel.hollowHolds",
  "Bar Based Path":                 "skillTree.pathLabel.barBased",
  "Human Flag Path":                "skillTree.pathLabel.humanFlag",
  "L-Sit Path":                     "skillTree.pathLabel.lSit",
  "Pistol Squat Path":              "skillTree.pathLabel.pistolSquat",
  "One-Arm Path":                   "skillTree.pathLabel.oneArm",
  "Rings Specialist":               "skillTree.pathLabel.ringsSpecialist",
  "Weighted Specialist":            "skillTree.pathLabel.weightedSpecialist",
  "Weighted Core Specialist":       "skillTree.pathLabel.weightedCoreSpecialist",
  "Power & Instability Specialist": "skillTree.pathLabel.powerInstability",
  "Weighted Legs Specialist":       "skillTree.pathLabel.weightedLegs",
};

function translateReq(
  req: MasteryRequirement,
  t: (key: string, opts?: Record<string, number>) => string,
): string {
  const { minReps, minFormScore, minQualifyingSessions, description } = req;
  const lower = description.toLowerCase();
  const opts = { reps: minReps, form: minFormScore, sessions: minQualifyingSessions };
  if (lower.startsWith("hold") && lower.includes("per side")) {
    return t("skillTree.req.holdSide", opts);
  }
  if (lower.startsWith("hold")) {
    return t("skillTree.req.hold", opts);
  }
  if (lower.includes("steps per side")) {
    return t("skillTree.req.completeSteps", opts);
  }
  if (lower.includes("per side")) {
    return t("skillTree.req.completeSide", opts);
  }
  return t("skillTree.req.complete", opts);
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_R   = 28;
const HUB_R    = 38;
const GAP      = 150;    // pixels between each level
const SIDE     = 165;    // side-branch offset (perpendicular)
const HUB_X    = 1500;
const HUB_Y    = 1500;
const GOLD     = "#177548";
const MUTED    = "#9ca3af";
const HIT_R    = NODE_R + 20;  // 48px+ touch/mouse target

const BRANCH_COLOR: Record<SkillBranch, string> = {
  PUSH: "#1a1a1a",
  PULL: "#1a1a1a",
  CORE: "#1a1a1a",
  LEGS: "#1a1a1a",
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
  "push-f1":   { x: HUB_X,           y: HUB_Y - 75 },            // (1500, 1425) Foundation
  "push-1":    { x: HUB_X,           y: HUB_Y - GAP },           // (1500, 1350)
  "push-2":    { x: HUB_X,           y: HUB_Y - GAP * 2 },       // (1500, 1200)
  "push-3":    { x: HUB_X,           y: HUB_Y - GAP * 3 },       // (1500, 1050)
  "push-4":    { x: HUB_X,           y: HUB_Y - GAP * 4 },       // (1500,  900)
  "push-5":    { x: HUB_X,           y: HUB_Y - GAP * 5 },       // (1500,  750)
  // Overhead path (+SIDE east, from push-2)
  "push-oh-1": { x: HUB_X + SIDE,     y: HUB_Y - GAP * 2 },     // (1665, 1200)
  "push-oh-2": { x: HUB_X + SIDE,     y: HUB_Y - GAP * 3 },     // (1665, 1050)
  "push-oh-3": { x: HUB_X + SIDE,     y: HUB_Y - GAP * 4 },     // (1665,  900)
  "push-oh-4": { x: HUB_X + SIDE,     y: HUB_Y - GAP * 5 },     // (1665,  750)
  "push-oh-5": { x: HUB_X + SIDE,     y: HUB_Y - GAP * 6 },     // (1665,  600)
  // Planche path (+SIDE*2 east, from push-3)
  "push-pp-1": { x: HUB_X + SIDE * 2, y: HUB_Y - GAP * 3 },     // (1830, 1050)
  "push-pp-2": { x: HUB_X + SIDE * 2, y: HUB_Y - GAP * 4 },     // (1830,  900)
  "push-pp-3": { x: HUB_X + SIDE * 2, y: HUB_Y - GAP * 5 },     // (1830,  750)
  "push-pp-4": { x: HUB_X + SIDE * 2, y: HUB_Y - GAP * 6 },     // (1830,  600)

  // ── PULL (east) ───────────────────────────────────────────────────
  "pull-f1":   { x: HUB_X + 75,       y: HUB_Y },                 // (1575, 1500) Foundation
  "pull-1":    { x: HUB_X + GAP,      y: HUB_Y },                 // (1650, 1500)
  "pull-2":    { x: HUB_X + GAP * 2,  y: HUB_Y },                 // (1800, 1500)
  "pull-3":    { x: HUB_X + GAP * 3,  y: HUB_Y },                 // (1950, 1500)
  // Front Lever (upper lane -SIDE, from pull-2)
  "pull-fl-1": { x: HUB_X + GAP * 3,  y: HUB_Y - SIDE },         // (1950, 1335)
  "pull-fl-2": { x: HUB_X + GAP * 4,  y: HUB_Y - SIDE },         // (2100, 1335)
  "pull-fl-3": { x: HUB_X + GAP * 5,  y: HUB_Y - SIDE },         // (2250, 1335)
  // Muscle-Up (center, from pull-3)
  "pull-mu-1": { x: HUB_X + GAP * 4,  y: HUB_Y },                 // (2100, 1500)
  "pull-mu-2": { x: HUB_X + GAP * 5,  y: HUB_Y },                 // (2250, 1500)
  "pull-mu-3": { x: HUB_X + GAP * 6,  y: HUB_Y },                 // (2400, 1500)
  // Advanced Moves (lower lane +SIDE, from pull-mu-1)
  "pull-am-1": { x: HUB_X + GAP * 5,  y: HUB_Y + SIDE },         // (2250, 1665)
  "pull-am-2": { x: HUB_X + GAP * 6,  y: HUB_Y + SIDE },         // (2400, 1665)
  // One-Arm Path (second lower lane +SIDE*2, from pull-3)
  "pull-oah-1":  { x: HUB_X + GAP * 4, y: HUB_Y + SIDE * 2 },   // (2100, 1830)
  "pull-oapu-1": { x: HUB_X + GAP * 5, y: HUB_Y + SIDE * 2 },   // (2250, 1830)

  // ── CORE (south) ──────────────────────────────────────────────────
  "core-f1":   { x: HUB_X,            y: HUB_Y + 75 },            // (1500, 1575) Foundation
  "core-1":    { x: HUB_X,            y: HUB_Y + GAP },           // (1500, 1650)
  "core-2":    { x: HUB_X,            y: HUB_Y + GAP * 2 },       // (1500, 1800)
  // Hollow Holds (-SIDE west, branches directly from core-1; Dead Bug lives in Foundation)
  "core-hh-2": { x: HUB_X - SIDE * 2, y: HUB_Y + GAP },         // (1170, 1650) Superman side
  "core-hh-3": { x: HUB_X - SIDE,     y: HUB_Y + GAP },         // (1335, 1650) Hollow Body Hold
  "core-hh-4": { x: HUB_X - SIDE,     y: HUB_Y + GAP * 2 },     // (1335, 1800)
  "core-hh-5": { x: HUB_X - SIDE,     y: HUB_Y + GAP * 3 },     // (1335, 1950)
  // Bar Based (+SIDE east, from core-1 & core-2)
  "core-bb-1": { x: HUB_X + SIDE,     y: HUB_Y + GAP },          // (1665, 1650)
  "core-bb-2": { x: HUB_X + SIDE * 2, y: HUB_Y + GAP },          // (1830, 1650)
  "core-bb-3": { x: HUB_X + SIDE,     y: HUB_Y + GAP * 2 },     // (1665, 1800)
  "core-bb-4": { x: HUB_X + SIDE,     y: HUB_Y + GAP * 3 },     // (1665, 1950)
  // Human Flag (+SIDE*2 east, from core-2)
  "core-hf-1": { x: HUB_X + SIDE * 2, y: HUB_Y + GAP * 2 },     // (1830, 1800)
  "core-hf-2": { x: HUB_X + SIDE * 2, y: HUB_Y + GAP * 3 },     // (1830, 1950)
  "core-hf-3": { x: HUB_X + SIDE * 2, y: HUB_Y + GAP * 4 },     // (1830, 2100)
  "core-hf-4": { x: HUB_X + SIDE * 2, y: HUB_Y + GAP * 5 },     // (1830, 2250)

  // ── LEGS (west) ───────────────────────────────────────────────────
  "legs-f1":   { x: HUB_X - 75,       y: HUB_Y },                 // (1425, 1500) Foundation
  "legs-1":    { x: HUB_X - GAP,      y: HUB_Y },                 // (1350, 1500)
  "legs-2":    { x: HUB_X - GAP * 2,  y: HUB_Y },                 // (1200, 1500)
  "legs-3":    { x: HUB_X - GAP * 3,  y: HUB_Y },                 // (1050, 1500)
  "legs-4":    { x: HUB_X - GAP * 4,  y: HUB_Y },                 //  (900, 1500)
  // L-Sit (upper lane -SIDE, from legs-2)
  "legs-ls-1": { x: HUB_X - GAP * 2,  y: HUB_Y - SIDE },         // (1200, 1335)
  "legs-ls-2": { x: HUB_X - GAP * 3,  y: HUB_Y - SIDE },         // (1050, 1335)
  "legs-ls-3": { x: HUB_X - GAP * 4,  y: HUB_Y - SIDE },         //  (900, 1335)
  "legs-ls-4": { x: HUB_X - GAP * 5,  y: HUB_Y - SIDE },         //  (750, 1335)
  // Pistol Squat (lower lane +SIDE, from legs-2)
  "legs-ps-1": { x: HUB_X - GAP * 2,  y: HUB_Y + SIDE },         // (1200, 1665)
  "legs-ps-2": { x: HUB_X - GAP * 3,  y: HUB_Y + SIDE },         // (1050, 1665)
  "legs-ps-3": { x: HUB_X - GAP * 4,  y: HUB_Y + SIDE },         //  (900, 1665)
  "legs-ps-4": { x: HUB_X - GAP * 5,  y: HUB_Y + SIDE },         //  (750, 1665)
};

// Hub-to-branch edges (visual only, no lock state)
const HUB_EDGES: Array<{ toId: string; branch: SkillBranch }> = [
  { toId: "push-f1", branch: "PUSH" },
  { toId: "pull-f1", branch: "PULL" },
  { toId: "core-f1", branch: "CORE" },
  { toId: "legs-f1", branch: "LEGS" },
];

// Skill-to-skill edges (prerequisite connections)
const EDGES: [string, string][] = [
  // PUSH foundation → main
  ["push-f1", "push-1"],
  // PUSH main
  ["push-1", "push-2"], ["push-2", "push-3"],
  ["push-3", "push-4"], ["push-4", "push-5"],
  // PUSH overhead (from push-2)
  ["push-2", "push-oh-1"], ["push-oh-1", "push-oh-2"],
  ["push-oh-2", "push-oh-3"], ["push-oh-3", "push-oh-4"],
  ["push-oh-4", "push-oh-5"],
  // PUSH planche (from push-3)
  ["push-3", "push-pp-1"], ["push-pp-1", "push-pp-2"],
  ["push-pp-2", "push-pp-3"], ["push-pp-3", "push-pp-4"],
  // PULL foundation → shared
  ["pull-f1", "pull-1"],
  // PULL shared
  ["pull-1", "pull-2"], ["pull-2", "pull-3"],
  // PULL front lever (from pull-2)
  ["pull-2", "pull-fl-1"], ["pull-fl-1", "pull-fl-2"], ["pull-fl-2", "pull-fl-3"],
  // PULL muscle-up (from pull-3)
  ["pull-3", "pull-mu-1"], ["pull-mu-1", "pull-mu-2"], ["pull-mu-2", "pull-mu-3"],
  // PULL advanced moves (from pull-mu-1)
  ["pull-mu-1", "pull-am-1"], ["pull-am-1", "pull-am-2"],
  // PULL one-arm path (from pull-3)
  ["pull-3", "pull-oah-1"], ["pull-oah-1", "pull-oapu-1"],
  // CORE foundation → main
  ["core-f1", "core-1"],
  // CORE main
  ["core-1", "core-2"],
  // CORE hollow holds (Dead Bug lives in Foundation; Superman + HBH branch directly from core-1)
  ["core-1", "core-hh-2"], ["core-1", "core-hh-3"],
  ["core-hh-3", "core-hh-4"], ["core-hh-4", "core-hh-5"],
  // CORE bar based (from core-1 and core-2)
  ["core-1", "core-bb-1"], ["core-1", "core-bb-2"],
  ["core-2", "core-bb-3"], ["core-bb-3", "core-bb-4"],
  // CORE human flag (from core-2)
  ["core-2", "core-hf-1"], ["core-hf-1", "core-hf-2"],
  ["core-hf-2", "core-hf-3"], ["core-hf-3", "core-hf-4"],
  // LEGS foundation → main
  ["legs-f1", "legs-1"],
  // LEGS main
  ["legs-1", "legs-2"], ["legs-2", "legs-3"], ["legs-3", "legs-4"],
  // LEGS l-sit (from legs-2)
  ["legs-2", "legs-ls-1"], ["legs-ls-1", "legs-ls-2"],
  ["legs-ls-2", "legs-ls-3"], ["legs-ls-3", "legs-ls-4"],
  // LEGS pistol squat (from legs-2)
  ["legs-2", "legs-ps-1"], ["legs-ps-1", "legs-ps-2"],
  ["legs-ps-2", "legs-ps-3"], ["legs-ps-3", "legs-ps-4"],
];

// Section labels (positioned at branch tips + outward) — label field holds i18n key
const SECTION_LABELS = [
  { x: HUB_X,                y: HUB_Y - GAP * 5 - 52,  label: "skillTree.push", color: BRANCH_COLOR.PUSH, anchor: "middle" },
  { x: HUB_X + GAP * 6 + 64, y: HUB_Y,                 label: "skillTree.pull", color: BRANCH_COLOR.PULL, anchor: "start" },
  { x: HUB_X,                y: HUB_Y + GAP * 5 + 56,  label: "skillTree.core", color: BRANCH_COLOR.CORE, anchor: "middle" },
  { x: HUB_X - GAP * 5 - 64, y: HUB_Y,                 label: "skillTree.legs", color: BRANCH_COLOR.LEGS, anchor: "end" },
];

// Sub-path labels — text field holds i18n key
const PATH_LABELS = [
  { x: HUB_X + SIDE + 14,     y: HUB_Y - GAP * 1.5,    text: "skillTree.svgPath.overhead",    color: BRANCH_COLOR.PUSH },
  { x: HUB_X + SIDE * 2 + 14, y: HUB_Y - GAP * 2.4,    text: "skillTree.svgPath.planche",     color: BRANCH_COLOR.PUSH },
  { x: HUB_X + GAP * 3,       y: HUB_Y - SIDE - 32,     text: "skillTree.svgPath.frontLever",  color: BRANCH_COLOR.PULL },
  { x: HUB_X + GAP * 4,       y: HUB_Y - 32,            text: "skillTree.svgPath.muscleUp",    color: BRANCH_COLOR.PULL },
  { x: HUB_X + GAP * 5,       y: HUB_Y + SIDE + 22,     text: "skillTree.svgPath.advanced",    color: BRANCH_COLOR.PULL },
  { x: HUB_X + GAP * 4.5,     y: HUB_Y + SIDE * 2 + 22, text: "skillTree.svgPath.oneArm",      color: BRANCH_COLOR.PULL },
  { x: HUB_X - SIDE - 14,     y: HUB_Y + GAP * 0.55,   text: "skillTree.svgPath.hollowHolds", color: BRANCH_COLOR.CORE },
  { x: HUB_X + SIDE + 14,     y: HUB_Y + GAP * 0.55,   text: "skillTree.svgPath.barBased",    color: BRANCH_COLOR.CORE },
  { x: HUB_X + SIDE * 2 + 14, y: HUB_Y + GAP * 1.6,    text: "skillTree.svgPath.humanFlag",   color: BRANCH_COLOR.CORE },
  { x: HUB_X - GAP * 2,       y: HUB_Y - SIDE - 32,    text: "skillTree.svgPath.lSit",        color: BRANCH_COLOR.LEGS },
  { x: HUB_X - GAP * 2,       y: HUB_Y + SIDE + 22,    text: "skillTree.svgPath.pistolSquat", color: BRANCH_COLOR.LEGS },
];

// ─── Equipment Specialty Node Positions ──────────────────────────────────────
// Equipment nodes branch off their bodyweight prerequisites:
//   PULL branch (→ east): equipment paths fan SOUTH from pull-2
//   PUSH branch (↑ north): equipment paths fan WEST from push-3

const EQUIPMENT_NODE_POS: Record<string, { x: number; y: number }> = {
  // ── PULL — Rings Specialist (south of OAH lane, y + SIDE*3) ──────────────
  "pull-rings-1":    { x: HUB_X + GAP * 2, y: HUB_Y + SIDE * 3 },  // (1800, 1995)
  "pull-rings-2":    { x: HUB_X + GAP * 3, y: HUB_Y + SIDE * 3 },  // (1950, 1995)
  "pull-rings-3":    { x: HUB_X + GAP * 4, y: HUB_Y + SIDE * 3 },  // (2100, 1995)
  // ── PULL — Weighted Specialist (south of rings lane, y + SIDE*4) ─────────
  "pull-weighted-1": { x: HUB_X + GAP * 2, y: HUB_Y + SIDE * 4 },  // (1800, 2160)
  "pull-weighted-2": { x: HUB_X + GAP * 3, y: HUB_Y + SIDE * 4 },  // (1950, 2160)
  "pull-weighted-3": { x: HUB_X + GAP * 4, y: HUB_Y + SIDE * 4 },  // (2100, 2160)
  // ── PUSH — Rings Specialist (west of push-branch, x - SIDE) ──────────────
  "push-rings-1":    { x: HUB_X - SIDE,     y: HUB_Y - GAP * 3 },  // (1335, 1050)
  "push-rings-2":    { x: HUB_X - SIDE,     y: HUB_Y - GAP * 4 },  // (1335,  900)
  // ── PUSH — Weighted Specialist (further west, x - SIDE*2) ────────────────
  "push-weighted-1": { x: HUB_X - SIDE * 2, y: HUB_Y - GAP * 3 },  // (1170, 1050)
  // ── CORE — Weighted/Rings Specialist (east column at x + SIDE*3) ─────────
  "core-weighted-1": { x: HUB_X + SIDE * 3, y: HUB_Y + GAP },      // (1995, 1650)
  "core-rings-1":    { x: HUB_X + SIDE * 3, y: HUB_Y + GAP * 2 },  // (1995, 1800)
  "core-weighted-2": { x: HUB_X + SIDE * 3, y: HUB_Y + GAP * 3 },  // (1995, 1950)
  "core-weighted-3": { x: HUB_X + SIDE * 3, y: HUB_Y + GAP * 4 },  // (1995, 2100)
  // ── CORE — Power/Instability Specialist (east-2 column at x + SIDE*4) ────
  "core-roller-1":   { x: HUB_X + SIDE * 4, y: HUB_Y + GAP },      // (2160, 1650)
  "core-band-1":     { x: HUB_X + SIDE * 4, y: HUB_Y + GAP * 2 },  // (2160, 1800)
  "core-rings-2":    { x: HUB_X + SIDE * 4, y: HUB_Y + GAP * 3 },  // (2160, 1950)
  // ── LEGS — Weighted Specialist (south row at y + SIDE*2) ─────────────────
  "legs-weighted-1": { x: HUB_X - GAP,      y: HUB_Y + SIDE * 2 }, // (1350, 1830)
  "legs-weighted-2": { x: HUB_X - GAP * 2,  y: HUB_Y + SIDE * 2 }, // (1200, 1830)
  "legs-weighted-3": { x: HUB_X - GAP * 3,  y: HUB_Y + SIDE * 2 }, // (1050, 1830)
  "legs-weighted-4": { x: HUB_X - GAP * 4,  y: HUB_Y + SIDE * 2 }, //  (900, 1830)
  // ── LEGS — Power/Instability Specialist (south-2 row at y + SIDE*3) ──────
  "legs-band-1":     { x: HUB_X - GAP,      y: HUB_Y + SIDE * 3 }, // (1350, 1995)
  "legs-box-1":      { x: HUB_X - GAP * 2,  y: HUB_Y + SIDE * 3 }, // (1200, 1995)
  "legs-sliders-1":  { x: HUB_X - GAP * 3,  y: HUB_Y + SIDE * 3 }, // (1050, 1995)
};

// Equipment edges follow the prerequisite chain defined in skill-tree.ts
const EQUIPMENT_EDGES: Array<[string, string]> = [
  // PULL rings (from pull-2)
  ["pull-2", "pull-rings-1"], ["pull-rings-1", "pull-rings-2"], ["pull-rings-2", "pull-rings-3"],
  // PULL weighted (from pull-2)
  ["pull-2", "pull-weighted-1"], ["pull-weighted-1", "pull-weighted-2"], ["pull-weighted-2", "pull-weighted-3"],
  // PUSH rings (from push-3)
  ["push-3", "push-rings-1"], ["push-rings-1", "push-rings-2"],
  // PUSH weighted (from push-3)
  ["push-3", "push-weighted-1"],
  // CORE weighted/rings (from core-1)
  ["core-1", "core-weighted-1"], ["core-weighted-1", "core-rings-1"],
  ["core-rings-1", "core-weighted-2"], ["core-weighted-2", "core-weighted-3"],
  // CORE power/instability (from core-1)
  ["core-1", "core-roller-1"], ["core-roller-1", "core-band-1"], ["core-band-1", "core-rings-2"],
  // LEGS weighted (from legs-1)
  ["legs-1", "legs-weighted-1"], ["legs-weighted-1", "legs-weighted-2"],
  ["legs-weighted-2", "legs-weighted-3"], ["legs-weighted-3", "legs-weighted-4"],
  // LEGS power/instability (from legs-1)
  ["legs-1", "legs-band-1"], ["legs-band-1", "legs-box-1"], ["legs-box-1", "legs-sliders-1"],
];

// Equipment tag → color (matches EQUIPMENT_SPECIALTIES exported from skill-tree.ts)
const EQUIPMENT_COLORS: Record<string, string> = {
  rings:    "#06b6d4",
  weighted: "#a855f7",
  roller:   "#f97316",
  band:     "#ec4899",
  box:      "#84cc16",
  sliders:  "#f43f5e",
};

// Path labels that appear when lens is on (tag field drives filter dimming) — text field holds i18n key
const EQUIPMENT_PATH_LABELS: Array<{ x: number; y: number; text: string; color: string; tag: string }> = [
  // PULL — rings and weighted
  { x: HUB_X + GAP * 3,       y: HUB_Y + SIDE * 3 - 38, text: "skillTree.svgEq.rings",              color: EQUIPMENT_COLORS.rings,    tag: "rings"    },
  { x: HUB_X + GAP * 3,       y: HUB_Y + SIDE * 4 - 38, text: "skillTree.svgEq.weighted",            color: EQUIPMENT_COLORS.weighted, tag: "weighted" },
  // PUSH
  { x: HUB_X - SIDE - 40,     y: HUB_Y - GAP * 3.4,     text: "skillTree.svgEq.rings",              color: EQUIPMENT_COLORS.rings,    tag: "rings"    },
  { x: HUB_X - SIDE * 2 - 48, y: HUB_Y - GAP * 3.4,     text: "skillTree.svgEq.weighted",           color: EQUIPMENT_COLORS.weighted, tag: "weighted" },
  // CORE weighted / rings (column 1)
  { x: HUB_X + SIDE * 3 + 50, y: HUB_Y + GAP * 2.4,     text: "skillTree.svgEq.weightedRings",      color: EQUIPMENT_COLORS.weighted, tag: "weighted" },
  // CORE power / instability (column 2)
  { x: HUB_X + SIDE * 4 + 55, y: HUB_Y + GAP * 2,       text: "skillTree.svgEq.powerInstability",   color: EQUIPMENT_COLORS.roller,   tag: "roller"   },
  // LEGS weighted (row 1)
  { x: HUB_X - GAP * 2.5,     y: HUB_Y + SIDE * 2 - 38, text: "skillTree.svgEq.weighted",            color: EQUIPMENT_COLORS.weighted, tag: "weighted" },
  // LEGS power / instability (row 2)
  { x: HUB_X - GAP * 2,       y: HUB_Y + SIDE * 3 - 38, text: "skillTree.svgEq.powerInstability",    color: EQUIPMENT_COLORS.box,      tag: "box"      },
];

function equipmentNodeColor(id: string): string {
  if (id.includes("-rings-"))    return EQUIPMENT_COLORS.rings;
  if (id.includes("-weighted-")) return EQUIPMENT_COLORS.weighted;
  if (id.includes("-roller-"))   return EQUIPMENT_COLORS.roller;
  if (id.includes("-band-"))     return EQUIPMENT_COLORS.band;
  if (id.includes("-box-"))      return EQUIPMENT_COLORS.box;
  if (id.includes("-sliders-"))  return EQUIPMENT_COLORS.sliders;
  return MUTED;
}

// ─── EquipmentConnectorPath ───────────────────────────────────────────────────
// Neon dashed line used for equipment-specific branches (distinct from bodyweight)

function EquipmentConnectorPath({
  fromPos, toPos, color, mastered, lit, fromR = NODE_R, toR = NODE_R,
}: {
  fromPos: { x: number; y: number };
  toPos:   { x: number; y: number };
  color:   string;
  mastered: boolean;
  lit:      boolean;
  fromR?: number;
  toR?: number;
}) {
  const { x1, y1, x2, y2 } = edgePoints(fromPos, toPos, fromR, toR);
  const d = makeBezier(x1, y1, x2, y2);
  if (mastered) {
    return (
      <g>
        {/* Wide outer neon bloom */}
        <path d={d} fill="none" stroke={color}
          strokeWidth={lit ? 18 : 10} opacity={lit ? 0.28 : 0.10}
          strokeLinecap="round" />
        {/* Core glow line (solid, no dash) */}
        <path d={d} fill="none" stroke={color}
          strokeWidth={lit ? 3.5 : 2.5} opacity={lit ? 1 : 0.85}
          strokeLinecap="round" />
        {/* Neon dash overlay */}
        <path d={d} fill="none" stroke="white"
          strokeWidth={1} opacity={lit ? 0.45 : 0.20}
          strokeDasharray="6 8" strokeLinecap="round" />
      </g>
    );
  }
  // Unlocked / locked: visible dashed neon (shows the gear path)
  return (
    <g>
      <path d={d} fill="none" stroke={color}
        strokeWidth={lit ? 8 : 5} opacity={lit ? 0.18 : 0.06}
        strokeLinecap="round" />
      <path d={d} fill="none" stroke={color}
        strokeWidth={lit ? 2 : 1.5}
        strokeDasharray="7 6"
        opacity={lit ? 0.7 : 0.35}
        strokeLinecap="round"
        style={{ transition: "opacity 0.15s" }}
      />
    </g>
  );
}

// ─── DiamondNode ──────────────────────────────────────────────────────────────
// Diamond-shaped SVG node for equipment specialty skills.
// Uses the same overall structure as GlassNode but with a rotated polygon.

function DiamondNode({
  nodeId, skill, isHovered, showLabel, onClick, onHover,
}: {
  nodeId:    string;
  skill:     EvaluatedSkill;
  isHovered: boolean;
  showLabel: boolean;
  onClick:   (skill: EvaluatedSkill, e: React.MouseEvent) => void;
  onHover:   (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const pos = EQUIPMENT_NODE_POS[nodeId];
  if (!pos) return null;
  const { x, y } = pos;
  const color = equipmentNodeColor(nodeId);

  const isMastered = skill.status === "mastered";
  const isLocked   = skill.status === "locked";
  const isUnlocked = skill.status === "unlocked";

  const pct = skill.masteryRequirement.minQualifyingSessions > 0
    ? Math.min(1, skill.progress.qualifyingSessions / skill.masteryRequirement.minQualifyingSessions)
    : 0;

  const R  = NODE_R;
  const RR = NODE_R + 8; // outer ring radius

  // Diamond polygon points: top, right, bottom, left
  const pts        = `${x},${y - R}  ${x + R},${y}  ${x},${y + R}  ${x - R},${y}`;
  const outerPts   = `${x},${y - RR} ${x + RR},${y} ${x},${y + RR} ${x - RR},${y}`;
  const glowPts14  = `${x},${y - (R+14)} ${x+(R+14)},${y} ${x},${y+(R+14)} ${x-(R+14)},${y}`;
  const glowPts7   = `${x},${y - (R+7)}  ${x+(R+7)},${y}  ${x},${y+(R+7)}  ${x-(R+7)},${y}`;
  const hitPts     = `${x},${y - (R+20)} ${x+(R+20)},${y} ${x},${y+(R+20)} ${x-(R+20)},${y}`;

  const nodeTitle  = t(`skillTree.nodeTitle.${nodeId}`);
  const shortTitle = nodeTitle.length > 13 ? nodeTitle.slice(0, 12) + "…" : nodeTitle;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(skill, e); }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => onHover(nodeId)}
      onPointerLeave={() => onHover(null)}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        transformOrigin: `${x}px ${y}px`,
        transform: isHovered ? "scale(1.12)" : "scale(1)",
        transition: "transform 0.14s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      role="button"
      aria-label={nodeTitle}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(skill, e as unknown as React.MouseEvent);
      }}
    >
      {/* Hit area */}
      <polygon points={hitPts} fill="transparent" style={{ cursor: "pointer", pointerEvents: "all" }} />

      {/* Hover pulse ring */}
      {isHovered && (
        <polygon points={`${x},${y-(R+20)} ${x+(R+20)},${y} ${x},${y+(R+20)} ${x-(R+20)},${y}`}
          fill="none" stroke={isMastered ? GOLD : color} strokeWidth={1.5} opacity={0.25} />
      )}

      {/* Mastered glow rings */}
      {isMastered && (
        <>
          <polygon points={glowPts14} fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2 : 1} opacity={isHovered ? 0.3 : 0.12} />
          <polygon points={glowPts7}  fill="none" stroke={GOLD}
            strokeWidth={isHovered ? 2.5 : 1.5} opacity={isHovered ? 0.65 : 0.35} />
        </>
      )}

      {/* Progress ring (unlocked) — circle ring around diamond */}
      {isUnlocked && (() => {
        const CIRC = 2 * Math.PI * RR;
        return (
          <>
            <circle cx={x} cy={y} r={RR}
              fill="none" stroke={color} strokeWidth={3} opacity={isHovered ? 0.3 : 0.15} />
            {pct > 0 && (
              <circle cx={x} cy={y} r={RR}
                fill="none" stroke={color} strokeWidth={3}
                strokeDasharray={`${pct * CIRC} ${CIRC}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${x} ${y})`}
                opacity={isHovered ? 1 : 0.9}
              />
            )}
          </>
        );
      })()}

      {/* Neon outer glow for mastered */}
      {isMastered && (
        <polygon points={outerPts} fill="none" stroke={color}
          strokeWidth={isHovered ? 10 : 6} opacity={isHovered ? 0.22 : 0.08} />
      )}

      {/* Main diamond */}
      <polygon points={pts}
        fill={isMastered ? GOLD : isLocked ? "#f1f5f9" : "#ffffff"}
        stroke={isMastered ? GOLD : isLocked ? "#9ca3af" : color}
        strokeWidth={
          isMastered ? (isHovered ? 3 : 2)
          : isLocked  ? 1.5
          : (isHovered ? 3.5 : 2.5)
        }
        opacity={isLocked ? 0.6 : 1}
      />

      {/* Shimmer on top facet */}
      {!isLocked && (
        <ellipse cx={x} cy={y - R * 0.35}
          rx={R * 0.35} ry={R * 0.16}
          fill="white" opacity={isHovered ? 0.14 : 0.07} />
      )}

      {/* Status icon */}
      {isMastered && <StarShape cx={x} cy={y} />}
      {isLocked    && <LockShape cx={x} cy={y} />}
      {isUnlocked  && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight="800" fill={color}
          fontFamily="ui-monospace, monospace">
          ◆
        </text>
      )}

      {/* Progress badge */}
      {isUnlocked && pct > 0 && !showLabel && (
        <text x={x} y={y + R + 12} textAnchor="middle"
          fontSize={7} fill={color} opacity={0.75} fontFamily="ui-monospace, monospace">
          {Math.round(pct * 100)}%
        </text>
      )}

      {/* Label */}
      {showLabel && (
        <text x={x} y={y + R + 13} textAnchor="middle"
          fontSize={8}
          fill={isLocked ? "#9ca3af" : isHovered ? (isMastered ? GOLD : "#1a1a1a") : "#374151"}
          fontWeight={isUnlocked || isHovered ? "600" : "400"}
          fontFamily="ui-sans-serif, system-ui, sans-serif">
          {shortTitle}
        </text>
      )}
    </g>
  );
}

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
      stroke={lit ? color : "#cbd5e1"}
      strokeWidth={lit ? 2 : 1.5}
      strokeDasharray="8 5"
      opacity={lit ? 0.7 : 0.9}
      strokeLinecap="round"
      style={{ transition: "stroke 0.15s, opacity 0.15s" }}
    />
  );
}

// ─── CrossBranchConnector ─────────────────────────────────────────────────────
// Renders a cross-branch dependency arc when a multi-prereq node is selected.
// met=true  → solid colored glow (requirement satisfied)
// met=false → red dashed line  (requirement still needed)

function CrossBranchConnector({
  fromPos, toPos, prereqMastered, prereqColor,
}: {
  fromPos: { x: number; y: number };
  toPos:   { x: number; y: number };
  prereqMastered: boolean;
  prereqColor: string;
}) {
  const { x1, y1, x2, y2 } = edgePoints(fromPos, toPos, NODE_R, NODE_R);
  const d = makeBezier(x1, y1, x2, y2);
  const color = prereqMastered ? prereqColor : "#ef4444";
  return (
    <g>
      {/* wide soft glow */}
      <path d={d} fill="none" stroke={color}
        strokeWidth={20} opacity={0.05} strokeLinecap="round" />
      {/* core line */}
      <path d={d} fill="none" stroke={color}
        strokeWidth={2}
        opacity={prereqMastered ? 0.42 : 0.70}
        strokeDasharray={prereqMastered ? undefined : "5 4"}
        strokeLinecap="round"
        style={{ transition: "stroke 0.2s, opacity 0.2s" }} />
      {/* arrowhead dot at target */}
      <circle cx={x2} cy={y2} r={4} fill={color}
        opacity={prereqMastered ? 0.55 : 0.80} />
    </g>
  );
}

// ─── Hub visual ───────────────────────────────────────────────────────────────

function HubNode() {
  return (
    <g>
      {/* Animated pulse rings */}
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R + 22} fill="none"
        stroke="#177548" strokeWidth={1} opacity={0.15} />
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R + 12} fill="none"
        stroke="#177548" strokeWidth={1.5} opacity={0.25} />
      {/* Main circle */}
      <circle cx={HUB_X} cy={HUB_Y} r={HUB_R}
        fill="#177548"
        stroke="#177548"
        strokeWidth={2}
        opacity={1}
      />
      {/* Shimmer */}
      <ellipse cx={HUB_X} cy={HUB_Y - HUB_R * 0.32}
        rx={HUB_R * 0.4} ry={HUB_R * 0.18}
        fill="white" opacity={0.15} />
      {/* Label */}
      <text x={HUB_X} y={HUB_Y - 3} textAnchor="middle"
        fontSize={7.5} fontWeight="800" fill="white" opacity={0.95}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.06em">
        CORE
      </text>
      <text x={HUB_X} y={HUB_Y + 8} textAnchor="middle"
        fontSize={7.5} fontWeight="800" fill="white" opacity={0.95}
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
      <circle cx={cx} cy={cy + 5} r={2.5} fill="#f1f5f9" />
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
  const { t } = useTranslation();
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

  const nodeTitle  = t(`skillTree.nodeTitle.${nodeId}`);
  const shortTitle = nodeTitle.length > 13 ? nodeTitle.slice(0, 12) + "…" : nodeTitle;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(skill, e); }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => onHover(nodeId)}
      onPointerLeave={() => onHover(null)}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        transformOrigin: `${x}px ${y}px`,
        transform: isHovered ? "scale(1.12)" : "scale(1)",
        transition: "transform 0.14s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      role="button"
      aria-label={nodeTitle}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(skill, e as unknown as React.MouseEvent);
      }}
    >
      {/* Enlarged hit area — transparent fill keeps pointer-events active */}
      <circle cx={x} cy={y} r={HIT_R} fill="transparent" style={{ cursor: "pointer", pointerEvents: "all" }} />

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

      {/* Elite L5 soft gold glow (unlocked/locked Elite nodes) */}
      {!isMastered && skill.level === 5 && skill.levelName === "Elite" && (
        <>
          <circle cx={x} cy={y} r={NODE_R + 14} fill="none" stroke="#d97706"
            strokeWidth={isHovered ? 2 : 1} opacity={isHovered ? 0.28 : 0.10} />
          <circle cx={x} cy={y} r={NODE_R + 7}  fill="none" stroke="#d97706"
            strokeWidth={isHovered ? 2.5 : 1.5} opacity={isHovered ? 0.50 : 0.22} />
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
        fill={isMastered ? GOLD : isLocked ? "#f1f5f9" : "#ffffff"}
        stroke={isMastered ? GOLD : isLocked ? "#9ca3af" : color}
        strokeWidth={
          isMastered ? (isHovered ? 3 : 2)
          : isLocked  ? 1.5
          : (isHovered ? 3.5 : 2.5)
        }
        opacity={isLocked ? 0.6 : 1}
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
          fill={isLocked ? "#9ca3af" : isHovered ? (isMastered ? GOLD : "#1a1a1a") : "#374151"}
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
  skill, screenX, screenY, containerW, containerH, color, onClose, skillMap,
}: {
  skill:      EvaluatedSkill;
  screenX:    number; screenY:    number;
  containerW: number; containerH: number;
  color:      string;
  onClose:    () => void;
  skillMap:   Map<string, EvaluatedSkill>;
}) {
  const { t } = useTranslation();
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
        boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
      }}
      className="bg-white border border-black/10 rounded-2xl p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isLocked ? "#4b5563" : color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider truncate"
            style={{ color: isLocked ? "#9ca3af" : color }}>
            {t("skillTree.level")} {skill.level} · {t(`skillTree.levelName.${skill.levelName.toLowerCase()}`)}
          </span>
        </div>
        <button onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none shrink-0 w-6 h-6 flex items-center justify-center">
          ×
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {(skill.type as SkillType) === "static" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
            🧲 {t("skillTree.staticHold")}
          </span>
        )}
        {(skill.type as SkillType) === "explosive" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
            ⚡ {t("skillTree.explosive")}
          </span>
        )}
        {isLocked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {t("skillTree.lockedNode")}
          </span>
        )}
        {isMastered && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border"
            style={{ backgroundColor: "rgba(23,117,72,0.08)", color: "#177548", borderColor: "rgba(23,117,72,0.25)" }}>
            ★ {t("skillTree.mastered")}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="font-bold text-sm text-foreground mb-0.5 leading-tight">{t(`skillTree.nodeTitle.${skill.id}`)}</p>
      {skill.pathLabel && (
        <p className="text-[10px] text-muted-foreground mb-2">
          {t(PATH_LABEL_I18N[skill.pathLabel] ?? "skillTree.pathLabel.overhead", { defaultValue: skill.pathLabel })}
        </p>
      )}

      {/* "Why train this?" */}
      <div className="rounded-lg px-2.5 py-2 mb-3 border"
        style={{
          borderColor: isLocked ? "rgba(0,0,0,0.07)" : `${color}25`,
          backgroundColor: isLocked ? "rgba(0,0,0,0.03)" : `${color}08`,
        }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
          style={{ color: isLocked ? "#9ca3af" : color }}>
          {isLocked ? t("skillTree.lockedNode") : t("skillTree.whyTrain")}
        </p>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          {isLocked
            ? t("skillTree.masterPrereq")
            : t(`skillTree.nodeDesc.${skill.id}`, { defaultValue: skill.description })}
        </p>
      </div>

      {/* Cross-branch requirements */}
      {skill.secondaryPrerequisiteIds && skill.secondaryPrerequisiteIds.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-muted-foreground">
            {t("skillTree.alsoRequires")}
          </p>
          <div className="space-y-1">
            {skill.secondaryPrerequisiteIds.map((reqId) => {
              const reqNode = ALL_SKILL_NODES.find((n) => n.id === reqId);
              if (!reqNode) return null;
              const reqColor = nodeColor(reqId);
              const isMet = skillMap.get(reqId)?.status === "mastered";
              return (
                <div key={reqId}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                  style={{ backgroundColor: isMet ? `${reqColor}14` : "rgba(239,68,68,0.09)" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isMet ? reqColor : "#ef4444" }} />
                  <span className="text-[10px] text-foreground/80 flex-1 truncate">
                    {t(`skillTree.nodeTitle.${reqNode.id}`, { defaultValue: reqNode.title })}
                  </span>
                  <span className={cn(
                    "text-[9px] font-bold",
                    isMet ? "text-green-400" : "text-red-400",
                  )}>
                    {isMet ? "✓" : "✗"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mastery progress */}
      {!isLocked && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{t("skillTree.masteryLabel")}</span>
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: isMastered ? GOLD : color }}>
              {isMastered ? t("skillTree.masteryComplete") : `${masteryPct}%`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${masteryPct}%`, backgroundColor: isMastered ? GOLD : color }} />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{translateReq(req, t)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {t("skillTree.qualifyingSessions", { done: Math.min(prog.qualifyingSessions, req.minQualifyingSessions), total: req.minQualifyingSessions })}
          </p>
        </div>
      )}

      {/* Stats */}
      {!isLocked && (prog.bestReps > 0 || prog.bestFormScore > 0) && (
        <div className="rounded-xl bg-muted/50 border border-border px-3 py-2 mb-3 space-y-1">
          {isStatic && prog.bestReps > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-cyan-600/80 font-medium">⏱ {t("skillTree.bestHold")}</span>
              <span className="text-[10px] font-bold text-cyan-700 tabular-nums">{prog.bestReps}s</span>
            </div>
          )}
          {!isStatic && prog.bestReps > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground">🏆 {t("skillTree.bestReps")}</span>
              <span className="text-[10px] font-bold text-foreground tabular-nums">{prog.bestReps}</span>
            </div>
          )}
          {prog.bestFormScore > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground">🎯 {t("skillTree.formScoreLabel")}</span>
              <span className="text-[10px] font-bold text-foreground tabular-nums">
                {Math.round(prog.bestFormScore)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Locked prerequisite */}
      {isLocked && prereqNode && (
        <div className="rounded-xl bg-muted/50 border border-border px-3 py-2 mb-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">{t("skillTree.requiresLabel")}</p>
          <p className="text-[11px] font-semibold text-foreground/80">{t(`skillTree.nodeTitle.${prereqNode.id}`, { defaultValue: prereqNode.title })}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{translateReq(prereqNode.masteryRequirement, t)}</p>
        </div>
      )}

      {/* CTA button */}
      {!isLocked && (
        <Link href={workoutUrl}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: "#177548" }}
          >
            {isMastered ? t("skillTree.practiceAgain") : t("skillTree.trainNowArrow")}
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

function TreeCanvas({ evaluated, lensOn, filterTag }: { evaluated: EvaluatedSkill[]; lensOn: boolean; filterTag: EquipmentTag | null }) {
  const { t } = useTranslation();
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

  // Unified position map — includes equipment nodes when lens is on
  const allNodePos = useMemo<Record<string, { x: number; y: number }>>(() => {
    return lensOn ? { ...NODE_POS, ...EQUIPMENT_NODE_POS } : NODE_POS;
  }, [lensOn]);

  // Focused-lens bodyweight filter: when lens is ON, compute the full ancestor
  // chain (in EDGES) of bodyweight nodes that directly parent equipment nodes.
  // Only these nodes (and their connecting edges) are rendered, revealing the
  // minimal tree paths that lead to gear skills.
  const focusedBodyweightIds = useMemo<Set<string> | null>(() => {
    if (!lensOn) return null; // null = show all bodyweight nodes
    // Equipment "parents" = bodyweight nodes that directly spawn equipment nodes
    const equipParents = new Set(
      EQUIPMENT_EDGES.map(([from]) => from).filter((id) => !!NODE_POS[id]),
    );
    // BFS backwards through EDGES to collect all bodyweight ancestors
    const result = new Set<string>(equipParents);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, to] of EDGES) {
        if (result.has(to) && !result.has(from) && NODE_POS[from]) {
          result.add(from);
          changed = true;
        }
      }
    }
    return result;
  }, [lensOn]);

  const skillMap = useMemo(() => {
    const m = new Map<string, EvaluatedSkill>();
    for (const s of evaluated) m.set(s.id, s);
    return m;
  }, [evaluated]);

  // First in-progress skill (for auto-center) — includes equipment nodes when lens on
  const inProgressId = useMemo(() => {
    const allEdges = lensOn ? [...EDGES, ...EQUIPMENT_EDGES] : EDGES;
    const order = [...allEdges.map(([a]) => a), ...allEdges.map(([, b]) => b)];
    const unique = [...new Set(order)];
    return unique.find((id) => {
      const s = skillMap.get(id);
      return s?.status === "unlocked" && (lensOn || !s.equipmentSpecialty);
    }) ?? null;
  }, [skillMap, lensOn]);

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
    const TREE_SPAN = 1800; // bounding span of radial tree (expanded 48-node layout)
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
    const pos = allNodePos[inProgressId];
    if (!pos) { resetView(); return; }
    centerOn(pos.x, pos.y, Math.max(zoomRef.current, 0.7));
  }, [inProgressId, centerOn, resetView, allNodePos]);

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
  // NOTE: nodes call e.stopPropagation() on their own onPointerDown, so this
  // handler only fires when the user presses on empty space / edges / labels.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isPanning.current = true;
    didDrag.current   = false;
    lastPos.current   = { x: e.clientX, y: e.clientY };
    downPos.current   = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Imperatively update cursor so grabbing feedback works without re-render
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    if (overlay) setOverlay(null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    const totalD = Math.abs(e.clientX - downPos.current.x) + Math.abs(e.clientY - downPos.current.y);
    if (totalD > 6) didDrag.current = true;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp() {
    isPanning.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
  }

  // Node click → open overlay (works for both bodyweight and equipment nodes)
  function handleNodeClick(skill: EvaluatedSkill, _e: React.MouseEvent) {
    if (didDrag.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = allNodePos[skill.id];
    if (!pos) return;
    setContainerSize({ w: rect.width, h: rect.height });
    setOverlay({
      skill,
      screenX: pos.x * zoom + pan.x,
      screenY: pos.y * zoom + pan.y,
    });
  }

  const showLabel = zoom >= 0.48;
  const overlayColor = overlay
    ? overlay.skill.equipmentSpecialty
      ? equipmentNodeColor(overlay.skill.id)
      : nodeColor(overlay.skill.id)
    : "#6b7280";

  return (
    <div className="relative" style={{ height: "calc(100vh - 210px)", minHeight: 430 }}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5">
        <button
          onClick={autoCenter}
          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          title="Auto-center on in-progress skill"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.22, z * 0.8))}
          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          title="Reset view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SVG canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden rounded-2xl border border-border bg-white"
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
            pointerEvents: "visiblePainted",
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* ── Hub spoke lines (behind everything) ── */}
            {HUB_EDGES.map(({ toId, branch }) => {
              const toPos = NODE_POS[toId];
              if (!toPos) return null;
              // Focused-lens: only draw spoke if the target node is in the visible set
              if (focusedBodyweightIds && !focusedBodyweightIds.has(toId)) return null;
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

            {/* ── Bodyweight skill edges ── */}
            {EDGES.map(([fromId, toId]) => {
              const fromPos = NODE_POS[fromId];
              const toPos   = NODE_POS[toId];
              if (!fromPos || !toPos) return null;
              // Focused-lens: skip edges where either endpoint is hidden
              if (focusedBodyweightIds && !(focusedBodyweightIds.has(fromId) && focusedBodyweightIds.has(toId))) return null;
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

            {/* ── Equipment Lens: neon dashed edges (fade in when lensOn) ── */}
            {lensOn && EQUIPMENT_EDGES.map(([fromId, toId]) => {
              const fromPos = allNodePos[fromId];
              const toPos   = EQUIPMENT_NODE_POS[toId] ?? allNodePos[toId];
              if (!fromPos || !toPos) return null;
              const fromSkill = skillMap.get(fromId);
              const toSkill   = skillMap.get(toId);
              const mastered  = fromSkill?.status === "mastered";
              const lit = hoveredId === fromId || hoveredId === toId;
              const color = equipmentNodeColor(toId) || equipmentNodeColor(fromId);
              const edgeTag = toSkill?.equipmentTag ?? fromSkill?.equipmentTag;
              const dimmed = filterTag !== null && edgeTag !== filterTag;
              return (
                <g key={`eq-${fromId}-${toId}`} opacity={dimmed ? 0.1 : 1} style={{ transition: "opacity 0.2s" }}>
                  <EquipmentConnectorPath
                    fromPos={fromPos}
                    toPos={toPos}
                    color={color}
                    mastered={mastered}
                    lit={lit}
                  />
                </g>
              );
            })}

            {/* ── Cross-branch dependency lines (shown when a node is selected) ── */}
            {overlay?.skill.secondaryPrerequisiteIds?.map((reqId) => {
              const fromPos = allNodePos[overlay.skill.id];
              const toPos   = allNodePos[reqId];
              if (!fromPos || !toPos) return null;
              const prereqMastered = skillMap.get(reqId)?.status === "mastered";
              return (
                <CrossBranchConnector
                  key={`cross-${overlay.skill.id}-${reqId}`}
                  fromPos={fromPos}
                  toPos={toPos}
                  prereqMastered={prereqMastered ?? false}
                  prereqColor={nodeColor(reqId)}
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
                {t(label).toUpperCase()}
              </text>
            ))}

            {/* ── Path sub-labels (only when zoomed in) ── */}
            {showLabel && PATH_LABELS.map(({ x, y, text, color }) => (
              <text key={text} x={x} y={y} textAnchor="middle"
                fontSize={8} fill={color} opacity={0.55}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontStyle="italic">
                {t(text)}
              </text>
            ))}

            {/* ── Equipment path labels (only when lens is on and zoomed in) ── */}
            {lensOn && showLabel && EQUIPMENT_PATH_LABELS.map(({ x, y, text, color, tag }) => {
              const dimmed = filterTag !== null && tag !== filterTag;
              return (
                <text key={`eq-lbl-${text}-${x}`} x={x} y={y} textAnchor="middle"
                  fontSize={8} fill={color}
                  opacity={dimmed ? 0.08 : 0.70}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontStyle="italic" fontWeight="600"
                  style={{ transition: "opacity 0.2s" }}>
                  {t(text)} ◆
                </text>
              );
            })}

            {/* ── Bodyweight skill nodes (circles) ── */}
            {Object.keys(NODE_POS).map((nodeId) => {
              // Focused-lens: hide nodes not in the ancestor chain
              if (focusedBodyweightIds && !focusedBodyweightIds.has(nodeId)) return null;
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

            {/* ── Equipment Lens: diamond nodes (animate in when lensOn) ── */}
            {lensOn && Object.keys(EQUIPMENT_NODE_POS).map((nodeId) => {
              const skill = skillMap.get(nodeId);
              if (!skill) return null;
              const dimmed = filterTag !== null && skill.equipmentTag !== filterTag;
              return (
                <g key={nodeId} opacity={dimmed ? 0.1 : 1} style={{ transition: "opacity 0.2s" }}>
                  <DiamondNode
                    nodeId={nodeId}
                    skill={skill}
                    isHovered={hoveredId === nodeId}
                    showLabel={showLabel}
                    onClick={handleNodeClick}
                    onHover={setHoveredId}
                  />
                </g>
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
              skillMap={skillMap}
            />
          )}
        </AnimatePresence>

        {/* Hint */}
        <p className="absolute bottom-3 left-3 text-[10px] text-muted-foreground pointer-events-none select-none">
          {t("skillTree.dragToPan")} · {t("skillTree.scrollOrPinchToZoom")} · {t("skillTree.tapNodeForDetails")} · {
            zoom < 0.48 ? t("skillTree.zoomInToSeeLabels") : t("skillTree.tapToSnapToActive")
          }
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────


const LENS_STORAGE_KEY = "calicoach_equipment_lens";

export function SkillTreePage() {
  const { t } = useTranslation();
  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  // Equipment Lens state — persisted to localStorage so workout picker stays in sync
  const [lensOn, setLensOn] = useState<boolean>(() => {
    try { return localStorage.getItem(LENS_STORAGE_KEY) === "true"; } catch { return false; }
  });
  // Equipment filter: null = show all, tag = highlight only that equipment type
  const [filterTag, setFilterTag] = useState<EquipmentTag | null>(null);

  const toggleLens = () => {
    const next = !lensOn;
    setLensOn(next);
    if (!next) setFilterTag(null); // reset filter when hiding overlay
    try { localStorage.setItem(LENS_STORAGE_KEY, String(next)); } catch {}
    // Dispatch a storage event so other tabs / the workout page can react
    window.dispatchEvent(new StorageEvent("storage", { key: LENS_STORAGE_KEY, newValue: String(next) }));
  };

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
          <h1 className="text-3xl font-bold tracking-tight">{t("skillTree.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("skillTree.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* ── Equipment Lens Toggle ── */}
          <button
            onClick={toggleLens}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all select-none"
            style={lensOn ? {
              borderColor: "rgba(23,117,72,0.4)",
              background: "rgba(23,117,72,0.07)",
              boxShadow: "0 0 12px rgba(23,117,72,0.15)",
            } : {
              borderColor: "rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.02)",
            }}
            title={lensOn ? t("skillTree.hideEquipmentPaths") : t("skillTree.showEquipmentPaths")}
          >
            {/* Diamond icon representing equipment specialty nodes */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon
                points="7,0 14,7 7,14 0,7"
                fill={lensOn ? "#177548" : "transparent"}
                stroke={lensOn ? "#177548" : "#9ca3af"}
                strokeWidth="1.5"
              />
            </svg>
            <span className="text-xs font-bold tracking-wide"
              style={{ color: lensOn ? "#177548" : "#6b7280" }}>
              {t("skillTree.equipmentOverlay")}
            </span>
            {/* Toggle pill */}
            <span className="relative inline-flex w-9 h-5 rounded-full border transition-colors shrink-0"
              style={{
                backgroundColor: lensOn ? "rgba(23,117,72,0.2)" : "rgba(0,0,0,0.04)",
                borderColor: lensOn ? "rgba(23,117,72,0.4)" : "rgba(0,0,0,0.12)",
              }}>
              <span className="absolute top-0.5 transition-all duration-200 w-4 h-4 rounded-full shadow"
                style={{
                  left: lensOn ? "calc(100% - 18px)" : "2px",
                  backgroundColor: lensOn ? "#177548" : "#9ca3af",
                }} />
            </span>
          </button>

          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {totalMastered}
              <span className="text-muted-foreground text-base font-normal">/{TOTAL_SKILL_COUNT}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("skillTree.skillsMastered")}</p>
          </div>
          <Button asChild>
            <Link href="/workout">{t("skillTree.trainNow")}</Link>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {[
          { color: BRANCH_COLOR.PUSH, label: t("skillTree.push") },
          { color: BRANCH_COLOR.PULL, label: t("skillTree.pull") },
          { color: BRANCH_COLOR.CORE, label: t("skillTree.core") },
          { color: BRANCH_COLOR.LEGS, label: t("skillTree.legs") },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#177548" }}>
            <Star className="w-2.5 h-2.5 fill-white text-white" />
          </span>
          {t("skillTree.mastered")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-2 border-primary" />
          {t("skillTree.inProgress")}
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-muted-foreground" />
          {t("skillTree.locked")}
        </span>
      </div>

      {/* Tree */}
      {isLoading || !evaluated ? (
        <Skeleton className="w-full rounded-2xl" style={{ height: "calc(100vh - 210px)", minHeight: 430 }} />
      ) : (
        <>
          <TreeCanvas evaluated={evaluated} lensOn={lensOn} filterTag={filterTag} />
        </>
      )}
    </div>
  );
}
