import { useState } from "react";
import { useListExercises } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Info, Volume2, Crosshair, Sparkles, Clock, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getExerciseConfig } from "@/lib/exercise-registry";
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
import { getWarmupSuggestionsFor, formatTime } from "@/lib/mobility-service";
import { cn } from "@/lib/utils";

const CATEGORY_TABS = [
  { label: "All",               value: null               },
  { label: "Push",              value: "push"             },
  { label: "Pull",              value: "pull"             },
  { label: "Core",              value: "core"             },
  { label: "Legs",              value: "legs"             },
  { label: "Mobility & Prehab", value: "Mobility & Prehab" },
] as const;

type CategoryFilter = (typeof CATEGORY_TABS)[number]["value"];

/** Derive a display category from the exercise name when the DB field is null. */
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("push") || n.includes("dip") || n.includes("handstand") || n.includes("planche") || n.includes("press"))
    return "push";
  if (n.includes("pull") || n.includes("row") || n.includes("chin") || n.includes("lever") || n.includes("muscle-up") || n.includes("hang"))
    return "pull";
  if (n.includes("squat") || n.includes("lunge") || n.includes("pistol") || n.includes("nordic") || n.includes("calf"))
    return "legs";
  if (n.includes("plank") || n.includes("l-sit") || n.includes("dragon") || n.includes("flag") || n.includes("core") || n.includes("ab") || n.includes("roll"))
    return "core";
  return "other";
}

export function Exercises() {
  const { data: exercises, isLoading } = useListExercises();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(null);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading exercises…</div>;
  }

  const filtered = exercises?.filter(ex => {
    if (activeCategory === null) return true;
    const cat = ex.category ?? inferCategory(ex.name);
    return cat.toLowerCase() === activeCategory.toLowerCase();
  }) ?? [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
          <p className="text-muted-foreground mt-1">Movement library, coaching cues, and mobility requirements.</p>
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_TABS.map(tab => (
          <button
            key={String(tab.value)}
            onClick={() => setActiveCategory(tab.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all border",
              activeCategory === tab.value
                ? tab.value === "Mobility & Prehab"
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-primary border-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
            )}
          >
            {tab.value === "Mobility & Prehab" && <Sparkles className="inline w-3 h-3 mr-1 -mt-0.5" />}
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-16">
          No exercises in this category yet.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map(exercise => {
          const warmupSuggestions = getWarmupSuggestionsFor(exercise.name);
          const isMobility = (exercise.category ?? inferCategory(exercise.name)).toLowerCase() === "mobility & prehab";

          return (
            <Card key={exercise.id} className={cn(
              "overflow-hidden flex flex-col",
              isMobility && "border-violet-500/30",
            )}>
              <CardHeader className={cn(
                "pb-4 border-b border-border",
                isMobility ? "bg-violet-950/40" : "bg-secondary/30",
              )}>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{exercise.name}</CardTitle>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant={
                        exercise.difficulty === "beginner" ? "default" :
                        exercise.difficulty === "intermediate" ? "secondary" : "destructive"
                      } className="capitalize">
                        {exercise.difficulty}
                      </Badge>
                      {isMobility && (
                        <Badge className="bg-violet-600/20 text-violet-300 border-violet-500/40 border text-xs font-normal">
                          <Sparkles className="w-2.5 h-2.5 mr-1" /> Mobility & Prehab
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm",
                    isMobility && "bg-violet-900/40",
                  )}>
                    {isMobility
                      ? <Sparkles className="w-5 h-5 text-violet-400" />
                      : <Dumbbell className="w-5 h-5 text-primary" />}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 flex-1 flex flex-col">
                {/* 3-panel motion snapshot */}
                <ExerciseMotionSnapshot exerciseName={exercise.name} className="mb-5" />

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

                  {/* ── Recommended Warm-up ── */}
                  {warmupSuggestions.length > 0 && (
                    <div className="rounded-lg border border-violet-500/30 bg-violet-950/30 p-3">
                      <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Recommended Warm-up
                      </div>
                      <ul className="space-y-2">
                        {warmupSuggestions.map(stretch => (
                          <li key={stretch.id} className="flex items-start gap-2">
                            <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-violet-200">{stretch.name}</span>
                              <span className="text-xs text-muted-foreground ml-2 inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />{formatTime(stretch.durationSeconds)}
                              </span>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{stretch.why}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-violet-400/70 mt-2 italic">
                        Complete mobility prep before this exercise for best results.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-auto">
                  {isMobility ? (
                    <Button className="w-full font-bold bg-violet-600 hover:bg-violet-700 text-white" asChild>
                      <Link href="/training?tab=daily">
                        Start Mobility Session
                      </Link>
                    </Button>
                  ) : (
                    <Button className="w-full font-bold" asChild>
                      <Link href="/workout">
                        Train {exercise.name}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
