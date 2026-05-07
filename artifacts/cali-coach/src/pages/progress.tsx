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
import { Target, TrendingUp, ShieldCheck, GitBranch, Lock, Crown, Zap, Check } from "lucide-react";
import { format } from "date-fns";
import {
  ALL_SKILL_NODES,
  type SessionSummary as SkillSessionSummary,
} from "@/lib/skill-tree";
import { useMyProfile, useActivatePro } from "@/lib/social";

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

const BRANCH_LABELS: Record<string, string> = {
  PUSH: "Push",
  PULL: "Pull",
  CORE: "Core",
  LEGS: "Legs",
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
      subject: BRANCH_LABELS[key],
      reps: value,
    }));
  }, [sessions]);

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
          name: "AI Verified",
          value: verified,
          color: "hsl(var(--primary))",
        },
        {
          name: "Self-Reported",
          value: unverified,
          color: "hsl(var(--muted-foreground))",
        },
      ].filter((d) => d.value > 0),
      totalReps: total,
      verifiedReps: verified,
    };
  }, [sessions]);

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
          <p className="text-[10px] text-white/30">
            {t("progress.trialNote", { price: prices.monthly })}
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
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-1">
          Deep athletic insights and performance analytics.
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
            <div className="text-xs text-muted-foreground">Avg Form Score</div>
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
            <div className="text-xs text-muted-foreground">Best Form Score</div>
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
            <div className="text-xs text-muted-foreground">Verified Reps</div>
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
              Form Improvement
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Form Score vs. Volume (dual-axis) ───────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>Form Score vs. Volume</CardTitle>
          <CardDescription>
            See whether your form holds up as you increase intensity — last 90
            days
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
                      value: "Form",
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
                      value: "Reps",
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
                    name="Reps"
                    fill="hsl(var(--primary))"
                    opacity={0.2}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="form"
                    type="monotone"
                    dataKey="avgFormScore"
                    name="Form Score"
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
                Not enough data yet. Complete a few sessions to see your trend.
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
            <CardTitle>Volume by Category</CardTitle>
            <CardDescription>
              Identify weak links — total reps per movement branch
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
                      name="Volume"
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
                  No session data yet.
                </div>
              )}
            </div>
            {/* Branch legend */}
            {hasAnyVolume && (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3">
                {radarData.map((d) => {
                  const key = Object.keys(BRANCH_LABELS).find(
                    (k) => BRANCH_LABELS[k] === d.subject,
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
            <CardTitle>Verification Ratio</CardTitle>
            <CardDescription>
              AI-Verified vs. Self-Reported reps — only verified reps count
              toward rankings
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
                      verified
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
                  No sessions yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Reps by Exercise ─────────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>Reps by Exercise</CardTitle>
          <CardDescription>Total volume per movement</CardDescription>
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
                  />
                  <Bar
                    dataKey="totalReps"
                    name="Total Reps"
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
                Not enough data to display chart.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Skill Unlock Timeline ─────────────────────────────────────────── */}
      <Card className={glassCardClass}>
        <CardHeader>
          <CardTitle>Skill Unlock Timeline</CardTitle>
          <CardDescription>
            Every level-up in your skill tree — from first rep to elite mastery
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
                            {skill.title}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              color,
                              backgroundColor: `${color}18`,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            {skill.branch} · L{skill.level}
                          </span>
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                            {skill.levelName}
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
                No skills mastered yet. Complete sessions to unlock your first
                skill!
              </p>
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
