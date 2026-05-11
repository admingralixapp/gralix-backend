import { useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import {
  Trophy, Globe, Users, Flag, Star, Dumbbell, LogIn, ShieldCheck, ChevronDown, ChevronUp, Zap, TrendingUp,
} from "lucide-react";
import { useLeaderboard, useMyProfile } from "@/lib/social";
import type { LeaderboardEntry } from "@/lib/social";
import { getBadge } from "@/lib/badge-status";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

const MEDAL: Record<number, { icon: string; color: string }> = {
  1: { icon: "🥇", color: "text-yellow-400" },
  2: { icon: "🥈", color: "text-slate-400" },
  3: { icon: "🥉", color: "text-amber-600" },
};

/** Soft reference for bar width at 10 000 pts — purely cosmetic, no cap. */
const BAR_REF = 10_000;

function PointsBar({ points }: { points: number }) {
  const pct = Math.min(100, (points / BAR_REF) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-[40px]">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-primary">
        {points.toLocaleString()} pts
      </span>
    </div>
  );
}

// ─── LeaderboardRow ───────────────────────────────────────────────────────────

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { t } = useTranslation();
  const medal = MEDAL[entry.rank];
  return (
    <Link
      href={`/profile/${entry.username}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors",
        isMe && "bg-primary/5 hover:bg-primary/10",
      )}
    >
      {/* Rank */}
      <div className="w-8 shrink-0 text-center">
        {medal ? (
          <span className="text-lg leading-none">{medal.icon}</span>
        ) : (
          <span className="text-sm font-bold text-muted-foreground tabular-nums">{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      {entry.avatarUrl ? (
        <img src={entry.avatarUrl} alt={entry.displayName}
          className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {entry.displayName[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      {/* Name + country */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("text-sm font-medium truncate", isMe && "text-primary")}>
            {entry.displayName}
          </span>
          {isMe && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              {t("leaderboard.you")}
            </span>
          )}
          {entry.showVerifiedBadge && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
              style={{
                background: "rgba(168,85,247,0.12)",
                color: "#a855f7",
                border: "1px solid rgba(168,85,247,0.35)",
                filter: "drop-shadow(0 0 5px rgba(168,85,247,0.5))",
              }}
            >
              <ShieldCheck className="w-3 h-3" />
              {t("common.pro")}
            </span>
          )}
          {(() => {
            const badge = getBadge(entry.masteredSkills);
            return badge ? (
              <span className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0",
                badge.bgColor, badge.textColor, badge.borderColor,
              )}>
                <span className="text-[9px]">{badge.icon}</span>
                {badge.label}
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>@{entry.username}</span>
          {entry.country && (
            <><span>·</span><span title={entry.country}>{flagEmoji(entry.country)}</span></>
          )}
          <span>·</span>
          <Dumbbell className="w-3 h-3" />
          <span>{t("leaderboard.skillsLabel", { count: entry.masteredSkills })}</span>
        </div>
      </div>

      {/* Points bar (desktop) */}
      <div className="w-36 shrink-0 hidden sm:block">
        <PointsBar points={entry.masteryPoints} />
      </div>
      {/* Points (mobile) */}
      <span className="text-sm font-bold text-primary tabular-nums sm:hidden shrink-0">
        {entry.masteryPoints.toLocaleString()}
      </span>
    </Link>
  );
}

// ─── Move Value Guide ─────────────────────────────────────────────────────────

const TIER_DEFS = [
  {
    label: "Elite",
    multiplier: "10.0×",
    color: "#eab308",
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.22)",
    emoji: "🏆",
    desc: "The most taxing skills — Muscle-Ups, Planche, Human Flag and more.",
    examples: "Muscle-Up, Planche Push-Up, Human Flag",
  },
  {
    label: "Advanced",
    multiplier: "5.0×",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.22)",
    emoji: "🔥",
    desc: "High-level movements — Pistol Squats, Archer Pull-Ups, L-Sit.",
    examples: "Pistol Squat, Archer Pull-Up, L-Sit",
  },
  {
    label: "Intermediate",
    multiplier: "3.0×",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.22)",
    emoji: "💪",
    desc: "Foundational strength moves — Diamond Push-Ups, Chin-Ups, Dips.",
    examples: "Diamond Push-Up, Chin-Up, Dips",
  },
  {
    label: "Basic",
    multiplier: "1.0×",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    border: "rgba(107,114,128,0.22)",
    emoji: "🌱",
    desc: "Introductory movements and holds — Push-Ups, Negatives, Plank.",
    examples: "Push-Up, Pull-Up Negative, Plank",
  },
] as const;

function MoveValueGuide() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-6 mt-4 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">{t("leaderboard.moveValueGuide")}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · {t("leaderboard.pointsPerRep")}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border space-y-4">

          {/* ── How it works ── */}
          <div className="mt-3 rounded-xl p-3.5 border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                {t("leaderboard.howItWorks", { defaultValue: "How it works" })}
              </span>
            </div>
            <p className="text-[12px] font-mono font-semibold text-foreground">
              Points = (Tier Multiplier) × (Reps or Seconds) × (AI Form Score %)
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {t("leaderboard.moveValueDesc")}
            </p>
          </div>

          {/* ── Tier cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIER_DEFS.map((tier) => (
              <div
                key={tier.label}
                className="rounded-xl p-3 flex flex-col gap-1"
                style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">{tier.emoji}</span>
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: tier.color }}>
                      {tier.label}
                    </span>
                  </div>
                  <span className="text-sm font-black tabular-nums" style={{ color: tier.color }}>
                    {tier.multiplier}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {tier.desc}
                </p>
                <p className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">
                  e.g. {tier.examples}
                </p>
              </div>
            ))}
          </div>

          {/* ── Example calculation ── */}
          <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            {t("leaderboard.exampleCalc", { defaultValue: "Example: 10 Muscle-Up reps at 90% form = 10 × 10.0 × 0.9 = 90 pts" })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "global" | "national" | "friends";

export function Leaderboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("global");
  const { data: myProfile } = useMyProfile();
  const { data, isLoading, error } = useLeaderboard(tab);

  const myUserId = myProfile?.id;
  const hasCountry = tab !== "national" || data?.country != null || isLoading;

  const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
    { id: "global",   label: t("leaderboard.global"),   icon: Globe  },
    { id: "national", label: t("leaderboard.national"), icon: Flag   },
    { id: "friends",  label: t("leaderboard.friends"),  icon: Users  },
  ];

  return (
    <>
      <div className="pb-28 md:pb-24">
        {/* Header */}
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <Trophy className="w-6 h-6 text-yellow-400" />
            {t("leaderboard.title")}
          </h1>
          <p className="text-xs text-muted-foreground mb-5">
            {t("leaderboard.subtitle")}
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-secondary w-fit">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  tab === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "national" && data?.country && tab === "national" && (
                  <span className="ml-0.5">{flagEmoji(data.country)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Friends auth gate */}
        {tab === "friends" && (
          <Show when="signed-out">
            <div className="mx-6 rounded-xl border border-border bg-card p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-2">{t("leaderboard.signInToSeeFriends")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("leaderboard.compareRank")}
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {t("common.signIn")}
              </Link>
            </div>
          </Show>
        )}

        {/* National — country not detected */}
        {tab === "national" && !isLoading && !data?.country && (
          <div className="mx-6 rounded-xl border border-border bg-card p-10 text-center">
            <Flag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{t("leaderboard.countryNotDetected")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t("leaderboard.countryNotDetectedDesc").split("Settings")[0]}
              <Link href="/settings" className="text-primary hover:underline">{t("nav.settings")}</Link>
              {t("leaderboard.countryNotDetectedDesc").split("Settings")[1]}
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mx-6 rounded-xl border border-border bg-card p-12 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mx-6 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("leaderboard.failedToLoad")}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && data && hasCountry && data.entries.length === 0 && (
          <div className="mx-6 rounded-xl border border-border bg-card p-10 text-center">
            <Star className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === "friends"
                ? t("leaderboard.noFriendsEmpty")
                : t("leaderboard.noAthletesRegion")}
            </p>
          </div>
        )}

        {/* Leaderboard list */}
        {!isLoading && !error && data && data.entries.length > 0 && (
          <div className="mx-6 rounded-xl border border-border bg-card overflow-hidden">
            {/* Column header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-secondary/30">
              <div className="w-8" />
              <div className="w-8" />
              <div className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("leaderboard.athlete")}
              </div>
              {tab !== "friends" && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/25 shrink-0">
                  Top 100
                </span>
              )}
              <div className="w-36 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right hidden sm:block">
                {t("leaderboard.totalPoints")}
              </div>
            </div>

            {data.entries.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                isMe={!!myUserId && entry.userId === myUserId}
              />
            ))}
          </div>
        )}

        {/* Move Value Guide */}
        <MoveValueGuide />

        {/* Disclaimer */}
        <div className="text-center mt-4 px-6 space-y-1">
          <p className="text-xs text-amber-400/80 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            {t("leaderboard.onlyVerified")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("leaderboard.formula")}
          </p>
        </div>
      </div>

      {/* ── Sticky rank bar — only shown when user is outside top 100 on global/national ── */}
      {data && tab !== "friends" && (data.myRank == null || data.myRank > 100) && (
        <div className="fixed bottom-[80px] md:bottom-0 left-0 md:left-64 right-0 z-30">
          <div className="bg-card/95 backdrop-blur-sm border-t border-border px-5 py-3 flex items-center justify-between gap-3">
            {/* Rank + label */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground leading-none mb-0.5">
                  {t("leaderboard.yourRank")}
                </div>
                <div className="font-bold text-sm leading-tight tabular-nums">
                  {data.myRank != null ? `#${data.myRank}` : t("leaderboard.unranked", { defaultValue: "Unranked" })}
                </div>
              </div>
            </div>

            {/* Points + gap to leader */}
            <div className="flex items-center gap-5 text-sm">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground leading-none mb-0.5">
                  {t("leaderboard.points")}
                </div>
                <div className="font-bold text-primary tabular-nums text-sm">
                  {(data.myPoints).toLocaleString()}
                </div>
              </div>
              {data.leaderPoints > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground leading-none mb-0.5">
                    {t("leaderboard.behindLeader", { defaultValue: "Behind #1" })}
                  </div>
                  <div className="font-bold tabular-nums text-sm text-rose-400">
                    −{Math.max(0, data.leaderPoints - data.myPoints).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar toward leader */}
            <div className="flex-1 max-w-[100px] hidden sm:block">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: data.leaderPoints > 0
                      ? `${Math.min(100, (data.myPoints / data.leaderPoints) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground text-right mt-0.5 tabular-nums">
                {data.leaderPoints > 0
                  ? `${Math.round((data.myPoints / data.leaderPoints) * 100)}% of leader`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
