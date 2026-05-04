import { useGetProgressSummary, useGetRecentSessions } from "@workspace/api-client-react";
import { Link } from "wouter";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillMap } from "@/components/skill-map";
import { SocialFeed } from "@/components/social-feed";
import { useMobilityStatus, useNotificationScheduler } from "@/lib/use-mobility";
import { GOAL_LABELS, type MobilityGoal } from "@/lib/mobility-service";

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
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function Home() {
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: recentSessions, isLoading: loadingSessions } = useGetRecentSessions({ limit: 5 });
  const { data: mobilityStatus, isLoading: loadingMobility } = useMobilityStatus();

  useNotificationScheduler(mobilityStatus);

  const mobilityGoal = (mobilityStatus?.settings.mobilityGoal ?? "general") as MobilityGoal;
  const goalLabel = GOAL_LABELS[mobilityGoal];

  return (
    <div className="p-6 md:p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Ready to train?</p>
        </div>
        <Button asChild size="lg" className="font-bold">
          <Link href="/workout">
            <Activity className="w-5 h-5 mr-2" />
            Start Workout
          </Link>
        </Button>
      </header>

      {/* ── Stats Grid (5 cards) ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          label="Workout Streak"
          value={summary?.currentStreak ?? 0}
          sub="days in a row"
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-primary" />}
          label="Avg Form"
          value={
            summary?.avgFormScore != null
              ? Math.round(summary.avgFormScore)
              : "--"
          }
          sub="out of 100"
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label="Total Reps"
          value={summary?.totalReps ?? 0}
          sub="all time"
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-yellow-500" />}
          label="Sessions"
          value={summary?.totalSessions ?? 0}
          sub="completed"
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4 text-violet-400" />}
          label="Mobility Streak"
          value={loadingMobility ? "--" : (mobilityStatus?.currentStreak ?? 0)}
          sub="stretch days"
          isLoading={loadingMobility}
        />
      </div>

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
                    Daily Mobility
                  </span>
                  {mobilityStatus?.completedToday && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Done
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold leading-tight">
                  {goalLabel}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  5 stretches · ~5 min ·{" "}
                  {loadingMobility ? (
                    "loading…"
                  ) : mobilityStatus?.currentStreak ? (
                    <span className="text-orange-400 font-medium">
                      🔥 {mobilityStatus.currentStreak}-day streak
                    </span>
                  ) : (
                    "Start your streak today"
                  )}
                </p>
              </div>

              <Button asChild size="sm" variant={mobilityStatus?.completedToday ? "outline" : "default"}>
                <Link href="/mobility">
                  {mobilityStatus?.completedToday ? "Repeat" : "Begin"}
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
              Skill Map
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7 px-2">
              <Link href="/skill-tree">Full tree →</Link>
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
          <h2 className="text-xl font-bold">Recent Sessions</h2>
          <Button variant="link" asChild className="text-primary">
            <Link href="/history">
              View All <ArrowRight className="w-4 h-4 ml-1" />
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
          <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/50">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground mb-4">No sessions recorded yet.</p>
            <Button asChild variant="outline">
              <Link href="/workout">Start your first workout</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/session/${session.id}`}>
                <Card className="hover:bg-secondary transition-colors cursor-pointer border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{session.exerciseName}</div>
                      <div className="text-sm text-muted-foreground">
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
                        <span className="text-sm text-muted-foreground">reps</span>
                      </div>
                      <div className="text-sm text-primary font-medium">
                        {session.avgFormScore != null
                          ? Math.round(session.avgFormScore)
                          : "--"}{" "}
                        avg form
                      </div>
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
            Friends Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <SocialFeed />
        </CardContent>
      </Card>
    </div>
  );
}
