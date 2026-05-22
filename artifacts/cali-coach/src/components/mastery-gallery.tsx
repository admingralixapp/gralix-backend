import { useMemo } from "react";
import { EmojiIcon } from "@/components/emoji-icon";
import {
  EXERCISE_MASTERY_DEFS,
  MASTERY_THRESHOLDS,
  TIER_LABELS,
  TIER_COLORS,
  CATEGORY_COLORS,
  getAchievedTier,
  getTierTitle,
  getNextTier,
  type ExerciseStatsMap,
  type MasteryTier,
  type ExerciseMasteryDef,
} from "@/lib/exercise-mastery";

interface MasteryCardProps {
  def: ExerciseMasteryDef;
  total: number;
  tier: MasteryTier;
}

function MasteryCard({ def, total, tier }: MasteryCardProps) {
  const colors = TIER_COLORS[tier];
  const title = getTierTitle(def, tier);
  const next = getNextTier(tier);
  const progress = next
    ? Math.min(100, Math.round(((total - (MASTERY_THRESHOLDS.find((t) => t.tier === tier)?.value ?? 0)) /
        ((next.value) - (MASTERY_THRESHOLDS.find((t) => t.tier === tier)?.value ?? 0))) * 100))
    : 100;
  const unit = def.milestoneType === "seconds" ? "s" : "reps";

  return (
    <div
      className={`relative rounded-xl border p-3 flex flex-col gap-1.5 transition-all ${colors.bg} ${colors.border} ${colors.glow ? `shadow-md ${colors.glow}` : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-lg leading-none shrink-0">{def.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight truncate">
              {def.exerciseName}
            </p>
            <p className={`text-[10px] font-medium leading-tight ${CATEGORY_COLORS[def.category]}`}>
              {def.category.toUpperCase()}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${colors.text} bg-black/20`}>
          {TIER_LABELS[tier]}
        </span>
      </div>

      <p className={`text-xs font-semibold italic ${colors.text} leading-tight`}>
        "{title}"
      </p>

      <div className="flex items-center justify-between gap-1 mt-0.5">
        <div className="flex-1 h-1 rounded-full bg-black/30 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${tier === "platinum" ? "bg-cyan-400" : tier === "gold" ? "bg-yellow-400" : tier === "silver" ? "bg-slate-300" : tier === "bronze" ? "bg-amber-400" : "bg-zinc-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {total.toLocaleString()}{unit}
          {next ? ` / ${next.value.toLocaleString()}` : ""}
        </span>
      </div>
    </div>
  );
}

interface MasteryGalleryProps {
  exerciseStats: ExerciseStatsMap;
  compact?: boolean;
}

export function MasteryGallery({ exerciseStats, compact = false }: MasteryGalleryProps) {
  const entries = useMemo(() => {
    return EXERCISE_MASTERY_DEFS
      .map((def) => {
        const stat = exerciseStats[def.exerciseName];
        const total = stat?.total ?? 0;
        const tier = getAchievedTier(total);
        return { def, total, tier };
      })
      .filter((e) => e.tier !== null)
      .sort((a, b) => {
        const tierOrder: Record<MasteryTier, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, starter: 4 };
        return tierOrder[a.tier!] - tierOrder[b.tier!];
      }) as Array<{ def: ExerciseMasteryDef; total: number; tier: MasteryTier }>;
  }, [exerciseStats]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <div className="flex justify-center mb-2"><EmojiIcon emoji="🏅" className="w-8 h-8 object-contain" /></div>
        <p>Complete workouts to earn mastery titles.</p>
        <p className="text-xs mt-1">Reach 10 reps or 10 seconds on any exercise to start.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries.slice(0, 8).map(({ def, tier }) => {
          const colors = TIER_COLORS[tier];
          return (
            <span
              key={def.exerciseName}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {def.icon} {def.exerciseName}
            </span>
          );
        })}
        {entries.length > 8 && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{entries.length - 8} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {entries.map(({ def, total, tier }) => (
        <MasteryCard key={def.exerciseName} def={def} total={total} tier={tier} />
      ))}
    </div>
  );
}
