/**
 * Milestone Badge definitions — shared frontend copy.
 * Mirrors artifacts/api-server/src/lib/milestoneBadges.ts
 */

export type MilestoneCategory = "push" | "pull" | "core" | "legs";
export type MilestoneTier = "Starter" | "Bronze" | "Silver" | "Gold" | "Platinum";

export interface MilestoneBadgeDef {
  id: string;
  category: MilestoneCategory;
  tier: MilestoneTier;
  name: string;
  description: string;
  repsRequired: number;
  icon: string;
  color: string;
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

export const ALL_MILESTONE_BADGES: MilestoneBadgeDef[] = (
  Object.entries(CATEGORY_META) as Array<[MilestoneCategory, { label: string; icon: string; color: string }]>
).flatMap(([cat, meta]) =>
  THRESHOLDS.map(({ reps, tier }) => ({
    id:           `${cat}-${tier.toLowerCase()}`,
    category:     cat,
    tier,
    name:         `${meta.label} ${tier}`,
    description:  `Complete ${reps.toLocaleString()} lifetime ${meta.label.toLowerCase()} reps.`,
    repsRequired: reps,
    icon:         meta.icon,
    color:        meta.color,
  })),
);

export const MILESTONE_BADGE_MAP = new Map<string, MilestoneBadgeDef>(
  ALL_MILESTONE_BADGES.map((b) => [b.id, b]),
);

/** Ordered categories for display. */
export const MILESTONE_CATEGORIES: MilestoneCategory[] = ["push", "pull", "core", "legs"];

/** Tailwind color classes per color token. */
export const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  orange: {
    bg:     "bg-orange-500/20",
    text:   "text-orange-300",
    border: "border-orange-500/40",
    ring:   "ring-orange-500/30",
  },
  blue: {
    bg:     "bg-blue-500/20",
    text:   "text-blue-300",
    border: "border-blue-500/40",
    ring:   "ring-blue-500/30",
  },
  purple: {
    bg:     "bg-violet-500/20",
    text:   "text-violet-300",
    border: "border-violet-500/40",
    ring:   "ring-violet-500/30",
  },
  green: {
    bg:     "bg-emerald-500/20",
    text:   "text-emerald-300",
    border: "border-emerald-500/40",
    ring:   "ring-emerald-500/30",
  },
};

const TIER_ORDER: MilestoneTier[] = ["Starter", "Bronze", "Silver", "Gold", "Platinum"];

export const TIER_GLOW: Record<MilestoneTier, string> = {
  Starter:  "shadow-sm",
  Bronze:   "shadow-amber-700/30 shadow-md",
  Silver:   "shadow-slate-400/30 shadow-md",
  Gold:     "shadow-yellow-400/40 shadow-lg",
  Platinum: "shadow-cyan-300/50 shadow-xl ring-1 ring-cyan-300/30",
};

/** Return earned badge IDs for a given rep total per category. */
export function computeEarnedBadgeIds(reps: {
  push: number; pull: number; core: number; legs: number;
}): string[] {
  const ids: string[] = [];
  for (const cat of MILESTONE_CATEGORIES) {
    for (const { reps: req, tier } of THRESHOLDS) {
      if (reps[cat] >= req) ids.push(`${cat}-${tier.toLowerCase()}`);
    }
  }
  return ids;
}

/** Highest earned tier for a category given rep count. */
export function highestTierForCategory(
  category: MilestoneCategory,
  repCount: number,
): { badge: MilestoneBadgeDef; next: MilestoneBadgeDef | null } | null {
  const badges = ALL_MILESTONE_BADGES.filter((b) => b.category === category);
  const earned = badges.filter((b) => repCount >= b.repsRequired);
  if (earned.length === 0) return null;
  const top = earned[earned.length - 1]!;
  const nextIdx = TIER_ORDER.indexOf(top.tier) + 1;
  const nextTier = nextIdx < TIER_ORDER.length ? TIER_ORDER[nextIdx] : null;
  const next = nextTier
    ? (ALL_MILESTONE_BADGES.find((b) => b.category === category && b.tier === nextTier) ?? null)
    : null;
  return { badge: top, next };
}

/** Reps needed for the next milestone in a category. */
export function repsToNextMilestone(
  category: MilestoneCategory,
  currentReps: number,
): { next: MilestoneBadgeDef; remaining: number } | null {
  const next = ALL_MILESTONE_BADGES.find(
    (b) => b.category === category && b.repsRequired > currentReps,
  );
  if (!next) return null;
  return { next, remaining: next.repsRequired - currentReps };
}
