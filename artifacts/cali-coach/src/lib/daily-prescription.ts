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

import { ALL_SKILL_NODES, type SkillNode } from "./skill-tree";

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

/**
 * A node is "available" (unlocked) when every prerequisite it directly
 * depends on is already mastered (readiness >= 1.0).
 */
function isAvailable(node: SkillNode, stats: Record<string, { total: number }>): boolean {
  if (node.prerequisiteId) {
    const prereq = NODE_MAP.get(node.prerequisiteId);
    if (!prereq || readinessOf(prereq, stats) < 1.0) return false;
  }
  for (const sid of node.secondaryPrerequisiteIds ?? []) {
    const prereq = NODE_MAP.get(sid);
    if (!prereq || readinessOf(prereq, stats) < 1.0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  // Pick the highest-level node that is both available (prerequisites met)
  // and not yet mastered — i.e. the most advanced skill the user can work on.
  // "candidates" is ordered earliest-first, so the last available+unmastered
  // item is the highest available prerequisite.
  const availableUnmastered = unmastered.filter((n) => isAvailable(n, exerciseStats));

  // If somehow nothing is available (e.g. brand-new user with no reps at all),
  // fall back to the very first unmastered prerequisite (the starting point).
  const focusNode = availableUnmastered.length > 0
    ? availableUnmastered[availableUnmastered.length - 1]
    : unmastered[0];

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
