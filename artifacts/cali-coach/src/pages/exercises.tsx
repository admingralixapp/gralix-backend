import { useListExercises } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Info, Volume2, Crosshair } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getExerciseConfig } from "@/lib/exercise-registry";

export function Exercises() {
  const { data: exercises, isLoading } = useListExercises();

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
          <p className="text-muted-foreground mt-1">Movement library and coaching cues.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {exercises?.map(exercise => (
          <Card key={exercise.id} className="overflow-hidden flex flex-col">
            <CardHeader className="bg-secondary/30 pb-4 border-b border-border">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{exercise.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={
                      exercise.difficulty === 'beginner' ? 'default' : 
                      exercise.difficulty === 'intermediate' ? 'secondary' : 'destructive'
                    } className="capitalize">
                      {exercise.difficulty}
                    </Badge>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2">
                {exercise.description}
              </p>
              
              <div className="space-y-4 flex-1">
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Target Muscles
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {exercise.muscleGroups.map(m => (
                      <span key={m} className="text-xs px-2 py-1 bg-secondary rounded-md text-secondary-foreground">{m}</span>
                    ))}
                  </div>
                </div>

                {(() => {
                  const config = getExerciseConfig(exercise.name);
                  if (!config) return null;
                  return (
                    <div>
                      <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Crosshair className="w-3 h-3 text-primary" /> Critical Joints
                      </div>
                      <ul className="space-y-2">
                        {config.criticalJoints.map((joint, i) => (
                          <li key={i} className="text-sm">
                            <span className="inline-flex items-center gap-1 font-medium text-primary">
                              <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
                                {joint.label}
                              </Badge>
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5 pl-1">{joint.description}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Audio Cues
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside pl-4">
                    {exercise.coachingCues.slice(0, 3).map((cue, i) => (
                      <li key={i} className="line-clamp-1 italic">"{cue}"</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <Button className="w-full font-bold" asChild>
                  <Link href={`/workout`}>
                    Train {exercise.name}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
