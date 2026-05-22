import { useGetProgressSummary, useGetRecentSessions, useGetProgressTimeline, useListSessions } from "@workspace/api-client-react";
import { EmojiIcon } from "@/components/emoji-icon";
import { evaluateSkillTree } from "@/lib/skill-tree";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Flame,
  Trophy,
  Target,
  ArrowRight,
  Dumbbell,
  GitBranch,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  PenLine,
  Clock,
  Crown,
  TrendingUp,
  Zap,
  HeartPulse,
  ChevronDown,
  AlertTriangle,
  ShieldCheck,
  X,
  Timer,
} from "lucide-react";
import { getDailyPrescription } from "@/lib/daily-prescription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillMap } from "@/components/skill-map";
import { SocialFeed } from "@/components/social-feed";
import { useMobilityStatus, useNotificationScheduler } from "@/lib/use-mobility";
import { GOAL_LABELS, type MobilityGoal, type Stretch, buildWarmupSequence } from "@/lib/mobility-service";
import { WarmupSequencePlayer } from "@/components/warmup-sequence-player";
import { useLeaderboard, useMyProfile } from "@/lib/social";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { format as fmtDate } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
} from "recharts";

// ─── Countdown helpers ────────────────────────────────────────────────────────

function getNextWeeklyReset(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntil = day === 0 ? 7 : 7 - day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil, 23, 59, 59, 0),
  );
}

function useWeeklyCountdown() {
  const target = getNextWeeklyReset();
  const [ms, setMs] = useState(() => target.getTime() - Date.now());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setMs(target.getTime() - Date.now()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target]);
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  return { d, h, m };
}

function StatCard({
  icon,
  label,
  value,
  sub,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="tracking-tight text-muted-foreground font-light opacity-80 flex items-center gap-2 text-[13px]">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : (
          <div className="text-3xl font-extrabold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground font-light opacity-80 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Performance Trends card ──────────────────────────────────────────────────

function PerformanceTrendsCard({ isPro }: { isPro: boolean }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: timeline } = useGetProgressTimeline({ days: 30 });
  const { data: summary }  = useGetProgressSummary();

  const chartData = useMemo(() => {
    if (!timeline?.length) {
      // synthetic skeleton data so the blurred chart looks meaningful
      return Array.from({ length: 12 }, (_, i) => ({
        label: "",
        form:  60 + Math.round(Math.sin(i * 0.6) * 20 + Math.random() * 10),
        reps:  20 + Math.round(Math.cos(i * 0.4) * 15 + Math.random() * 8),
      }));
    }
    return timeline.slice(-12).map((pt) => ({
      label: new Date(pt.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      form:  pt.avgFormScore != null ? Math.round(pt.avgFormScore) : null,
      reps:  pt.totalReps ?? 0,
    }));
  }, [timeline]);

  return (
    <Card className="border-border bg-card overflow-hidden relative">
      {/* Blurred content layer */}
      <div
        className={!isPro ? "pointer-events-none select-none" : undefined}
        style={!isPro ? { filter: "blur(5px) brightness(0.4)", userSelect: "none" } : undefined}
        aria-hidden={!isPro}
      >
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t("dashboard.performanceTrends", "Performance Trends")}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {t("dashboard.last30Days", "Last 30 days")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Mini stat row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: t("dashboard.avgForm", "Avg Form"),
                value: summary?.avgFormScore != null ? `${Math.round(summary.avgFormScore)}` : "--",
                unit: "/100",
              },
              {
                label: t("dashboard.totalReps", "Total Reps"),
                value: summary?.totalReps != null ? `${summary.totalReps}` : "--",
                unit: "",
              },
              {
                label: t("dashboard.sessions", "Sessions"),
                value: summary?.totalSessions != null ? `${summary.totalSessions}` : "--",
                unit: "",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center bg-secondary border border-border"
              >
                <div className="text-xl font-black font-mono text-primary">
                  {s.value}
                  {s.unit && <span className="text-xs text-muted-foreground ml-0.5">{s.unit}</span>}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Form score area chart */}
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#177548" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#177548" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#6b7280" }}
                  itemStyle={{ color: "#177548" }}
                  formatter={(v: number) => [`${v}`, "Form"]}
                />
                <Area
                  type="monotone"
                  dataKey="form"
                  stroke="#177548"
                  strokeWidth={2}
                  fill="url(#formGrad)"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {t("dashboard.formScoreOverTime", "Form score over time")}
          </p>
        </CardContent>
      </div>

      {/* Pro paywall overlay — only for free users */}
      {!isPro && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 py-8">
          <div className="absolute inset-0 backdrop-blur-[2px]" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-black/10 p-6 flex flex-col items-center text-center space-y-4 shadow-lg bg-white">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/25">
              <Crown className="w-6 h-6 text-primary" />
            </div>

            {/* Copy */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1 text-primary">
                {t("dashboard.proFeature", "Pro Feature")}
              </div>
              <h3 className="text-lg font-black text-foreground">
                {t("dashboard.unlockPerformance", "Unlock Your Performance Data")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t("dashboard.performanceDesc", "See form trends, rep volume, and progress charts with a Pro plan.")}
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setLocation("/shop")}
              className="w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all"
              style={{ background: "#177548", color: "#fff" }}
            >
              {t("dashboard.startTrial", "Start 3-Day Free Trial")}
            </button>
            <p className="text-[9px] text-muted-foreground">
              {t("progress.trialNote", "Cancel any time · No charge today")}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Contextual 10-Minute Warmup Modal ───────────────────────────────────────

function WarmupModal({
  stretches,
  onClose,
}: {
  stretches: Stretch[];
  onClose: () => void;
}) {
  const [playerActive, setPlayerActive] = useState(false);
  const totalSeconds = stretches.reduce((s, x) => s + x.durationSeconds, 0);
  const mins = Math.ceil(totalSeconds / 60);

  if (playerActive) {
    return (
      <WarmupSequencePlayer
        stretches={stretches}
        onComplete={onClose}
        onExit={() => setPlayerActive(false)}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="relative z-10 bg-white w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col"
        style={{ border: "1px solid rgba(0,0,0,0.10)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
          <div>
            <h2 className="text-base font-black text-black">Targeted Warmup</h2>
            <p className="text-xs text-black/45 flex items-center gap-1 mt-0.5">
              <Timer className="w-3 h-3" />
              {stretches.length} exercises · ~{mins} min
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/6 transition-colors"
          >
            <X className="w-4 h-4 text-black/50" />
          </button>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 divide-y divide-black/8">
          {stretches.map((stretch, i) => (
            <div key={stretch.id} className="px-6 py-4 flex gap-4">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5"
                style={{ background: "#177548" }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-black">{stretch.name}</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(23,117,72,0.08)", color: "#177548" }}
                  >
                    {stretch.durationSeconds}s
                  </span>
                </div>
                <p className="text-xs text-black/55 leading-snug mb-1.5">
                  {stretch.description}
                </p>
                <p className="text-[11px] font-semibold leading-snug flex items-center gap-1" style={{ color: "#177548" }}>
                  <EmojiIcon emoji="💡" className="w-3.5 h-3.5 object-contain shrink-0" style={{ filter: "invert(37%) sepia(51%) saturate(1260%) hue-rotate(101deg) brightness(95%) contrast(96%)" }} />
                  {stretch.coachingCue}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTAs */}
        <div className="px-6 py-4 border-t border-black/10 space-y-2 shrink-0">
          <button
            onClick={() => setPlayerActive(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
            style={{ background: "#177548" }}
          >
            <Sparkles className="w-4 h-4" />
            Begin Warmup
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-black/55 hover:bg-black/4 transition-colors border border-black/12"
          >
            Continue to Workout Instead
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Joint Readiness Quick-Log Widget ────────────────────────────────────────

const JOINT_LS_KEY = "calicoach_joint_readiness_v1";

const JOINTS = ["wrist", "elbow", "shoulder", "neck", "hips", "knee", "ankle"] as const;
type JointKey = typeof JOINTS[number];
type JointInput = Record<JointKey, number>;

interface JointLog extends JointInput { date: string; }

function loadJoints(): JointLog[] {
  try { return JSON.parse(localStorage.getItem(JOINT_LS_KEY) ?? "[]"); }
  catch { return []; }
}

const DEFAULT_INPUT: JointInput = { wrist: 7, elbow: 7, shoulder: 7, neck: 7, hips: 7, knee: 7, ankle: 7 };

type WarningTier = 1 | 2 | 3;
interface ReadinessWarning { tier: WarningTier; joints: string[] }

function JointReadinessWidget({
  onNavigateProgress,
  onOpenWarmup,
}: {
  onNavigateProgress: () => void;
  onOpenWarmup: (flaggedJoints: string[]) => void;
}) {
  const today = fmtDate(new Date(), "yyyy-MM-dd");

  const [logs,      setLogs]      = useState<JointLog[]>(loadJoints);
  const [input,     setInput]     = useState<JointInput>(DEFAULT_INPUT);
  const [todayDone, setTodayDone] = useState(() => loadJoints().some(l => l.date === today));
  const [expanded,  setExpanded]  = useState(() => !loadJoints().some(l => l.date === today));
  const [warning,   setWarning]   = useState<ReadinessWarning | null>(null);

  const avgLast7 = useMemo(() => {
    const recent = logs.slice(-7);
    if (!recent.length) return null;
    const avg = recent.reduce((s, l) => {
      const vals = JOINTS.map(j => l[j] ?? 7);
      return s + vals.reduce((a, b) => a + b, 0) / vals.length;
    }, 0) / recent.length;
    return Math.round(avg * 10) / 10;
  }, [logs]);

  const comfortColor = avgLast7 === null ? "#888"
    : avgLast7 >= 7 ? "#177548"
    : avgLast7 >= 5 ? "#b45309"
    : "#b91c1c";

  const handleLog = useCallback(() => {
    const updated = [...logs.filter(l => l.date !== today), { date: today, ...input }].slice(-30);
    setLogs(updated);
    localStorage.setItem(JOINT_LS_KEY, JSON.stringify(updated));
    setTodayDone(true);
    setExpanded(false);

    // ── Tier 3: any joint <= 3 — critical ─────────────────────────────────────
    const criticalJoints = JOINTS.filter(j => input[j] <= 3);
    if (criticalJoints.length > 0) {
      setWarning({ tier: 3, joints: criticalJoints });
      return;
    }
    // ── Tier 2: any joint 4–6 — cautionary ────────────────────────────────────
    const cautionJoints = JOINTS.filter(j => input[j] >= 4 && input[j] <= 6);
    if (cautionJoints.length > 0) {
      setWarning({ tier: 2, joints: cautionJoints });
      return;
    }
    // ── Tier 1: all >= 7 — nominal ────────────────────────────────────────────
    setWarning({ tier: 1, joints: [] });
  }, [logs, today, input]);

  // Format joint list as readable string, e.g. "Wrist & Shoulder"
  function fmtJoints(joints: string[]): string {
    const cap = joints.map(j => j.charAt(0).toUpperCase() + j.slice(1));
    if (cap.length === 1) return cap[0];
    if (cap.length === 2) return `${cap[0]} & ${cap[1]}`;
    return cap.slice(0, -1).join(", ") + " & " + cap[cap.length - 1];
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-black/12 bg-white">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 pt-4 pb-3 text-left"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(23,117,72,0.10)", border: "1px solid rgba(23,117,72,0.25)" }}>
          <HeartPulse className="w-4 h-4" style={{ color: "#177548" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-black">Joint Readiness</span>
            {todayDone && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(23,117,72,0.10)", border: "1px solid rgba(23,117,72,0.25)", color: "#177548" }}>
                ✓ Logged
              </span>
            )}
          </div>
          <p className="text-[11px] text-black/45 leading-none mt-0.5">
            {todayDone ? "Today's check-in complete" : "Log today's joint comfort"}
          </p>
        </div>
        {avgLast7 !== null && (
          <div className="text-right shrink-0 mr-1">
            <div className="text-xl font-black font-mono" style={{ color: comfortColor }}>
              {avgLast7}
            </div>
            <div className="text-[9px] text-black/40">7-day avg</div>
          </div>
        )}
        <ChevronDown
          className="w-4 h-4 shrink-0 text-black/35 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* ── Warning / success banner — always visible once submitted ──────────── */}
      {warning && !expanded && (
        <div className="px-5 pb-4 space-y-2.5">
          {/* ── Tier 1: all nominal ─────────────────────────────────────────────── */}
          {warning.tier === 1 && (
            <>
              <div
                className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ background: "rgba(23,117,72,0.07)", border: "1px solid rgba(23,117,72,0.25)" }}
              >
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#177548" }} />
                <p className="text-xs font-semibold leading-snug" style={{ color: "#177548" }}>
                  Mechanical integrity nominal. Enjoy your session.
                </p>
              </div>
              <Link
                href="/training"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90"
                style={{ background: "#177548" }}
              >
                <Activity className="w-3.5 h-3.5" />
                Proceed to Workout
              </Link>
            </>
          )}

          {/* ── Tier 2: sub-optimal ─────────────────────────────────────────────── */}
          {warning.tier === 2 && (
            <>
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.28)" }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
                  <p className="text-xs font-semibold leading-snug text-black">
                    Sub-optimal joint readiness detected in your{" "}
                    <span className="font-black" style={{ color: "#b45309" }}>
                      {fmtJoints(warning.joints)}
                    </span>
                    . Consider executing a targeted warm-up before loading these joints.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenWarmup(warning.joints)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-white transition-all hover:opacity-90"
                  style={{ background: "#177548" }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Targeted Warmup
                </button>
                <Link
                  href="/training"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-black/70 border border-black/20 hover:bg-black/4 transition-all"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Workout Anyway
                </Link>
              </div>
            </>
          )}

          {/* ── Tier 3: critical ────────────────────────────────────────────────── */}
          {warning.tier === 3 && (
            <>
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(185,28,28,0.06)", border: "2px solid rgba(185,28,28,0.55)" }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                  <p className="text-xs font-bold leading-snug text-black">
                    <span className="font-black text-red-700">⚠ CRITICAL INJURY RISK DETECTED:</span>{" "}
                    Heavy joint strain flagged in your{" "}
                    <span className="font-black text-red-700">{fmtJoints(warning.joints)}</span>.
                    {" "}We strongly recommend a therapeutic warm-up before loading this area.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenWarmup(warning.joints)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-white transition-all hover:opacity-90"
                  style={{ background: "#177548" }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Targeted Warmup
                </button>
                <Link
                  href="/training"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-black/70 border border-black/20 hover:bg-black/4 transition-all"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Workout Anyway
                </Link>
              </div>
              <p className="text-[10px] text-black/35 text-center leading-tight">
                Full workout access is preserved — this is a safety recommendation only.
              </p>
            </>
          )}
        </div>
      )}

      {/* Expandable sliders */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          <div className="rounded-xl p-4 space-y-3 bg-black/[0.03] border border-black/8">
            {JOINTS.map((joint) => (
              <div key={joint} className="flex items-center gap-3">
                <span className="w-16 text-xs capitalize text-black/45 shrink-0">{joint}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={input[joint]}
                  onChange={e => {
                    setWarning(null);
                    setInput(prev => ({ ...prev, [joint]: parseInt(e.target.value) }));
                  }}
                  className="flex-1 h-1.5 cursor-pointer"
                  style={{ accentColor: "#177548" }}
                />
                <span
                  className="w-5 text-sm font-bold font-mono text-right shrink-0"
                  style={{
                    color: input[joint] >= 7 ? "#177548" : input[joint] >= 4 ? "#b45309" : "#b91c1c",
                  }}
                >
                  {input[joint]}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleLog}
            className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-white hover:opacity-90"
            style={{ background: "#177548" }}
          >
            {todayDone ? "Update Today" : "Log Today"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Daily Prescription Card ──────────────────────────────────────────────────

function DailyPrescriptionCard({
  targetSkillId,
  masteredNodeIds,
  exerciseStats,
}: {
  targetSkillId: string;
  masteredNodeIds: Set<string>;
  exerciseStats: Record<string, { total: number }>;
}) {
  const prescription = getDailyPrescription(targetSkillId, masteredNodeIds, exerciseStats);
  if (!prescription) return null;

  const { targetNode, focusNode, readiness, requiredReps, totalReps, allMastered } = prescription;
  const pct = Math.round(readiness * 100);
  const workoutUrl = `/workout?exercise=${encodeURIComponent(focusNode.exercises[0])}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-primary/30 bg-card">
      <div className="flex items-stretch">
        {/* Accent bar */}
        <div className="w-1 shrink-0 bg-primary" />

        <div className="flex-1 p-5">
          {/* Label row */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-primary/10 border border-primary/25">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
              Today's Prescription
            </span>
          </div>

          {/* Main message */}
          {allMastered ? (
            <p className="text-base font-bold leading-snug text-foreground">
              You've mastered the full path to{" "}
              <span className="text-primary">{targetNode.title}</span>! Keep
              training to maintain your edge.
            </p>
          ) : focusNode.id === targetNode.id ? (
            <p className="text-base font-bold leading-snug text-foreground">
              Focus on{" "}
              <span className="font-black">{focusNode.title}</span> today to
              master your target —{" "}
              <span className="text-primary">{targetNode.title}</span>.
            </p>
          ) : (
            <p className="text-base font-bold leading-snug text-foreground">
              To unlock{" "}
              <span className="text-primary">{targetNode.title}</span>, focus
              on <span className="font-black">{focusNode.title}</span> today.
            </p>
          )}

          {/* Mastery requirement hint */}
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            {focusNode.masteryRequirement.description}
          </p>

          {/* Progress bar */}
          <div className="mt-3 mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {focusNode.title} Readiness
              </span>
              <span
                className="text-[11px] font-black tabular-nums"
                style={{ color: pct >= 50 ? "#177548" : "#9ca3af" }}
              >
                {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-700 bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            {!allMastered && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {totalReps} / {requiredReps} qualifying reps logged
              </p>
            )}
          </div>

          {/* CTA */}
          <Button
            asChild
            size="sm"
            className="font-bold w-full sm:w-auto bg-primary text-white hover:bg-primary/90"
          >
            <Link href={workoutUrl}>
              <Dumbbell className="w-4 h-4 mr-1.5" />
              Start Recommended Session
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

export function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: loadingSummary } = useGetProgressSummary();
  const { data: recentSessions, isLoading: loadingSessions } = useGetRecentSessions({ limit: 5 });
  const { data: mobilityStatus, isLoading: loadingMobility } = useMobilityStatus();
  const { data: profile } = useMyProfile();

  // ── Warmup modal state ────────────────────────────────────────────────────
  const [warmupCtx, setWarmupCtx] = useState<{
    flaggedJoints: string[];
    exerciseName?: string;
  } | null>(null);

  const warmupStretches = useMemo(
    () => warmupCtx
      ? buildWarmupSequence(warmupCtx.flaggedJoints, warmupCtx.exerciseName)
      : [],
    [warmupCtx],
  );

  const recentExerciseName = recentSessions?.[0]?.exerciseName;

  // Fetch all sessions to evaluate real skill tree mastery (same as skill-tree page)
  const { data: allSessions } = useListSessions(
    { limit: 500 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );
  const masteredNodeIds = useMemo(() => {
    if (!allSessions) return new Set<string>();
    const evaluated = evaluateSkillTree(allSessions);
    return new Set(evaluated.filter((n) => n.status === "mastered").map((n) => n.id));
  }, [allSessions]);

  useNotificationScheduler(mobilityStatus);

  const isPro = profile?.isPro ?? false;
  const mobilityGoal = (mobilityStatus?.settings.mobilityGoal ?? "general") as MobilityGoal;
  const goalLabel = GOAL_LABELS[mobilityGoal];

  const leaderboard = useLeaderboard("global", "weekly");
  const myRank = leaderboard.data?.myRank ?? null;
  const weeklyCountdown = useWeeklyCountdown();

  const countdownParts: string[] = [];
  if (weeklyCountdown.d > 0) countdownParts.push(`${weeklyCountdown.d}d`);
  if (weeklyCountdown.h > 0 || weeklyCountdown.d > 0) countdownParts.push(`${weeklyCountdown.h}h`);
  countdownParts.push(`${weeklyCountdown.m}m`);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1 font-light opacity-80">{t("dashboard.welcomeBack")}</p>
          {/* Time Remaining badge — visible when user has a rank */}
          {myRank != null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary">
                <Trophy className="w-3 h-3" />
                #{myRank} this week
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Clock className="w-3 h-3" />
                {countdownParts.join(" ")} left
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button asChild size="lg" className="font-extrabold">
            <Link href="/training">
              <Activity className="w-5 h-5 mr-2" />
              {t("dashboard.startWorkout")}
            </Link>
          </Button>
          <button
            onClick={() => setWarmupCtx({
              flaggedJoints: [],
              exerciseName: recentExerciseName,
            })}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-black/15 text-black/55 hover:bg-black/4 transition-all"
          >
            <Sparkles className="w-3 h-3" style={{ color: "#177548" }} />
            Start Warmup First
          </button>
        </div>
      </header>

      {/* ── Stats Grid (5 cards) ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          label={t("dashboard.workoutStreak")}
          value={summary?.currentStreak ?? 0}
          sub={t("dashboard.daysInARow")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-primary" />}
          label={t("dashboard.avgForm")}
          value={
            summary?.avgFormScore != null
              ? Math.round(summary.avgFormScore)
              : "--"
          }
          sub={t("dashboard.outOf100")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label={t("dashboard.totalReps")}
          value={summary?.totalReps ?? 0}
          sub={t("dashboard.allTime")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-yellow-500" />}
          label={t("dashboard.sessions")}
          value={summary?.totalSessions ?? 0}
          sub={t("dashboard.completed")}
          isLoading={loadingSummary}
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4 text-primary" />}
          label={t("dashboard.mobilityStreak")}
          value={loadingMobility ? "--" : (mobilityStatus?.currentStreak ?? 0)}
          sub={t("dashboard.stretchDays")}
          isLoading={loadingMobility}
        />
      </div>

      {/* ── Daily Prescription (only when user has a target skill) ─── */}
      {profile?.targetSkillId && (
        <DailyPrescriptionCard
          targetSkillId={profile.targetSkillId}
          masteredNodeIds={masteredNodeIds}
          exerciseStats={profile.exerciseStats ?? {}}
        />
      )}

      {/* ── Joint Readiness Quick-Log ──────────────────────────────── */}
      <JointReadinessWidget
        onNavigateProgress={() => setLocation("/mastery?tab=progress")}
        onOpenWarmup={(flaggedJoints) =>
          setWarmupCtx({ flaggedJoints, exerciseName: recentExerciseName })
        }
      />

      {/* ── Performance Trends (Pro paywall) ──────────────────────── */}
      <PerformanceTrendsCard isPro={isPro} />

      {/* ── Daily Mobility Card ────────────────────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="flex items-stretch">
          {/* Accent bar */}
          <div className="w-1 bg-primary shrink-0" />

          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {t("dashboard.dailyMobility")}
                  </span>
                  {mobilityStatus?.completedToday && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("dashboard.done")}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold leading-tight">
                  {goalLabel}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.stretchInfo")} ·{" "}
                  {loadingMobility ? (
                    t("dashboard.loadingMobility")
                  ) : mobilityStatus?.currentStreak ? (
                    <span className="text-orange-400 font-medium flex items-center gap-1">
                      <EmojiIcon emoji="🔥" className="w-3.5 h-3.5 object-contain shrink-0" style={{ filter: "invert(55%) sepia(80%) saturate(600%) hue-rotate(360deg) brightness(110%)" }} />
                      {t("dashboard.dayStreak", { count: mobilityStatus.currentStreak })}
                    </span>
                  ) : (
                    t("dashboard.startStreak")
                  )}
                </p>
              </div>

              <Button asChild size="sm" variant={mobilityStatus?.completedToday ? "outline" : "default"}>
                <Link href="/mobility">
                  {mobilityStatus?.completedToday ? t("dashboard.repeat") : t("dashboard.begin")}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Skill Map ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              {t("dashboard.skillMap")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7 px-2">
              <Link href="/mastery">{t("dashboard.fullTree")}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-2">
          <SkillMap />
        </CardContent>
      </Card>

      {/* ── Recent Sessions ───────────────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-extrabold">{t("dashboard.recentSessions")}</h2>
          <Button variant="link" asChild className="text-primary">
            <Link href="/mastery?tab=history">
              {t("dashboard.viewAll")} <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>

        {loadingSessions ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !recentSessions || recentSessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-[20px] bg-secondary/30">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-light opacity-80 mb-4">{t("dashboard.noSessionsYet")}</p>
            <Button asChild variant="outline">
              <Link href="/training">{t("dashboard.startFirstWorkout")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/session/${session.id}`}>
                <Card className="hover:bg-secondary/50 transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-lg">{session.exerciseName}</div>
                      <div className="text-sm text-muted-foreground font-light opacity-80">
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {session.durationMinutes != null && (
                          <span className="ml-2 text-muted-foreground/70">
                            · {Math.round(session.durationMinutes)}m
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl">
                        {session.totalReps}{" "}
                        <span className="text-sm text-muted-foreground">{t("dashboard.reps")}</span>
                      </div>
                      {session.logType === "manual" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/8 border border-black/12 text-muted-foreground mt-1">
                          <PenLine className="w-2.5 h-2.5" />
                          {t("dashboard.manual")}
                        </span>
                      ) : (
                        <div className="text-sm text-primary font-medium">
                          {session.avgFormScore != null
                            ? Math.round(session.avgFormScore)
                            : "--"}{" "}
                          {t("dashboard.avgFormLabel")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Friends Activity ──────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            {t("dashboard.friendsActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <SocialFeed />
        </CardContent>
      </Card>

      {/* ── Contextual Warmup Modal ────────────────────────────────── */}
      {warmupCtx && warmupStretches.length > 0 && (
        <WarmupModal
          stretches={warmupStretches}
          onClose={() => setWarmupCtx(null)}
        />
      )}
    </div>
  );
}
