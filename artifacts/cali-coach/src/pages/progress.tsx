import { useGetProgressTimeline, useGetProgressByExercise, useGetProgressSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { Activity, Target, Flame, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export function Progress() {
  const { data: timeline } = useGetProgressTimeline({ days: 30 });
  const { data: exerciseProgress } = useGetProgressByExercise();
  const { data: summary } = useGetProgressSummary();

  const formattedTimeline = timeline?.map(p => ({
    ...p,
    dateFormatted: format(new Date(p.date), 'MMM d')
  })) || [];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-1">Analytics and performance over time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <Flame className="w-5 h-5 text-orange-500 mb-2" />
            <div className="text-2xl font-bold">{summary?.currentStreak || 0}</div>
            <div className="text-xs text-muted-foreground">Day Streak</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Activity className="w-5 h-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{summary?.totalSessions || 0}</div>
            <div className="text-xs text-muted-foreground">Total Sessions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Target className="w-5 h-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{summary?.avgFormScore ? Math.round(summary.avgFormScore) : '--'}</div>
            <div className="text-xs text-muted-foreground">Avg Form Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
            <div className="text-2xl font-bold">{summary?.totalReps || 0}</div>
            <div className="text-xs text-muted-foreground">Total Reps</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Score Trend</CardTitle>
          <CardDescription>Average form score over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            {formattedTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedTimeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="dateFormatted" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line type="monotone" dataKey="avgFormScore" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Not enough data to display chart.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reps by Exercise</CardTitle>
          <CardDescription>Total volume per movement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            {exerciseProgress && exerciseProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exerciseProgress}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="exerciseName" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Bar dataKey="totalReps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Not enough data to display chart.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
