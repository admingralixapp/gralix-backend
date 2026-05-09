import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MobilityPage } from "@/pages/mobility";
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
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
import { useTranslation } from "react-i18next";

// ─── Local-storage helpers ────────────────────────────────────────────────────

const LS_KEY = "calicoach:dailyPrefs";

interface LocalPrefs {
  mobilityGoal: string;
  stiffnessAreas: string;
  dailyTimeMinutes: number;
}

function readLocalPrefs(): LocalPrefs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LocalPrefs) : null;
  } catch {
    return null;
  }
}

function writeLocalPrefs(p: LocalPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch { /* storage full — ignore */ }
}

// ─── Notification localStorage helpers ───────────────────────────────────────

const NOTIF_LS_KEY = "calicoach:notifPrefs";

interface NotifPrefs { enabled: boolean; time: string }

function readNotifPrefs(): NotifPrefs | null {
  try {
    const raw = localStorage.getItem(NOTIF_LS_KEY);
    return raw ? (JSON.parse(raw) as NotifPrefs) : null;
  } catch {
    return null;
  }
}

function writeNotifPrefs(p: NotifPrefs) {
  try {
    localStorage.setItem(NOTIF_LS_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

// ─── Goal search database ─────────────────────────────────────────────────────

interface GoalSearchItem { label: string; value: MobilityGoal }

const GOAL_SEARCH_DB: GoalSearchItem[] = [
  { label: "Pull-Up Mastery",          value: "pull"         },
  { label: "First Pull-Up",            value: "pull"         },
  { label: "Front Lever",              value: "front-lever"  },
  { label: "Tuck Front Lever",         value: "front-lever"  },
  { label: "Straddle Front Lever",     value: "front-lever"  },
  { label: "Full Front Lever",         value: "front-lever"  },
  { label: "Muscle-Up",                value: "muscle-up"    },
  { label: "Kipping Muscle-Up",        value: "muscle-up"    },
  { label: "Strict Muscle-Up",         value: "muscle-up"    },
  { label: "Ring Muscle-Up",           value: "muscle-up"    },
  { label: "Weighted Muscle-Up",       value: "muscle-up"    },
  { label: "Planche / Push",           value: "push"         },
  { label: "Planche",                  value: "push"         },
  { label: "Handstand",                value: "handstand"    },
  { label: "Handstand Push-Up",        value: "handstand"    },
  { label: "Pike Push-Up",             value: "handstand"    },
  { label: "Elevated Pike Push-Up",    value: "handstand"    },
  { label: "Dragon Flag / Human Flag", value: "core"         },
  { label: "Dragon Flag",              value: "core"         },
  { label: "Human Flag",               value: "core"         },
  { label: "Pistol Squat",             value: "legs"         },
  { label: "General Mobility",         value: "general"      },
  { label: "All-Round Mobility",       value: "general"      },
  { label: "Push-Up",                  value: "push"         },
  { label: "Wall Push-Up",             value: "push"         },
  { label: "Incline Push-Up",          value: "push"         },
  { label: "Knee Push-Up",             value: "push"         },
  { label: "Diamond Push-Up",          value: "push"         },
  { label: "Dip",                      value: "push"         },
  { label: "Ring Dip",                 value: "push"         },
  { label: "Weighted Dip",             value: "push"         },
  { label: "Pull-Up",                  value: "pull"         },
  { label: "Negative Pull-Up",         value: "pull"         },
  { label: "Australian Rows",          value: "pull"         },
  { label: "Scapular Shrugs",          value: "pull"         },
  { label: "Chest-to-Bar Pull-Up",     value: "pull"         },
  { label: "Archer Pull-Up",           value: "pull"         },
  { label: "Explosive Pull-Up",        value: "pull"         },
  { label: "Ring Pull-Up",             value: "pull"         },
  { label: "Ring Support Hold",        value: "push"         },
  { label: "Weighted Pull-Up",         value: "pull"         },
  { label: "Bar Pull-Up Volume",       value: "pull"         },
  { label: "Plank",                    value: "core"         },
  { label: "Burpee",                   value: "core"         },
  { label: "Hollow Body Hold",         value: "core"         },
  { label: "Tuck L-Sit",              value: "core"         },
  { label: "Squat",                    value: "legs"         },
  { label: "Air Squat",                value: "legs"         },
  { label: "Assisted Squat",           value: "legs"         },
  { label: "Archer Squat",             value: "legs"         },
  { label: "Nordic Curls",             value: "legs"         },
  { label: "Lunge",                    value: "legs"         },
  { label: "Bulgarian Split Squat",    value: "legs"         },
  { label: "Shrimp Squat",             value: "legs"         },
];

// ─── Extended body parts for stiffness search ─────────────────────────────────

const EXTENDED_BODY_PARTS = [
  "Wrists", "Shoulders", "Lower Back", "Ankles", "Hips",
  "Neck", "Upper Back", "Thoracic Spine", "Forearms", "Calves",
  "Hamstrings", "Hip Flexors", "Chest", "Lats", "Triceps",
  "Knees", "Glutes", "Quadriceps", "Rotator Cuff", "Core",
];

const QUICK_TAGS = ["Wrists", "Shoulders", "Hips", "Ankles", "Lower Back"] as const;

// ─── Glassmorphism dropdown shared style ──────────────────────────────────────

const GLASS_DROPDOWN: CSSProperties = {
  background:        "rgba(12,18,36,0.94)",
  backdropFilter:    "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:         "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
  border:            "1px solid rgba(255,255,255,0.08)",
};

// ─── Questionnaire Modal ──────────────────────────────────────────────────────

interface QuestionnaireProps {
  initialGoal: string;
  initialAreas: string[];
  initialTime: number;
  onSave: (goal: string, areas: string[], time: number) => void;
  onClose: () => void;
}

function Questionnaire({
  initialGoal,
  initialAreas,
  initialTime,
  onSave,
  onClose,
}: QuestionnaireProps) {
  const { t }         = useTranslation();
  const initGoalItem  = GOAL_SEARCH_DB.find(g => g.value === (initialGoal || "general"));
  const [goal,       setGoal]       = useState(initialGoal || "general");
  const [goalQuery,  setGoalQuery]  = useState(initGoalItem?.label ?? "");
  const [goalOpen,   setGoalOpen]   = useState(false);

  const [areas,      setAreas]      = useState<string[]>(initialAreas);
  const [areaQuery,  setAreaQuery]  = useState("");
  const [areaOpen,   setAreaOpen]   = useState(false);

  const [time,       setTime]       = useState<number>(initialTime || 10);

  const goalSuggestions = GOAL_SEARCH_DB.filter(g =>
    !goalQuery
      ? true
      : g.label.toLowerCase().includes(goalQuery.toLowerCase()),
  ).slice(0, 7);

  const areaSuggestions = EXTENDED_BODY_PARTS.filter(p =>
    areaQuery
      ? p.toLowerCase().includes(areaQuery.toLowerCase()) && !areas.includes(p)
      : false,
  ).slice(0, 6);

  function selectGoal(item: GoalSearchItem) {
    setGoal(item.value);
    setGoalQuery(item.label);
    setGoalOpen(false);
  }

  function toggleArea(area: string) {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  }

  function addArea(area: string) {
    if (!areas.includes(area)) setAreas(prev => [...prev, area]);
    setAreaQuery("");
    setAreaOpen(false);
  }

  const selectedGoalLabel = GOAL_LABELS[goal as MobilityGoal] ?? goal;

  return (
    <motion.div
      key="questionnaire-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full sm:max-w-lg glass-card rounded-t-[20px] sm:rounded-[20px] shadow-2xl overflow-y-auto max-h-[92vh] border-0"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 40,  opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-extrabold">{t("dailyTasks.updateMyGoals")}</h2>
            <p className="text-sm text-muted-foreground font-light opacity-80">
              {t("dailyTasks.personaliseDesc")}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-7">

          {/* Q1 — Primary goal (search) */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("dailyTasks.primaryGoalQuestion")}
            </p>

            {/* Selected badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
                {selectedGoalLabel}
              </span>
              <span className="text-xs text-muted-foreground">{t("dailyTasks.tapToChange")}</span>
            </div>

            {/* Search input */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={goalQuery}
                  onChange={e => { setGoalQuery(e.target.value); setGoalOpen(true); }}
                  onFocus={() => setGoalOpen(true)}
                  onBlur={() => setTimeout(() => setGoalOpen(false), 160)}
                  placeholder={t("dailyTasks.searchMovementPlaceholder")}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Glassmorphism dropdown */}
              {goalOpen && goalSuggestions.length > 0 && (
                <div
                  className="absolute z-50 top-full mt-1.5 w-full rounded-xl overflow-hidden"
                  style={GLASS_DROPDOWN}
                >
                  {goalSuggestions.map(item => (
                    <button
                      key={item.label}
                      onMouseDown={() => selectGoal(item)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-3",
                        item.value === goal
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-white/[0.05]",
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {GOAL_LABELS[item.value]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Q2 — Stiffness areas (search + quick tags) */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("dailyTasks.stiffnessQuestion")}{" "}
              <span className="font-normal text-muted-foreground">{t("dailyTasks.pickAllThatApply")}</span>
            </p>

            {/* Selected chips */}
            {areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {areas.map(a => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium"
                  >
                    {a}
                    <button
                      onClick={() => toggleArea(a)}
                      className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={areaQuery}
                  onChange={e => { setAreaQuery(e.target.value); setAreaOpen(true); }}
                  onFocus={() => { setAreaOpen(true); }}
                  onBlur={() => setTimeout(() => setAreaOpen(false), 160)}
                  placeholder={t("dailyTasks.searchBodyPartPlaceholder")}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Glassmorphism dropdown */}
              {areaOpen && areaSuggestions.length > 0 && (
                <div
                  className="absolute z-50 top-full mt-1.5 w-full rounded-xl overflow-hidden"
                  style={GLASS_DROPDOWN}
                >
                  {areaSuggestions.map(part => (
                    <button
                      key={part}
                      onMouseDown={() => addArea(part)}
                      className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/[0.05] transition-colors font-medium"
                    >
                      {part}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick-select suggested tags */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                {t("dailyTasks.suggested")}
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleArea(tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-xs font-semibold transition-all",
                      areas.includes(tag)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Q3 — Daily time */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("dailyTasks.dailyTimeQuestion")}
            </p>
            <div className="flex gap-3">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setTime(opt)}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                    time === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {t("dailyTasks.minutesLabel", { n: opt })}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <Button
            className="w-full font-bold"
            size="lg"
            onClick={() => onSave(goal, areas, time)}
          >
            {t("dailyTasks.savePreferences")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Saved checkmark flash ────────────────────────────────────────────────────

function SavedBadge() {
  const { t } = useTranslation();
  return (
    <motion.div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg pointer-events-none"
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
    >
      <CheckCircle2 className="w-4 h-4" />
      {t("dailyTasks.goalsUpdated")}
    </motion.div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  index,
  name,
  muscles,
  durationSeconds,
  cue,
  why,
}: {
  index: number;
  name: string;
  muscles: string[];
  durationSeconds: number;
  cue: string;
  why: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "glass-card transition-all",
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
          <div className="font-bold text-sm truncate">{name}</div>
          <div className="text-xs text-muted-foreground font-light opacity-80">
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
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
          {/* Why this exercise for your goal */}
          <div className="flex items-start gap-2 pt-3 rounded-lg bg-primary/5 px-3 py-2.5 -mx-0">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest shrink-0 mt-px">
              Why
            </span>
            <p className="text-xs text-primary/90 leading-relaxed">{why}</p>
          </div>
          {/* Coaching cue */}
          <p className="text-xs text-muted-foreground leading-relaxed">{cue}</p>
        </div>
      )}
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  enabled,
  blocked,
  notificationTime,
  goalLabel,
  stiffnessAreas,
  dailyTimeMinutes,
  onToggle,
  onTimeChange,
}: {
  enabled: boolean;
  blocked: boolean;
  notificationTime: string;
  goalLabel: string;
  stiffnessAreas: string;
  dailyTimeMinutes: number;
  onToggle: () => void;
  onTimeChange: (t: string) => void;
}) {
  const { t } = useTranslation();

  const areas = stiffnessAreas
    ? stiffnessAreas.split(",").filter(Boolean).slice(0, 2).join(" & ")
    : "";

  const preview = `Ready to work toward your ${goalLabel}? Your ${dailyTimeMinutes}-min mobility prep is waiting${areas ? `. Focus: ${areas}` : ""}.`;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Bell className="w-4 h-4 text-primary" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            {enabled ? t("dailyTasks.dailyReminderOn") : t("dailyTasks.dailyReminderOff")}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="relative rounded-full transition-colors"
          style={{ width: 40, height: 22, background: enabled ? "var(--primary)" : "hsl(var(--muted))" }}
        >
          <span
            className="absolute top-0.5 rounded-full bg-white shadow transition-transform"
            style={{
              left: 2,
              width: 18,
              height: 18,
              transform: enabled ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </button>
      </div>

      {blocked && (
        <p className="text-xs text-destructive">
          {t("settings.notificationsBlocked")}
        </p>
      )}

      {enabled && !blocked && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">
            {t("settings.reminderTime")}
          </label>
          <input
            type="time"
            value={notificationTime}
            onChange={e => onTimeChange(e.target.value)}
            className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
          />
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{preview}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main DailyTasks page ─────────────────────────────────────────────────────

export function DailyTasksPage() {
  const { t }       = useTranslation();
  const { toast }   = useToast();
  const { data: mobilityStatus, isLoading } = useMobilityStatus();
  const updateSettings = useUpdateMobilitySettings();

  // Local optimistic state (mirrors server)
  const [goal,  setGoal]  = useState<string>(() => readLocalPrefs()?.mobilityGoal  ?? "general");
  const [areas, setAreas] = useState<string>(() => readLocalPrefs()?.stiffnessAreas ?? "");
  const [time,  setTime]  = useState<number>(() => readLocalPrefs()?.dailyTimeMinutes ?? 10);

  // Notification state
  const [notifEnabled, setNotifEnabled]   = useState(() => readNotifPrefs()?.enabled ?? false);
  const [notifTime,    setNotifTime]      = useState(() => readNotifPrefs()?.time ?? "08:00");
  const [notifBlocked, setNotifBlocked]   = useState(false);
  const [activeTab,    setActiveTab]      = useState<"tasks" | "routine">("tasks");

  // Questionnaire modal
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showSaved,         setShowSaved]         = useState(false);

  // Sync from server once loaded
  useEffect(() => {
    if (!mobilityStatus) return;
    const local = readLocalPrefs();
    if (!local) {
      setGoal(mobilityStatus.settings.mobilityGoal ?? "general");
      setAreas(mobilityStatus.settings.stiffnessAreas ?? "");
      setTime(mobilityStatus.settings.dailyTimeMinutes ?? 10);
    }
    const localNotif = readNotifPrefs();
    if (!localNotif) {
      setNotifEnabled(mobilityStatus.settings.enabled ?? false);
      setNotifTime(mobilityStatus.settings.notificationTime ?? "08:00");
    }
  }, [mobilityStatus]);

  useNotificationScheduler(mobilityStatus);

  async function handleNotifToggle() {
    const next = !notifEnabled;
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) { setNotifBlocked(true); return; }
      setNotifBlocked(false);
    }
    setNotifEnabled(next);
    writeNotifPrefs({ enabled: next, time: notifTime });
    updateSettings.mutate({ enabled: next, notificationTime: notifTime, mobilityGoal: goal as MobilityGoal });
  }

  function handleTimeChange(newTime: string) {
    setNotifTime(newTime);
    writeNotifPrefs({ enabled: notifEnabled, time: newTime });
    if (notifEnabled) {
      updateSettings.mutate({ enabled: notifEnabled, notificationTime: newTime, mobilityGoal: goal as MobilityGoal });
    }
  }

  function handleSave(newGoal: string, newAreas: string[], newTime: number) {
    const areasStr = newAreas.join(",");
    setGoal(newGoal);
    setAreas(areasStr);
    setTime(newTime);
    writeLocalPrefs({ mobilityGoal: newGoal, stiffnessAreas: areasStr, dailyTimeMinutes: newTime });
    setShowQuestionnaire(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2200);
    updateSettings.mutate({
      enabled: notifEnabled,
      notificationTime: notifTime,
      mobilityGoal: newGoal as MobilityGoal,
      stiffnessAreas: areasStr,
      dailyTimeMinutes: newTime,
    });
  }

  const tasks = getTasksForPreferences(goal as MobilityGoal, areas ? areas.split(",").filter(Boolean) as StiffnessArea[] : [], time);
  const goalLabel = GOAL_LABELS[goal as MobilityGoal] ?? goal;
  const totalMins = routineDurationMinutes(tasks);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.dailyMobility")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {goalLabel} · {totalMins} {t("dailyTasks.min")}
          </p>
        </div>
        <button
          onClick={() => setShowQuestionnaire(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          {t("dailyTasks.editGoals")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/40 border border-border/50">
        {(["tasks", "routine"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "tasks" ? t("dailyTasks.tabTasks") : t("dailyTasks.tabRoutine")}
          </button>
        ))}
      </div>

      {activeTab === "tasks" && (
        <div className="space-y-3">
          {/* Notification card */}
          <NotificationCard
            enabled={notifEnabled}
            blocked={notifBlocked}
            notificationTime={notifTime}
            goalLabel={goalLabel}
            stiffnessAreas={areas}
            dailyTimeMinutes={time}
            onToggle={() => void handleNotifToggle()}
            onTimeChange={handleTimeChange}
          />

          {/* Task list */}
          {tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              index={i}
              name={task.name}
              muscles={task.targetMuscles}
              durationSeconds={task.durationSeconds}
              cue={task.coachingCue}
              why={task.why}
            />
          ))}
        </div>
      )}

      {activeTab === "routine" && (
        <MobilityPage />
      )}

      {/* Questionnaire modal */}
      <AnimatePresence>
        {showQuestionnaire && (
          <Questionnaire
            initialGoal={goal}
            initialAreas={areas ? areas.split(",").filter(Boolean) : []}
            initialTime={time}
            onSave={handleSave}
            onClose={() => setShowQuestionnaire(false)}
          />
        )}
      </AnimatePresence>

      {/* Saved badge */}
      <AnimatePresence>
        {showSaved && <SavedBadge />}
      </AnimatePresence>
    </div>
  );
}
