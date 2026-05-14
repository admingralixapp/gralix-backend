/**
 * Daily Prescription Engine
 *
 * Given a user's target skill and their exercise history (exerciseStats),
 * walks the full prerequisite chain and returns the weakest unmastered skill
 * they should focus on today.
 *
 * Readiness score = total lifetime reps / (minReps × minQualifyingSessions)
 * capped at 1.0. This gives a fast, zero-extra-fetch measure of how close
 * the user is to mastering each prerequisite.
 */

import { ALL_SKILL_NODES, type SkillNode, type EvaluatedSkill } from "./skill-tree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrescriptionResult {
  /** The user's chosen target skill */
  targetNode: SkillNode;
  /** The weakest unmastered prerequisite to work on today */
  focusNode: SkillNode;
  /** 0–1 readiness fraction for focusNode */
  readiness: number;
  /** Number of reps needed to "satisfy" the mastery proxy (minReps × minSessions) */
  requiredReps: number;
  /** User's current total reps/seconds for focusNode's exercises */
  totalReps: number;
  /** True when all prerequisites (and the target itself) are already mastered */
  allMastered: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NODE_MAP = new Map(ALL_SKILL_NODES.map((n) => [n.id, n]));

/** Lifetime total for a node across all its exercises */
function nodeTotal(node: SkillNode, stats: Record<string, { total: number }>): number {
  return node.exercises.reduce((sum, ex) => sum + (stats[ex]?.total ?? 0), 0);
}

/** 0–1 readiness proxy: lifetime total / (minReps × minQualifyingSessions) */
function readinessOf(node: SkillNode, stats: Record<string, { total: number }>): number {
  const required = node.masteryRequirement.minReps * node.masteryRequirement.minQualifyingSessions;
  return Math.min(1, nodeTotal(node, stats) / Math.max(1, required));
}

/**
 * Recursively collect all ancestor nodes for a target skill.
 * Returns them in depth-first order (earliest prerequisite first).
 * The target node itself is NOT included.
 */
function buildPrerequisiteChain(targetId: string): SkillNode[] {
  const visited = new Set<string>();
  const chain: SkillNode[] = [];

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = NODE_MAP.get(nodeId);
    if (!node) return;
    if (node.prerequisiteId) walk(node.prerequisiteId);
    for (const sid of node.secondaryPrerequisiteIds ?? []) walk(sid);
    chain.push(node);
  }

  const target = NODE_MAP.get(targetId);
  if (!target) return [];
  if (target.prerequisiteId) walk(target.prerequisiteId);
  for (const sid of target.secondaryPrerequisiteIds ?? []) walk(sid);

  return chain;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Auto-selects the most advanced skill the user can currently train.
 *
 * Strategy:
 *   1. Prefer "unlocked" (prerequisites met, not yet mastered) skills —
 *      these are the frontier the user should push.
 *   2. Among the frontier, pick the highest `level` node.  Ties broken by
 *      whichever appears latest in ALL_SKILL_NODES (prerequisites-first order).
 *   3. If every unlocked node is already mastered, fall back to the highest-
 *      level mastered node so the card still shows useful content.
 *   4. Returns null only when the evaluated list is empty.
 */
export function getSmartPrescription(
  evaluated: EvaluatedSkill[],
  exerciseStats: Record<string, { total: number }>,
): PrescriptionResult | null {
  if (evaluated.length === 0) return null;

  const frontier = evaluated.filter((s) => s.status === "unlocked");

  if (frontier.length > 0) {
    // Most advanced = highest level; ties broken by position in the array
    // (later = deeper in the tree, since ALL_SKILL_NODES is topo-sorted).
    const target = frontier.reduce((best, n) => n.level >= best.level ? n : best);
    return getDailyPrescription(target.id, exerciseStats);
  }

  // All reachable nodes are mastered — fall back to the most advanced mastered one.
  const mastered = evaluated.filter((s) => s.status === "mastered");
  if (mastered.length > 0) {
    const target = mastered.reduce((best, n) => n.level >= best.level ? n : best);
    return getDailyPrescription(target.id, exerciseStats);
  }

  // Only locked skills exist (no prerequisites met yet) — use the first Foundation node.
  const fallback = evaluated.find((s) => s.prerequisiteId === null);
  if (fallback) return getDailyPrescription(fallback.id, exerciseStats);

  return null;
}

/**
 * Returns the single best exercise prescription for today, or null if the
 * targetSkillId is not found in the skill tree.
 */
export function getDailyPrescription(
  targetSkillId: string,
  exerciseStats: Record<string, { total: number }>,
): PrescriptionResult | null {
  const targetNode = NODE_MAP.get(targetSkillId);
  if (!targetNode) return null;

  const prereqs = buildPrerequisiteChain(targetSkillId);

  // Candidates = all prereqs + the target itself
  const candidates = [...prereqs, targetNode];

  // Filter to unmastered (readiness < 1.0)
  const unmastered = candidates.filter((n) => readinessOf(n, exerciseStats) < 1.0);

  if (unmastered.length === 0) {
    // All mastered — encourage continued training on the target
    const required = targetNode.masteryRequirement.minReps * targetNode.masteryRequirement.minQualifyingSessions;
    return {
      targetNode,
      focusNode: targetNode,
      readiness: 1.0,
      requiredReps: required,
      totalReps: nodeTotal(targetNode, exerciseStats),
      allMastered: true,
    };
  }

  // Pick the weakest link (lowest readiness among unmastered)
  const focusNode = unmastered.reduce((worst, n) =>
    readinessOf(n, exerciseStats) < readinessOf(worst, exerciseStats) ? n : worst,
  );

  const required = focusNode.masteryRequirement.minReps * focusNode.masteryRequirement.minQualifyingSessions;
  const total     = nodeTotal(focusNode, exerciseStats);

  return {
    targetNode,
    focusNode,
    readiness:    Math.min(1, total / Math.max(1, required)),
    requiredReps: required,
    totalReps:    total,
    allMastered:  false,
  };
}
