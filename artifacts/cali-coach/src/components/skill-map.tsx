/**
 * SkillMap — Dashboard "Dynamic Window"
 *
 * Shows 3 focused nodes per branch:
 *   1. Last mastered  (gold star  – most recent win)
 *   2. Current active (in-progress – first unlocked node)
 *   3. Next goal      (first locked node after the active one)
 *
 * For new users (nothing mastered yet) the three slots become:
 *   active → next locked → next-next locked
 */

import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Star, Lock, ChevronRight } from "lucide-react";
import { useListSessions } from "@workspace/api-client-react";
import {
  evaluateSkillTree,
  SKILL_TREE_BRANCHES,
  TOTAL_SKILL_COUNT,
  type EvaluatedSkill,
  type SkillBranch,
} from "@/lib/skill-tree";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANCH_META: Record<SkillBranch, { label: string; emoji: string; color: string }> = {
  PUSH: { label: "Push",  emoji: "💪", color: "#f97316" },
  PULL: { label: "Pull",  emoji: "⬆",  color: "#3b82f6" },
  CORE: { label: "Core",  emoji: "⚡", color: "#a855f7" },
  LEGS: { label: "Legs",  emoji: "🟢", color: "#10b981" },
};

const BRANCHES: SkillBranch[] = ["PUSH", "PULL", "CORE", "LEGS"];

// ─── Window logic ─────────────────────────────────────────────────────────────

/**
 * Returns exactly 3 skill slots [last-mastered?, active, next-locked?].
 * Slot 0 may be null when the user has no mastered skills yet.
 */
function getBranchWindow(
  skills: EvaluatedSkill[],
): [EvaluatedSkill | null, EvaluatedSkill | null, EvaluatedSkill | null] {
  const core      = skills.filter((s) => !s.equipmentSpecialty);
  const mastered  = core.filter((s) => s.status === "mastered");
  const unlocked  = core.filter((s) => s.status === "unlocked");
  const locked    = core.filter((s) => s.status === "locked");

  const lastMastered  = mastered.length  > 0 ? mastered[mastered.length - 1] : null;
  const firstUnlocked = unlocked.length  > 0 ? unlocked[0] : null;
  const firstLocked   = locked.length    > 0 ? locked[0]   : null;

  // Normal case: last mastered → active → next
  if (lastMastered && firstUnlocked) {
    return [lastMastered, firstUnlocked, firstLocked];
  }
  // Everything mastered — show last 3 masteries
  if (lastMastered && !firstUnlocked) {
    return [
      mastered[mastered.length - 3] ?? null,
      mastered[mastered.length - 2] ?? null,
      mastered[mastered.length - 1] ?? null,
    ];
  }
  // Nothing mastered yet — active + next 2 locked
  if (firstUnlocked) {
    return [firstUnlocked, locked[0] ?? null, locked[1] ?? null];
  }
  // Fallback (all locked — shouldn't happen with valid tree)
  return [locked[0] ?? null, locked[1] ?? null, locked[2] ?? null];
}

// ─── Components ───────────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div className="h-14 rounded-xl border border-border/20 bg-card/10 flex items-center justify-center">
      <span className="text-xs text-muted-foreground/40">—</span>
    </div>
  );
}

function WindowNode({
  skill,
  color,
}: {
  skill: EvaluatedSkill;
  color: string;
}) {
  const isMastered = skill.status === "mastered";
  const isLocked   = skill.status === "locked";
  const isUnlocked = skill.status === "unlocked";
  const pct = skill.masteryRequirement.minQualifyingSessions > 0
    ? Math.min(100, Math.round(
        (skill.progress.qualifyingSessions / skill.masteryRequirement.minQualifyingSessions) * 100,
      ))
    : 100;

  const workoutUrl = `/workout?exercise=${encodeURIComponent(skill.exercises[0])}`;

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-all",
        isMastered && "border-amber-500/40 bg-amber-950/20",
        isUnlocked && "border-border bg-card hover:bg-card/80",
        isLocked   && "border-border/30 bg-card/20 opacity-55",
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {isMastered && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
        {isUnlocked  && (
          <div
            className="w-3 h-3 rounded-full border-2 shrink-0"
            style={{ borderColor: color }}
          />
        )}
        {isLocked && <Lock className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
        <span
          className={cn(
            "text-[11px] font-semibold leading-tight truncate",
            isMastered && "text-amber-200",
            isUnlocked && "text-foreground",
            isLocked   && "text-muted-foreground/50",
          )}
        >
          {skill.title}
        </span>
      </div>

      {isUnlocked && (
        <>
          <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {pct}% · {Math.min(skill.progress.qualifyingSessions, skill.masteryRequirement.minQualifyingSessions)}/{skill.masteryRequirement.minQualifyingSessions}
            </span>
            <Link href={workoutUrl}>
              <button
                className="text-[9px] font-semibold px-2 py-0.5 rounded-md transition-opacity hover:opacity-80"
                style={{ backgroundColor: color + "22", color }}
              >
                Train →
              </button>
            </Link>
          </div>
        </>
      )}

      {isMastered && (
        <p className="text-[9px] text-amber-400/70 mt-0.5">✓ Mastered</p>
      )}
      {isLocked && (
        <p className="text-[9px] text-muted-foreground/40 mt-0.5">Locked</p>
      )}
    </div>
  );
}

function ConnectorLine({ mastered, color }: { mastered: boolean; color: string }) {
  return (
    <div className="flex justify-center h-3.5 my-0.5">
      {mastered ? (
        <div className="w-0.5 h-full" style={{ backgroundColor: color }} />
      ) : (
        <div
          className="w-0.5 h-full"
          style={{ borderLeft: "1.5px dashed #374151" }}
        />
      )}
    </div>
  );
}

function BranchWindow({
  branch,
  allSkills,
}: {
  branch: SkillBranch;
  allSkills: EvaluatedSkill[];
}) {
  const meta   = BRANCH_META[branch];
  const skills = allSkills.filter((s) => s.branch === branch);
  const [slot0, slot1, slot2] = getBranchWindow(skills);

  const masteredCount  = skills.filter((s) => s.status === "mastered" && !s.equipmentSpecialty).length;
  const totalBranch    = skills.filter((s) => !s.equipmentSpecialty).length;
  const conn01Mastered = slot0?.status === "mastered" && !!slot1;
  const conn12Mastered = slot1?.status === "mastered" && !!slot2;

  return (
    <div className="flex flex-col gap-0">
      {/* Branch header */}
      <div
        className="rounded-xl border px-3 py-2 mb-2 flex items-center justify-between"
        style={{
          borderColor: meta.color + "55",
          backgroundColor: meta.color + "11",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{meta.emoji}</span>
          <span className="font-bold text-sm" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
          {masteredCount}/{totalBranch}
        </span>
      </div>

      {/* Slot 0 */}
      {slot0 ? (
        <WindowNode skill={slot0} color={meta.color} />
      ) : (
        <EmptySlot />
      )}

      <ConnectorLine mastered={conn01Mastered} color={meta.color} />

      {/* Slot 1 */}
      {slot1 ? (
        <WindowNode skill={slot1} color={meta.color} />
      ) : (
        <EmptySlot />
      )}

      <ConnectorLine mastered={conn12Mastered} color={meta.color} />

      {/* Slot 2 */}
      {slot2 ? (
        <WindowNode skill={slot2} color={meta.color} />
      ) : (
        <EmptySlot />
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function SkillMapSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {BRANCHES.map((b) => (
        <div key={b} className="flex flex-col gap-2">
          <Skeleton className="h-9 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-1 mx-6" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-1 mx-6" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SkillMap() {
  const [, navigate] = useLocation();

  const { data: sessions, isLoading } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  const { evaluated, masteredCount } = useMemo(() => {
    if (!sessions) return { evaluated: null, masteredCount: 0 };
    const ev = evaluateSkillTree(sessions);
    const mc = ev.filter((s) => s.status === "mastered" && !s.equipmentSpecialty).length;
    return { evaluated: ev, masteredCount: mc };
  }, [sessions]);

  if (isLoading || !evaluated) return <SkillMapSkeleton />;

  return (
    <div className="space-y-3">
      {/* Mini stats bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <div className="flex items-center gap-3 flex-wrap">
          {BRANCHES.map((branch) => {
            const branchSkills = evaluated.filter(
              (s) => s.branch === branch && !s.equipmentSpecialty,
            );
            const m = branchSkills.filter((s) => s.status === "mastered").length;
            const meta = BRANCH_META[branch];
            return (
              <span key={branch} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <span style={{ color: meta.color }} className="font-semibold">{branch}</span>
                <span className="tabular-nums">{m}/{branchSkills.length}</span>
              </span>
            );
          })}
        </div>
        <span className="font-semibold tabular-nums text-foreground/80">
          {masteredCount}/{TOTAL_SKILL_COUNT}
        </span>
      </div>

      {/* 4-column branch windows */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BRANCHES.map((branch) => (
          <BranchWindow key={branch} branch={branch} allSkills={evaluated} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-1">
        <button
          className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          onClick={() => navigate("/skill-tree")}
        >
          View Full Skill Tree
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
