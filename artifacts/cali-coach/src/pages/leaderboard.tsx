import { useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Trophy, Globe, Users, Flag, Star, Dumbbell, LogIn, ShieldCheck } from "lucide-react";
import { useLeaderboard, useMyProfile } from "@/lib/social";
import type { LeaderboardEntry } from "@/lib/social";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function MasteryBar({ points }: { points: number }) {
  const MAX = 6000;
  const pct = Math.min(100, (points / MAX) * 100);
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

function LeaderboardRow({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
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
          <span className="text-sm font-bold text-muted-foreground tabular-nums">
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt={entry.displayName}
          className="w-8 h-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {entry.displayName[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      {/* Name + country */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isMe && "text-primary",
            )}
          >
            {entry.displayName}
          </span>
          {isMe && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>@{entry.username}</span>
          {entry.country && (
            <>
              <span>·</span>
              <span title={entry.country}>{flagEmoji(entry.country)}</span>
            </>
          )}
          <span>·</span>
          <Dumbbell className="w-3 h-3" />
          <span>{entry.masteredSkills} skills</span>
        </div>
      </div>

      {/* Points bar */}
      <div className="w-36 shrink-0 hidden sm:block">
        <MasteryBar points={entry.masteryPoints} />
      </div>
      {/* Mobile: just points */}
      <span className="text-sm font-bold text-primary tabular-nums sm:hidden shrink-0">
        {entry.masteryPoints.toLocaleString()}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "global" | "national" | "friends";

const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: "global",   label: "Global",   icon: Globe  },
  { id: "national", label: "National", icon: Flag   },
  { id: "friends",  label: "Friends",  icon: Users  },
];

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>("global");
  const { data: myProfile } = useMyProfile();

  const { data, isLoading, error } = useLeaderboard(tab);

  const myUserId = myProfile?.id;
  const hasCountry = tab !== "national" || data?.country != null || isLoading;

  return (
    <>
      {/* ── Page (leaves room for sticky rank bar) ── */}
      <div className="pb-28 md:pb-24">
        {/* Header */}
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-5">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Leaderboard
          </h1>

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
              <h3 className="font-semibold mb-2">Sign in to see friends</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Compare your rank against the people you train with.
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            </div>
          </Show>
        )}

        {/* National — country not detected */}
        {tab === "national" && !isLoading && !data?.country && (
          <div className="mx-6 rounded-xl border border-border bg-card p-10 text-center">
            <Flag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Country not detected</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              We couldn't detect your country. Set it in{" "}
              <Link href="/settings" className="text-primary hover:underline">
                Settings
              </Link>{" "}
              to unlock the national leaderboard.
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
            Failed to load leaderboard. Try again shortly.
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && data && hasCountry && data.entries.length === 0 && (
          <div className="mx-6 rounded-xl border border-border bg-card p-10 text-center">
            <Star className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === "friends"
                ? "None of your friends have trained yet — or you have no friends added."
                : "No athletes in this region yet. Be the first!"}
            </p>
          </div>
        )}

        {/* Leaderboard list */}
        {!isLoading && !error && data && data.entries.length > 0 && (
          <div className="mx-6 rounded-xl border border-border bg-card overflow-hidden">
            {/* Column header */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-border bg-secondary/30">
              <div className="w-8" />
              <div className="w-8" />
              <div className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Athlete
              </div>
              <div className="w-36 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                Mastery Points
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

        {/* Disclaimer + Max points legend */}
        <div className="text-center mt-4 px-6 space-y-1">
          <p className="text-xs text-amber-400/80 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            Only AI-Verified reps count toward global rankings.
          </p>
          <p className="text-xs text-muted-foreground">
            Max 6,000 pts · L1=100 · L2=200 · L3=300 · L4=400 · L5=500 per skill
          </p>
        </div>
      </div>

      {/* ── Sticky rank bar (fixed, always visible) ── */}
      <div className="fixed bottom-[80px] md:bottom-0 left-0 md:left-64 right-0 z-30">
        <div className="bg-card/95 backdrop-blur-sm border-t border-border px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Your Rank</div>
              <div className="font-bold text-sm leading-tight">
                {data?.myRank != null ? `#${data.myRank}` : "—"}
                {data?.myRank === 1 && " 🥇"}
                {data?.myRank === 2 && " 🥈"}
                {data?.myRank === 3 && " 🥉"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Points</div>
              <div className="font-bold text-primary">
                {(data?.myPoints ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Skills</div>
              <div className="font-bold">{data?.myMasteredSkills ?? 0}</div>
            </div>
            <div className="text-center hidden sm:block">
              <div className="text-xs text-muted-foreground">Max</div>
              <div className="font-bold text-muted-foreground">6,000</div>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="flex-1 max-w-[120px] hidden md:block">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((data?.myPoints ?? 0) / 6000) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
