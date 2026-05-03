import { useGetSession } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ArrowLeft, Target, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function SessionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: session, isLoading } = useGetSession(id, { query: { enabled: !!id } });

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return <div className="p-8">Session not found.</div>;
  }

  const durationStr = session.completedAt 
    ? `${Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)} min`
    : '--';

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary">
        <Link href="/history">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to History
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{session.exerciseName}</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(session.startedAt), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Reps</div>
              <div className="text-3xl font-bold">{session.totalReps}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Avg Form Score</div>
              <div className="text-3xl font-bold">{session.avgFormScore ? Math.round(session.avgFormScore) : '--'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Duration</div>
              <div className="text-3xl font-bold">{durationStr}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {session.reps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Form Score by Rep</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={session.reps}>
                  <XAxis dataKey="repNumber" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <ReferenceLine y={80} stroke="hsl(var(--primary))" strokeDasharray="3 3" opacity={0.5} />
                  <ReferenceLine y={60} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />
                  <Line type="monotone" dataKey="formScore" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {session.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
