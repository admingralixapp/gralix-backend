import { useGetProgressSummary, useGetRecentSessions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Activity, Flame, Trophy, Target, ArrowRight, Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          label="Current Streak"
          value={summary?.currentStreak ?? 0}
          sub="days in a row"
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-primary" />}
          label="Avg Form"
          value={summary?.avgFormScore != null ? Math.round(summary.avgFormScore) : "--"}
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
      </div>

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
                        {session.avgFormScore != null ? Math.round(session.avgFormScore) : "--"}{" "}
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
    </div>
  );
}
