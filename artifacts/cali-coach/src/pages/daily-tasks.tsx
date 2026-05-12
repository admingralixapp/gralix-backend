import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getTasksForPreferences,
  GOAL_LABELS,
  QUESTIONNAIRE_GOAL_OPTIONS,
  STIFFNESS_OPTIONS,
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
import {
  Questionnaire,
  toKey,
  goalToKey,
} from "@/components/mobility-questionnaire";

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

// ─── (Questionnaire, toKey, goalToKey, GOAL_SEARCH_DB, GLASS_DROPDOWN imported from @/components/mobility-questionnaire) ───

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
      {t("mobility.goalsUpdatedBadge")}
    </motion.div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  index,
  stretchId,
  name,
  muscles,
  durationSeconds,
  cue,
  why,
}: {
  index: number;
  stretchId: string;
  name: string;
  muscles: string[];
  durationSeconds: number;
  cue: string;
  why: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const displayName = t(`mobility.stretches.${stretchId}`, { defaultValue: name });
  const displayMuscles = muscles.map(m => t(`mobility.muscles.${toKey(m)}`, { defaultValue: m }));

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
          <div className="font-bold text-sm truncate">{displayName}</div>
          <div className="text-xs text-muted-foreground font-light opacity-80">
            {displayMuscles.slice(0, 2).join(" · ")}
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
            {enabled ? t("mobility.reminderOn") : t("mobility.reminderOff")}
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
            {t("mobility.notificationsBlocked")}
          </p>
        </div>
      )}

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("mobility.remindMeAt")}</span>
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
  const { t }              = useTranslation();
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
  const goalLabel        = t(`mobility.goals.${goalToKey(goal)}`, { defaultValue: GOAL_LABELS[goal] ?? goal });
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
          <h1 className="text-2xl font-extrabold tracking-tight">{t("mobility.title")}</h1>
          <p className="text-sm text-muted-foreground font-light opacity-80 mt-0.5">
            {t("mobility.subtitle")}
          </p>
        </div>
        {(status?.currentStreak ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 rounded-full px-3 py-1 text-sm font-semibold shrink-0">
            <Flame className="w-4 h-4" />
            {t("mobility.streak", { count: status?.currentStreak })}
          </div>
        )}
      </div>

      {/* Goal + preferences summary */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              {t("mobility.currentGoal")}
            </div>
            <div className="font-extrabold text-lg leading-tight">{goalLabel}</div>
            {areasArray.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {areasArray.map(a => (
                  <span
                    key={a}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {t(`mobility.areas.${toKey(a)}`, { defaultValue: a })}
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
            {t("mobility.updateGoals")}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {t("mobility.minPerDay", { count: dailyTimeMinutes })}
          </span>
          <span>·</span>
          <span>{t("mobility.exerciseCount", { count: tasks.length, min: totalMin })}</span>
        </div>
      </div>

      {/* Completed today banner */}
      {status?.completedToday && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            {t("mobility.completedToday")}
          </span>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          {t("mobility.todaysTasks")}
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
                stretchId={stretch.id}
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
        onClick={() => setLocation("/mobility-session")}
      >
        <Play className="w-5 h-5 mr-2" />
        {status?.completedToday ? t("mobility.repeatSession") : t("mobility.startSession")}
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

      {/* Questionnaire modal */}
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
