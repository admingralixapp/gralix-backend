import { useMemo } from "react";
import { useListSessions } from "@workspace/api-client-react";
import {
  SKILL_TREE_BRANCHES,
  TOTAL_SKILL_COUNT,
  evaluateSkillTree,
  type EvaluatedSkill,
  type SkillBranch,
  type SkillType,
} from "@/lib/skill-tree";
import { cn } from "@/lib/utils";
import { Lock, Star, ChevronUp, Zap, ArrowUp, Dumbbell, Circle, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Branch visual configuration ─────────────────────────────────────────────

const BRANCH_META: Record<
  SkillBranch,
  {
    label: string;
    emoji: string;
    color: string;          // Tailwind text color
    bgColor: string;        // Tailwind bg for header
    borderColor: string;    // Tailwind border
    barColor: string;       // Tailwind bg for progress bar fill
    icon: React.ElementType;
  }
> = {
  PUSH: {
    label: "Push",
    emoji: "💪",
    color: "text-orange-400",
    bgColor: "bg-orange-950/40",
    borderColor: "border-orange-500/40",
    barColor: "bg-orange-400",
    icon: ArrowUp,
  },
  PULL: {
    label: "Pull",
    emoji: "🔵",
    color: "text-blue-400",
    bgColor: "bg-blue-950/40",
    borderColor: "border-blue-500/40",
    barColor: "bg-blue-400",
    icon: ChevronUp,
  },
  CORE: {
    label: "Core",
    emoji: "⚡",
    color: "text-violet-400",
    bgColor: "bg-violet-950/40",
    borderColor: "border-violet-500/40",
    barColor: "bg-violet-400",
    icon: Zap,
  },
  LEGS: {
    label: "Legs",
    emoji: "🟢",
    color: "text-emerald-400",
    bgColor: "bg-emerald-950/40",
    borderColor: "border-emerald-500/40",
    barColor: "bg-emerald-400",
    icon: Dumbbell,
  },
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     "bg-slate-700 text-slate-200",
  Novice:       "bg-sky-900 text-sky-200",
  Intermediate: "bg-indigo-900 text-indigo-200",
  Advanced:     "bg-amber-900 text-amber-200",
  Elite:        "bg-rose-900 text-rose-200",
};

// ─── SkillNodeCard ────────────────────────────────────────────────────────────

function StatusIcon({ status, color }: { status: EvaluatedSkill["status"]; color: string }) {
  if (status === "mastered") return <Star className={cn("w-5 h-5 fill-current", color)} />;
  if (status === "unlocked") return <Circle className={cn("w-5 h-5", color)} />;
  return <Lock className="w-5 h-5 text-muted-foreground/50" />;
}

function SkillNodeCard({
  skill,
  branch,
  isLast,
}: {
  skill: EvaluatedSkill;
  branch: SkillBranch;
  isLast: boolean;
}) {
  const meta = BRANCH_META[branch];
  const req = skill.masteryRequirement;
  const { qualifyingSessions, bestReps, bestFormScore } = skill.progress;
  const progressPct = Math.min(
    100,
    (qualifyingSessions / req.minQualifyingSessions) * 100,
  );

  const isLocked = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  const workoutUrl = `/workout?exercise=${encodeURIComponent(skill.exercises[0])}`;

  return (
    <div className="relative flex flex-col items-center">
      {/* Connector line going DOWN to next node */}
      {!isLast && (
        <div
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-6 z-0",
            isMastered ? meta.barColor : "bg-border",
          )}
        />
      )}

      <div
        className={cn(
          "relative w-full rounded-xl border p-4 transition-all z-10",
          isMastered
            ? cn("border-2", meta.borderColor, meta.bgColor)
            : skill.status === "unlocked"
            ? "border border-border bg-card hover:border-primary/30 hover:bg-card/80"
            : "border border-border/40 bg-card/30 opacity-60",
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon status={skill.status} color={meta.color} />
            <div className="min-w-0">
              <span
                className={cn(
                  "font-semibold text-sm leading-tight block",
                  isLocked ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {skill.title}
              </span>
              {/* Path + Type badge */}
              {skill.pathLabel && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {skill.pathLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              className={cn(
                "text-[10px] px-1.5 py-0.5 font-medium",
                LEVEL_COLORS[skill.levelName],
              )}
            >
              {skill.levelName}
            </Badge>
            {(skill.type as SkillType) === "static" && (
              <Badge className="text-[9px] px-1.5 py-0.5 bg-cyan-900/60 text-cyan-300 border border-cyan-700/40">
                🧲 Static Hold
              </Badge>
            )}
            {(skill.type as SkillType) === "explosive" && (
              <Badge className="text-[9px] px-1.5 py-0.5 bg-orange-900/60 text-orange-300 border border-orange-700/40">
                ⚡ Explosive
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">
          {isLocked ? "🔒 Master the previous skill to unlock." : skill.description}
        </p>

        {/* Mastery requirement */}
        {!isLocked && (
          <div className="mb-3 rounded-md bg-secondary/50 px-3 py-2">
            <p className="text-[11px] font-medium text-foreground/80 leading-snug">
              {req.description}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {!isLocked && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Qualifying Sessions
              </span>
              <span
                className={cn(
                  "text-[11px] font-bold tabular-nums",
                  isMastered ? meta.color : "text-foreground",
                )}
              >
                {qualifyingSessions} / {req.minQualifyingSessions}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", meta.barColor)}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Best session stats */}
            {(bestReps > 0 || bestFormScore > 0) && (
              <div className="flex gap-3 mt-2">
                {bestReps > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Best:{" "}
                    <span className="text-foreground font-medium">
                      {(skill.type as SkillType) === "static"
                        ? `${bestReps}s hold`
                        : `${bestReps} reps`}
                    </span>
                  </span>
                )}
                {bestFormScore > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Form: <span className="text-foreground font-medium">{Math.round(bestFormScore)}%</span>
                  </span>
                )}
              </div>
            )}

            {isMastered && (
              <div
                className={cn(
                  "mt-2 text-[11px] font-semibold flex items-center gap-1",
                  meta.color,
                )}
              >
                <Star className="w-3 h-3 fill-current" /> Mastered
              </div>
            )}
          </div>
        )}

        {/* Start Workout CTA */}
        {!isLocked && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className={cn(
              "mt-3 w-full h-7 text-[11px] gap-1.5 border transition-colors",
              isMastered
                ? cn(meta.borderColor, meta.color, "hover:opacity-80")
                : "border-border hover:border-primary/40",
            )}
          >
            <Link href={workoutUrl}>
              <Play className="w-3 h-3 fill-current" />
              Start Workout
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── BranchColumn ─────────────────────────────────────────────────────────────

function BranchColumn({
  branch,
  skills,
}: {
  branch: SkillBranch;
  skills: EvaluatedSkill[];
}) {
  const meta = BRANCH_META[branch];
  const Icon = meta.icon;
  const masteredCount = skills.filter((s) => s.status === "mastered").length;

  return (
    <div className="flex flex-col gap-0">
      {/* Branch header */}
      <div
        className={cn(
          "rounded-xl border-2 p-3 mb-6 flex items-center justify-between",
          meta.bgColor,
          meta.borderColor,
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-5 h-5", meta.color)} />
          <span className={cn("font-bold text-base", meta.color)}>{meta.label}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {masteredCount}/{skills.length}
        </span>
      </div>

      {/* Skill nodes */}
      <div className="flex flex-col gap-6">
        {skills.map((skill, i) => (
          <SkillNodeCard
            key={skill.id}
            skill={skill}
            branch={branch}
            isLast={i === skills.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkillTreeSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {["PUSH", "PULL", "CORE", "LEGS"].map((b) => (
        <div key={b} className="flex flex-col gap-4">
          <Skeleton className="h-14 rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillTreePage() {
  // Fetch a generous slice of history so mastery can be computed correctly
  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const evaluated = useMemo(() => {
    if (!sessions) return null;
    return evaluateSkillTree(sessions);
  }, [sessions]);

  // Group by branch, preserving level order (already sorted in config)
  const byBranch = useMemo(() => {
    if (!evaluated) return null;
    const branches = Object.keys(SKILL_TREE_BRANCHES) as SkillBranch[];
    return branches.map((branch) => ({
      branch,
      skills: evaluated.filter((s) => s.branch === branch),
    }));
  }, [evaluated]);

  const totalMastered = evaluated?.filter((s) => s.status === "mastered").length ?? 0;
  const totalSkills = TOTAL_SKILL_COUNT;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skill Tree</h1>
          <p className="text-muted-foreground mt-1">
            Progress through four branches of calisthenics mastery — each level unlocks
            when the one before it is mastered.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {totalMastered}
              <span className="text-muted-foreground text-base font-normal">
                /{totalSkills}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">Skills Mastered</p>
          </div>
          <Button asChild>
            <Link href="/workout">Train Now</Link>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Mastered
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="w-3.5 h-3.5 text-primary" /> Unlocked
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Locked
        </span>
        <span className="ml-auto italic">
          Mastery requires meeting the requirement in the specified number of sessions.
        </span>
      </div>

      {/* Tree grid */}
      {isLoading || !byBranch ? (
        <SkillTreeSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {byBranch.map(({ branch, skills }) => (
            <BranchColumn key={branch} branch={branch} skills={skills} />
          ))}
        </div>
      )}
    </div>
  );
}
