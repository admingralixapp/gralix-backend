import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocalizedPrices } from "@/lib/locale";
import { useLocation } from "wouter";
import {
  useGetProgressTimeline,
  useGetProgressSummary,
  useGetProgressByExercise,
  useListSessions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
} from "recharts";
import { Target, TrendingUp, ShieldCheck, GitBranch, Crown, Zap, Check, Calendar, Flame } from "lucide-react";
import { format, getISOWeek, getISOWeekYear } from "date-fns";
import {
  ALL_SKILL_NODES,
  type SessionSummary as SkillSessionSummary,
} from "@/lib/skill-tree";
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

const BRANCH_LABEL_KEYS: Record<string, string> = {
  PUSH: "skillTree.push",
  PULL: "skillTree.pull",
  CORE: "skillTree.core",
  LEGS: "skillTree.legs",
};

// ─── Mastery date computation ─────────────────────────────────────────────────

interface MasteryEvent {
  id: string;
  title: string;
  branch: string;
  level: number;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function Progress() {
  const { t } = useTranslation();
  const prices = useLocalizedPrices();
  const [, setLocation] = useLocation();
  const { data: profile } = useMyProfile();
  const activatePro = useActivatePro();
  const { data: timeline } = useGetProgressTimeline({ days: 90 });
  const { data: summary } = useGetProgressSummary();
  const { data: exerciseProgress } = useGetProgressByExercise();
  const { data: sessions } = useListSessions();
  const isPro = profile?.isPro ?? false;

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

  // ── Volume by Category (radar) ────────────────────────────────────────────
  const radarData = useMemo(() => {
    const branchReps: Record<string, number> = {
      PUSH: 0,
      PULL: 0,
      CORE: 0,
      LEGS: 0,
    };
    sessions?.forEach((s) => {
      const branch =
        EXERCISE_BRANCH[(s.exerciseName ?? "").toLowerCase()];
      if (branch && branchReps[branch] !== undefined) {
        branchReps[branch] += s.totalReps ?? 0;
      }
    });
    return Object.entries(branchReps).map(([key, value]) => ({
      subject: t(BRANCH_LABEL_KEYS[key] ?? key),
      reps: value,
    }));
  }, [sessions, t]);

  const hasAnyVolume = radarData.some((d) => d.reps > 0);

  // ── Verification donut ────────────────────────────────────────────────────
  const { donutData, totalReps, verifiedReps } = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    sessions?.forEach((s) => {
      const r = s.totalReps ?? 0;
      if (s.isVerified) verified += r;
      else unverified += r;
    });
    const total = verified + unverified;
    return {
      donutData: [
        {
          name: t("progress.aiVerified"),
          value: verified,
          color: "hsl(var(--primary))",
        },
        {
          name: t("progress.selfReported"),
          value: unverified,
          color: "hsl(var(--muted-foreground))",
        },
      ].filter((d) => d.value > 0),
      totalReps: total,
      verifiedReps: verified,
    };
  }, [sessions, t]);

  const verificationPct =
    totalReps > 0 ? Math.round((verifiedReps / totalReps) * 100) : 0;

  // ── Skill unlock timeline ─────────────────────────────────────────────────
  const skillTimeline = useMemo(() => {
    if (!sessions?.length) return [];
    const mapped: SkillSessionSummary[] = sessions.map((s) => ({
      exerciseName: s.exerciseName ?? "",
      totalReps: s.totalReps ?? null,
      avgFormScore: s.avgFormScore ?? null,
      completedAt: s.completedAt ?? null,
    }));
    return computeMasteryDates(mapped);
  }, [sessions]);

  // ── Consistency calendar — last 84 days (12 × 7 grid) ────────────────────
  const { calendarGrid, calendarMonthLabels } = useMemo(() => {
    // Build date → session count map
    const dayMap: Record<string, number> = {};
    sessions?.forEach((s) => {
      const key = format(new Date(s.startedAt), "yyyy-MM-dd");
      dayMap[key] = (dayMap[key] ?? 0) + 1;
    });

    // Generate 84 days newest→oldest, then reverse into week columns
    const today = new Date();
    const days: { key: string; count: number; date: Date; isToday: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = format(d, "yyyy-MM-dd");
      days.push({ key, count: dayMap[key] ?? 0, date: d, isToday: i === 0 });
    }

    // Split into 12 columns (weeks), each 7 days
    const grid: typeof days[] = [];
    for (let w = 0; w < 12; w++) {
      grid.push(days.slice(w * 7, w * 7 + 7));
    }

    // Month labels per column (show if first day of month appears in that week)
    const monthLabels: (string | null)[] = grid.map((week) => {
      const firstDay1 = week.find((d) => d.date.getDate() <= 7);
      if (firstDay1) return format(firstDay1.date, "MMM");
      return null;
    });

    return { calendarGrid: grid, calendarMonthLabels: monthLabels };
  }, [sessions]);

  const totalWorkoutDays = useMemo(() => {
    const keys = new Set(
      sessions?.map((s) => format(new Date(s.startedAt), "yyyy-MM-dd")) ?? [],
    );
    return keys.size;
  }, [sessions]);

  // ── Weekly volume data ─────────────────────────────────────────────────────
  const weeklyVolumeData = useMemo(() => {
    if (!sessions?.length) return [];
    const weekMap: Record<string, { week: string; reps: number; sets: number }> = {};
    sessions.forEach((s) => {
      const d = new Date(s.startedAt);
      const isoWeek = getISOWeek(d);
      const isoYear = getISOWeekYear(d);
      const key = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
      // Label: start of that week
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const label = format(monday, "MMM d");
      if (!weekMap[key]) weekMap[key] = { week: label, reps: 0, sets: 0 };
      weekMap[key].reps += s.totalReps ?? 0;
      weekMap[key].sets += s.sets ?? 1;
    });
    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .slice(-12);
  }, [sessions]);

  // ── Skill predictions ─────────────────────────────────────────────────────
  const skillPredictions = useMemo(() => {
    if (!sessions?.length) return [];
    const masteredIds = new Set(skillTimeline.map((s) => s.id));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const predictions: {
      node: typeof ALL_SKILL_NODES[number];
      completed: number;
      total: number;
      pct: number;
      weeksRemaining: number;
      estimatedDate: Date;
    }[] = [];

    for (const node of ALL_SKILL_NODES) {
      if (masteredIds.has(node.id)) continue;
      // Skip if primary prerequisite not yet mastered
      if (node.prerequisiteId && !masteredIds.has(node.prerequisiteId)) continue;

      const req = node.masteryRequirement;

      // Count qualifying sessions for this node
      const qualifying = (sessions ?? []).filter(
        (s) =>
          node.exercises.some(
            (e) => e.toLowerCase() === (s.exerciseName ?? "").toLowerCase(),
          ) &&
          (s.totalReps ?? 0) >= req.minReps &&
          (s.avgFormScore ?? 0) >= req.minFormScore &&
          s.completedAt !== null,
      );

      const completed = qualifying.length;
      const remaining = Math.max(0, req.minQualifyingSessions - completed);
      if (remaining === 0) continue; // technically mastered but not in timeline yet

      // Exercise-specific recent rate (last 30 days)
      const recentEx = (sessions ?? []).filter(
        (s) =>
          node.exercises.some(
            (e) => e.toLowerCase() === (s.exerciseName ?? "").toLowerCase(),
          ) && new Date(s.startedAt) >= thirtyDaysAgo,
      );
      const exRate = recentEx.length / 4.3; // sessions/week for this exercise

      // Fallback: overall rate / node's exercise count
      const overallRate =
        (sessions ?? []).filter((s) => new Date(s.startedAt) >= thirtyDaysAgo).length / 4.3;
      const effectiveRate = exRate > 0 ? exRate : overallRate / Math.max(1, node.exercises.length);

      if (effectiveRate <= 0.05) continue; // barely training — skip

      const weeksRemaining = Math.max(1, Math.ceil(remaining / effectiveRate));
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + weeksRemaining * 7);

      predictions.push({
        node,
        completed,
        total: req.minQualifyingSessions,
        pct: Math.min(99, Math.round((completed / req.minQualifyingSessions) * 100)),
        weeksRemaining,
        estimatedDate,
      });
    }

    return predictions.sort((a, b) => a.weeksRemaining - b.weeksRemaining).slice(0, 5);
  }, [sessions, skillTimeline]);

  // ── Paywall overlay for free users ───────────────────────────────────────
  const paywallOverlay = !isPro && (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6 py-12">
      {/* Frosted backdrop */}
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border p-7 flex flex-col items-center text-center space-y-5 shadow-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(168,85,247,0.16) 0%, rgba(109,40,217,0.08) 50%, rgba(15,10,20,0.95) 100%)",
          borderColor: "rgba(168,85,247,0.35)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          boxShadow: "0 0 80px rgba(168,85,247,0.2), inset 0 1px 0 rgba(168,85,247,0.15)",
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
        />

        {/* Lock icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
          style={{
            background: "rgba(168,85,247,0.18)",
            border: "1px solid rgba(168,85,247,0.4)",
            boxShadow: "0 0 24px rgba(168,85,247,0.35)",
          }}
        >
          <Crown className="w-8 h-8" style={{ color: "#c084fc" }} />
        </div>

        {/* Heading */}
        <div>
          <div
            className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5"
            style={{ color: "#c084fc" }}
          >
            {t("progress.premiumAnalytics")}
          </div>
          <h2 className="text-2xl font-black" style={{ color: "#e9d5ff" }}>
            {t("progress.unlockTitle")}
          </h2>
        </div>

        {/* Pitch */}
        <p className="text-sm text-white/60 leading-relaxed max-w-xs">
          {t("progress.unlockDesc")}
        </p>

        {/* Feature bullets */}
        <div className="w-full space-y-2.5 text-left">
          {[
            { icon: "📐", label: t("progress.featureForm") },
            { icon: "📈", label: t("progress.featureVolume") },
            { icon: "🗓️", label: t("progress.featureMastery") },
            { icon: "🎯", label: t("progress.featureTimeline") },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                style={{ background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.22)" }}
              >
                {icon}
              </div>
              <span className="text-sm text-white/75">{label}</span>
              <Check className="w-3.5 h-3.5 shrink-0 ml-auto" style={{ color: "#c084fc" }} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="w-full space-y-2.5 pt-1">
          <button
            onClick={() => setLocation("/shop")}
            className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            {t("progress.startTrial")}
          </button>
          <p className="text-[10px] text-white/30 text-center">
            {t("progress.trialNote")}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Content — blurred when not Pro */}
      <div
        className={!isPro ? "pointer-events-none select-none" : undefined}
        style={!isPro ? { filter: "blur(4px) brightness(0.45)", userSelect: "none" } : undefined}
        aria-hidden={!isPro}
      >
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("progress.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("progress.subtitle")}
        </p>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={glassCardClass}>
          <CardContent className="p-6">
            <Target
              className="w-5 h-5 text-primary mb-2"
              style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)))" }}
            />
            <div className="text-2xl font-bold font-mono">
              {summary?.avgFormScore ? Math.round(summary.avgFormScore) : "--"}
            </div>
            <div className="text-xs text-muted-foreground">{t("progress.avgFormScore")}</div>
          </CardContent>
        </Card>

        <Card className={glassCardClass}>
          <CardContent className="p-6">
            <TrendingUp
              className="w-5 h-5 text-emerald-400 mb-2"
              style={{ filter: "drop-shadow(0 0 6px #34d399)" }}
            />
            <div className="text-2xl font-bold font-mono">
              {summary?.bestFormScore
                ? Math.round(summary.bestFormScore)
                : "--"}
            </div>
            <div className="text-xs text-muted-foreground">{t("progress.bestFormScore")}</div>
          </CardContent>
        </Card>

        <Card className={glassCardClass}>
          <CardContent className="p-6">
            <ShieldCheck
              className="w-5 h-5 text-cyan-400 mb-2"
              style={{ filter: "drop-shadow(0 0 6px #22d3ee)" }}
            />
            <div className="text-2xl font-bold font-mono">
              {verificationPct}%
            </div>
            <div className="text-xs text-muted-foreground">{t("progress.verifiedReps")}</div>
          </CardContent>
        </Card>

        <Card className={glassCardClass}>
          <CardContent className="p-6">
            <TrendingUp
              className="w-5 h-5 text-violet-400 mb-2"
              style={{ filter: "drop-shadow(0 0 6px #a78bfa)" }}
            />
            <div className="text-2xl font-bold font-mono">
              {summary?.improvementPercent != null
                ? `${summary.improvementPercent > 0 ? "+" : ""}${Math.round(summary.improvementPercent)}%`
                : "--"}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("progress.formImprovement")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Form Score vs. Volume (dual-axis) ───────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>{t("progress.formVsVolume")}</CardTitle>
          <CardDescription>
            {t("progress.formVsVolumeDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            {formattedTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={formattedTimeline}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="dateFormatted"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="form"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    label={{
                      value: t("progress.formLabel"),
                      angle: -90,
                      position: "insideLeft",
                      fill: "#666",
                      fontSize: 10,
                      dx: -4,
                    }}
                  />
                  <YAxis
                    yAxisId="reps"
                    orientation="right"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: t("progress.repsLabel"),
                      angle: 90,
                      position: "insideRight",
                      fill: "#666",
                      fontSize: 10,
                      dx: 12,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                  />
                  <Bar
                    yAxisId="reps"
                    dataKey="totalReps"
                    name={t("progress.repsLabel")}
                    fill="hsl(var(--primary))"
                    opacity={0.2}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="form"
                    type="monotone"
                    dataKey="avgFormScore"
                    name={t("progress.formScoreLabel")}
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "hsl(var(--background))",
                      strokeWidth: 2,
                    }}
                    style={{
                      filter: "drop-shadow(0 0 5px hsl(var(--primary)))",
                    }}
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

      {/* ── Radar + Donut row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Volume by Category Radar */}
        <Card className={glassCardClass}>
          <CardHeader>
            <CardTitle>{t("progress.volumeByCategory")}</CardTitle>
            <CardDescription>
              {t("progress.volumeByCategoryDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {hasAnyVolume ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    margin={{ top: 16, right: 40, bottom: 16, left: 40 }}
                  >
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="subject"
                      stroke="#888888"
                      fontSize={13}
                      tick={{ fill: "#aaaaaa" }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, "auto"]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name={t("progress.volumeByCategory")}
                      dataKey="reps"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      strokeWidth={2}
                      style={{
                        filter: "drop-shadow(0 0 8px hsl(var(--primary)))",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [`${v} reps`, "Volume"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t("progress.noSessionData")}
                </div>
              )}
            </div>
            {/* Branch legend */}
            {hasAnyVolume && (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3">
                {radarData.map((d) => {
                  const key = Object.keys(BRANCH_LABEL_KEYS).find(
                    (k) => t(BRANCH_LABEL_KEYS[k] ?? k) === d.subject,
                  )!;
                  return (
                    <div
                      key={d.subject}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: BRANCH_COLORS[key] }}
                      />
                      {d.subject}
                      <span className="font-mono font-medium text-foreground/70">
                        {d.reps}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Donut */}
        <Card className={glassCardClass}>
          <CardHeader>
            <CardTitle>{t("progress.verificationRatio")}</CardTitle>
            <CardDescription>
              {t("progress.verificationRatioDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full relative">
              {donutData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="72%"
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                      >
                        {donutData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [`${v} reps`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label — positioned inside the donut */}
                  <div className="absolute inset-x-0 top-0 h-[80%] flex flex-col items-center justify-center pointer-events-none">
                    <span
                      className="text-3xl font-bold font-mono text-primary"
                      style={{
                        textShadow: "0 0 12px hsl(var(--primary))",
                      }}
                    >
                      {verificationPct}%
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {t("progress.verified")}
                    </span>
                  </div>
                  {/* Legend */}
                  <div className="flex justify-center gap-6 mt-1">
                    {donutData.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.name}
                        <span className="font-mono font-medium text-foreground/70">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t("progress.noSessionsYet")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Reps by Exercise ─────────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>{t("progress.repsByExercise")}</CardTitle>
          <CardDescription>{t("progress.repsByExerciseDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full mt-4">
            {exerciseProgress && exerciseProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exerciseProgress}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="exerciseName"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(name: string) => t(`exercises.${sanitizeExName(name)}`, { defaultValue: name })}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(label: string) => t(`exercises.${sanitizeExName(label)}`, { defaultValue: label })}
                  />
                  <Bar
                    dataKey="totalReps"
                    name={t("progress.totalRepsLabel")}
                    fill="hsl(var(--primary))"
                    opacity={0.85}
                    radius={[4, 4, 0, 0]}
                    style={{
                      filter: "drop-shadow(0 0 4px hsl(var(--primary)))",
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {t("progress.notEnoughDataChart")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Skill Unlock Timeline ─────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>{t("progress.skillUnlockTimeline")}</CardTitle>
          <CardDescription>
            {t("progress.skillUnlockTimelineDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skillTimeline.length > 0 ? (
            <div className="relative pl-7">
              {/* Vertical spine */}
              <div
                className="absolute left-[9px] top-1 w-px"
                style={{
                  height: "calc(100% - 8px)",
                  background:
                    "linear-gradient(to bottom, hsl(var(--primary)/0.6), hsl(var(--border)/0.3))",
                }}
              />
              <div className="space-y-6">
                {[...skillTimeline].reverse().map((skill) => {
                  const color = BRANCH_COLORS[skill.branch] ?? "hsl(var(--primary))";
                  return (
                    <div
                      key={skill.id}
                      className="relative flex items-start gap-3"
                    >
                      {/* Glowing dot */}
                      <div
                        className="absolute -left-7 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{
                          borderColor: color,
                          backgroundColor: `${color}18`,
                          boxShadow: `0 0 8px 1px ${color}55`,
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold leading-tight">
                            {t(`skillTree.nodeTitle.${skill.id}`, { defaultValue: skill.title })}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              color,
                              backgroundColor: `${color}18`,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            {t(BRANCH_LABEL_KEYS[skill.branch] ?? skill.branch)} · L{skill.level}
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
              <p className="text-sm">
                {t("progress.noSkillsYet")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* ── Consistency Calendar ─────────────────────────────────────────── */}
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
          {/* Day-of-week labels */}
          <div className="flex gap-1 mb-1 ml-0" style={{ paddingLeft: 0 }}>
            {/* spacer for week columns */}
            {calendarGrid.map((_, wi) => (
              <div key={wi} className="flex flex-col gap-1" style={{ flex: 1 }}>
                {wi === 0 && (
                  <div className="flex flex-col gap-0.5">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, di) => (
                      <div key={di} style={{ height: 11, fontSize: 8, color: "rgba(100,116,139,0.5)", fontWeight: 700, textAlign: "center" }}>
                        {d}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Calendar grid — 12 columns (weeks) × 7 rows (days) */}
          <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
            {/* Day-of-week labels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 2, flexShrink: 0 }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} style={{ height: 13, width: 12, fontSize: 8, color: "rgba(100,116,139,0.5)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Month labels */}
              <div style={{ display: "flex", gap: 3 }}>
                {calendarGrid.map((week, wi) => (
                  <div key={wi} style={{ flex: 1, fontSize: 8, color: "rgba(100,116,139,0.6)", fontWeight: 700, textAlign: "center", minWidth: 0, overflow: "hidden" }}>
                    {calendarMonthLabels[wi] ?? ""}
                  </div>
                ))}
              </div>

              {/* Day cells — 7 rows */}
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                <div key={dayIdx} style={{ display: "flex", gap: 3 }}>
                  {calendarGrid.map((week, wi) => {
                    const cell = week[dayIdx];
                    if (!cell) return <div key={wi} style={{ flex: 1, aspectRatio: "1" }} />;
                    const count = cell.count;
                    const bg =
                      count === 0
                        ? "rgba(255,255,255,0.04)"
                        : count === 1
                          ? "rgba(34,197,94,0.25)"
                          : count === 2
                            ? "rgba(34,197,94,0.55)"
                            : "rgba(34,197,94,0.9)";
                    const glow = count > 0 ? `0 0 ${count * 4}px rgba(34,197,94,${count * 0.2})` : "none";
                    return (
                      <div
                        key={wi}
                        title={`${format(cell.date, "MMM d")}: ${count} session${count !== 1 ? "s" : ""}`}
                        style={{
                          flex: 1,
                          aspectRatio: "1",
                          borderRadius: 3,
                          background: bg,
                          boxShadow: glow,
                          border: cell.isToday ? "1px solid rgba(34,197,94,0.8)" : "1px solid rgba(255,255,255,0.04)",
                          transition: "background 0.2s",
                          minWidth: 0,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 9, color: "rgba(100,116,139,0.6)", fontWeight: 600 }}>Less</span>
            {[0, 1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  width: 11, height: 11, borderRadius: 2,
                  background: n === 0 ? "rgba(255,255,255,0.04)" : `rgba(34,197,94,${n * 0.3})`,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              />
            ))}
            <span style={{ fontSize: 9, color: "rgba(100,116,139,0.6)", fontWeight: 600 }}>More</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly Volume ─────────────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" style={{ filter: "drop-shadow(0 0 5px #fb923c)" }} />
            Weekly Volume
          </CardTitle>
          <CardDescription>Total reps and sets logged per week (last 12 weeks)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full mt-2">
            {weeklyVolumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyVolumeData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="reps" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="sets" orientation="right" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar yAxisId="reps" dataKey="reps" name="Total Reps" fill="#22c55e" opacity={0.85} radius={[4, 4, 0, 0]}
                    style={{ filter: "drop-shadow(0 0 4px rgba(34,197,94,0.4))" }} />
                  <Bar yAxisId="sets" dataKey="sets" name="Sets" fill="#60a5fa" opacity={0.6} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Complete a few sessions to see your weekly volume here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Skill Predictions ────────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" style={{ filter: "drop-shadow(0 0 5px #facc15)" }} />
            Skill Predictions
          </CardTitle>
          <CardDescription>
            Based on your training frequency, here's when you're on track to master your next skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skillPredictions.length > 0 ? (
            <div className="space-y-4">
              {skillPredictions.map(({ node, completed, total, pct, weeksRemaining, estimatedDate }) => {
                const color = BRANCH_COLORS[node.branch] ?? "#22c55e";
                const isClose = weeksRemaining <= 2;
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
                        {isClose && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 shrink-0 animate-pulse">
                            Almost!
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-muted-foreground">
                          {weeksRemaining === 1 ? "~1 week" : `~${weeksRemaining} weeks`}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60">
                          {format(estimatedDate, "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-2 rounded-full overflow-hidden bg-white/[0.05]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}60, ${color})`,
                          boxShadow: `0 0 8px ${color}60`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-muted-foreground/60">
                      <span>{completed} / {total} qualifying sessions</span>
                      <span>{pct}% there</span>
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
              <p className="text-sm">Complete more AI-verified sessions to unlock predictions.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
    </div>{/* end blur wrapper */}
    {paywallOverlay}
  </div>
  );
}
