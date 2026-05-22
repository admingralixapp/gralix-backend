import { cn } from "@/lib/utils";
import { EmojiIcon } from "@/components/emoji-icon";
import {
  ALL_MILESTONE_BADGES,
  MILESTONE_CATEGORIES,
  COLOR_CLASSES,
  TIER_GLOW,
  type MilestoneCategory,
} from "@/lib/milestone-badges";

interface LifetimeReps {
  push: number;
  pull: number;
  core: number;
  legs: number;
}

interface BadgeGalleryProps {
  earnedBadgeIds: string[];
  lifetimeReps?: LifetimeReps;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  push: "Push",
  pull: "Pull",
  core: "Core",
  legs: "Legs",
};

function RepProgressBar({
  current,
  next,
  color,
}: {
  current: number;
  next: number;
  color: string;
}) {
  const pct = Math.min(100, (current / next) * 100);
  const colorMap: Record<string, string> = {
    orange: "bg-orange-500",
    blue:   "bg-blue-500",
    purple: "bg-violet-500",
    green:  "bg-emerald-500",
  };
  return (
    <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", colorMap[color] ?? "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function BadgeGallery({ earnedBadgeIds, lifetimeReps, compact = false }: BadgeGalleryProps) {
  const earnedSet = new Set(earnedBadgeIds);

  if (compact) {
    // Compact view: just show earned badges as small pills
    const earned = ALL_MILESTONE_BADGES.filter((b) => earnedSet.has(b.id));
    if (earned.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {earned.map((badge) => {
          const colors = COLOR_CLASSES[badge.color] ?? COLOR_CLASSES.orange!;
          return (
            <span
              key={badge.id}
              title={badge.description}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                colors.bg,
                colors.text,
                colors.border,
                TIER_GLOW[badge.tier],
              )}
            >
              <EmojiIcon emoji={badge.icon} className="w-3.5 h-3.5 object-contain shrink-0" />
              {badge.name}
            </span>
          );
        })}
      </div>
    );
  }

  // Full gallery: one row per category, 5 tiers
  return (
    <div className="space-y-4">
      {MILESTONE_CATEGORIES.map((cat) => {
        const categoryBadges = ALL_MILESTONE_BADGES.filter((b) => b.category === cat);
        const colors = COLOR_CLASSES[categoryBadges[0]?.color ?? "orange"]!;
        const catReps = lifetimeReps?.[cat] ?? 0;
        // Find next milestone
        const nextBadge = categoryBadges.find((b) => !earnedSet.has(b.id));

        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <EmojiIcon emoji={categoryBadges[0]?.icon ?? ""} className="w-5 h-5 object-contain shrink-0" />
                <span className={cn("text-sm font-semibold", colors.text)}>
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {catReps.toLocaleString()} reps lifetime
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {categoryBadges.map((badge) => {
                const earned = earnedSet.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    title={earned ? badge.description : `${badge.description} (${(badge.repsRequired - catReps).toLocaleString()} more reps)`}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all",
                      earned
                        ? cn(colors.bg, colors.border, TIER_GLOW[badge.tier])
                        : "bg-secondary/30 border-border opacity-50 grayscale",
                    )}
                  >
                    <span className={cn(!earned && "opacity-40")}>
                      <EmojiIcon emoji={earned ? badge.icon : "🔒"} className="w-6 h-6 object-contain" />
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold leading-tight",
                      earned ? colors.text : "text-muted-foreground",
                    )}>
                      {badge.tier}
                    </span>
                    <span className="text-[8px] text-muted-foreground leading-tight">
                      {badge.repsRequired >= 1000
                        ? `${badge.repsRequired / 1000}k`
                        : badge.repsRequired}{" "}
                      reps
                    </span>
                    {!earned && (
                      <RepProgressBar
                        current={catReps}
                        next={badge.repsRequired}
                        color={categoryBadges[0]?.color ?? "orange"}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {nextBadge && catReps > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {(nextBadge.repsRequired - catReps).toLocaleString()} more reps to{" "}
                <span className={colors.text}>{nextBadge.tier}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
