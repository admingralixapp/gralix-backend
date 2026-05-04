/**
 * Skill Tree Configuration
 *
 * Four branches — PUSH, PULL, CORE, LEGS — each with 5 levels (Beginner → Elite).
 * Each SkillNode defines:
 *   - which exercises count toward mastery
 *   - masteryRequirement: the bar a user must clear
 *   - prerequisiteId: the node that must be MASTERED before this one UNLOCKS
 */

export type SkillBranch = "PUSH" | "PULL" | "CORE" | "LEGS";

export type SkillLevelName =
  | "Beginner"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Elite";

export interface MasteryRequirement {
  /** Human-readable description shown in the UI */
  description: string;
  /**
   * A session "qualifies" when the user completes at least this many reps.
   * For Plank (no rep counting), 1 is sufficient — form score carries the weight.
   */
  minReps: number;
  /** Minimum avgFormScore (0–100) for a session to qualify */
  minFormScore: number;
  /** Number of qualifying sessions needed to MASTER this skill */
  minQualifyingSessions: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  /** 1 = Beginner, 5 = Elite */
  level: number;
  levelName: SkillLevelName;
  title: string;
  description: string;
  /**
   * Exercise names (from the DB) that count toward mastery.
   * A session qualifies if it matches ANY exercise in this list.
   */
  exercises: string[];
  masteryRequirement: MasteryRequirement;
  /** id of the SkillNode that must be mastered first. null = always unlocked. */
  prerequisiteId: string | null;
}

// ─── PUSH Branch ──────────────────────────────────────────────────────────────
// Horizontal pressing movements: Push-Up → Dip
const PUSH_NODES: SkillNode[] = [
  {
    id: "push-1",
    branch: "PUSH",
    level: 1,
    levelName: "Beginner",
    title: "Push-Up Foundation",
    description: "Build the foundational pressing pattern with a standard push-up.",
    exercises: ["Push-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥70% form score in 3 sessions",
      minReps: 5,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "push-2",
    branch: "PUSH",
    level: 2,
    levelName: "Novice",
    title: "Push-Up Strength",
    description: "Double your push-up capacity and tighten your form.",
    exercises: ["Push-Up"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥78% form score in 5 sessions",
      minReps: 10,
      minFormScore: 78,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-1",
  },
  {
    id: "push-3",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    title: "Dip Introduction",
    description: "Transition to parallel-bar dips for deeper chest and tricep strength.",
    exercises: ["Dip"],
    masteryRequirement: {
      description: "Complete 5 dips with ≥80% form score in 3 sessions",
      minReps: 5,
      minFormScore: 80,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "push-2",
  },
  {
    id: "push-4",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    title: "Dip Mastery",
    description: "Command the dip with high volume and elite technique.",
    exercises: ["Dip"],
    masteryRequirement: {
      description: "Complete 10 dips with ≥85% form score in 5 sessions",
      minReps: 10,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-3",
  },
  {
    id: "push-5",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    title: "Push Elite",
    description: "Demonstrate elite-level pressing endurance across both movements.",
    exercises: ["Push-Up", "Dip"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥90% form score in 7 sessions",
      minReps: 15,
      minFormScore: 90,
      minQualifyingSessions: 7,
    },
    prerequisiteId: "push-4",
  },
];

// ─── PULL Branch ──────────────────────────────────────────────────────────────
// Vertical pulling: first rep → 20-rep dead-hang sets
const PULL_NODES: SkillNode[] = [
  {
    id: "pull-1",
    branch: "PULL",
    level: 1,
    levelName: "Beginner",
    title: "First Pull-Up",
    description: "Achieve your first clean, full-range pull-up from a dead hang.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 1 rep with ≥65% form score in 2 sessions",
      minReps: 1,
      minFormScore: 65,
      minQualifyingSessions: 2,
    },
    prerequisiteId: null,
  },
  {
    id: "pull-2",
    branch: "PULL",
    level: 2,
    levelName: "Novice",
    title: "Pull-Up Consistency",
    description: "Develop reliable pull-up strength across multiple reps.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥75% form score in 3 sessions",
      minReps: 5,
      minFormScore: 75,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "pull-1",
  },
  {
    id: "pull-3",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    title: "Pull-Up Strength",
    description: "Build serious lat and bicep strength with quality sets of 8.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥80% form score in 5 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-2",
  },
  {
    id: "pull-4",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    title: "Pull-Up Power",
    description: "Reach sets of 12+ with near-perfect form and zero swing.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 12 reps with ≥85% form score in 5 sessions",
      minReps: 12,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-3",
  },
  {
    id: "pull-5",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    title: "Pull Elite",
    description: "Demonstrate elite pulling endurance with 20-rep dead-hang sets.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 20 reps with ≥90% form score in 7 sessions",
      minReps: 20,
      minFormScore: 90,
      minQualifyingSessions: 7,
    },
    prerequisiteId: "pull-4",
  },
];

// ─── CORE Branch ──────────────────────────────────────────────────────────────
// Isometric holding + explosive full-body conditioning
const CORE_NODES: SkillNode[] = [
  {
    id: "core-1",
    branch: "CORE",
    level: 1,
    levelName: "Beginner",
    title: "Plank Foundation",
    description: "Build a solid isometric core base with consistent plank holds.",
    exercises: ["Plank"],
    masteryRequirement: {
      description: "Hold a plank with ≥70% form score in 3 sessions",
      minReps: 1,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "core-2",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    title: "Burpee Basics",
    description: "Introduce explosive full-body conditioning with burpees.",
    exercises: ["Burpee"],
    masteryRequirement: {
      description: "Complete 5 burpees with ≥70% form score in 3 sessions",
      minReps: 5,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
  },
  {
    id: "core-3",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    title: "Burpee Conditioning",
    description: "Sustain higher-volume burpee sets with consistent mechanics.",
    exercises: ["Burpee"],
    masteryRequirement: {
      description: "Complete 8 burpees with ≥80% form score in 5 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "core-2",
  },
  {
    id: "core-4",
    branch: "CORE",
    level: 4,
    levelName: "Advanced",
    title: "Burpee Power",
    description: "Chain powerful burpees with explosive hip extension every rep.",
    exercises: ["Burpee"],
    masteryRequirement: {
      description: "Complete 12 burpees with ≥85% form score in 5 sessions",
      minReps: 12,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "core-3",
  },
  {
    id: "core-5",
    branch: "CORE",
    level: 5,
    levelName: "Elite",
    title: "Core Elite",
    description: "Demonstrate elite conditioning with high-volume explosive sets.",
    exercises: ["Burpee", "Plank"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥90% form score in 7 sessions",
      minReps: 15,
      minFormScore: 90,
      minQualifyingSessions: 7,
    },
    prerequisiteId: "core-4",
  },
];

// ─── LEGS Branch ──────────────────────────────────────────────────────────────
// Bilateral squat → unilateral lunge progression
const LEGS_NODES: SkillNode[] = [
  {
    id: "legs-1",
    branch: "LEGS",
    level: 1,
    levelName: "Beginner",
    title: "Squat Foundation",
    description: "Build the bilateral squat pattern with full depth and upright posture.",
    exercises: ["Squat"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥70% form score in 3 sessions",
      minReps: 10,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "legs-2",
    branch: "LEGS",
    level: 2,
    levelName: "Novice",
    title: "Squat Strength",
    description: "Increase squat volume and dial in knee tracking and depth.",
    exercises: ["Squat"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥78% form score in 5 sessions",
      minReps: 15,
      minFormScore: 78,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-1",
  },
  {
    id: "legs-3",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    title: "Lunge Balance",
    description: "Develop unilateral leg strength and coordination with lunges.",
    exercises: ["Lunge"],
    masteryRequirement: {
      description: "Complete 10 lunges with ≥80% form score in 3 sessions",
      minReps: 10,
      minFormScore: 80,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-2",
  },
  {
    id: "legs-4",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    title: "Lunge Mastery",
    description: "Build high-volume lunge capacity with a perfectly upright torso.",
    exercises: ["Lunge"],
    masteryRequirement: {
      description: "Complete 15 lunges with ≥85% form score in 5 sessions",
      minReps: 15,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-3",
  },
  {
    id: "legs-5",
    branch: "LEGS",
    level: 5,
    levelName: "Elite",
    title: "Legs Elite",
    description: "Demonstrate elite lower-body mastery across both movement patterns.",
    exercises: ["Squat", "Lunge"],
    masteryRequirement: {
      description: "Complete 20 reps with ≥90% form score in 7 sessions",
      minReps: 20,
      minFormScore: 90,
      minQualifyingSessions: 7,
    },
    prerequisiteId: "legs-4",
  },
];

// ─── Full registry ─────────────────────────────────────────────────────────────

export const SKILL_TREE_BRANCHES: Record<SkillBranch, SkillNode[]> = {
  PUSH: PUSH_NODES,
  PULL: PULL_NODES,
  CORE: CORE_NODES,
  LEGS: LEGS_NODES,
};

export const ALL_SKILL_NODES: SkillNode[] = [
  ...PUSH_NODES,
  ...PULL_NODES,
  ...CORE_NODES,
  ...LEGS_NODES,
];

// ─── Evaluation ───────────────────────────────────────────────────────────────

export type SkillStatus = "locked" | "unlocked" | "mastered";

export interface SessionSummary {
  exerciseName: string;
  totalReps: number | null;
  avgFormScore: number | null;
  completedAt: string | null;
}

export interface EvaluatedSkill extends SkillNode {
  status: SkillStatus;
  progress: {
    qualifyingSessions: number;
    bestReps: number;
    bestFormScore: number;
  };
}

/**
 * Evaluate every skill node against completed session history.
 *
 * Rules:
 *   - A session QUALIFIES if: completedAt set, exerciseName matches,
 *     totalReps >= minReps, avgFormScore >= minFormScore.
 *   - A skill is MASTERED when qualifyingSessions >= minQualifyingSessions.
 *   - A skill is UNLOCKED when its prerequisite is MASTERED (or it has none).
 *   - Otherwise the skill is LOCKED.
 */
export function evaluateSkillTree(
  sessions: SessionSummary[],
): EvaluatedSkill[] {
  const completedSessions = sessions.filter((s) => s.completedAt !== null);

  // Build a Map from id → EvaluatedSkill so we can resolve prerequisites
  const evaluated = new Map<string, EvaluatedSkill>();

  // Process each branch level by level (nodes are already ordered 1→5)
  for (const node of ALL_SKILL_NODES) {
    const req = node.masteryRequirement;

    // Count qualifying sessions
    const qualifying = completedSessions.filter(
      (s) =>
        node.exercises.some(
          (ex) => ex.toLowerCase() === s.exerciseName?.toLowerCase(),
        ) &&
        (s.totalReps ?? 0) >= req.minReps &&
        (s.avgFormScore ?? 0) >= req.minFormScore,
    );

    const bestReps = Math.max(0, ...qualifying.map((s) => s.totalReps ?? 0));
    const bestFormScore = Math.max(
      0,
      ...qualifying.map((s) => s.avgFormScore ?? 0),
    );

    const mastered = qualifying.length >= req.minQualifyingSessions;

    let status: SkillStatus;
    if (mastered) {
      status = "mastered";
    } else if (node.prerequisiteId === null) {
      status = "unlocked"; // L1 nodes are always available
    } else {
      const prereq = evaluated.get(node.prerequisiteId);
      status = prereq?.status === "mastered" ? "unlocked" : "locked";
    }

    evaluated.set(node.id, {
      ...node,
      status,
      progress: {
        qualifyingSessions: qualifying.length,
        bestReps,
        bestFormScore,
      },
    });
  }

  return Array.from(evaluated.values());
}
