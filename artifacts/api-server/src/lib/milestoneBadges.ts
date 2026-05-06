/**
 * Milestone Badge System — lifetime cumulative rep milestones per category.
 *
 * Categories: push | pull | core | legs
 * Thresholds: 10, 100, 500, 1000, 5000 reps
 * Tiers:      Starter | Bronze | Silver | Gold | Platinum
 */

export type MilestoneCategory = "push" | "pull" | "core" | "legs";
export type MilestoneTier = "Starter" | "Bronze" | "Silver" | "Gold" | "Platinum";

export interface MilestoneBadgeDef {
  id: string;                 // e.g. "push-bronze"
  category: MilestoneCategory;
  tier: MilestoneTier;
  name: string;              // e.g. "Push Specialist (Bronze)"
  description: string;
  repsRequired: number;
  icon: string;              // emoji
  color: string;             // Tailwind class token
}

const THRESHOLDS: Array<{ reps: number; tier: MilestoneTier }> = [
  { reps: 10,   tier: "Starter"  },
  { reps: 100,  tier: "Bronze"   },
  { reps: 500,  tier: "Silver"   },
  { reps: 1000, tier: "Gold"     },
  { reps: 5000, tier: "Platinum" },
];

const CATEGORY_META: Record<MilestoneCategory, { label: string; icon: string; color: string }> = {
  push: { label: "Push",  icon: "💪", color: "orange" },
  pull: { label: "Pull",  icon: "🔵", color: "blue"   },
  core: { label: "Core",  icon: "⚡", color: "purple" },
  legs: { label: "Legs",  icon: "🟢", color: "green"  },
};

const TIER_NAMES: Record<MilestoneTier, string> = {
  Starter:  "Starter",
  Bronze:   "Bronze",
  Silver:   "Silver",
  Gold:     "Gold",
  Platinum: "Platinum",
};

/** All possible milestone badges (20 total). */
export const ALL_MILESTONE_BADGES: MilestoneBadgeDef[] = (
  Object.entries(CATEGORY_META) as Array<[MilestoneCategory, typeof CATEGORY_META[MilestoneCategory]]>
).flatMap(([cat, meta]) =>
  THRESHOLDS.map(({ reps, tier }) => ({
    id:           `${cat}-${tier.toLowerCase()}`,
    category:     cat,
    tier,
    name:         `${meta.label} ${TIER_NAMES[tier]}`,
    description:  `Complete ${reps.toLocaleString()} lifetime ${meta.label.toLowerCase()} reps.`,
    repsRequired: reps,
    icon:         meta.icon,
    color:        meta.color,
  })),
);

/** Map badge ID → definition for fast lookup. */
export const MILESTONE_BADGE_MAP = new Map<string, MilestoneBadgeDef>(
  ALL_MILESTONE_BADGES.map((b) => [b.id, b]),
);

/**
 * Given an old rep count and a new rep count for a category,
 * return any newly earned badge IDs (thresholds crossed).
 */
export function getNewlyEarnedBadgeIds(
  category: MilestoneCategory,
  oldReps: number,
  newReps: number,
): string[] {
  return THRESHOLDS.filter(
    ({ reps }) => oldReps < reps && newReps >= reps,
  ).map(({ tier }) => `${category}-${tier.toLowerCase()}`);
}

/** Exercise → category mapping (case-insensitive). */
const EXERCISE_CATEGORY: Record<string, MilestoneCategory> = {
  // PUSH
  "push-up":              "push",
  "diamond push-up":      "push",
  "pike push-up":         "push",
  "elevated pike push-up": "push",
  "handstand push-up":    "push",
  "dip":                  "push",
  "wall push-up":         "push",
  "incline push-up":      "push",
  "knee push-up":         "push",
  // PULL
  "pull-up":              "pull",
  "chin-up":              "pull",
  "chest-to-bar pull-up": "pull",
  "archer pull-up":       "pull",
  "muscle-up":            "pull",
  "australian rows":      "pull",
  "negative pull-ups":    "pull",
  "scapular shrugs":      "pull",
  "explosive pull-up":    "pull",
  // CORE
  "plank":                "core",
  "burpee":               "core",
  "hollow body hold":     "core",
  "tuck l-sit":           "core",
  "dragon flag":          "core",
  "tuck front lever":     "core",
  "straddle front lever": "core",
  "full front lever":     "core",
  "human flag":           "core",
  // LEGS
  "squat":                "legs",
  "lunge":                "legs",
  "assisted squat":       "legs",
  "bulgarian split squat": "legs",
  "shrimp squat":         "legs",
  "pistol squat":         "legs",
  "nordic curls":         "legs",
  "archer squat":         "legs",
};

/** Look up the movement category for an exercise name. */
export function getExerciseCategory(exerciseName: string): MilestoneCategory | null {
  return EXERCISE_CATEGORY[exerciseName.toLowerCase()] ?? null;
}

export interface LifetimeReps {
  push: number;
  pull: number;
  core: number;
  legs: number;
}

/**
 * Compute absolute lifetime rep totals from a user's full session history.
 * Used for initial backfill when a user first sets up their profile.
 */
export function computeLifetimeRepsFromSessions(
  sessions: Array<{ exerciseName: string; totalReps: number | null; completedAt: Date | string | null }>,
): LifetimeReps {
  const totals: LifetimeReps = { push: 0, pull: 0, core: 0, legs: 0 };
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const cat = getExerciseCategory(s.exerciseName);
    if (cat) totals[cat] += s.totalReps ?? 0;
  }
  return totals;
}

/**
 * Determine all badge IDs earned given current lifetime reps.
 */
export function computeEarnedBadgeIds(reps: LifetimeReps): string[] {
  const ids: string[] = [];
  for (const [cat, total] of Object.entries(reps) as Array<[MilestoneCategory, number]>) {
    for (const { reps: required, tier } of THRESHOLDS) {
      if (total >= required) ids.push(`${cat}-${tier.toLowerCase()}`);
    }
  }
  return ids;
}
