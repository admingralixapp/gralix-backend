/**
 * Daily Prescription Engine
 *
 * Given a user's target skill, a set of actually-mastered node IDs (from
 * evaluateSkillTree), and their exercise history (exerciseStats for progress
 * display), finds the highest skill in the prerequisite chain that is:
 *   1. not yet mastered, AND
 *   2. available — every direct prerequisite is already mastered
 *
 * This means the user always sees the most advanced skill they can work on
 * RIGHT NOW on the path to their goal.
 */

import { ALL_SKILL_NODES, type SkillNode } from "./skill-tree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrescriptionResult {
  targetNode: SkillNode;
  focusNode: SkillNode;
  /** 0–1 readiness fraction for focusNode (exercise-stats proxy for progress bar) */
  readiness: number;
  requiredReps: number;
  totalReps: number;
  allMastered: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NODE_MAP = new Map(ALL_SKILL_NODES.map((n) => [n.id, n]));

function nodeTotal(node: SkillNode, stats: Record<string, { total: number }>): number {
  return node.exercises.reduce((sum, ex) => sum + (stats[ex]?.total ?? 0), 0);
}

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
 * A node is available (unlocked) when every direct prerequisite it depends on
 * is in the mastered set (as determined by evaluateSkillTree).
 */
function isAvailable(node: SkillNode, masteredNodeIds: Set<string>): boolean {
  if (node.prerequisiteId && !masteredNodeIds.has(node.prerequisiteId)) return false;
  for (const sid of node.secondaryPrerequisiteIds ?? []) {
    if (!masteredNodeIds.has(sid)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the single best exercise prescription for today, or null if the
 * targetSkillId is not found in the skill tree.
 *
 * @param masteredNodeIds  Set of node IDs the user has truly mastered,
 *                         derived from evaluateSkillTree() — used for all
 *                         mastered/available decisions.
 * @param exerciseStats    Lifetime rep totals per exercise — used ONLY for
 *                         the progress bar readiness display on the focus node.
 */
export function getDailyPrescription(
  targetSkillId: string,
  masteredNodeIds: Set<string>,
  exerciseStats: Record<string, { total: number }>,
): PrescriptionResult | null {
  const targetNode = NODE_MAP.get(targetSkillId);
  if (!targetNode) return null;

  const prereqs = buildPrerequisiteChain(targetSkillId);
  const candidates = [...prereqs, targetNode];

  // Unmastered = not in the real mastery set
  const unmastered = candidates.filter((n) => !masteredNodeIds.has(n.id));

  if (unmastered.length === 0) {
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

  // Available = unmastered AND every direct prerequisite is mastered.
  // "candidates" is ordered earliest-first, so the LAST available+unmastered
  // item is the highest prerequisite the user can work on right now.
  const availableUnmastered = unmastered.filter((n) => isAvailable(n, masteredNodeIds));

  // Fallback: brand-new user — nothing available yet, point to the very first node.
  const focusNode = availableUnmastered.length > 0
    ? availableUnmastered[availableUnmastered.length - 1]
    : unmastered[0];

  const required = focusNode.masteryRequirement.minReps * focusNode.masteryRequirement.minQualifyingSessions;
  const total     = nodeTotal(focusNode, exerciseStats);

  return {
    targetNode,
    focusNode,
    readiness:    readinessOf(focusNode, exerciseStats),
    requiredReps: required,
    totalReps:    total,
    allMastered:  false,
  };
}
