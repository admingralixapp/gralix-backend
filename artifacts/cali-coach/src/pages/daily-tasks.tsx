import { useEffect, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
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
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
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

// ─── Local-storage helpers ────────────────────────────────────────────────────
// Used as an optimistic cache so the task list updates the instant the user
// taps Save — no API round-trip needed for the re-render.

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
// Maps every skill-tree exercise / title to the closest MobilityGoal so users
// can search "Archer Pull-Up" and land on the Pull-Up Mastery routine.

interface GoalSearchItem { label: string; value: MobilityGoal }

const GOAL_SEARCH_DB: GoalSearchItem[] = [
  // Primary goal names
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
  // Skill tree exercises
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
  const initGoalItem = GOAL_SEARCH_DB.find(g => g.value === (initialGoal || "general"));
  const [goal,       setGoal]       = useState(initialGoal || "general");
  const [goalQuery,  setGoalQuery]  = useState(initGoalItem?.label ?? "");
  const [goalOpen,   setGoalOpen]   = useState(false);

  const [areas,      setAreas]      = useState<string[]>(initialAreas);
  const [areaQuery,  setAreaQuery]  = useState("");
  const [areaOpen,   setAreaOpen]   = useState(false);

  const [time,       setTime]       = useState<number>(initialTime || 10);

  // Goal suggestions: show all when query is empty, else filter
  const goalSuggestions = GOAL_SEARCH_DB.filter(g =>
    !goalQuery
      ? true
      : g.label.toLowerCase().includes(goalQuery.toLowerCase()),
  ).slice(0, 7);

  // Area suggestions: filter extended list, exclude already selected
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
            <h2 className="text-lg font-extrabold">Update My Goals</h2>
            <p className="text-sm text-muted-foreground font-light opacity-80">
              Personalise your daily mobility tasks
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
              What is your primary calisthenics goal?
            </p>

            {/* Selected badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
                {selectedGoalLabel}
              </span>
              <span className="text-xs text-muted-foreground">Tap below to change</span>
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
                  placeholder="Search a movement or skill…"
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
              What muscles and joints are holding you back?{" "}
              <span className="font-normal text-muted-foreground">(pick all that apply)</span>
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
                  placeholder="Search a body part…"
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
                Suggested
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
            onClick={() => onSave(goal, areas, time)}
          >
            Save My Preferences
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Saved checkmark flash ────────────────────────────────────────────────────

function SavedBadge() {
  return (
    <motion.div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg pointer-events-none"
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
    >
      <CheckCircle2 className="w-4 h-4" />
      Goals Updated! Your routine has been personalized.
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
          {/* 3-panel motion snapshot */}
          <ExerciseMotionSnapshot exerciseName={name} className="pt-3" />

          {/* Why this exercise for your goal */}
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 -mx-0">
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
            {enabled ? "Daily Reminder On" : "Daily Reminder Off"}
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

      {/* Blocked warning — shown when browser has denied permission */}
      {blocked && !enabled && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <BellOff className="w-3.5 h-3.5 text-destructive shrink-0 mt-px" />
          <p className="text-xs text-destructive leading-relaxed">
            Notifications are blocked. Please enable them in your browser settings to receive reminders.
          </p>
        </div>
      )}

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
  const [, setLocation]    = useLocation();
  const { data: status }   = useMobilityStatus();
  const updateSettings     = useUpdateMobilitySettings();
  const { toast }          = useToast();

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showSavedBadge,    setShowSavedBadge]    = useState(false);

  // ── Optimistic local preferences ──────────────────────────────────────────
  // Initialised from localStorage (instant) then overwritten by server data.
  // Drives the task list so the re-render is immediate on Save.
  const serverSettings = status?.settings;

  const [localPrefs, setLocalPrefs] = useState<LocalPrefs>(() => {
    const cached = readLocalPrefs();
    return cached ?? {
      mobilityGoal:     "general",
      stiffnessAreas:   "",
      dailyTimeMinutes: 10,
    };
  });

  // Sync server data into local prefs once loaded (server is source of truth)
  useEffect(() => {
    if (!serverSettings) return;
    const synced: LocalPrefs = {
      mobilityGoal:     serverSettings.mobilityGoal     ?? "general",
      stiffnessAreas:   serverSettings.stiffnessAreas   ?? "",
      dailyTimeMinutes: serverSettings.dailyTimeMinutes  ?? 10,
    };
    setLocalPrefs(synced);
    writeLocalPrefs(synced);
  }, [
    serverSettings?.mobilityGoal,
    serverSettings?.stiffnessAreas,
    serverSettings?.dailyTimeMinutes,
  ]);

  // ── Notification local state ───────────────────────────────────────────────
  // Persisted to localStorage so the toggle state survives page refresh without
  // waiting for the server query to resolve.
  const [localNotif, setLocalNotif] = useState<NotifPrefs>(() => {
    const cached = readNotifPrefs();
    if (cached) return cached;
    return {
      enabled: serverSettings?.enabled          ?? false,
      time:    serverSettings?.notificationTime ?? "08:00",
    };
  });

  // Track whether the browser has actively denied permission so we can show
  // the "blocked" warning without hiding the toggle.
  const [notifBlocked, setNotifBlocked] = useState(
    () => "Notification" in window && Notification.permission === "denied",
  );

  // Sync server notification settings into local state once loaded
  useEffect(() => {
    if (!serverSettings) return;
    const synced: NotifPrefs = {
      enabled: serverSettings.enabled          ?? false,
      time:    serverSettings.notificationTime ?? "08:00",
    };
    setLocalNotif(synced);
    writeNotifPrefs(synced);
  }, [serverSettings?.enabled, serverSettings?.notificationTime]);

  useNotificationScheduler(status);

  const goal             = localPrefs.mobilityGoal as MobilityGoal;
  const goalLabel        = GOAL_LABELS[goal] ?? goal;
  const stiffnessAreas   = localPrefs.stiffnessAreas;
  const dailyTimeMinutes = localPrefs.dailyTimeMinutes;
  const enabled          = localNotif.enabled;
  const notificationTime = localNotif.time;

  const areasArray = stiffnessAreas
    ? (stiffnessAreas.split(",").filter(Boolean) as StiffnessArea[])
    : [];

  // Task list derived from local (optimistic) prefs — updates instantly
  const tasks    = getTasksForPreferences(goal, areasArray, dailyTimeMinutes);
  const totalMin = routineDurationMinutes(tasks);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSavePreferences(
    newGoal: string,
    newAreas: StiffnessArea[],
    newTime: number,
  ) {
    const newPrefs: LocalPrefs = {
      mobilityGoal:     newGoal,
      stiffnessAreas:   newAreas.join(","),
      dailyTimeMinutes: newTime,
    };

    // 1. Update local state immediately — task list re-renders right now
    setLocalPrefs(newPrefs);
    // 2. Persist to localStorage so the next mount also picks it up instantly
    writeLocalPrefs(newPrefs);
    // 3. Close the modal without waiting for the network
    setShowQuestionnaire(false);
    // 4. Show the in-page animated badge
    setShowSavedBadge(true);
    setTimeout(() => setShowSavedBadge(false), 2800);
    // 5. Toast for accessibility / desktop users
    toast({
      title: "Goals Updated!",
      description: "Your routine has been personalized.",
    });
    // 6. Sync to the server in the background
    updateSettings.mutate(newPrefs);
  }

  async function handleToggleNotification() {
    if (enabled) {
      // Turning off — no permission needed
      const updated: NotifPrefs = { enabled: false, time: notificationTime };
      setLocalNotif(updated);
      writeNotifPrefs(updated);
      updateSettings.mutate({ enabled: false });
      return;
    }

    // Turning on — check / request browser permission first
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Your browser does not support notifications.",
        variant: "destructive",
      });
      return;
    }

    // Already hard-denied — show the blocked warning immediately
    if (Notification.permission === "denied") {
      setNotifBlocked(true);
      toast({
        title: "Notifications Blocked",
        description:
          "Notifications are blocked. Please enable them in your browser settings.",
        variant: "destructive",
      });
      return;
    }

    // Request permission (shows the browser prompt if still "default")
    const granted = await requestNotificationPermission();
    // Re-read after the async call so TypeScript doesn't narrow away "denied"
    const permissionAfter = (window as typeof window & { Notification: { permission: string } })
      .Notification.permission;

    if (granted) {
      setNotifBlocked(false);
      const updated: NotifPrefs = { enabled: true, time: notificationTime };
      setLocalNotif(updated);
      writeNotifPrefs(updated);
      updateSettings.mutate({ enabled: true });
    } else {
      const isDenied = permissionAfter === "denied";
      setNotifBlocked(isDenied);
      if (isDenied) {
        toast({
          title: "Notifications Blocked",
          description:
            "Notifications are blocked. Please enable them in your browser settings.",
          variant: "destructive",
        });
      }
    }
  }

  function handleTimeChange(time: string) {
    const updated: NotifPrefs = { enabled, time };
    setLocalNotif(updated);
    writeNotifPrefs(updated);
    updateSettings.mutate({ notificationTime: time });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 max-w-lg mx-auto space-y-5 pb-8">

      {/* Page header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground font-light opacity-80 mt-0.5">
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
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              Current Goal
            </div>
            <div className="font-extrabold text-lg leading-tight">{goalLabel}</div>
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
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Today's Tasks
        </h2>

        <AnimatePresence mode="popLayout">
          {tasks.map((stretch, i) => (
            <motion.div
              key={stretch.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
            >
              <TaskCard
                index={i}
                name={stretch.name}
                muscles={stretch.targetMuscles}
                durationSeconds={stretch.durationSeconds}
                cue={stretch.coachingCue}
                why={stretch.why}
              />
            </motion.div>
          ))}
        </AnimatePresence>
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
        blocked={notifBlocked}
        notificationTime={notificationTime}
        goalLabel={goalLabel}
        stiffnessAreas={stiffnessAreas}
        dailyTimeMinutes={dailyTimeMinutes}
        onToggle={handleToggleNotification}
        onTimeChange={handleTimeChange}
      />

      {/* Questionnaire modal — rendered with AnimatePresence for slide-up enter/exit */}
      <AnimatePresence>
        {showQuestionnaire && (
          <Questionnaire
            initialGoal={goal}
            initialAreas={areasArray}
            initialTime={dailyTimeMinutes}
            onSave={handleSavePreferences}
            onClose={() => setShowQuestionnaire(false)}
          />
        )}
      </AnimatePresence>

      {/* Saved badge */}
      <AnimatePresence>
        {showSavedBadge && <SavedBadge />}
      </AnimatePresence>
    </div>
  );
}
