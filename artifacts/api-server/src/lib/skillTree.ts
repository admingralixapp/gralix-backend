/**
 * Backend mirror of the frontend skill tree data.
 * Used to compute per-user Performance Points for leaderboards.
 *
 * Scoring (AI-Verified sessions only):
 *   Points per set = difficultyWeight × reps × (formScore / 100)
 *   For static holds: reps = seconds held
 *
 * Skill Tree XP (masteredCount):
 *   Uses ALL sessions (verified + manual) — unchanged from before.
 *   Not capped; contributes only to secondary sort on leaderboard.
 */

interface SkillNodeDef {
  id: string;
  level: number;
  levelName: string;
  title: string;
  branch: string;
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
    id: "push-1", level: 1, levelName: "Beginner", title: "Push-Up Foundation", branch: "PUSH",
    exercises: ["Push-Up"],
    masteryRequirement: { minReps: 5,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "push-2", level: 2, levelName: "Novice", title: "Push-Up Strength", branch: "PUSH",
    exercises: ["Push-Up"],
    masteryRequirement: { minReps: 10, minFormScore: 78, minQualifyingSessions: 5 },
  },
  {
    id: "push-3", level: 3, levelName: "Intermediate", title: "Dip Introduction", branch: "PUSH",
    exercises: ["Dip"],
    masteryRequirement: { minReps: 5,  minFormScore: 80, minQualifyingSessions: 3 },
  },
  {
    id: "push-4", level: 4, levelName: "Advanced", title: "Dip Mastery", branch: "PUSH",
    exercises: ["Dip"],
    masteryRequirement: { minReps: 10, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "push-5", level: 5, levelName: "Elite", title: "Push Elite", branch: "PUSH",
    exercises: ["Push-Up", "Dip"],
    masteryRequirement: { minReps: 15, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── PULL ──────────────────────────────────────────────────────────────────
  {
    id: "pull-1", level: 1, levelName: "Beginner", title: "First Pull-Up", branch: "PULL",
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 1,  minFormScore: 65, minQualifyingSessions: 2 },
  },
  {
    id: "pull-2", level: 2, levelName: "Novice", title: "Pull-Up Consistency", branch: "PULL",
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 5,  minFormScore: 75, minQualifyingSessions: 3 },
  },
  {
    id: "pull-3", level: 3, levelName: "Intermediate", title: "Pull-Up Strength", branch: "PULL",
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 8,  minFormScore: 80, minQualifyingSessions: 5 },
  },
  {
    id: "pull-4", level: 4, levelName: "Advanced", title: "Pull-Up Power", branch: "PULL",
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 12, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "pull-5", level: 5, levelName: "Elite", title: "Pull Elite", branch: "PULL",
    exercises: ["Pull-Up"],
    masteryRequirement: { minReps: 20, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── CORE ──────────────────────────────────────────────────────────────────
  {
    id: "core-1", level: 1, levelName: "Beginner", title: "Plank Foundation", branch: "CORE",
    exercises: ["Plank"],
    masteryRequirement: { minReps: 1,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "core-2", level: 2, levelName: "Novice", title: "Burpee Basics", branch: "CORE",
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 5,  minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "core-3", level: 3, levelName: "Intermediate", title: "Burpee Conditioning", branch: "CORE",
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 8,  minFormScore: 80, minQualifyingSessions: 5 },
  },
  {
    id: "core-4", level: 4, levelName: "Advanced", title: "Burpee Power", branch: "CORE",
    exercises: ["Burpee"],
    masteryRequirement: { minReps: 12, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "core-5", level: 5, levelName: "Elite", title: "Core Elite", branch: "CORE",
    exercises: ["Burpee", "Plank"],
    masteryRequirement: { minReps: 15, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  {
    id: "legs-1", level: 1, levelName: "Beginner", title: "Squat Foundation", branch: "LEGS",
    exercises: ["Squat"],
    masteryRequirement: { minReps: 10, minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "legs-2", level: 2, levelName: "Novice", title: "Squat Strength", branch: "LEGS",
    exercises: ["Squat"],
    masteryRequirement: { minReps: 15, minFormScore: 78, minQualifyingSessions: 5 },
  },
  {
    id: "legs-3", level: 3, levelName: "Intermediate", title: "Lunge Balance", branch: "LEGS",
    exercises: ["Lunge"],
    masteryRequirement: { minReps: 10, minFormScore: 80, minQualifyingSessions: 3 },
  },
  {
    id: "legs-4", level: 4, levelName: "Advanced", title: "Lunge Mastery", branch: "LEGS",
    exercises: ["Lunge"],
    masteryRequirement: { minReps: 15, minFormScore: 85, minQualifyingSessions: 5 },
  },
  {
    id: "legs-5", level: 5, levelName: "Elite", title: "Legs Elite", branch: "LEGS",
    exercises: ["Squat", "Lunge"],
    masteryRequirement: { minReps: 20, minFormScore: 90, minQualifyingSessions: 7 },
  },

  // ── Overhead Pressing Path ─────────────────────────────────────────────────
  {
    id: "push-oh-1", level: 2, levelName: "Novice", title: "Pike Push-Up", branch: "PUSH",
    exercises: ["Pike Push-Up"],
    masteryRequirement: { minReps: 8, minFormScore: 72, minQualifyingSessions: 3 },
  },
  {
    id: "push-oh-2", level: 3, levelName: "Intermediate", title: "Elevated Pike Push-Up", branch: "PUSH",
    exercises: ["Elevated Pike Push-Up"],
    masteryRequirement: { minReps: 8, minFormScore: 78, minQualifyingSessions: 4 },
  },

  // ── Explosive Pull Path ────────────────────────────────────────────────────
  {
    id: "pull-exp-1", level: 3, levelName: "Intermediate", title: "Chest-to-Bar Pull-Up", branch: "PULL",
    exercises: ["Chest-to-Bar Pull-Up"],
    masteryRequirement: { minReps: 5, minFormScore: 78, minQualifyingSessions: 4 },
  },
  {
    id: "pull-exp-2", level: 4, levelName: "Advanced", title: "Archer Pull-Up", branch: "PULL",
    exercises: ["Archer Pull-Up"],
    masteryRequirement: { minReps: 4, minFormScore: 80, minQualifyingSessions: 4 },
  },

  // ── Static Holds Path ─────────────────────────────────────────────────────
  {
    id: "core-sh-1", level: 2, levelName: "Novice", title: "Hollow Body Hold", branch: "CORE",
    exercises: ["Hollow Body Hold"],
    masteryRequirement: { minReps: 20, minFormScore: 70, minQualifyingSessions: 3 },
  },
  {
    id: "core-sh-2", level: 3, levelName: "Intermediate", title: "Tuck L-Sit", branch: "CORE",
    exercises: ["Tuck L-Sit"],
    masteryRequirement: { minReps: 10, minFormScore: 72, minQualifyingSessions: 4 },
  },

  // ── Unilateral Legs Path ───────────────────────────────────────────────────
  {
    id: "legs-uni-1", level: 3, levelName: "Intermediate", title: "Bulgarian Split Squat", branch: "LEGS",
    exercises: ["Bulgarian Split Squat"],
    masteryRequirement: { minReps: 8, minFormScore: 78, minQualifyingSessions: 4 },
  },
  {
    id: "legs-uni-2", level: 4, levelName: "Advanced", title: "Shrimp Squat", branch: "LEGS",
    exercises: ["Shrimp Squat"],
    masteryRequirement: { minReps: 5, minFormScore: 80, minQualifyingSessions: 4 },
  },
];

// ─── Difficulty Weights ───────────────────────────────────────────────────────
// Points per rep (or per second for holds) = weight × (formScore / 100)
// Tiers: Beginner=1.0, Intermediate=3.0, Advanced=5.0, Elite=10.0

export const DIFFICULTY_WEIGHTS: Record<string, number> = {
  // ── Beginner (1.0) ──
  "Wall Push-Up":       1.0,
  "Incline Push-Up":    1.0,
  "Knee Push-Up":       1.0,
  "Assisted Squat":     1.0,
  "Scapular Shrugs":    1.0,
  "Negative Pull-Ups":  1.0,
  "Plank":              1.0,
  // ── Intermediate (3.0) ──
  "Push-Up":            3.0,
  "Diamond Push-Up":    3.0,
  "Pike Push-Up":       3.0,
  "Australian Rows":    3.0,
  "Pull-Up":            3.0,
  "Dip":                3.0,
  "Squat":              3.0,
  "Lunge":              3.0,
  "Burpee":             3.0,
  "Hollow Body Hold":   3.0,
  "Tuck Front Lever":   3.0,
  "Bulgarian Split Squat": 3.0,
  "Chest-to-Bar Pull-Up":  3.0,
  // ── Advanced (5.0) ──
  "Elevated Pike Push-Up": 5.0,
  "Explosive Pull-Up":  5.0,
  "Archer Pull-Up":     5.0,
  "Tuck L-Sit":         5.0,
  "Straddle Front Lever": 5.0,
  "Dragon Flag":        5.0,
  "Archer Squat":       5.0,
  "Nordic Curls":       5.0,
  "Shrimp Squat":       5.0,
  "Pistol Squat":       5.0,
  // ── Elite (10.0) ──
  "Handstand Push-Up":  10.0,
  "Muscle-Up":          10.0,
  "Full Front Lever":   10.0,
  "Human Flag":         10.0,
};

/** Case-insensitive difficulty weight lookup. Returns 1.0 for unknown exercises. */
function getDifficultyWeight(exerciseName: string): number {
  const key = Object.keys(DIFFICULTY_WEIGHTS).find(
    (k) => k.toLowerCase() === exerciseName.toLowerCase(),
  );
  return key ? DIFFICULTY_WEIGHTS[key] : 1.0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionRow {
  exerciseName: string;
  totalReps: number | null;
  avgFormScore: number | null;
  completedAt: Date | string | null;
  /** false = manual log or frozen-frame flagged; absent/null = treat as true (legacy). */
  isVerified?: boolean | null;
}

export interface MasteredSkillInfo {
  id: string;
  level: number;
  levelName: string;
  title: string;
  branch: string;
}

// ─── computeMasteryPoints ─────────────────────────────────────────────────────

/**
 * Compute a user's leaderboard score from their session history.
 *
 * points (leaderboard):
 *   Sum of (difficultyWeight × reps × formScore/100) for every AI-Verified set.
 *   Manual logs contribute 0 leaderboard points.
 *
 * masteredCount (secondary sort, Skill Tree XP):
 *   Counted from ALL sessions (verified + manual) — manual logs still count
 *   toward skill mastery as before.
 */
export function computeMasteryPoints(sessions: SessionRow[]): {
  points: number;
  masteredCount: number;
} {
  // ── Performance Points (verified only) ──
  let points = 0;
  for (const s of sessions) {
    // Skip unverified / manual logs
    if (s.isVerified === false) continue;
    if (s.completedAt == null) continue;
    const reps      = s.totalReps ?? 0;
    const form      = s.avgFormScore ?? 0;
    const weight    = getDifficultyWeight(s.exerciseName);
    points += weight * reps * (form / 100);
  }
  points = Math.round(points);

  // ── Skill Tree Mastery Count (all sessions) ──
  const allCompleted = sessions.filter((s) => s.completedAt != null);
  const masteredIds  = new Set<string>();

  for (const node of SKILL_NODES) {
    const req = node.masteryRequirement;
    const qualifying = allCompleted.filter(
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

  return { points, masteredCount: masteredIds.size };
}

/**
 * Return the full node info for every mastered skill (uses all sessions).
 */
export function getMasteredSkills(sessions: SessionRow[]): MasteredSkillInfo[] {
  const completed = sessions.filter((s) => s.completedAt != null);
  const result: MasteredSkillInfo[] = [];

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
      result.push({
        id: node.id,
        level: node.level,
        levelName: node.levelName,
        title: node.title,
        branch: node.branch,
      });
    }
  }

  return result;
}
