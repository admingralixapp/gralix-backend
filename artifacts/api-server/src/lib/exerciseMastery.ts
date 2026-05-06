/**
 * Per-exercise mastery system.
 *
 * Each exercise has a milestoneType ('reps' | 'seconds') and five tier titles.
 * Thresholds are shared with the category milestone system: 10, 100, 500, 1000, 5000.
 * For static-hold exercises, `totalReps` in the session already stores seconds held.
 */

export type MilestoneType = "reps" | "seconds";
export type MasteryTier = "starter" | "bronze" | "silver" | "gold" | "platinum";
export type ExerciseCategory = "push" | "pull" | "core" | "legs";

export const MASTERY_THRESHOLDS: Array<{ value: number; tier: MasteryTier }> = [
  { value: 10,   tier: "starter"  },
  { value: 100,  tier: "bronze"   },
  { value: 500,  tier: "silver"   },
  { value: 1000, tier: "gold"     },
  { value: 5000, tier: "platinum" },
];

export const TIER_LABELS: Record<MasteryTier, string> = {
  starter:  "Starter",
  bronze:   "Bronze",
  silver:   "Silver",
  gold:     "Gold",
  platinum: "Platinum",
};

export interface ExerciseMasteryDef {
  exerciseName: string;
  milestoneType: MilestoneType;
  category: ExerciseCategory;
  icon: string;
  /** [Starter, Bronze, Silver, Gold, Platinum] titles */
  tierTitles: [string, string, string, string, string];
}

export const EXERCISE_MASTERY_DEFS: ExerciseMasteryDef[] = [
  // ─── PUSH ────────────────────────────────────────────────────────────────
  { exerciseName: "Wall Push-Up",           milestoneType: "reps",    category: "push", icon: "🧱", tierTitles: ["Wall Tapper",        "Wall Rookie",            "Wall Specialist",       "Wall Elite",            "The Foundation"]         },
  { exerciseName: "Incline Push-Up",        milestoneType: "reps",    category: "push", icon: "📐", tierTitles: ["Ramp Starter",        "Incline Rookie",         "Slope Specialist",      "Incline Iron",          "Incline Immortal"]       },
  { exerciseName: "Knee Push-Up",           milestoneType: "reps",    category: "push", icon: "🦵", tierTitles: ["Padded Presser",      "Knee Rookie",            "Floor Specialist",      "Ground Elite",          "The Kneeling King"]      },
  { exerciseName: "Push-Up",                milestoneType: "reps",    category: "push", icon: "💪", tierTitles: ["Floor Presser",       "Push Specialist",        "Press Master",          "Push Legend",           "Iron Chest"]             },
  { exerciseName: "Diamond Push-Up",        milestoneType: "reps",    category: "push", icon: "💎", tierTitles: ["Diamond Miner",       "Diamond Driller",        "Gem Specialist",        "Diamond Elite",         "The Diamond Crusher"]    },
  { exerciseName: "Pike Push-Up",           milestoneType: "reps",    category: "push", icon: "⛰️", tierTitles: ["Pike Starter",        "Pike Presser",           "Angle Specialist",      "Pike Elite",            "Summit Seeker"]          },
  { exerciseName: "Elevated Pike Push-Up",  milestoneType: "reps",    category: "push", icon: "🏔️", tierTitles: ["Elevation Rookie",    "Elevated Pusher",        "Elevated Specialist",   "Elevation Elite",       "Apex Presser"]           },
  { exerciseName: "Archer Push-Up",         milestoneType: "reps",    category: "push", icon: "🏹", tierTitles: ["Bow Novice",          "Archer Trainee",         "The Archer",            "Archer Elite",          "The Bowmaster"]          },
  { exerciseName: "Pseudo Planche Push-Up", milestoneType: "reps",    category: "push", icon: "🔄", tierTitles: ["Pseudo Starter",      "Lean Pusher",            "Planche Prep",          "Pseudo Elite",          "Planche Pioneer"]        },
  { exerciseName: "Handstand Push-Up",      milestoneType: "reps",    category: "push", icon: "🤸", tierTitles: ["Inverted Starter",    "Wall Walker",            "Vertical Presser",      "Inverted Titan",        "The Sky Presser"]        },
  { exerciseName: "Dip",                    milestoneType: "reps",    category: "push", icon: "📉", tierTitles: ["Bar Dipper",          "Dip Specialist",         "Tricep Titan",          "Dip Master",            "Bar Sovereign"]          },
  { exerciseName: "Weighted Dip",           milestoneType: "reps",    category: "push", icon: "⚖️", tierTitles: ["Load Dipper",         "Heavy Dipper",           "Iron Dipper",           "Weighted Dip Master",   "Iron Dip"]               },
  { exerciseName: "Ring Dip",               milestoneType: "reps",    category: "push", icon: "⭕", tierTitles: ["Ring Dipper",         "Ring Presser",           "Ring Dip Specialist",   "Ring Dip Master",       "Ring Master"]            },
  { exerciseName: "Ring Support Hold",      milestoneType: "seconds", category: "push", icon: "⭕", tierTitles: ["Ring Balancer",       "Ring Stabilizer",        "Ring Specialist",       "Ring Support Master",   "The Ring Lord"]          },

  // ─── PULL ────────────────────────────────────────────────────────────────
  { exerciseName: "Scapular Shrugs",        milestoneType: "reps",    category: "pull", icon: "🫱", tierTitles: ["Scap Starter",        "Shoulder Awakener",      "Scap Specialist",       "Shoulder Sculptor",     "The Retractor"]          },
  { exerciseName: "Australian Rows",        milestoneType: "reps",    category: "pull", icon: "🦘", tierTitles: ["Rowing Rookie",       "Horizontal Puller",      "Row Specialist",        "Row Master",            "Horizontal Hammer"]      },
  { exerciseName: "Negative Pull-Ups",      milestoneType: "reps",    category: "pull", icon: "⬇️", tierTitles: ["Slow Descender",      "Eccentric Trainee",      "The Brake",             "Descent Master",        "Eccentric Elite"]        },
  { exerciseName: "Pull-Up",                milestoneType: "reps",    category: "pull", icon: "⬆️", tierTitles: ["Pull Specialist",     "Bar Dweller",            "Gravity Fighter",       "The Climber",           "Gravity Defier"]         },
  { exerciseName: "Chest-to-Bar Pull-Up",   milestoneType: "reps",    category: "pull", icon: "🎯", tierTitles: ["CTB Starter",         "High Puller",            "Chest Seeker",          "CTB Master",            "Bar Toucher"]            },
  { exerciseName: "Explosive Pull-Up",      milestoneType: "reps",    category: "pull", icon: "💥", tierTitles: ["Launch Pad",          "Explosive Starter",      "Spring Loader",         "Launch Master",         "The Catapult"]           },
  { exerciseName: "Archer Pull-Up",         milestoneType: "reps",    category: "pull", icon: "🏹", tierTitles: ["Archer Starter",      "Side Seeker",            "Lateral Puller",        "Archer Master",         "Precision Puller"]       },
  { exerciseName: "Muscle-Up",              milestoneType: "reps",    category: "pull", icon: "🚀", tierTitles: ["Riser Novice",        "Transition Starter",     "The Riser",             "Muscle Specialist",     "The Transcender"]        },
  { exerciseName: "Typewriter Pull-Up",     milestoneType: "reps",    category: "pull", icon: "⌨️", tierTitles: ["Typing Novice",       "Lateral Mover",          "The Scribe",            "Typewriter Specialist", "Typewriter Titan"]       },
  { exerciseName: "Ring Pull-Up",           milestoneType: "reps",    category: "pull", icon: "⭕", tierTitles: ["Ring Rookie",         "Ring Puller",            "Ring Specialist",       "Ring Master",           "Ring Sovereign"]         },
  { exerciseName: "Ring Muscle-Up",         milestoneType: "reps",    category: "pull", icon: "⭕", tierTitles: ["Ring Riser",          "Ring Transitionist",     "Ring Ascender",         "Ring Elite",            "Ring Legend"]            },
  { exerciseName: "Weighted Pull-Up",       milestoneType: "reps",    category: "pull", icon: "⚖️", tierTitles: ["Load Bearer",         "Heavy Puller",           "Iron Puller",           "Weighted Specialist",   "Iron Hauler"]            },
  { exerciseName: "Weighted Muscle-Up",     milestoneType: "reps",    category: "pull", icon: "⚖️", tierTitles: ["Loaded Riser",        "Heavy Riser",            "Iron Muscle",           "Loaded Legend",         "Iron Ascender"]          },
  { exerciseName: "Active Hang",            milestoneType: "seconds", category: "pull", icon: "🪝", tierTitles: ["Hang Timer",          "Hang Specialist",        "The Suspender",         "Hang Master",           "The Pendulum"]           },
  { exerciseName: "Tuck Front Lever",       milestoneType: "seconds", category: "pull", icon: "🌊", tierTitles: ["Lever Novice",        "Tuck Lever Starter",     "Tuck Lever Specialist", "Tuck Lever Master",     "Tuck Titan"]             },
  { exerciseName: "Straddle Front Lever",   milestoneType: "seconds", category: "pull", icon: "🌊", tierTitles: ["Straddle Starter",    "Straddle Lever",         "Straddle Specialist",   "Straddle Master",       "Straddle Horizon"]       },
  { exerciseName: "Full Front Lever",       milestoneType: "seconds", category: "pull", icon: "🌊", tierTitles: ["Lever Novice",        "Horizontal Seeker",      "Lever Specialist",      "Lever Master",          "Horizon Master"]         },

  // ─── CORE ────────────────────────────────────────────────────────────────
  { exerciseName: "Plank",                  milestoneType: "seconds", category: "core", icon: "🔒", tierTitles: ["Plank Starter",       "Time Keeper",            "Plank Specialist",      "Iron Plank",            "The Wall"]               },
  { exerciseName: "Side Plank",             milestoneType: "seconds", category: "core", icon: "🧱", tierTitles: ["Side Starter",        "Lateral Plank",          "Side Specialist",       "Side Pillar",           "The Pillar"]             },
  { exerciseName: "Hollow Body Hold",       milestoneType: "seconds", category: "core", icon: "🚀", tierTitles: ["Hollow Starter",      "Compression Rookie",     "Hollow Specialist",     "Hollow Master",         "The Rocket"]             },
  { exerciseName: "Tuck L-Sit",             milestoneType: "seconds", category: "core", icon: "💺", tierTitles: ["Tuck Sitter",         "Floor Lifter",           "Tuck Specialist",       "Tuck Master",           "Tuck Titan"]             },
  { exerciseName: "L-Sit",                  milestoneType: "seconds", category: "core", icon: "🪑", tierTitles: ["L-Sit Novice",        "Floor Compressor",       "L-Sit Specialist",      "L-Sit Master",          "The Compressor"]         },
  { exerciseName: "Dragon Flag",            milestoneType: "seconds", category: "core", icon: "🐉", tierTitles: ["Flag Beginner",       "Dragon Trainee",         "Dragon Specialist",     "Dragon Master",         "Dragonlord"]             },
  { exerciseName: "Dragon Flag Negative",   milestoneType: "reps",    category: "core", icon: "🐉", tierTitles: ["Descent Starter",     "Eccentric Dragon",       "Dragon Braker",         "Descent Master",        "The Dive Master"]        },
  { exerciseName: "Handstand",              milestoneType: "seconds", category: "core", icon: "🤸", tierTitles: ["Balance Beginner",    "Wall Balancer",          "Handstand Specialist",  "Inversion Master",      "The Vertical"]           },
  { exerciseName: "Planche Lean",           milestoneType: "seconds", category: "core", icon: "🦅", tierTitles: ["Lean Starter",        "Forward Leaner",         "Lean Specialist",       "Lean Master",           "The Leaning Tower"]      },
  { exerciseName: "Tuck Planche",           milestoneType: "seconds", category: "core", icon: "🦅", tierTitles: ["Tuck Student",        "Tuck Planche Trainee",   "Tuck Specialist",       "Tuck Planche Master",   "Tuck Titan"]             },
  { exerciseName: "Straddle Planche",       milestoneType: "seconds", category: "core", icon: "🦅", tierTitles: ["Straddle Student",    "Straddle Trainee",       "Straddle Specialist",   "Straddle Sovereign",    "Straddle Legend"]        },
  { exerciseName: "Planche",                milestoneType: "seconds", category: "core", icon: "🦅", tierTitles: ["Lean Student",        "Planche Trainee",        "Planche Specialist",    "Planche Master",        "The Human Fulcrum"]      },
  { exerciseName: "Human Flag",             milestoneType: "seconds", category: "core", icon: "🚩", tierTitles: ["Lateral Starter",     "Flag Trainee",           "Flag Specialist",       "Flag Master",           "Storm Warning"]          },
  { exerciseName: "Tucked Human Flag",      milestoneType: "seconds", category: "core", icon: "🚩", tierTitles: ["Tuck Flagger",        "Flag Starter",           "Tuck Flag Specialist",  "Tuck Flag Master",      "Flag Architect"]         },
  { exerciseName: "One-Leg Human Flag",     milestoneType: "seconds", category: "core", icon: "🚩", tierTitles: ["One-Leg Flagger",     "Half Flag",              "One-Leg Specialist",    "One-Leg Master",        "Half Storm"]             },
  { exerciseName: "Dead Bug",               milestoneType: "reps",    category: "core", icon: "🐛", tierTitles: ["Bug Beginner",        "Stability Trainee",      "Anti-Gravity Bug",      "Bug Master",            "The Invert"]             },
  { exerciseName: "Superman",               milestoneType: "reps",    category: "core", icon: "🦸", tierTitles: ["Cape Starter",        "Back Raiser",            "Superman Trainee",      "Back Master",           "The Cape"]               },
  { exerciseName: "Hanging Knee Tuck",      milestoneType: "reps",    category: "core", icon: "🦵", tierTitles: ["Tuck Starter",        "Knee Tucker",            "Hang Specialist",       "Tuck Master",           "Knee King"]              },
  { exerciseName: "Hanging Leg Raise",      milestoneType: "reps",    category: "core", icon: "🦵", tierTitles: ["Leg Lifter",          "Hanging Raiser",         "Hip Flexor",            "Hanging Sculptor",      "The Leg Legend"]         },
  { exerciseName: "Toes to Bar",            milestoneType: "reps",    category: "core", icon: "🎯", tierTitles: ["Reach Rookie",        "Bar Reacher",            "Toes Specialist",       "Toes Master",           "The Bar Toucher"]        },
  { exerciseName: "Windshield Wiper",       milestoneType: "reps",    category: "core", icon: "🌀", tierTitles: ["Wiper Starter",       "Hip Rotator",            "Wiper Specialist",      "Swing Master",          "The Pendulum"]           },
  { exerciseName: "L-Sit Compression",      milestoneType: "reps",    category: "core", icon: "💪", tierTitles: ["Press Starter",       "Compression Trainee",    "Floor Presser",         "Compression Master",    "The Floater"]            },
  { exerciseName: "Pike Stretch",           milestoneType: "seconds", category: "core", icon: "🧘", tierTitles: ["Flex Starter",        "Hamstring Seeker",       "Flexibility Specialist","The Pretzel",           "The Contortionist"]      },
  { exerciseName: "Burpee",                 milestoneType: "reps",    category: "core", icon: "💥", tierTitles: ["Burpee Beginner",     "Floor Popper",           "Burst Specialist",      "Burpee Machine",        "The Tornado"]            },

  // ─── LEGS ────────────────────────────────────────────────────────────────
  { exerciseName: "Assisted Squat",         milestoneType: "reps",    category: "legs", icon: "🙌", tierTitles: ["Supported Starter",   "Assisted Squatter",      "Support Specialist",    "Foundation Builder",    "Supported Strength"]     },
  { exerciseName: "Squat",                  milestoneType: "reps",    category: "legs", icon: "🏋️", tierTitles: ["Squat Rookie",        "Squat Specialist",       "Squat Master",          "Squat Legend",          "The Foundation"]         },
  { exerciseName: "Lunge",                  milestoneType: "reps",    category: "legs", icon: "🦵", tierTitles: ["Lunge Starter",       "Step Specialist",        "Lunge Master",          "Stride Legend",         "Step Legend"]            },
  { exerciseName: "Bulgarian Split Squat",  milestoneType: "reps",    category: "legs", icon: "🎽", tierTitles: ["Split Starter",       "Bulgarian Trainee",      "Split Specialist",      "Bulgarian Master",      "Bulgarian Baron"]        },
  { exerciseName: "Archer Squat",           milestoneType: "reps",    category: "legs", icon: "🏹", tierTitles: ["Archer Squatter",     "Side Squatter",          "Lateral Squatter",      "Archer Specialist",     "The Marksman"]           },
  { exerciseName: "Nordic Curls",           milestoneType: "reps",    category: "legs", icon: "❄️", tierTitles: ["Nordic Novice",       "Hamstring Seeker",       "Nordic Specialist",     "Nordic Master",         "Viking Strength"]        },
  { exerciseName: "Shrimp Squat",           milestoneType: "reps",    category: "legs", icon: "🦐", tierTitles: ["Shrimp Starter",      "Quad Seeker",            "Shrimp Specialist",     "Shrimp Master",         "Shrimp King"]            },
  { exerciseName: "Pistol Squat",           milestoneType: "reps",    category: "legs", icon: "🔫", tierTitles: ["One-Legged Wonder",   "Single-Leg Trainee",     "Pistol Specialist",     "Pistol Master",         "Single-Pillar Titan"]    },
  { exerciseName: "Step-Up",                milestoneType: "reps",    category: "legs", icon: "🪜", tierTitles: ["Step Starter",        "Step Climber",           "Step Specialist",       "Step Master",           "Step Legend"]            },
  { exerciseName: "Assisted Pistol Squat",  milestoneType: "reps",    category: "legs", icon: "🔫", tierTitles: ["Assisted Pistolero",  "Supported Single-Leg",   "Pistol Prep",           "Almost Pistol",         "Pistol Pioneer"]         },
  { exerciseName: "Close-Stance Squat",     milestoneType: "reps",    category: "legs", icon: "🦵", tierTitles: ["Close Starter",       "Narrow Squatter",        "Close Specialist",      "Narrow Master",         "The Close-Out"]          },
];

/** Fast lookup by exercise name (case-insensitive). */
const DEF_MAP = new Map<string, ExerciseMasteryDef>(
  EXERCISE_MASTERY_DEFS.map((d) => [d.exerciseName.toLowerCase(), d]),
);

export function getExerciseMasteryDef(exerciseName: string): ExerciseMasteryDef | undefined {
  return DEF_MAP.get(exerciseName.toLowerCase());
}

/**
 * Return the highest achieved tier for a given total, or null if below Starter threshold.
 */
export function getAchievedTier(total: number): MasteryTier | null {
  let achieved: MasteryTier | null = null;
  for (const { value, tier } of MASTERY_THRESHOLDS) {
    if (total >= value) achieved = tier;
  }
  return achieved;
}

/**
 * Return tier title for a given exercise and tier.
 */
export function getTierTitle(def: ExerciseMasteryDef, tier: MasteryTier): string {
  const idx = MASTERY_THRESHOLDS.findIndex((t) => t.tier === tier);
  return def.tierTitles[idx] ?? def.tierTitles[0];
}

/**
 * Return newly crossed tiers given old and new totals for an exercise.
 */
export function getNewlyEarnedExerciseTiers(
  oldTotal: number,
  newTotal: number,
): MasteryTier[] {
  return MASTERY_THRESHOLDS
    .filter(({ value }) => oldTotal < value && newTotal >= value)
    .map(({ tier }) => tier);
}

/** Shape stored in users.exerciseStats */
export interface ExerciseStat {
  total: number;
}
export type ExerciseStatsMap = Record<string, ExerciseStat>;

/**
 * Compute exercise stats from a full session history (used during backfill).
 */
export function computeExerciseStatsFromSessions(
  sessions: Array<{ exerciseName: string; totalReps: number | null; completedAt: Date | string | null }>,
): ExerciseStatsMap {
  const map: ExerciseStatsMap = {};
  for (const s of sessions) {
    if (!s.completedAt || !s.totalReps) continue;
    const key = s.exerciseName;
    if (!map[key]) map[key] = { total: 0 };
    map[key]!.total += s.totalReps;
  }
  return map;
}
