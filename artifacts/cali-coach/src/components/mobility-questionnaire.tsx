import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GOAL_LABELS,
  GOAL_AUTO_AREAS,
  TIME_OPTIONS,
  type MobilityGoal,
  type StiffnessArea,
} from "@/lib/mobility-service";

// ─── i18n key helpers ─────────────────────────────────────────────────────────

export const toKey = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");

export const goalToKey = (g: string) =>
  g.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());

// ─── Glassmorphism dropdown shared style ──────────────────────────────────────

export const GLASS_DROPDOWN: CSSProperties = {
  background:           "rgba(12,18,36,0.94)",
  backdropFilter:       "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:            "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
  border:               "1px solid rgba(255,255,255,0.08)",
};

// ─── Goal search database ─────────────────────────────────────────────────────

export interface GoalSearchItem { label: string; value: MobilityGoal }

export const GOAL_SEARCH_DB: GoalSearchItem[] = [
  { label: "Pull-Up Mastery",                 value: "pull"         },
  { label: "Front Lever",                     value: "front-lever"  },
  { label: "Muscle-Up",                       value: "muscle-up"    },
  { label: "Planche / Push",                  value: "push"         },
  { label: "Handstand",                       value: "handstand"    },
  { label: "Dragon Flag / Human Flag",        value: "core"         },
  { label: "Pistol Squat",                   value: "legs"         },
  { label: "General Mobility",               value: "general"      },
  { label: "All-Round Mobility",             value: "general"      },
  { label: "First Push-Up",                  value: "push"         },
  { label: "Push-Up Strength",               value: "push"         },
  { label: "Wall Push-Up",                   value: "push"         },
  { label: "Incline Push-Up",                value: "push"         },
  { label: "Knee Push-Up",                   value: "push"         },
  { label: "Diamond Push-Up",                value: "push"         },
  { label: "Archer Push-Up",                 value: "push"         },
  { label: "Pseudo Planche Push-Up",         value: "push"         },
  { label: "Dip",                            value: "push"         },
  { label: "Ring Dip",                       value: "push"         },
  { label: "Weighted Dip",                   value: "push"         },
  { label: "Ring Support Hold",              value: "push"         },
  { label: "Ring Muscle-Up",                 value: "muscle-up"    },
  { label: "Pike Push-Up",                   value: "handstand"    },
  { label: "Elevated Pike Push-Up",          value: "handstand"    },
  { label: "Wall Handstand Push-Up",         value: "handstand"    },
  { label: "Handstand Push-Up",              value: "handstand"    },
  { label: "Planche",                        value: "push"         },
  { label: "Planche Lean",                   value: "push"         },
  { label: "Tuck Planche",                   value: "push"         },
  { label: "Straddle Planche",               value: "push"         },
  { label: "Full Planche",                   value: "push"         },
  { label: "First Pull-Up",                  value: "pull"         },
  { label: "Pull-Up Consistency",            value: "pull"         },
  { label: "Negative Pull-Ups",              value: "pull"         },
  { label: "Pull-Up",                        value: "pull"         },
  { label: "Australian Rows",                value: "pull"         },
  { label: "Scapular Shrugs",                value: "pull"         },
  { label: "Chest-to-Bar Pull-Up",           value: "pull"         },
  { label: "Archer Pull-Up",                 value: "pull"         },
  { label: "Typewriter Pull-Up",             value: "pull"         },
  { label: "Explosive Pull-Up",              value: "pull"         },
  { label: "Ring Pull-Up",                   value: "pull"         },
  { label: "Weighted Pull-Up",               value: "pull"         },
  { label: "Weighted Pull-Up Volume",        value: "pull"         },
  { label: "One-Arm Active Hang",            value: "pull"         },
  { label: "One-Arm Pull-Up",                value: "pull"         },
  { label: "Kipping Muscle-Up",              value: "muscle-up"    },
  { label: "Strict Muscle-Up",               value: "muscle-up"    },
  { label: "Weighted Muscle-Up",             value: "muscle-up"    },
  { label: "Tuck Front Lever",               value: "front-lever"  },
  { label: "Straddle Front Lever",           value: "front-lever"  },
  { label: "Full Front Lever",               value: "front-lever"  },
  { label: "Plank Foundation",               value: "core"         },
  { label: "Side Plank",                     value: "core"         },
  { label: "Plank",                          value: "core"         },
  { label: "Dead Bug",                       value: "core"         },
  { label: "Back Extensions",                value: "core"         },
  { label: "Hollow Body Hold",               value: "core"         },
  { label: "Dragon Flag Negative",           value: "core"         },
  { label: "Dragon Flag",                    value: "core"         },
  { label: "Burpee",                         value: "core"         },
  { label: "Active Hang",                    value: "core"         },
  { label: "Hanging Knee Tucks",             value: "core"         },
  { label: "Hanging Leg Raises",             value: "core"         },
  { label: "Toes to Bar",                    value: "core"         },
  { label: "Hanging Windshield Wipers",      value: "core"         },
  { label: "Tucked Human Flag",              value: "core"         },
  { label: "One-Leg Human Flag",             value: "core"         },
  { label: "Human Flag",                     value: "core"         },
  { label: "Weighted Plank",                 value: "core"         },
  { label: "Ring Knee Raises",               value: "core"         },
  { label: "Weighted Leg Raises",            value: "core"         },
  { label: "Weighted Dragon Flag",           value: "core"         },
  { label: "Ab Roller Rollout",              value: "core"         },
  { label: "Banded Pallof Press",            value: "core"         },
  { label: "Ring Rollouts",                  value: "core"         },
  { label: "Squat Foundation",               value: "legs"         },
  { label: "Squat Strength",                 value: "legs"         },
  { label: "Squat",                          value: "legs"         },
  { label: "Air Squat",                      value: "legs"         },
  { label: "Assisted Squat",                 value: "legs"         },
  { label: "Shrimp Squat",                   value: "legs"         },
  { label: "Bulgarian Split Squat",          value: "legs"         },
  { label: "Nordic Curls",                   value: "legs"         },
  { label: "Lunge",                          value: "legs"         },
  { label: "Step-Ups",                       value: "legs"         },
  { label: "Assisted Pistol Squat",          value: "legs"         },
  { label: "Close-Stance Squat",             value: "legs"         },
  { label: "Weighted Goblet Squat",          value: "legs"         },
  { label: "Weighted Bulgarian Split Squat", value: "legs"         },
  { label: "Weighted Pistol Squat",          value: "legs"         },
  { label: "Weighted Shrimp Squat",          value: "legs"         },
  { label: "Banded Lateral Walks",           value: "legs"         },
  { label: "Box Jumps",                      value: "legs"         },
  { label: "Slider Hamstring Curls",         value: "legs"         },
  { label: "Pike Stretch",                   value: "legs"         },
  { label: "L-Sit Compressions",             value: "core"         },
  { label: "Tuck L-Sit",                     value: "core"         },
  { label: "Full L-Sit",                     value: "core"         },
];

const EXTENDED_BODY_PARTS = [
  "Wrists", "Shoulders", "Lower Back", "Ankles", "Hips",
  "Neck", "Upper Back", "Thoracic Spine", "Forearms", "Calves",
  "Hamstrings", "Hip Flexors", "Chest", "Lats", "Triceps",
  "Knees", "Glutes", "Quadriceps", "Rotator Cuff", "Core",
];

const QUICK_TAGS = ["Wrists", "Shoulders", "Hips", "Ankles", "Lower Back"] as const;

// ─── Questionnaire Modal ──────────────────────────────────────────────────────

export interface QuestionnaireProps {
  initialGoal: string;
  initialAreas: string[];
  initialTime: number;
  onSave: (goal: string, areas: string[], time: number) => void;
  onClose: () => void;
}

export function Questionnaire({
  initialGoal,
  initialAreas,
  initialTime,
  onSave,
  onClose,
}: QuestionnaireProps) {
  const { t } = useTranslation();
  const initGoalItem = GOAL_SEARCH_DB.find(g => g.value === (initialGoal || "general"));
  const [goal,      setGoal]      = useState(initialGoal || "general");
  const [goalQuery, setGoalQuery] = useState(initGoalItem?.label ?? "");
  const [goalOpen,  setGoalOpen]  = useState(false);

  const [areas,     setAreas]     = useState<string[]>(initialAreas);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaOpen,  setAreaOpen]  = useState(false);

  const [time, setTime] = useState<number>(initialTime || 10);

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
    const autoAreas = GOAL_AUTO_AREAS[item.value] ?? [];
    if (autoAreas.length > 0) setAreas(autoAreas);
  }

  function toggleArea(area: string) {
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  }

  function addArea(area: string) {
    if (!areas.includes(area)) setAreas(prev => [...prev, area]);
    setAreaQuery("");
    setAreaOpen(false);
  }

  const selectedGoalLabel = t(
    `mobility.goals.${goalToKey(goal)}`,
    { defaultValue: GOAL_LABELS[goal as MobilityGoal] ?? goal },
  );

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
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-extrabold">{t("mobility.updateMyGoals")}</h2>
            <p className="text-sm text-muted-foreground font-light opacity-80">
              {t("mobility.personaliseSubtitle")}
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
              {t("mobility.questionGoal")}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
                {selectedGoalLabel}
              </span>
              <span className="text-xs text-muted-foreground">{t("mobility.tapToChange")}</span>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={goalQuery}
                  onChange={e => { setGoalQuery(e.target.value); setGoalOpen(true); }}
                  onFocus={() => setGoalOpen(true)}
                  onBlur={() => setTimeout(() => setGoalOpen(false), 160)}
                  placeholder={t("mobility.searchMovement")}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

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
                        {t(`mobility.goals.${goalToKey(item.value)}`, { defaultValue: GOAL_LABELS[item.value] })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Q2 — Stiffness areas */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("mobility.questionMuscles")}{" "}
              <span className="font-normal text-muted-foreground">{t("mobility.pickAll")}</span>
            </p>

            {areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {areas.map(a => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium"
                  >
                    {t(`mobility.areas.${toKey(a)}`, { defaultValue: a })}
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

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={areaQuery}
                  onChange={e => { setAreaQuery(e.target.value); setAreaOpen(true); }}
                  onFocus={() => setAreaOpen(true)}
                  onBlur={() => setTimeout(() => setAreaOpen(false), 160)}
                  placeholder={t("mobility.searchBodyPart")}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
              </div>

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
                      {t(`mobility.areas.${toKey(part)}`, { defaultValue: part })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                {t("mobility.suggested")}
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
                    {t(`mobility.areas.${toKey(tag)}`, { defaultValue: tag })}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Q3 — Daily time */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("mobility.questionTime")}
            </p>
            <div className="flex gap-3">
              {TIME_OPTIONS.map(mins => (
                <button
                  key={mins}
                  onClick={() => setTime(mins)}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                    time === mins
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  {t("mobility.minSuffix", { n: mins })}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <Button
            className="w-full font-bold"
            onClick={() => onSave(goal, areas as StiffnessArea[], time)}
          >
            {t("mobility.savePreferences")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
