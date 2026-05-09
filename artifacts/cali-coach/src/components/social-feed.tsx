import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFeed, useMyProfile } from "@/lib/social";

const BRANCH_EMOJI: Record<string, string> = {
  PUSH: "💪",
  PULL: "🔵",
  CORE: "⚡",
  LEGS: "🟢",
};

const BRANCH_PILL: Record<string, string> = {
  PUSH: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
  PULL: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  CORE: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  LEGS: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
};

function useTimeAgo() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t("dashboard.justNow");
    if (mins < 60) return t("dashboard.minutesAgo", { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("dashboard.hoursAgo", { count: hrs });
    const days = Math.floor(hrs / 24);
    return t("dashboard.daysAgo", { count: days });
  };
}

export function SocialFeed() {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();
  const { data: profile } = useMyProfile();
  const { data, isLoading } = useFeed();

  if (!profile) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.entries?.length) {
    return (
      <div className="text-center py-8 border border-dashed border-border rounded-xl bg-card/50">
        <Trophy className="w-8 h-8 text-yellow-500/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-medium">{t("dashboard.noEliteAchievements")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("dashboard.masterEliteSkill")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.entries.map((entry) => {
        const isMe = entry.userId === profile.id;
        const pill = BRANCH_PILL[entry.branch] ?? "bg-primary/15 text-primary border border-primary/20";
        const emoji = BRANCH_EMOJI[entry.branch] ?? "🏆";

        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:bg-secondary/30 transition-colors"
          >
            {/* Avatar */}
            {entry.avatarUrl ? (
              <img
                src={entry.avatarUrl}
                alt={entry.displayName}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(entry.displayName[0] ?? "?").toUpperCase()}
              </div>
            )}

            {/* Text */}
            <div className="flex-1 min-w-0 text-sm">
              <Link
                href={`/profile/${entry.username}`}
                className="font-semibold hover:text-primary transition-colors"
              >
                {isMe ? t("dashboard.youLabel") : entry.displayName}
              </Link>{" "}
              {t("dashboard.justMastered")}{" "}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${pill}`}>
                {emoji} {entry.skillTitle}
              </span>{" "}
              🏆
            </div>

            {/* Time */}
            <div className="text-xs text-muted-foreground shrink-0 ml-1">
              {timeAgo(entry.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
