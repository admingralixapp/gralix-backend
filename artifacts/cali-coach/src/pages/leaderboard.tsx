import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, Globe, Users, BookOpen } from "lucide-react";
import { useFeed, useFriends, useMyProfile } from "@/lib/social";
import type { FeedEntry } from "@/lib/social";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BRANCH_LABEL: Record<string, string> = {
  push: "PUSH",
  pull: "PULL",
  core: "CORE",
  legs: "LEGS",
};

// ─── LedgerCard ───────────────────────────────────────────────────────────────

function LedgerCard({ entry }: { entry: FeedEntry }) {
  const branchLabel = BRANCH_LABEL[entry.branch?.toLowerCase() ?? ""] ?? entry.branch?.toUpperCase() ?? "SKILL";

  return (
    <Link
      href={`/profile/${entry.username}`}
      className="block px-4 py-4 border-b border-black/10 last:border-0 hover:bg-black/[0.025] transition-colors"
    >
      {/* Top row — avatar + name + timestamp */}
      <div className="flex items-center gap-3 mb-2.5">
        {entry.avatarUrl ? (
          <img
            src={entry.avatarUrl}
            alt={entry.displayName}
            className="w-9 h-9 rounded-full object-cover shrink-0 border border-black/10"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "#177548" }}
          >
            {entry.displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-black leading-tight truncate block">
            {entry.displayName}
          </span>
          <span className="text-xs text-black/40 leading-tight">
            @{entry.username}
          </span>
        </div>

        <span className="text-xs text-black/35 shrink-0 tabular-nums">
          {relativeTime(entry.createdAt)}
        </span>
      </div>

      {/* Achievement headline */}
      <p className="text-sm font-medium text-black leading-snug mb-2.5">
        mastered{" "}
        <span className="font-black">{entry.skillTitle}</span>
      </p>

      {/* Tag row — branch pill + Form Verified badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Branch category pill */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-wider border"
          style={{ color: "#000", borderColor: "rgba(0,0,0,0.22)", background: "transparent" }}
        >
          {branchLabel}
        </span>

        {/* Form Verified stamp */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border"
          style={{
            color: "#177548",
            borderColor: "#177548",
            background: "rgba(23,117,72,0.07)",
          }}
        >
          <ShieldCheck className="w-3 h-3 shrink-0" />
          Form Verified
        </span>
      </div>
    </Link>
  );
}

// ─── LoadingSkeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-black/10">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-black/8 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 bg-black/8 rounded" />
              <div className="h-2.5 w-16 bg-black/5 rounded" />
            </div>
            <div className="h-2.5 w-12 bg-black/5 rounded" />
          </div>
          <div className="h-3.5 w-48 bg-black/8 rounded mb-3" />
          <div className="flex gap-2">
            <div className="h-4 w-12 bg-black/5 rounded" />
            <div className="h-4 w-24 bg-black/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ isFriends }: { isFriends: boolean }) {
  return (
    <div className="py-16 px-8 text-center">
      {isFriends ? (
        <>
          <Users className="w-9 h-9 mx-auto mb-3 opacity-20" />
          <p className="text-sm text-black/40 leading-relaxed max-w-xs mx-auto">
            No recent milestone logs. Master a new skill node to broadcast here.
          </p>
          <Link
            href="/community"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
            style={{ color: "#177548" }}
          >
            <Users className="w-3.5 h-3.5" />
            Find Athletes to Follow
          </Link>
        </>
      ) : (
        <>
          <BookOpen className="w-9 h-9 mx-auto mb-3 opacity-20" />
          <p className="text-sm text-black/40 leading-relaxed max-w-xs mx-auto">
            No recent milestone logs. Master a new skill node to broadcast here.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "everyone" | "friends";

export function Leaderboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("everyone");

  const { data: feedData, isLoading } = useFeed();
  const { data: friends } = useFriends();
  const { data: myProfile } = useMyProfile();

  const allEntries = feedData?.entries ?? [];

  // Build friend user-ID set for filtering
  const friendIds = new Set((friends ?? []).map((f) => f.id));
  // Exclude own shoutouts from Friends feed
  const myId = myProfile?.id;

  const friendEntries = allEntries.filter(
    (e) => friendIds.has(e.userId) && e.userId !== myId,
  );

  const displayed = tab === "everyone" ? allEntries : friendEntries;

  const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
    { id: "everyone", label: t("leaderboard.global", "Everyone"), icon: Globe },
    { id: "friends",  label: t("leaderboard.friends", "Friends"),  icon: Users },
  ];

  return (
    <div className="pb-28 md:pb-24">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-black text-black tracking-tight mb-0.5">
          Activity Ledger
        </h1>
        <p className="text-xs text-black/40">
          Verified skill masteries from athletes in the community
        </p>
      </div>

      {/* ── Sub-tab bar ─────────────────────────────────────────────────── */}
      <div className="px-6 mb-1">
        <div className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: "rgba(0,0,0,0.05)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === id
                  ? "bg-white text-black shadow-sm"
                  : "text-black/45 hover:text-black/70",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed list ───────────────────────────────────────────────────── */}
      <div
        className="mx-6 mt-4 rounded-xl overflow-hidden bg-white"
        style={{ border: "1px solid rgba(0,0,0,0.12)" }}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : displayed.length === 0 ? (
          <EmptyState isFriends={tab === "friends"} />
        ) : (
          <div>
            {displayed.map((entry) => (
              <LedgerCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer stamp ────────────────────────────────────────────────── */}
      <div className="mt-5 px-6 pb-2 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "#177548" }} />
        <span className="text-[11px]" style={{ color: "#177548" }}>
          All entries are AI-verified skill node completions
        </span>
      </div>
    </div>
  );
}
