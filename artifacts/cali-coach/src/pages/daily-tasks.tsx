import { useState } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Pencil,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getTasksForPreferences,
  GOAL_LABELS,
  QUESTIONNAIRE_GOAL_OPTIONS,
  STIFFNESS_OPTIONS,
  TIME_OPTIONS,
  routineDurationMinutes,
  type MobilityGoal,
  type StiffnessArea,
} from "@/lib/mobility-service";
import {
  useMobilityStatus,
  useUpdateMobilitySettings,
  useNotificationScheduler,
  requestNotificationPermission,
} from "@/lib/use-mobility";

// ─── Questionnaire Modal ──────────────────────────────────────────────────────

interface QuestionnaireProps {
  initialGoal: string;
  initialAreas: StiffnessArea[];
  initialTime: number;
  onSave: (goal: string, areas: StiffnessArea[], time: number) => void;
  onClose: () => void;
  saving: boolean;
}

function Questionnaire({
  initialGoal,
  initialAreas,
  initialTime,
  onSave,
  onClose,
  saving,
}: QuestionnaireProps) {
  const [goal, setGoal]   = useState(initialGoal || "general");
  const [areas, setAreas] = useState<StiffnessArea[]>(initialAreas);
  const [time,  setTime]  = useState<number>(initialTime || 10);

  function toggleArea(area: StiffnessArea) {
    setAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Update My Goals</h2>
            <p className="text-sm text-muted-foreground">
              Personalise your daily mobility tasks
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-7">

          {/* Q1 — Primary goal */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              What is your primary calisthenics goal?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUESTIONNAIRE_GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGoal(opt.value)}
                  className={cn(
                    "text-left px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    goal === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q2 — Stiffness areas */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Where do you feel the most stiffness?{" "}
              <span className="font-normal text-muted-foreground">(pick all that apply)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {STIFFNESS_OPTIONS.map(area => (
                <button
                  key={area}
                  onClick={() => toggleArea(area)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all",
                    areas.includes(area)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Q3 — Daily time */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              How much time can you commit to daily mobility?
            </p>
            <div className="flex gap-3">
              {TIME_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                    time === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {t} min
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <Button
            className="w-full font-bold"
            size="lg"
            disabled={saving}
            onClick={() => onSave(goal, areas, time)}
          >
            {saving ? "Saving…" : "Save My Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  index,
  name,
  muscles,
  durationSeconds,
  cue,
}: {
  index: number;
  name: string;
  muscles: string[];
  durationSeconds: number;
  cue: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card transition-all",
        expanded ? "border-primary/40" : "",
      )}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{name}</div>
          <div className="text-xs text-muted-foreground">
            {muscles.slice(0, 2).join(" · ")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-muted-foreground">
            {durationSeconds}s
          </span>
          <ChevronRight
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              expanded ? "rotate-90" : "",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">{cue}</p>
        </div>
      )}
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  enabled,
  notificationTime,
  goalLabel,
  stiffnessAreas,
  dailyTimeMinutes,
  onToggle,
  onTimeChange,
}: {
  enabled: boolean;
  notificationTime: string;
  goalLabel: string;
  stiffnessAreas: string;
  dailyTimeMinutes: number;
  onToggle: () => void;
  onTimeChange: (t: string) => void;
}) {
  const areas = stiffnessAreas
    ? stiffnessAreas.split(",").filter(Boolean).slice(0, 2).join(" & ")
    : "";

  const preview = `Ready to work toward your ${goalLabel}? Your ${dailyTimeMinutes}-min mobility prep is waiting${areas ? `. Focus: ${areas}` : ""}.`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Bell className="w-4 h-4 text-primary" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            {enabled ? "Daily Reminder On" : "Daily Reminder Off"}
          </span>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "relative w-10 h-5.5 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted",
          )}
          style={{ width: 40, height: 22 }}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-[18px]" : "translate-x-0",
            )}
            style={{ width: 18, height: 18 }}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Remind me at</span>
            <input
              type="time"
              value={notificationTime}
              onChange={e => onTimeChange(e.target.value)}
              className="ml-auto text-xs font-mono rounded-md bg-background border border-border px-2 py-1"
            />
          </div>
          <p className="text-xs text-muted-foreground/70 italic leading-relaxed border-l-2 border-primary/30 pl-3">
            "{preview}"
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DailyTasksPage() {
  const [, setLocation]        = useLocation();
  const { data: status }       = useMobilityStatus();
  const updateSettings         = useUpdateMobilitySettings();
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  useNotificationScheduler(status);

  const settings = status?.settings;
  const goal     = (settings?.mobilityGoal ?? "general") as MobilityGoal;
  const goalLabel = GOAL_LABELS[goal] ?? goal;
  const stiffnessAreas   = settings?.stiffnessAreas   ?? "";
  const dailyTimeMinutes = settings?.dailyTimeMinutes  ?? 10;
  const enabled          = settings?.enabled           ?? false;
  const notificationTime = settings?.notificationTime  ?? "08:00";

  // Parse stiffness areas back to array
  const areasArray = stiffnessAreas
    ? (stiffnessAreas.split(",").filter(Boolean) as StiffnessArea[])
    : [];

  // Generate personalised task list
  const tasks = getTasksForPreferences(goal, areasArray, dailyTimeMinutes);
  const totalMin = routineDurationMinutes(tasks);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSavePreferences(
    newGoal: string,
    newAreas: StiffnessArea[],
    newTime: number,
  ) {
    updateSettings.mutate(
      {
        mobilityGoal:     newGoal,
        stiffnessAreas:   newAreas.join(","),
        dailyTimeMinutes: newTime,
      },
      { onSuccess: () => setShowQuestionnaire(false) },
    );
  }

  function handleToggleNotification() {
    if (!enabled) {
      requestNotificationPermission().then(granted => {
        if (granted) {
          updateSettings.mutate({ enabled: true });
        }
      });
    } else {
      updateSettings.mutate({ enabled: false });
    }
  }

  function handleTimeChange(time: string) {
    updateSettings.mutate({ notificationTime: time });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 max-w-lg mx-auto space-y-5 pb-8">

      {/* Page header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your personalised mobility plan
          </p>
        </div>
        {(status?.currentStreak ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 rounded-full px-3 py-1 text-sm font-semibold shrink-0">
            <Flame className="w-4 h-4" />
            {status?.currentStreak}d streak
          </div>
        )}
      </div>

      {/* Goal + preferences summary */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              Current Goal
            </div>
            <div className="font-bold text-lg leading-tight">{goalLabel}</div>
            {areasArray.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {areasArray.map(a => (
                  <span
                    key={a}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowQuestionnaire(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            Update Goals
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {dailyTimeMinutes} min / day
          </span>
          <span>·</span>
          <span>{tasks.length} exercises (~{totalMin} min)</span>
        </div>
      </div>

      {/* Completed today banner */}
      {status?.completedToday && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            You've completed today's session — great work!
          </span>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Today's Tasks
          </h2>
        </div>

        {tasks.map((stretch, i) => (
          <TaskCard
            key={stretch.id}
            index={i}
            name={stretch.name}
            muscles={stretch.targetMuscles}
            durationSeconds={stretch.durationSeconds}
            cue={stretch.coachingCue}
          />
        ))}
      </div>

      {/* Start Session CTA */}
      <Button
        size="lg"
        className="w-full font-bold"
        onClick={() => setLocation("/mobility")}
      >
        <Play className="w-5 h-5 mr-2" />
        {status?.completedToday ? "Repeat Session" : "Start Today's Session"}
      </Button>

      {/* Notification card */}
      <NotificationCard
        enabled={enabled}
        notificationTime={notificationTime}
        goalLabel={goalLabel}
        stiffnessAreas={stiffnessAreas}
        dailyTimeMinutes={dailyTimeMinutes}
        onToggle={handleToggleNotification}
        onTimeChange={handleTimeChange}
      />

      {/* Questionnaire modal */}
      {showQuestionnaire && (
        <Questionnaire
          initialGoal={goal}
          initialAreas={areasArray}
          initialTime={dailyTimeMinutes}
          saving={updateSettings.isPending}
          onSave={handleSavePreferences}
          onClose={() => setShowQuestionnaire(false)}
        />
      )}
    </div>
  );
}
