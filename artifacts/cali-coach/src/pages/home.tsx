import { useGetProgressSummary, useGetRecentSessions, useGetProgressTimeline } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Flame,
  Trophy,
  Target,
  ArrowRight,
  Dumbbell,
  GitBranch,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  PenLine,
  Clock,
  Crown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillMap } from "@/components/skill-map";
import { SocialFeed } from "@/components/social-feed";
import { useMobilityStatus, useNotificationScheduler } from "@/lib/use-mobility";
import { GOAL_LABELS, type MobilityGoal } from "@/lib/mobility-service";
import { useLeaderboard, useMyProfile } from "@/lib/social";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
} from "recharts";

// ─── Countdown helpers ────────────────────────────────────────────────────────

function getNextWeeklyReset(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntil = day === 0 ? 7 : 7 - day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil, 23, 59, 59, 0),
  );
}

function useWeeklyCountdown() {
  const target = getNextWeeklyReset();
  const [ms, setMs] = useState(() => target.getTime() - Date.now());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setMs(target.getTime() - Date.now()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target]);
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  return { d, h, m };
}

function StatCard({
  icon,
  label,
  value,
  sub,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-light opacity-80 flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : (
          <div className="text-3xl font-extrabold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground font-light opacity-80 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Performance Trends card ──────────────────────────────────────────────────

function PerformanceTrendsCard({ isPro }: { isPro: boolean }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: timeline } = useGetProgressTimeline({ days: 30 });
  const { data: summary }  = useGetProgressSummary();

  const chartData = useMemo(() => {
    if (!timeline?.length) {
      // synthetic skeleton data so the blurred chart looks meaningful
      return Array.from({ length: 12 }, (_, i) => ({
        label: "",
        form:  60 + Math.round(Math.sin(i * 0.6) * 20 + Math.random() * 10),
        reps:  20 + Math.round(Math.cos(i * 0.4) * 15 + Math.random() * 8),
      }));
    }
    return timeline.slice(-12).map((pt) => ({
      label: new Date(pt.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      form:  pt.avgFormScore != null ? Math.round(pt.avgFormScore) : null,
      reps:  pt.totalReps ?? 0,
    }));
  }, [timeline]);

  return (
    <Card className="border-border bg-card overflow-hidden relative">
      {/* Blurred content layer */}
      <div
        className={!isPro ? "pointer-events-none select-none" : undefined}
        style={!isPro ? { filter: "blur(5px) brightness(0.4)", userSelect: "none" } : undefined}
        aria-hidden={!isPro}
      >
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t("dashboard.performanceTrends", "Performance Trends")}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {t("dashboard.last30Days", "Last 30 days")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Mini stat row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: t("dashboard.avgForm", "Avg Form"),
                value: summary?.avgFormScore != null ? `${Math.round(summary.avgFormScore)}` : "--",
                unit: "/100",
                color: "#22c55e",
              },
              {
                label: t("dashboard.totalReps", "Total Reps"),
                value: summary?.totalReps != null ? `${summary.totalReps}` : "--",
                unit: "",
                color: "#60a5fa",
              },
              {
                label: t("dashboard.sessions", "Sessions"),
                value: summary?.totalSessions != null ? `${summary.totalSessions}` : "--",
                unit: "",
                color: "#c084fc",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-xl font-black font-mono" style={{ color: s.color }}>
                  {s.value}
                  {s.unit && <span className="text-xs text-white/30 ml-0.5">{s.unit}</span>}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Form score area chart */}
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,15,26,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  itemStyle={{ color: "#22c55e" }}
                  formatter={(v: number) => [`${v}`, "Form"]}
                />
                <Area
                  type="monotone"
                  dataKey="form"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#formGrad)"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-white/25 text-center">
            {t("dashboard.formScoreOverTime", "Form score over time")}
          </p>
        </CardContent>
      </div>

      {/* Pro paywall overlay — only for free users */}
      {!isPro && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 py-8">
          <div className="absolute inset-0 backdrop-blur-[2px]" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-6 flex flex-col items-center text-center space-y-4 shadow-2xl"
            style={{
              background: "linear-gradient(145deg, rgba(168,85,247,0.18) 0%, rgba(109,40,217,0.08) 50%, rgba(15,10,20,0.96) 100%)",
              borderColor: "rgba(168,85,247,0.35)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              boxShadow: "0 0 60px rgba(168,85,247,0.18), inset 0 1px 0 rgba(168,85,247,0.12)",
            }}
          >
            {/* Ambient glow */}
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
            />

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(168,85,247,0.18)",
                border: "1px solid rgba(168,85,247,0.4)",
                boxShadow: "0 0 20px rgba(168,85,247,0.3)",
              }}
            >
              <Crown className="w-6 h-6" style={{ color: "#c084fc" }} />
            </div>

            {/* Copy */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: "#c084fc" }}>
                {t("dashboard.proFeature", "Pro Feature")}
              </div>
              <h3 className="text-lg font-black" style={{ color: "#e9d5ff" }}>
                {t("dashboard.unlockPerformance", "Unlock Your Performance Data")}
              </h3>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                {t("dashboard.performanceDesc", "See form trends, rep volume, and progress charts with a Pro plan.")}
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setLocation("/shop")}
              className="w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all"
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {t("dashboard.startTrial", "Start 3-Day Free Trial")}
            </button>
            <p className="text-[9px] text-white/25">
              {t("progress.trialNote", "Cancel any time · No charge today")}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

export function Home() {
  const { t } = useTranslation();
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: recentSessions, isLoading: loadingSessions } = useGetRecentSessions({ limit: 5 });
  const { data: mobilityStatus, isLoading: loadingMobility } = useMobilityStatus();
  const { data: profile } = useMyProfile();

  useNotificationScheduler(mobilityStatus);

  const isPro = profile?.isPro ?? false;
  const mobilityGoal = (mobilityStatus?.settings.mobilityGoal ?? "general") as MobilityGoal;
  const goalLabel = GOAL_LABELS[mobilityGoal];

  const leaderboard = useLeaderboard("global", "weekly");
  const myRank = leaderboard.data?.myRank ?? null;
  const weeklyCountdown = useWeeklyCountdown();

  const countdownParts: string[] = [];
  if (weeklyCountdown.d > 0) countdownParts.push(`${weeklyCountdown.d}d`);
  if (weeklyCountdown.h > 0 || weeklyCountdown.d > 0) countdownParts.push(`${weeklyCountdown.h}h`);
  countdownParts.push(`${weeklyCountdown.m}m`);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1 font-light opacity-80">{t("dashboard.welcomeBack")}</p>
          {/* Time Remaining badge — visible when user has a rank */}
          {myRank != null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary">
                <Trophy className="w-3 h-3" />
                #{myRank} this week
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Clock className="w-3 h-3" />
                {countdownParts.join(" ")} left
              </span>
            </div>
          )}
        </div>
        <Button asChild size="lg" className="font-extrabold">
          <Link href="/training">
            <Activity className="w-5 h-5 mr-2" />
            {t("dashboard.startWorkout")}
          </Link>
        </Button>
      </header>

      {/* ── Stats Grid (5 cards) ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          label={t("dashboard.workoutStreak")}
          value={summary?.currentStreak ?? 0}
          sub={t("dashboard.daysInARow")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-primary" />}
          label={t("dashboard.avgForm")}
          value={
            summary?.avgFormScore != null
              ? Math.round(summary.avgFormScore)
              : "--"
          }
          sub={t("dashboard.outOf100")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label={t("dashboard.totalReps")}
          value={summary?.totalReps ?? 0}
          sub={t("dashboard.allTime")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-yellow-500" />}
          label={t("dashboard.sessions")}
          value={summary?.totalSessions ?? 0}
          sub={t("dashboard.completed")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4 text-violet-400" />}
          label={t("dashboard.mobilityStreak")}
          value={loadingMobility ? "--" : (mobilityStatus?.currentStreak ?? 0)}
          sub={t("dashboard.stretchDays")}
          isLoading={loadingMobility}
        />
      </div>

      {/* ── Performance Trends (Pro paywall) ──────────────────────── */}
      <PerformanceTrendsCard isPro={isPro} />

      {/* ── Daily Mobility Card ────────────────────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="flex items-stretch">
          {/* Accent bar */}
          <div className="w-1 bg-gradient-to-b from-violet-500 to-primary shrink-0" />

          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-violet-400">
                    {t("dashboard.dailyMobility")}
                  </span>
                  {mobilityStatus?.completedToday && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("dashboard.done")}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold leading-tight">
                  {goalLabel}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.stretchInfo")} ·{" "}
                  {loadingMobility ? (
                    t("dashboard.loadingMobility")
                  ) : mobilityStatus?.currentStreak ? (
                    <span className="text-orange-400 font-medium">
                      🔥 {t("dashboard.dayStreak", { count: mobilityStatus.currentStreak })}
                    </span>
                  ) : (
                    t("dashboard.startStreak")
                  )}
                </p>
              </div>

              <Button asChild size="sm" variant={mobilityStatus?.completedToday ? "outline" : "default"}>
                <Link href="/training">
                  {mobilityStatus?.completedToday ? t("dashboard.repeat") : t("dashboard.begin")}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Skill Map ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              {t("dashboard.skillMap")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7 px-2">
              <Link href="/mastery">{t("dashboard.fullTree")}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-2">
          <SkillMap />
        </CardContent>
      </Card>

      {/* ── Recent Sessions ───────────────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-extrabold">{t("dashboard.recentSessions")}</h2>
          <Button variant="link" asChild className="text-primary">
            <Link href="/mastery?tab=history">
              {t("dashboard.viewAll")} <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>

        {loadingSessions ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !recentSessions || recentSessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-[20px] bg-white/[0.02]">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-light opacity-80 mb-4">{t("dashboard.noSessionsYet")}</p>
            <Button asChild variant="outline">
              <Link href="/training">{t("dashboard.startFirstWorkout")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/session/${session.id}`}>
                <Card className="hover:bg-white/[0.04] transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-lg">{session.exerciseName}</div>
                      <div className="text-sm text-muted-foreground font-light opacity-80">
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {session.durationMinutes != null && (
                          <span className="ml-2 text-muted-foreground/70">
                            · {Math.round(session.durationMinutes)}m
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl">
                        {session.totalReps}{" "}
                        <span className="text-sm text-muted-foreground">{t("dashboard.reps")}</span>
                      </div>
                      {session.logType === "manual" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400 mt-1">
                          <PenLine className="w-2.5 h-2.5" />
                          {t("dashboard.manual")}
                        </span>
                      ) : (
                        <div className="text-sm text-primary font-medium">
                          {session.avgFormScore != null
                            ? Math.round(session.avgFormScore)
                            : "--"}{" "}
                          {t("dashboard.avgFormLabel")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Friends Activity ──────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            {t("dashboard.friendsActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <SocialFeed />
        </CardContent>
      </Card>
    </div>
  );
}
