import { useMemo, useState, useEffect } from "react";
import { EmojiIcon } from "@/components/emoji-icon";
import { useTranslation } from "react-i18next";
import { useLocalizedPrices } from "@/lib/locale";
import { useLocation } from "wouter";
import {
  useGetProgressTimeline,
  useGetProgressSummary,
  useListSessions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Target, TrendingUp, GitBranch, Crown, Zap, Check, Calendar,
  Timer, Crosshair, Scale, Activity, Weight, AlertTriangle, HeartPulse,
} from "lucide-react";
import { format, getISOWeek, getISOWeekYear } from "date-fns";
import {
  ALL_SKILL_NODES,
  type SessionSummary as SkillSessionSummary,
} from "@/lib/skill-tree";
import { getExerciseConfig } from "@/lib/exercise-registry";
import { useMyProfile, useActivatePro } from "@/lib/social";

// ─── Exercise name → i18n key ─────────────────────────────────────────────────

function sanitizeExName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ─── Exercise → Branch lookup ────────────────────────────────────────────────

const EXERCISE_BRANCH: Record<string, string> = {};
ALL_SKILL_NODES.forEach((n) =>
  n.exercises.forEach((e) => {
    EXERCISE_BRANCH[e.toLowerCase()] = n.branch;
  }),
);

const BRANCH_COLORS: Record<string, string> = {
  PUSH: "#22c55e",
  PULL: "#06b6d4",
  CORE: "#f59e0b",
  LEGS: "#8b5cf6",
};

// ─── Body weight localStorage ─────────────────────────────────────────────────

const BODY_WEIGHT_KEY = "calicoach_body_weight_v1";

// ─── Mastery date computation ─────────────────────────────────────────────────

interface MasteryEvent {
  id:        string;
  title:     string;
  branch:    string;
  level:     number;
  levelName: string;
  masteredAt: Date;
}

function computeMasteryDates(sessions: SkillSessionSummary[]): MasteryEvent[] {
  const completed = sessions
    .filter((s) => s.completedAt !== null)
    .sort(
      (a, b) =>
        new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
    );

  const result: MasteryEvent[] = [];

  for (const node of ALL_SKILL_NODES) {
    const req = node.masteryRequirement;
    const qualifying = completed.filter(
      (s) =>
        node.exercises.some(
          (ex) => ex.toLowerCase() === s.exerciseName?.toLowerCase(),
        ) &&
        (s.totalReps ?? 0) >= req.minReps &&
        (s.avgFormScore ?? 0) >= req.minFormScore,
    );
    if (qualifying.length >= req.minQualifyingSessions) {
      const masteredAt = new Date(
        qualifying[req.minQualifyingSessions - 1].completedAt!,
      );
      result.push({
        id: node.id,
        title: node.title,
        branch: node.branch,
        level: node.level,
        levelName: node.levelName,
        masteredAt,
      });
    }
  }

  return result.sort((a, b) => a.masteredAt.getTime() - b.masteredAt.getTime());
}

// ─── Glassmorphism card style helpers ─────────────────────────────────────────

const glassCardClass =
  "backdrop-blur-sm bg-card/70 border border-border/60 shadow-lg";

const BRANCH_LABEL: Record<string, string> = {
  PUSH: "Push", PULL: "Pull", CORE: "Core", LEGS: "Legs",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Progress() {
  const { t } = useTranslation();
  const prices = useLocalizedPrices();
  const [, setLocation] = useLocation();
  const { data: profile } = useMyProfile();
  const activatePro = useActivatePro();
  const { data: timeline } = useGetProgressTimeline({ days: 90 });
  const { data: summary }  = useGetProgressSummary();
  const { data: sessions } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );
  const isPro = profile?.isPro ?? false;

  // ── Body Weight state (profile DB value takes priority over localStorage) ──
  const [bodyWeight, setBodyWeight] = useState<number>(() => {
    const stored = localStorage.getItem(BODY_WEIGHT_KEY);
    return stored ? parseFloat(stored) : 0;
  });
  const [bwInput, setBwInput] = useState<string>(
    () => localStorage.getItem(BODY_WEIGHT_KEY) ?? "",
  );

  // Sync body weight from profile once it loads (DB value overrides localStorage)
  useEffect(() => {
    if (profile?.weightKg && profile.weightKg > 0) {
      setBodyWeight(profile.weightKg);
      setBwInput(String(Math.round(profile.weightKg * 10) / 10));
    }
  }, [profile?.weightKg]);

  // ── Form + Volume dual-axis ───────────────────────────────────────────────
  const formattedTimeline = useMemo(
    () =>
      timeline?.map((p) => ({
        ...p,
        dateFormatted: format(new Date(p.date), "MMM d"),
        avgFormScore: p.avgFormScore ? Math.round(p.avgFormScore) : null,
      })) ?? [],
    [timeline],
  );

  // ── Mechanical Weak Link — avg form score per branch ─────────────────────
  const formByCategory = useMemo(() => {
    const cats: Record<string, { total: number; count: number }> = {
      PUSH: { total: 0, count: 0 },
      PULL: { total: 0, count: 0 },
      CORE: { total: 0, count: 0 },
      LEGS: { total: 0, count: 0 },
    };
    sessions?.forEach((s) => {
      if (!s.avgFormScore) return;
      const branch = EXERCISE_BRANCH[(s.exerciseName ?? "").toLowerCase()];
      if (branch && cats[branch]) {
        cats[branch].total += s.avgFormScore;
        cats[branch].count++;
      }
    });
    return ["PUSH", "PULL", "CORE", "LEGS"].map((cat) => ({
      subject:  BRANCH_LABEL[cat] ?? cat,
      score:    cats[cat].count > 0 ? Math.round(cats[cat].total / cats[cat].count) : 0,
      fullMark: 100,
    }));
  }, [sessions]);

  const hasWeakLinkData = formByCategory.some((d) => d.score > 0);

  // ── Time Under Tension (TUT) — weekly estimated effort seconds ────────────
  const tutChartData = useMemo(() => {
    if (!sessions?.length) return [];
    const weekMap: Record<string, {
      week:    string;
      tut:     number;
      count:   number;
      static:  number;
      dynamic: number;
    }> = {};

    sessions.forEach((s) => {
      if (!s.completedAt || !s.exerciseName) return;
      const config    = getExerciseConfig(s.exerciseName);
      const isStatic  = config?.isStatic ?? false;
      // Static: totalReps already stores seconds held
      // Dynamic: rough 2.5 s per rep (eccentric + concentric)
      const tutSec    = isStatic
        ? (s.totalReps ?? 0)
        : Math.round((s.totalReps ?? 0) * 2.5);

      const d          = new Date(s.startedAt);
      const isoWeek    = getISOWeek(d);
      const isoYear    = getISOWeekYear(d);
      const key        = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
      const dayOfWeek  = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday     = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const label      = format(monday, "MMM d");

      if (!weekMap[key]) weekMap[key] = { week: label, tut: 0, count: 0, static: 0, dynamic: 0 };
      weekMap[key].tut   += tutSec;
      weekMap[key].count += 1;
      if (isStatic) weekMap[key].static  += tutSec;
      else          weekMap[key].dynamic += tutSec;
    });

    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        week:    v.week,
        Total:   v.tut,
        Static:  v.static,
        Dynamic: v.dynamic,
      }))
      .slice(-12);
  }, [sessions]);

  // ── Relative Strength Index (RSI) — weighted volume / bodyweight ──────────
  const rsiChartData = useMemo(() => {
    if (!sessions?.length || !bodyWeight) return [];
    const bw = bodyWeight;
    const weekMap: Record<string, { week: string; rsi: number; count: number }> = {};

    sessions.forEach((s) => {
      if (!s.avgFormScore || !s.totalReps) return;
      const d          = new Date(s.startedAt);
      const isoWeek    = getISOWeek(d);
      const isoYear    = getISOWeekYear(d);
      const key        = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
      const dayOfWeek  = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday     = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const label      = format(monday, "MMM d");

      if (!weekMap[key]) weekMap[key] = { week: label, rsi: 0, count: 0 };
      // RSI = quality-weighted reps relative to body weight
      weekMap[key].rsi   += (s.totalReps * (s.avgFormScore / 100)) / bw * 100;
      weekMap[key].count += 1;
    });

    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        week: v.week,
        RSI:  Math.round((v.rsi / v.count) * 10) / 10,
      }))
      .slice(-12);
  }, [sessions, bodyWeight]);

  const currentRSI = rsiChartData.length > 0
    ? rsiChartData[rsiChartData.length - 1].RSI
    : null;

  // ── Skill unlock timeline ─────────────────────────────────────────────────
  const skillTimeline = useMemo(() => {
    if (!sessions?.length) return [];
    const mapped: SkillSessionSummary[] = sessions.map((s) => ({
      exerciseName: s.exerciseName ?? "",
      totalReps:    s.totalReps   ?? null,
      avgFormScore: s.avgFormScore ?? null,
      completedAt:  s.completedAt ?? null,
    }));
    return computeMasteryDates(mapped);
  }, [sessions]);

  // ── Skill Readiness — enhanced predictions ────────────────────────────────
  const skillReadiness = useMemo(() => {
    if (!sessions?.length) return [];
    const masteredIds   = new Set(skillTimeline.map((s) => s.id));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const results: {
      node:           typeof ALL_SKILL_NODES[number];
      sessionsPct:    number;
      formPct:        number;
      readiness:      number;
      completed:      number;
      total:          number;
      weeksRemaining: number;
      estimatedDate:  Date;
      avgForm:        number;
    }[] = [];

    for (const node of ALL_SKILL_NODES) {
      if (masteredIds.has(node.id)) continue;
      if (node.prerequisiteId && !masteredIds.has(node.prerequisiteId)) continue;

      const req = node.masteryRequirement;
      const qualifying = sessions.filter(
        (s) =>
          node.exercises.some((e) => e.toLowerCase() === (s.exerciseName ?? "").toLowerCase()) &&
          (s.totalReps   ?? 0) >= req.minReps &&
          (s.avgFormScore ?? 0) >= req.minFormScore &&
          s.completedAt !== null,
      );

      const completed     = qualifying.length;
      const remaining     = Math.max(0, req.minQualifyingSessions - completed);
      if (remaining === 0) continue;

      const recentEx   = sessions.filter(
        (s) =>
          node.exercises.some((e) => e.toLowerCase() === (s.exerciseName ?? "").toLowerCase()) &&
          new Date(s.startedAt) >= thirtyDaysAgo,
      );
      const exRate      = recentEx.length / 4.3;
      const overallRate = sessions.filter((s) => new Date(s.startedAt) >= thirtyDaysAgo).length / 4.3;
      const effectiveRate = exRate > 0 ? exRate : overallRate / Math.max(1, node.exercises.length);
      if (effectiveRate <= 0.05) continue;

      const weeksRemaining = Math.max(1, Math.ceil(remaining / effectiveRate));
      const estimatedDate  = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + weeksRemaining * 7);

      const relevantSessions = sessions.filter((s) =>
        node.exercises.some((e) => e.toLowerCase() === (s.exerciseName ?? "").toLowerCase()),
      );
      const avgForm = relevantSessions.length > 0
        ? Math.round(relevantSessions.reduce((sum, s) => sum + (s.avgFormScore ?? 0), 0) / relevantSessions.length)
        : 0;

      const sessionsPct = Math.min(99, Math.round((completed / req.minQualifyingSessions) * 100));
      const formPct     = Math.min(100, req.minFormScore > 0
        ? Math.round((avgForm / req.minFormScore) * 100)
        : 100);
      const readiness   = Math.round(sessionsPct * 0.6 + formPct * 0.4);

      results.push({
        node, sessionsPct, formPct, readiness,
        completed, total: req.minQualifyingSessions,
        weeksRemaining, estimatedDate, avgForm,
      });
    }

    // Pin the user's target skill to the front if it's in the list
    const targetId = profile?.targetSkillId;
    return results
      .sort((a, b) => {
        if (a.node.id === targetId) return -1;
        if (b.node.id === targetId) return 1;
        return b.readiness - a.readiness;
      })
      .slice(0, 5);
  }, [sessions, skillTimeline, profile?.targetSkillId]);

  // ── Consistency calendar — last 84 days (12 × 7 grid) ────────────────────
  const { calendarGrid, calendarMonthLabels } = useMemo(() => {
    const dayMap: Record<string, number> = {};
    sessions?.forEach((s) => {
      const key = format(new Date(s.startedAt), "yyyy-MM-dd");
      dayMap[key] = (dayMap[key] ?? 0) + 1;
    });

    const today = new Date();
    const days: { key: string; count: number; date: Date; isToday: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = format(d, "yyyy-MM-dd");
      days.push({ key, count: dayMap[key] ?? 0, date: d, isToday: i === 0 });
    }

    const grid: typeof days[] = [];
    for (let w = 0; w < 12; w++) grid.push(days.slice(w * 7, w * 7 + 7));

    const monthLabels: (string | null)[] = grid.map((week) => {
      const firstDay1 = week.find((d) => d.date.getDate() <= 7);
      return firstDay1 ? format(firstDay1.date, "MMM") : null;
    });

    return { calendarGrid: grid, calendarMonthLabels: monthLabels };
  }, [sessions]);

  const totalWorkoutDays = useMemo(() => {
    const keys = new Set(
      sessions?.map((s) => format(new Date(s.startedAt), "yyyy-MM-dd")) ?? [],
    );
    return keys.size;
  }, [sessions]);


  // ── Total TUT stat ────────────────────────────────────────────────────────
  const totalTutHours = useMemo(() => {
    if (!sessions?.length) return 0;
    const totalSec = sessions.reduce((sum, s) => {
      const config   = getExerciseConfig(s.exerciseName ?? "");
      const isStatic = config?.isStatic ?? false;
      return sum + (isStatic ? (s.totalReps ?? 0) : Math.round((s.totalReps ?? 0) * 2.5));
    }, 0);
    return Math.round(totalSec / 3600 * 10) / 10;
  }, [sessions]);

  // ── Paywall overlay for free users ───────────────────────────────────────
  const paywallOverlay = !isPro && (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6 py-12">
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-black/10 p-7 flex flex-col items-center text-center space-y-5 shadow-lg bg-white">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/25">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5 text-primary">
            {t("progress.premiumAnalytics")}
          </div>
          <h2 className="text-2xl font-black text-foreground">
            {t("progress.unlockTitle")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          {t("progress.unlockDesc")}
        </p>
        <div className="w-full space-y-2.5 text-left">
          {[
            { icon: "⏱", label: "Time Under Tension tracker per skill" },
            { icon: "🎯", label: "Mechanical Weak Link form heatmap" },
            { icon: "💪", label: "Skill Readiness Score & unlock ETA" },
            { icon: "📊", label: "Relative Strength Index trend" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                <EmojiIcon emoji={icon} className="w-4 h-4 object-contain" />
              </div>
              <span className="text-sm text-foreground">{label}</span>
              <Check className="w-3.5 h-3.5 shrink-0 ml-auto text-primary" />
            </div>
          ))}
        </div>
        <div className="w-full space-y-2.5 pt-1">
          <button
            onClick={() => setLocation("/shop")}
            className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all"
            style={{ background: "#177548", color: "#fff" }}
          >
            {t("progress.startTrial")}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            {t("progress.trialNote")}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Shared tooltip style ──────────────────────────────────────────────────
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(var(--card))",
      borderColor:     "hsl(var(--border))",
      borderRadius:    "8px",
    },
    itemStyle: { color: "hsl(var(--foreground))" },
  };

  return (
    <div className="relative">
      <div
        className={!isPro ? "pointer-events-none select-none" : undefined}
        style={!isPro ? { filter: "blur(4px) brightness(0.45)", userSelect: "none" } : undefined}
        aria-hidden={!isPro}
      >
        <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">

          {/* ── Page header ───────────────────────────────────────────── */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("progress.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("progress.subtitle")}</p>
          </div>

          {/* ── Stat Cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <Target className="w-5 h-5 text-primary mb-2" style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)))" }} />
                <div className="text-2xl font-bold font-mono">
                  {summary?.avgFormScore ? Math.round(summary.avgFormScore) : "--"}
                </div>
                <div className="text-xs text-muted-foreground">{t("progress.avgFormScore")}</div>
              </CardContent>
            </Card>

            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" style={{ filter: "drop-shadow(0 0 6px #34d399)" }} />
                <div className="text-2xl font-bold font-mono">
                  {summary?.bestFormScore ? Math.round(summary.bestFormScore) : "--"}
                </div>
                <div className="text-xs text-muted-foreground">{t("progress.bestFormScore")}</div>
              </CardContent>
            </Card>

            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <Timer className="w-5 h-5 text-cyan-400 mb-2" style={{ filter: "drop-shadow(0 0 6px #22d3ee)" }} />
                <div className="text-2xl font-bold font-mono">
                  {totalTutHours > 0 ? `${totalTutHours}h` : "--"}
                </div>
                <div className="text-xs text-muted-foreground">Total TUT</div>
              </CardContent>
            </Card>

            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <TrendingUp className="w-5 h-5 text-primary mb-2" />
                <div className="text-2xl font-bold font-mono">
                  {summary?.improvementPercent != null
                    ? `${summary.improvementPercent > 0 ? "+" : ""}${Math.round(summary.improvementPercent)}%`
                    : "--"}
                </div>
                <div className="text-xs text-muted-foreground">{t("progress.formImprovement")}</div>
              </CardContent>
            </Card>
          </div>

          {/* ── Form Score vs. Volume (dual-axis) ─────────────────────── */}
          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle>{t("progress.formVsVolume")}</CardTitle>
              <CardDescription>{t("progress.formVsVolumeDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                {formattedTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={formattedTimeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="dateFormatted" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="form" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]}
                        label={{ value: t("progress.formLabel"), angle: -90, position: "insideLeft", fill: "#666", fontSize: 10, dx: -4 }}
                      />
                      <YAxis yAxisId="reps" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}
                        label={{ value: t("progress.repsLabel"), angle: 90, position: "insideRight", fill: "#666", fontSize: 10, dx: 12 }}
                      />
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
                      <Bar yAxisId="reps" dataKey="totalReps" name={t("progress.repsLabel")} fill="hsl(var(--primary))" opacity={0.2} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="form" type="monotone" dataKey="avgFormScore" name={t("progress.formScoreLabel")}
                        stroke="hsl(var(--primary))" strokeWidth={3}
                        dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }}
                        style={{ filter: "drop-shadow(0 0 5px hsl(var(--primary)))" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    {t("progress.notEnoughData")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── TUT Tracker + Mechanical Weak Link ────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* TUT Tracker */}
            <Card className={glassCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" style={{ filter: "drop-shadow(0 0 5px #22c55e)" }} />
                  Time Under Tension
                </CardTitle>
                <CardDescription>
                  Weekly effort seconds — static holds + ~2.5 s per dynamic rep
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full mt-2">
                  {tutChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={tutChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false}
                          tickFormatter={(v: number) => `${v}s`}
                          label={{ value: "Seconds", angle: -90, position: "insideLeft", fill: "#666", fontSize: 9, dx: -4 }}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(v: number, name: string) => [`${v}s`, name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="Dynamic" stackId="tut" fill="#22c55e" opacity={0.85} radius={[0, 0, 0, 0]}
                          style={{ filter: "drop-shadow(0 0 3px rgba(34,197,94,0.4))" }}
                        />
                        <Bar dataKey="Static" stackId="tut" fill="#06b6d4" opacity={0.75} radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Complete sessions to see your TUT trend.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Mechanical Weak Link */}
            <Card className={glassCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-red-400" style={{ filter: "drop-shadow(0 0 5px #ef4444)" }} />
                  Mechanical Weak Link
                </CardTitle>
                <CardDescription>
                  Average Ghost Coach form score per movement category — lower = your bottleneck
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  {hasWeakLinkData ? (
                    <>
                      <ResponsiveContainer width="100%" height="85%">
                        <RadarChart data={formByCategory} margin={{ top: 10, right: 36, bottom: 10, left: 36 }}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="subject" stroke="#888" fontSize={13} tick={{ fill: "#aaa" }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Form Score"
                            dataKey="score"
                            stroke="#22c55e"
                            fill="#22c55e"
                            fillOpacity={0.25}
                            strokeWidth={2}
                            style={{ filter: "drop-shadow(0 0 8px #22c55e)" }}
                          />
                          <Tooltip
                            {...tooltipStyle}
                            formatter={(v: number) => [`${v}%`, "Avg Form"]}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      {/* Category scores */}
                      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-1">
                        {formByCategory.map((d) => {
                          const key   = Object.keys(BRANCH_LABEL).find((k) => BRANCH_LABEL[k] === d.subject)!;
                          const color = BRANCH_COLORS[key] ?? "#22c55e";
                          const isWeak = d.score === Math.min(...formByCategory.filter(x => x.score > 0).map(x => x.score));
                          return (
                            <div key={d.subject} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              {d.subject}
                              <span
                                className="font-mono font-bold"
                                style={{ color: isWeak && d.score > 0 ? "#ef4444" : color }}
                              >
                                {d.score > 0 ? `${d.score}%` : "—"}
                              </span>
                              {isWeak && d.score > 0 && (
                                <span className="text-[9px] uppercase font-black text-red-400 bg-red-400/10 px-1 rounded">
                                  Weak Link
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      {t("progress.noSessionData")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Skill Readiness Score ──────────────────────────────────── */}
          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" style={{ filter: "drop-shadow(0 0 5px #facc15)" }} />
                Skill Readiness Score
              </CardTitle>
              <CardDescription>
                Composite readiness (60% session progress + 40% form quality) for your next unlockable skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              {skillReadiness.length > 0 ? (
                <div className="space-y-5">
                  {skillReadiness.map(({ node, sessionsPct, formPct, readiness, completed, total, weeksRemaining, estimatedDate, avgForm }) => {
                    const color   = BRANCH_COLORS[node.branch] ?? "#22c55e";
                    const isReady = readiness >= 80;
                    return (
                      <div key={node.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                              style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                              {node.branch}
                            </span>
                            <span className="text-sm font-semibold truncate">{node.title}</span>
                            {isReady && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 shrink-0 animate-pulse">
                                Ready!
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className="text-lg font-black font-mono"
                              style={{ color: isReady ? "#22c55e" : color, textShadow: `0 0 10px ${color}60` }}
                            >
                              {readiness}%
                            </div>
                            <div className="text-[10px] text-muted-foreground/60">
                              ~{weeksRemaining === 1 ? "1 wk" : `${weeksRemaining} wks`} · {format(estimatedDate, "MMM d")}
                            </div>
                          </div>
                        </div>

                        {/* Composite readiness bar */}
                        <div className="relative h-2.5 rounded-full overflow-hidden bg-secondary">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                            style={{
                              width:      `${readiness}%`,
                              background: `linear-gradient(90deg, ${color}80, ${color})`,
                            }}
                          />
                        </div>

                        {/* Sub-scores */}
                        <div className="flex gap-4 text-[10px] text-muted-foreground/60">
                          <span>
                            Sessions <span className="font-mono font-bold text-foreground/50">{completed}/{total}</span>
                            {" "}({sessionsPct}%)
                          </span>
                          <span>
                            Form <span className="font-mono font-bold text-foreground/50">{avgForm}%</span>
                            {" "}({formPct}% of target)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : skillTimeline.length > 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">All available skills mastered!</p>
                  <p className="text-xs mt-1 opacity-60">Keep training to maintain your edge.</p>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Complete more AI-verified sessions to see your readiness scores.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Skill Unlock Timeline ──────────────────────────────────── */}
          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle>{t("progress.skillUnlockTimeline")}</CardTitle>
              <CardDescription>{t("progress.skillUnlockTimelineDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {skillTimeline.length > 0 ? (
                <div className="relative pl-7">
                  <div
                    className="absolute left-[9px] top-1 w-px"
                    style={{
                      height:     "calc(100% - 8px)",
                      background: "linear-gradient(to bottom, hsl(var(--primary)/0.6), hsl(var(--border)/0.3))",
                    }}
                  />
                  <div className="space-y-6">
                    {[...skillTimeline].reverse().map((skill) => {
                      const color = BRANCH_COLORS[skill.branch] ?? "hsl(var(--primary))";
                      return (
                        <div key={skill.id} className="relative flex items-start gap-3">
                          <div
                            className="absolute -left-7 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0"
                            style={{
                              borderColor:     color,
                              backgroundColor: `${color}18`,
                              boxShadow:       `0 0 8px 1px ${color}55`,
                            }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold leading-tight">
                                {t(`skillTree.nodeTitle.${skill.id}`, { defaultValue: skill.title })}
                              </span>
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                              >
                                {BRANCH_LABEL[skill.branch] ?? skill.branch} · L{skill.level}
                              </span>
                              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                {t(`skillTree.levelName.${skill.levelName.toLowerCase()}`, { defaultValue: skill.levelName })}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(skill.masteredAt, "MMMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t("progress.noSkillsYet")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Consistency Calendar ───────────────────────────────────── */}
          <Card className={glassCardClass}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" style={{ filter: "drop-shadow(0 0 5px #22c55e)" }} />
                    Workout Consistency
                  </CardTitle>
                  <CardDescription>Last 12 weeks — each cell is one day</CardDescription>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono text-primary" style={{ textShadow: "0 0 10px #22c55e" }}>
                    {totalWorkoutDays}
                  </div>
                  <div className="text-xs text-muted-foreground">active days</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 2, flexShrink: 0 }}>
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i} style={{ height: 13, width: 12, fontSize: 8, color: "rgba(100,116,139,0.5)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {calendarGrid.map((week, wi) => (
                      <div key={wi} style={{ flex: 1, fontSize: 8, color: "rgba(100,116,139,0.6)", fontWeight: 700, textAlign: "center", minWidth: 0, overflow: "hidden" }}>
                        {calendarMonthLabels[wi] ?? ""}
                      </div>
                    ))}
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                    <div key={dayIdx} style={{ display: "flex", gap: 3 }}>
                      {calendarGrid.map((week, wi) => {
                        const cell  = week[dayIdx];
                        if (!cell) return <div key={wi} style={{ flex: 1, aspectRatio: "1" }} />;
                        const count = cell.count;
                        const bg    =
                          count === 0 ? "rgba(0,0,0,0.06)"
                          : count === 1 ? "rgba(23,117,72,0.25)"
                          : count === 2 ? "rgba(23,117,72,0.55)"
                          : "rgba(23,117,72,0.9)";
                        const glow = "none";
                        return (
                          <div
                            key={wi}
                            title={`${format(cell.date, "MMM d")}: ${count} session${count !== 1 ? "s" : ""}`}
                            style={{
                              flex: 1, aspectRatio: "1", borderRadius: 3,
                              background: bg, boxShadow: glow,
                              border: cell.isToday ? "1px solid rgba(23,117,72,0.7)" : "1px solid rgba(0,0,0,0.08)",
                              transition: "background 0.2s", minWidth: 0,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 9, color: "rgba(100,116,139,0.6)", fontWeight: 600 }}>Less</span>
                {[0, 1, 2, 3].map((n) => (
                  <div key={n} style={{ width: 11, height: 11, borderRadius: 2, background: n === 0 ? "rgba(0,0,0,0.06)" : `rgba(23,117,72,${n * 0.3})`, border: "1px solid rgba(0,0,0,0.08)" }} />
                ))}
                <span style={{ fontSize: 9, color: "rgba(100,116,139,0.6)", fontWeight: 600 }}>More</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Relative Strength Index ────────────────────────────────── */}
          <Card className={glassCardClass}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" />
                    Relative Strength Index
                  </CardTitle>
                  <CardDescription>
                    Quality-weighted reps ÷ body weight × 100 — tracks strength relative to size
                  </CardDescription>
                </div>
                {currentRSI !== null && (
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold font-mono text-primary">
                      {currentRSI}
                    </div>
                    <div className="text-xs text-muted-foreground">current RSI</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Body weight input */}
              <div className="flex items-center gap-3">
                <Weight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Body weight (kg)</span>
                <input
                  type="number"
                  min={30}
                  max={200}
                  value={bwInput}
                  placeholder="e.g. 75"
                  onChange={(e) => setBwInput(e.target.value)}
                  onBlur={() => {
                    const v = parseFloat(bwInput);
                    if (v > 0) {
                      setBodyWeight(v);
                      localStorage.setItem(BODY_WEIGHT_KEY, String(v));
                    }
                  }}
                  className="w-24 px-3 py-1.5 rounded-lg text-sm font-mono bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-primary/60"
                />
                <span className="text-xs text-muted-foreground">kg — stored locally, never uploaded</span>
              </div>

              {/* RSI trend chart */}
              <div className="h-[200px] w-full">
                {rsiChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rsiChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v: number) => [v.toFixed(1), "RSI"]}
                      />
                      <Bar dataKey="RSI" fill="#8b5cf6" opacity={0.2} radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="RSI"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2, stroke: "#8b5cf6" }}
                        style={{ filter: "drop-shadow(0 0 6px #8b5cf6)" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {bodyWeight ? "Complete sessions to build your RSI trend." : "Enter your body weight above to activate RSI tracking."}
                  </div>
                )}
              </div>

              {bodyWeight > 0 && (
                <p className="text-[10px] text-muted-foreground/50">
                  RSI = (verified reps × avg form %) ÷ {bodyWeight} kg × 100. Higher is stronger relative to your body weight.
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>{/* end blur wrapper */}
      {paywallOverlay}
    </div>
  );
}
