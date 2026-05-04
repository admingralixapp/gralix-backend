/**
 * Backend mirror of the frontend skill tree data.
 * Used to compute per-user Mastery Points for leaderboards.
 *
 * Points per mastered skill: level × 100
 *   L1 = 100 pts, L2 = 200 pts, L3 = 300 pts, L4 = 400 pts, L5 = 500 pts
 * Max possible: 20 skills × avg 300 = 6 000 pts
 */

interface SkillNodeDef {
  id: string;
  level: number;
  exercises: string[];
  masteryRequirement: {
    minReps: number;
    minFormScore: number;
    minQualifyingSessions: number;
  };
}

export const SKILL_NODES: SkillNodeDef[] = [
  // ── PUSH ──────────────────────────────────────────────────────────────────
  {
    id: "push-1", level: 1,
    exercises: ["Push-Up"],
    masteryRequirement: { minReps: 5,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "push-2", level: 2,
    exercises: ["Push-Up"],
    masteryRequirement: { minReps: 10, minFormScore: 78, minQualifyingSessions: 5 },
  },
  {
    id: "push-3", level: 3,
    exercises: ["Dip"],
    masteryRequirement: { minReps: 5,  minFormScore: 80, minQualifyingSessions: 3 },
  },
  {
    id: "push-4", level: 4,
    exercises: ["Dip"],
    masteryRequirement: { minReps: 10, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "push-5", level: 5,
    exercises: ["Push-Up", "Dip"],
    masteryRequirement: { minReps: 15, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── PULL ──────────────────────────────────────────────────────────────────
  {
    id: "pull-1", level: 1,
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 1,  minFormScore: 65, minQualifyingSessions: 2 },
  },
  {
    id: "pull-2", level: 2,
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 5,  minFormScore: 75, minQualifyingSessions: 3 },
  },
  {
    id: "pull-3", level: 3,
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 8,  minFormScore: 80, minQualifyingSessions: 5 },
  },
  {
    id: "pull-4", level: 4,
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 12, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "pull-5", level: 5,
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 20, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── CORE ──────────────────────────────────────────────────────────────────
  {
    id: "core-1", level: 1,
    exercises: ["Plank"],
    masteryRequirement: { minReps: 1,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "core-2", level: 2,
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 5,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "core-3", level: 3,
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 8,  minFormScore: 80, minQualifyingSessions: 5 },
  },
  {
    id: "core-4", level: 4,
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 12, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "core-5", level: 5,
    exercises: ["Burpee", "Plank"],
    masteryRequirement: { minReps: 15, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  {
    id: "legs-1", level: 1,
    exercises: ["Squat"],
    masteryRequirement: { minReps: 10, minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "legs-2", level: 2,
    exercises: ["Squat"],
    masteryRequirement: { minReps: 15, minFormScore: 78, minQualifyingSessions: 5 },
  },
  {
    id: "legs-3", level: 3,
    exercises: ["Lunge"],
    masteryRequirement: { minReps: 10, minFormScore: 80, minQualifyingSessions: 3 },
  },
  {
    id: "legs-4", level: 4,
    exercises: ["Lunge"],
    masteryRequirement: { minReps: 15, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "legs-5", level: 5,
    exercises: ["Squat", "Lunge"],
    masteryRequirement: { minReps: 20, minFormScore: 90, minQualifyingSessions: 7 },
  },
];

export interface SessionRow {
  exerciseName: string;
  totalReps: number | null;
  avgFormScore: number | null;
  completedAt: Date | string | null;
}

/**
 * Compute mastery points for a single user given their session history.
 * Mirrors the frontend `evaluateSkillTree` logic exactly.
 */
export function computeMasteryPoints(sessions: SessionRow[]): {
  points: number;
  masteredCount: number;
} {
  const completed = sessions.filter((s) => s.completedAt != null);
  const masteredIds = new Set<string>();

  for (const node of SKILL_NODES) {
    const req = node.masteryRequirement;
    const qualifying = completed.filter(
      (s) =>
        node.exercises.some(
          (ex) => ex.toLowerCase() === (s.exerciseName ?? "").toLowerCase(),
        ) &&
        (s.totalReps ?? 0) >= req.minReps &&
        (s.avgFormScore ?? 0) >= req.minFormScore,
    );
    if (qualifying.length >= req.minQualifyingSessions) {
      masteredIds.add(node.id);
    }
  }

  const points = SKILL_NODES.filter((n) => masteredIds.has(n.id)).reduce(
    (sum, n) => sum + n.level * 100,
    0,
  );

  return { points, masteredCount: masteredIds.size };
}
