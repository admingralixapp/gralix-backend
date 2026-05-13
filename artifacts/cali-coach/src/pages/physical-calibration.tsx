import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdatePhysicalStats } from "@/lib/social";
import { ALL_SKILL_NODES } from "@/lib/skill-tree";
import {
  Ruler, Weight, Target, Zap, Activity, ChevronRight, ChevronLeft,
  Check, Dumbbell, Footprints,
} from "lucide-react";

// ── Skill groups for the dropdown ──────────────────────────────────────────

const BRANCH_COLORS: Record<string, string> = {
  PUSH: "#22c55e",
  PULL: "#06b6d4",
  CORE: "#f59e0b",
  LEGS: "#8b5cf6",
};

const FEATURED_IDS = new Set([
  "push-oh-4",   // Handstand
  "pull-mu-2",   // Bar Muscle-Up
  "pull-rings-3",// Ring Muscle-Up
  "core-hh-5",   // Dragon Flag
  "legs-ps-4",   // Pistol Squat
  "pull-oapu-1", // One-Arm Pull-Up
  "push-pp-3",   // Planche Push-Up
  "push-5",      // Pseudo Planche Push-Up
]);

const SKILL_GROUPS: { branch: string; label: string; nodes: typeof ALL_SKILL_NODES }[] = [
  { branch: "PUSH", label: "Push / Overhead", nodes: ALL_SKILL_NODES.filter(n => n.branch === "PUSH") },
  { branch: "PULL", label: "Pull / Back",     nodes: ALL_SKILL_NODES.filter(n => n.branch === "PULL") },
  { branch: "CORE", label: "Core",            nodes: ALL_SKILL_NODES.filter(n => n.branch === "CORE") },
  { branch: "LEGS", label: "Legs",            nodes: ALL_SKILL_NODES.filter(n => n.branch === "LEGS") },
];

// ── Goal options ────────────────────────────────────────────────────────────

interface GoalOption {
  id:          "mobility" | "strength" | "skill";
  icon:        React.ReactNode;
  title:       string;
  description: string;
}

const GOALS: GoalOption[] = [
  {
    id:          "mobility",
    icon:        <Activity className="w-7 h-7" />,
    title:       "Increased Mobility",
    description: "Focus on flexibility, joint health and movement quality.",
  },
  {
    id:          "strength",
    icon:        <Dumbbell className="w-7 h-7" />,
    title:       "Bodyweight Control",
    description: "Master calisthenics fundamentals and general strength.",
  },
  {
    id:          "skill",
    icon:        <Target className="w-7 h-7" />,
    title:       "Unlock a Skill",
    description: "Train toward a specific advanced movement goal.",
  },
];

// ── Step progress indicator ─────────────────────────────────────────────────

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-full text-xs font-black transition-all duration-300"
            style={{
              width:      28,
              height:     28,
              background: i < step
                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                : i === step
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.05)",
              border: `2px solid ${i <= step ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
              color:  i < step ? "#fff" : i === step ? "#22c55e" : "#64748b",
              boxShadow: i === step ? "0 0 12px rgba(34,197,94,0.35)" : "none",
            }}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className="h-px flex-1 min-w-[24px] transition-all duration-500"
              style={{ background: i < step ? "#22c55e" : "rgba(255,255,255,0.08)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Number input with unit toggle ───────────────────────────────────────────

function UnitInput({
  label,
  icon,
  valueCm,
  onChangeCm,
  metricUnit,
  imperialUnit,
  placeholder,
  convert,
}: {
  label:       string;
  icon:        React.ReactNode;
  valueCm:     number;
  onChangeCm:  (v: number) => void;
  metricUnit:  string;
  imperialUnit: string;
  placeholder: string;
  convert:     { toImperial: (v: number) => string; fromImperial: (s: string) => number };
}) {
  const [useMetric, setUseMetric]   = useState(true);
  const [rawInput,  setRawInput]    = useState("");
  const [focused,   setFocused]     = useState(false);

  const displayValue = focused
    ? rawInput
    : valueCm > 0
      ? useMetric
        ? String(Math.round(valueCm))
        : convert.toImperial(valueCm)
      : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setRawInput(v);
    const num = useMetric ? parseFloat(v) : convert.fromImperial(v);
    if (!isNaN(num) && num > 0) onChangeCm(num);
  };

  const toggleUnit = () => {
    setUseMetric((u) => !u);
    setRawInput("");
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={1}
            value={displayValue}
            placeholder={placeholder}
            onChange={handleChange}
            onFocus={() => { setFocused(true); setRawInput(""); }}
            onBlur={() => setFocused(false)}
            className="w-full px-4 py-3.5 rounded-xl text-lg font-bold font-mono text-foreground bg-white/5 border border-white/10 focus:outline-none transition-all"
            style={{ borderColor: valueCm > 0 ? "rgba(34,197,94,0.5)" : undefined, boxShadow: valueCm > 0 ? "0 0 0 1px rgba(34,197,94,0.2)" : undefined }}
          />
        </div>
        <button
          type="button"
          onClick={toggleUnit}
          className="px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border:     "1px solid rgba(255,255,255,0.1)",
            color:      "#94a3b8",
            minWidth:   64,
          }}
        >
          {useMetric ? metricUnit : imperialUnit}
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function PhysicalCalibration() {
  const [, setLocation]    = useLocation();
  const updatePhysical     = useUpdatePhysicalStats();

  const [step,           setStep]          = useState(0);
  const [heightCm,       setHeightCm]      = useState(0);
  const [weightKg,       setWeightKg]      = useState(0);
  const [goal,           setGoal]          = useState<"mobility" | "strength" | "skill" | null>(null);
  const [targetSkillId,  setTargetSkillId] = useState<string>("");
  const [saving,         setSaving]        = useState(false);

  const STEPS = ["Your Body", "Your Goal", "All Set"];

  // ── Step 0: Body Metrics ─────────────────────────────────────────────────

  const step0Valid = heightCm > 0 && weightKg > 0;

  // ── Step 1: Goal Selection ────────────────────────────────────────────────

  const step1Valid = goal !== null && (goal !== "skill" || targetSkillId !== "");

  // ── Step 2: Confirm & Save ───────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      await updatePhysical.mutateAsync({
        heightCm,
        weightKg,
        primaryGoal:   goal ?? "strength",
        targetSkillId: goal === "skill" ? targetSkillId : null,
      });
      // Profile query is invalidated by the mutation's onSuccess — the
      // OnboardingTour watches hasCompletedOnboarding from the DB directly.
      setLocation("/");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived display values for confirmation ───────────────────────────────

  const targetSkillNode = ALL_SKILL_NODES.find(n => n.id === targetSkillId);
  const heightFt        = Math.floor(heightCm / 30.48);
  const heightIn        = Math.round((heightCm / 2.54) % 12);
  const goalLabel       = GOALS.find(g => g.id === goal)?.title ?? "";

  // ── Shared card/input styles ─────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    background:    "rgba(15, 23, 42, 0.85)",
    border:        "1px solid rgba(255,255,255,0.07)",
    borderRadius:  20,
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.06) 0%, transparent 60%), #030712" }}
    >
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-lg mx-auto space-y-6 relative z-10">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
          >
            <Footprints className="w-5 h-5 text-primary" style={{ filter: "drop-shadow(0 0 6px #22c55e)" }} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.15em] text-primary/70">CaliCoach</div>
            <div className="text-lg font-black">Physical Calibration</div>
          </div>
        </div>

        {/* ── Step bar ── */}
        <div className="flex items-center gap-4">
          <StepBar step={step} total={STEPS.length} />
          <span className="text-xs text-muted-foreground font-medium ml-auto shrink-0">
            {STEPS[step]}
          </span>
        </div>

        {/* ── Panel ── */}
        <div className="p-6 md:p-8 space-y-6" style={panelStyle}>

          {/* Step 0 — Body Metrics */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-2xl font-black">Your Body Metrics</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Used to personalise your Relative Strength Index and coaching feedback.
                </p>
              </div>

              <div className="space-y-5">
                <UnitInput
                  label="Height"
                  icon={<Ruler className="w-3.5 h-3.5" />}
                  valueCm={heightCm}
                  onChangeCm={setHeightCm}
                  metricUnit="cm"
                  imperialUnit="ft"
                  placeholder="e.g. 178"
                  convert={{
                    toImperial:   (cm) => `${Math.floor(cm / 30.48)}'${Math.round((cm / 2.54) % 12)}"`,
                    fromImperial: (s)  => {
                      const m = s.match(/(\d+)'?\s*(\d+)?/);
                      if (!m) return NaN;
                      const ft = parseInt(m[1] ?? "0");
                      const inch = parseInt(m[2] ?? "0");
                      return (ft * 12 + inch) * 2.54;
                    },
                  }}
                />

                <UnitInput
                  label="Weight"
                  icon={<Weight className="w-3.5 h-3.5" />}
                  valueCm={weightKg}
                  onChangeCm={setWeightKg}
                  metricUnit="kg"
                  imperialUnit="lbs"
                  placeholder="e.g. 75"
                  convert={{
                    toImperial:   (kg)  => String(Math.round(kg * 2.205)),
                    fromImperial: (lbs) => parseFloat(lbs) / 2.205,
                  }}
                />
              </div>

              <div
                className="rounded-xl p-4 text-xs text-muted-foreground flex gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>Your metrics are stored privately and never shared. They power your Relative Strength Index so you can compare progress week-over-week.</p>
              </div>
            </>
          )}

          {/* Step 1 — Goal Selection */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-2xl font-black">What's Your Primary Goal?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This personalises your Skill Readiness Score and training focus.
                </p>
              </div>

              <div className="space-y-3">
                {GOALS.map((g) => {
                  const selected = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      className="w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all duration-200"
                      style={{
                        background:  selected ? "rgba(34,197,94,0.1)"  : "rgba(255,255,255,0.03)",
                        border:      `2px solid ${selected ? "#22c55e" : "rgba(255,255,255,0.07)"}`,
                        boxShadow:   selected ? "0 0 20px rgba(34,197,94,0.15)" : "none",
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: selected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                          border:     `1px solid ${selected ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                          color:      selected ? "#22c55e" : "#64748b",
                        }}
                      >
                        {g.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm ${selected ? "text-primary" : "text-foreground"}`}>{g.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: selected ? "#22c55e" : "rgba(255,255,255,0.15)", background: selected ? "#22c55e" : "transparent" }}
                      >
                        {selected && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Skill dropdown — only when "skill" is selected */}
              {goal === "skill" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Target Skill
                  </label>
                  <select
                    value={targetSkillId}
                    onChange={(e) => setTargetSkillId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-foreground focus:outline-none transition-all"
                    style={{
                      background:   "rgba(255,255,255,0.05)",
                      border:       `2px solid ${targetSkillId ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                      boxShadow:    targetSkillId ? "0 0 0 1px rgba(34,197,94,0.2)" : "none",
                      color:        "#f8fafc",
                      appearance:   "none",
                    }}
                  >
                    <option value="" disabled style={{ background: "#0f172a" }}>
                      Choose your target skill…
                    </option>
                    {SKILL_GROUPS.map(({ branch, label, nodes }) => (
                      <optgroup key={branch} label={`── ${label} ──`} style={{ background: "#0f172a", color: BRANCH_COLORS[branch] }}>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id} style={{ background: "#0f172a" }}>
                            {FEATURED_IDS.has(node.id) ? "★ " : ""}
                            {node.title}{node.level >= 4 ? " ⚡" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground/60">
                    ★ = iconic goals  ·  ⚡ = elite level
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Confirmation */}
          {step === 2 && (
            <>
              <div className="text-center space-y-2 pt-2">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    border:     "1px solid rgba(34,197,94,0.4)",
                    boxShadow:  "0 0 30px rgba(34,197,94,0.2)",
                  }}
                >
                  <Footprints className="w-8 h-8 text-primary" style={{ filter: "drop-shadow(0 0 8px #22c55e)" }} />
                </div>
                <h2 className="text-2xl font-black">Your Profile is Ready</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  CaliCoach is now personalised to your body and goals.
                </p>
              </div>

              {/* Summary cards */}
              <div className="space-y-2">
                {[
                  {
                    icon: <Ruler className="w-4 h-4" />,
                    label: "Height",
                    value: `${Math.round(heightCm)} cm  ·  ${heightFt}'${heightIn}"`,
                  },
                  {
                    icon: <Weight className="w-4 h-4" />,
                    label: "Weight",
                    value: `${Math.round(weightKg)} kg  ·  ${Math.round(weightKg * 2.205)} lbs`,
                  },
                  {
                    icon: GOALS.find(g => g.id === goal)?.icon,
                    label: "Primary Goal",
                    value: goalLabel,
                  },
                  ...(goal === "skill" && targetSkillNode ? [{
                    icon: <Target className="w-4 h-4" />,
                    label: "Target Skill",
                    value: targetSkillNode.title,
                  }] : []),
                ].map(({ icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-primary shrink-0">{icon}</div>
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                    <span className="text-sm font-semibold truncate">{value}</span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-4 text-xs text-muted-foreground flex gap-3"
                style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
              >
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>Your Skill Readiness Score will automatically track <strong className="text-foreground">{goal === "skill" && targetSkillNode ? targetSkillNode.title : goalLabel}</strong> in the Progress tab. You can change this at any time in Settings.</p>
              </div>
            </>
          )}

          {/* ── Navigation buttons ── */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 ? !step0Valid : !step1Valid}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: step === 0 ? (step0Valid ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(34,197,94,0.15)") : (step1Valid ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(34,197,94,0.15)"),
                  color:      "#fff",
                  boxShadow:  (step === 0 ? step0Valid : step1Valid) ? "0 4px 20px rgba(34,197,94,0.4)" : "none",
                }}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color:      "#fff",
                  boxShadow:  "0 4px 24px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {saving ? "Saving…" : "Start Your Journey →"}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
