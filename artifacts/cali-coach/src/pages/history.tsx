import { useListSessions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "wouter";
import { Calendar, ChevronRight, PenLine } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function History() {
  const { data: sessions, isLoading } = useListSessions();

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workout History</h1>
        <p className="text-muted-foreground mt-1">Review your past performance.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sessions?.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions?.map(session => (
            <Link key={session.id} href={`/session/${session.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer group">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {session.exerciseName}
                      {session.logType === "manual" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <PenLine className="w-2.5 h-2.5" />
                          Manual
                        </span>
                      )}
                    </h3>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(session.startedAt), "MMM d, yyyy • h:mm a")}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold text-foreground">
                        {session.totalReps}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Reps
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      {session.logType === "manual" ? (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                            <PenLine className="w-3 h-3" />
                            Manual
                          </span>
                          {session.rpe != null && (
                            <span className="text-xs text-muted-foreground mt-1">
                              RPE {session.rpe}/10
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="font-mono text-2xl font-bold text-primary">
                            {session.avgFormScore ? Math.round(session.avgFormScore) : '--'}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Avg Form
                          </div>
                        </>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
