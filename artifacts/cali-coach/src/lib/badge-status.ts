/**
 * Badge / Status tier system based on mastered skill node count.
 *
 * Tiers (hierarchical — higher tier always wins):
 *   Bronze   1-4   mastered
 *   Silver   5-9
 *   Gold    10-19
 *   Platinum 20-29
 *   Diamond  30-39
 *   Elite    40-51
 *   Master   52    (all skills)
 */

export type BadgeTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Elite"
  | "Master";

export interface BadgeInfo {
  tier: BadgeTier;
  label: string;
  /** Tailwind text colour for the tier label */
  textColor: string;
  /** Tailwind background for the pill */
  bgColor: string;
  /** Tailwind border colour */
  borderColor: string;
  /** Emoji/icon representing the tier */
  icon: string;
}

const TIERS: Array<{ min: number; info: BadgeInfo }> = [
  {
    min: 52,
    info: {
      tier:        "Master",
      label:       "Master",
      textColor:   "text-yellow-300",
      bgColor:     "bg-yellow-500/15",
      borderColor: "border-yellow-500/40",
      icon:        "👑",
    },
  },
  {
    min: 40,
    info: {
      tier:        "Elite",
      label:       "Elite",
      textColor:   "text-purple-300",
      bgColor:     "bg-purple-500/15",
      borderColor: "border-purple-500/40",
      icon:        "⚡",
    },
  },
  {
    min: 30,
    info: {
      tier:        "Diamond",
      label:       "Diamond",
      textColor:   "text-cyan-300",
      bgColor:     "bg-cyan-500/15",
      borderColor: "border-cyan-500/40",
      icon:        "💎",
    },
  },
  {
    min: 20,
    info: {
      tier:        "Platinum",
      label:       "Platinum",
      textColor:   "text-sky-300",
      bgColor:     "bg-sky-500/15",
      borderColor: "border-sky-500/40",
      icon:        "🏅",
    },
  },
  {
    min: 10,
    info: {
      tier:        "Gold",
      label:       "Gold",
      textColor:   "text-amber-400",
      bgColor:     "bg-amber-500/15",
      borderColor: "border-amber-500/40",
      icon:        "🥇",
    },
  },
  {
    min: 5,
    info: {
      tier:        "Silver",
      label:       "Silver",
      textColor:   "text-slate-300",
      bgColor:     "bg-slate-400/15",
      borderColor: "border-slate-400/40",
      icon:        "🥈",
    },
  },
  {
    min: 1,
    info: {
      tier:        "Bronze",
      label:       "Bronze",
      textColor:   "text-amber-700",
      bgColor:     "bg-amber-700/15",
      borderColor: "border-amber-700/40",
      icon:        "🥉",
    },
  },
];

/** Returns the badge info for a given mastered-skill count, or null for 0. */
export function getBadge(masteredCount: number): BadgeInfo | null {
  for (const { min, info } of TIERS) {
    if (masteredCount >= min) return info;
  }
  return null;
}
