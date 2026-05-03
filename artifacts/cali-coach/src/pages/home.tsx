import { useGetProgressSummary, useGetRecentSessions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Activity, Flame, Trophy, Target, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Home() {
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: recentSessions, isLoading: loadingSessions } = useGetRecentSessions({ limit: 3 });

  if (loadingSummary || loadingSessions) {
    return <div className="p-8">Loading...</div>;
  }

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
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.currentStreak || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">days in a row</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Avg Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary?.avgFormScore ? Math.round(summary.avgFormScore) : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Total Reps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalReps || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">all time</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">completed</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Sessions</h2>
          <Button variant="link" asChild className="text-primary">
            <Link href="/history">View All <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
        
        {(!recentSessions || recentSessions.length === 0) ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/50">
            <p className="text-muted-foreground mb-4">No sessions recorded yet.</p>
            <Button asChild variant="outline">
              <Link href="/workout">Start your first workout</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map(session => (
              <Link key={session.id} href={`/session/${session.id}`}>
                <Card className="hover:bg-secondary transition-colors cursor-pointer border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{session.exerciseName}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(session.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl">{session.totalReps} <span className="text-sm text-muted-foreground">reps</span></div>
                      <div className="text-sm text-primary font-medium">{session.avgFormScore ? Math.round(session.avgFormScore) : '--'} avg form</div>
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
