/**
 * Skill Tree Configuration — v2 (with Static / Explosive branching)
 *
 * Four branches — PUSH, PULL, CORE, LEGS.
 * After Level 2, PULL forks into:
 *   • Front Lever Path  (static holds)
 *   • Muscle-Up Path    (explosive power reps)
 * PUSH adds a parallel Handstand Push-Up skill at Elite level.
 * CORE gains Dragon Flag (L4, static) and Human Flag (L5, static).
 * LEGS gains Nordic Curls (L4) and Pistol Squat (L5).
 *
 * Each SkillNode defines:
 *   - type:              'standard' | 'static' | 'explosive'
 *   - exercises:         which exercise names (from DB) count toward mastery
 *   - masteryRequirement the bar a user must clear
 *       → for 'static' nodes, minReps means "minimum seconds held" per session
 *   - prerequisiteId:    the node that must be MASTERED first
 *   - path / pathLabel:  optional — used when multiple paths fork from same prereq
 */

export type SkillBranch = "PUSH" | "PULL" | "CORE" | "LEGS";

export type SkillType = "standard" | "static" | "explosive";

export type SkillLevelName =
  | "Beginner"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Elite";

export interface MasteryRequirement {
  description: string;
  /**
   * For standard / explosive nodes: minimum reps per qualifying session.
   * For static nodes:               minimum seconds held per qualifying session.
   */
  minReps: number;
  minFormScore: number;
  minQualifyingSessions: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  /** 1 = Beginner … 5 = Elite */
  level: number;
  levelName: SkillLevelName;
  title: string;
  description: string;
  type: SkillType;
  exercises: string[];
  masteryRequirement: MasteryRequirement;
  /** id of the SkillNode that must be mastered first. null = always unlocked. */
  prerequisiteId: string | null;
  /**
   * Cross-branch prerequisite ids — ALL must be mastered before this skill
   * unlocks, in addition to the primary prerequisiteId.
   */
  secondaryPrerequisiteIds?: string[];
  /** Identifies which fork a node belongs to (e.g. 'front-lever', 'muscle-up') */
  path?: string;
  /** Human-readable path label shown in the UI */
  pathLabel?: string;
  /** Equipment this specialty node requires (bar / rings / weighted) */
  equipmentTag?: EquipmentTag;
  /** True for nodes that belong to an equipment specialty path, not the core tree */
  equipmentSpecialty?: boolean;
}

// ─── PUSH Branch ──────────────────────────────────────────────────────────────

const PUSH_NODES: SkillNode[] = [
  {
    id: "push-1",
    branch: "PUSH",
    level: 1,
    levelName: "Beginner",
    type: "standard",
    title: "Push-Up Foundation",
    description: "Build the foundational pressing pattern with a standard push-up.",
    exercises: ["Push-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥70% form score in 3 sessions",
      minReps: 5,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "push-2",
    branch: "PUSH",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Push-Up Strength",
    description: "Double your push-up capacity and tighten your form.",
    exercises: ["Push-Up"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥78% form score in 5 sessions",
      minReps: 10,
      minFormScore: 78,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-1",
  },
  {
    id: "push-3",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Dip Introduction",
    description: "Transition to parallel-bar dips for deeper chest and tricep strength.",
    exercises: ["Dip"],
    masteryRequirement: {
      description: "Complete 5 dips with ≥80% form score in 3 sessions",
      minReps: 5,
      minFormScore: 80,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "push-2",
  },
  {
    id: "push-4",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Dip Mastery",
    description: "Command the dip with high volume and elite technique.",
    exercises: ["Dip"],
    masteryRequirement: {
      description: "Complete 10 dips with ≥85% form score in 5 sessions",
      minReps: 10,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-3",
  },
  {
    id: "push-5",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    type: "standard",
    title: "Push Elite",
    description: "Demonstrate elite-level pressing endurance across both movements.",
    exercises: ["Push-Up", "Dip"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥90% form score in 7 sessions",
      minReps: 15,
      minFormScore: 90,
      minQualifyingSessions: 7,
    },
    prerequisiteId: "push-4",
  },
  {
    id: "push-hs",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Handstand Push-Up",
    description:
      "Invert against the wall and press your full bodyweight overhead — the pinnacle of calisthenics pressing strength.",
    exercises: ["Handstand Push-Up"],
    masteryRequirement: {
      description: "Complete 3 HSPU with ≥85% form score in 5 sessions",
      minReps: 3,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-4",
    path: "hspu",
    pathLabel: "Handstand Path",
  },
];

// ─── PULL Branch ──────────────────────────────────────────────────────────────
// L1–L2 are shared. After L2 the branch forks into:
//   Front Lever Path  (static holds, pull-fl-*)
//   Muscle-Up Path    (explosive power reps, pull-mu-*)

const PULL_NODES: SkillNode[] = [
  // ── Shared foundation ──
  {
    id: "pull-1",
    branch: "PULL",
    level: 1,
    levelName: "Beginner",
    type: "standard",
    title: "First Pull-Up",
    description: "Achieve your first clean, full-range pull-up from a dead hang.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 1 rep with ≥65% form score in 2 sessions",
      minReps: 1,
      minFormScore: 65,
      minQualifyingSessions: 2,
    },
    prerequisiteId: null,
  },
  {
    id: "pull-2",
    branch: "PULL",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Pull-Up Consistency",
    description:
      "Develop reliable pull-up strength across multiple reps. Choose your path: Front Lever (static strength) or Muscle-Up (explosive power).",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥75% form score in 3 sessions",
      minReps: 5,
      minFormScore: 75,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "pull-1",
  },

  // ── Front Lever Path (static) ──
  {
    id: "pull-fl-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tuck Front Lever",
    description:
      "Hang from the bar, tuck your knees to your chest and hold your body horizontal. Builds the scapular depression and lat strength needed for the full lever.",
    exercises: ["Tuck Front Lever"],
    masteryRequirement: {
      description: "Hold 10 s with ≥75% form score in 4 sessions",
      minReps: 10,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    secondaryPrerequisiteIds: ["core-sh-1"],
    path: "front-lever",
    pathLabel: "Front Lever Path",
  },
  {
    id: "pull-fl-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "Straddle Front Lever",
    description:
      "Extend your legs out in a wide straddle and hold horizontal. Dramatically harder than the tuck — demands total-body tension.",
    exercises: ["Straddle Front Lever"],
    masteryRequirement: {
      description: "Hold 8 s with ≥80% form score in 5 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-fl-1",
    path: "front-lever",
    pathLabel: "Front Lever Path",
  },
  {
    id: "pull-fl-3",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "static",
    title: "Full Front Lever",
    description:
      "Body perfectly horizontal, arms straight, legs locked together — one of calisthenics' most iconic elite skills.",
    exercises: ["Full Front Lever"],
    masteryRequirement: {
      description: "Hold 5 s with ≥85% form score in 5 sessions",
      minReps: 5,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-fl-2",
    secondaryPrerequisiteIds: ["core-sh-2"],
    path: "front-lever",
    pathLabel: "Front Lever Path",
  },

  // ── Muscle-Up Path (explosive) ──
  {
    id: "pull-mu-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "explosive",
    title: "Explosive Pull-Ups",
    description:
      "Accelerate powerfully through the pull-up until your chest clears the bar. Essential momentum training for the muscle-up transition.",
    exercises: ["Explosive Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    path: "muscle-up",
    pathLabel: "Muscle-Up Path",
  },
  {
    id: "pull-mu-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "explosive",
    title: "Kipping Muscle-Up",
    description:
      "Use a controlled hip kip to generate momentum through the bar transition. Master the timing before eliminating the kip.",
    exercises: ["Muscle-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥80% form score in 4 sessions",
      minReps: 3,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-mu-1",
    secondaryPrerequisiteIds: ["push-2"],
    path: "muscle-up",
    pathLabel: "Muscle-Up Path",
  },
  {
    id: "pull-mu-3",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Strict Muscle-Up",
    description:
      "Zero swing, zero kip — pull through and press above the bar with pure upper-body strength. The gold standard of pulling power.",
    exercises: ["Muscle-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥88% form score in 5 sessions",
      minReps: 5,
      minFormScore: 88,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-mu-2",
    secondaryPrerequisiteIds: ["push-3"],
    path: "muscle-up",
    pathLabel: "Muscle-Up Path",
  },
];

// ─── CORE Branch ──────────────────────────────────────────────────────────────

const CORE_NODES: SkillNode[] = [
  {
    id: "core-1",
    branch: "CORE",
    level: 1,
    levelName: "Beginner",
    type: "static",
    title: "Plank Foundation",
    description: "Build a solid isometric core base. Hold a perfect plank — body straight from head to heels, glutes and abs braced.",
    exercises: ["Plank"],
    masteryRequirement: {
      description: "Hold 20 s with ≥70% form score in 3 sessions",
      minReps: 20,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "core-2",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Burpee Basics",
    description: "Introduce explosive full-body conditioning with burpees.",
    exercises: ["Burpee"],
    masteryRequirement: {
      description: "Complete 5 burpees with ≥70% form score in 3 sessions",
      minReps: 5,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
  },
  {
    id: "core-3",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Burpee Conditioning",
    description: "Sustain higher-volume burpee sets with consistent mechanics.",
    exercises: ["Burpee"],
    masteryRequirement: {
      description: "Complete 8 burpees with ≥80% form score in 5 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "core-2",
  },
  {
    id: "core-4",
    branch: "CORE",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "Dragon Flag",
    description:
      "Lie on a bench, grip behind your head, and hold your body perfectly horizontal — only your shoulders touch the surface. Total anti-extension strength.",
    exercises: ["Dragon Flag"],
    masteryRequirement: {
      description: "Hold 5 s with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-3",
  },
  {
    id: "core-5",
    branch: "CORE",
    level: 5,
    levelName: "Elite",
    type: "static",
    title: "Human Flag",
    description:
      "Grip a vertical pole and hold your entire body horizontal — a legendary feat that demands elite lateral core and shoulder strength.",
    exercises: ["Human Flag"],
    masteryRequirement: {
      description: "Hold 3 s with ≥80% form score in 4 sessions",
      minReps: 3,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-4",
    secondaryPrerequisiteIds: ["pull-2", "push-3"],
  },
];

// ─── LEGS Branch ──────────────────────────────────────────────────────────────

const LEGS_NODES: SkillNode[] = [
  {
    id: "legs-1",
    branch: "LEGS",
    level: 1,
    levelName: "Beginner",
    type: "standard",
    title: "Squat Foundation",
    description: "Build the bilateral squat pattern with full depth and upright posture.",
    exercises: ["Squat"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥70% form score in 3 sessions",
      minReps: 10,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: null,
  },
  {
    id: "legs-2",
    branch: "LEGS",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Squat Strength",
    description: "Increase squat volume and dial in knee tracking and depth.",
    exercises: ["Squat"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥78% form score in 5 sessions",
      minReps: 15,
      minFormScore: 78,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-1",
  },
  {
    id: "legs-3",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Lunge Balance",
    description: "Develop unilateral leg strength and coordination with lunges.",
    exercises: ["Lunge"],
    masteryRequirement: {
      description: "Complete 10 lunges with ≥80% form score in 3 sessions",
      minReps: 10,
      minFormScore: 80,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-2",
  },
  {
    id: "legs-4",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Nordic Curls",
    description:
      "Anchor your ankles, kneel tall and lower yourself slowly under control. The single best bodyweight hamstring exercise — brutal but effective.",
    exercises: ["Nordic Curls"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥80% form score in 4 sessions",
      minReps: 3,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-3",
  },
  {
    id: "legs-5",
    branch: "LEGS",
    level: 5,
    levelName: "Elite",
    type: "standard",
    title: "Pistol Squat",
    description:
      "Full-depth single-leg squat with the free leg extended — demands quad strength, ankle mobility and total-body balance.",
    exercises: ["Pistol Squat"],
    masteryRequirement: {
      description: "Complete 5 reps per side with ≥85% form score in 5 sessions",
      minReps: 5,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-4",
  },
];

// ─── Overhead Pressing Path (branches from push-1) ────────────────────────────
const PUSH_OVERHEAD_NODES: SkillNode[] = [
  {
    id: "push-oh-1",
    branch: "PUSH",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Pike Push-Up",
    description:
      "Hips high, hands shoulder-width — lower your head between your hands and press back up. Shifts load onto the shoulders and upper chest, bridging the gap toward overhead pressing.",
    exercises: ["Pike Push-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥72% form score in 3 sessions",
      minReps: 8,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "push-1",
    path: "overhead",
    pathLabel: "Overhead Path",
  },
  {
    id: "push-oh-2",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Elevated Pike Push-Up",
    description:
      "Feet on a box or bench — the elevated angle increases the shoulder range of motion and load, making this a direct stepping-stone to the handstand push-up.",
    exercises: ["Elevated Pike Push-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥78% form score in 4 sessions",
      minReps: 8,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-oh-1",
    path: "overhead",
    pathLabel: "Overhead Path",
  },
];

// ─── Explosive Pull Path (branches from pull-2) ────────────────────────────────
const PULL_EXPLOSIVE_NODES: SkillNode[] = [
  {
    id: "pull-exp-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "explosive",
    title: "Chest-to-Bar Pull-Up",
    description:
      "Explode past chin-over-bar — drive until your chest touches the bar. Demands far more pulling strength than a standard pull-up and directly builds the power needed for advanced bar work.",
    exercises: ["Chest-to-Bar Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    path: "explosive-pull",
    pathLabel: "Explosive Pull Path",
  },
  {
    id: "pull-exp-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "explosive",
    title: "Archer Pull-Up",
    description:
      "One arm pulls while the other extends straight — a brutally asymmetric drill that develops unilateral lat strength and sets the stage for the one-arm pull-up.",
    exercises: ["Archer Pull-Up"],
    masteryRequirement: {
      description: "Complete 4 reps per side with ≥80% form score in 4 sessions",
      minReps: 4,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-exp-1",
    path: "explosive-pull",
    pathLabel: "Explosive Pull Path",
  },
];

// ─── Static Holds Path (branches from core-1) ─────────────────────────────────
const CORE_STATIC_HOLDS_NODES: SkillNode[] = [
  {
    id: "core-sh-1",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "static",
    title: "Hollow Body Hold",
    description:
      "Lie on your back and brace into a hollow curve — shoulders off the floor, straight legs raised low. The fundamental full-body tension skill that underpins every calisthenics movement.",
    exercises: ["Hollow Body Hold"],
    masteryRequirement: {
      description: "Hold 20 s with ≥70% form score in 3 sessions",
      minReps: 20,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
    path: "static-holds",
    pathLabel: "Static Holds Path",
  },
  {
    id: "core-sh-2",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tuck L-Sit",
    description:
      "Press on parallel bars or the floor and lift your hips clear — knees tucked to chest, arms locked out. Builds the hip-flexor and tricep strength needed for a full L-sit and beyond.",
    exercises: ["Tuck L-Sit"],
    masteryRequirement: {
      description: "Hold 10 s with ≥72% form score in 4 sessions",
      minReps: 10,
      minFormScore: 72,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-sh-1",
    path: "static-holds",
    pathLabel: "Static Holds Path",
  },
];

// ─── Unilateral Legs Path (branches from legs-2) ──────────────────────────────
const LEGS_UNILATERAL_NODES: SkillNode[] = [
  {
    id: "legs-uni-1",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Bulgarian Split Squat",
    description:
      "Rear foot elevated, front foot forward — sink until the rear knee grazes the floor. One of the most effective unilateral strength builders in bodyweight training.",
    exercises: ["Bulgarian Split Squat"],
    masteryRequirement: {
      description: "Complete 8 reps per side with ≥78% form score in 4 sessions",
      minReps: 8,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-2",
    path: "unilateral",
    pathLabel: "Unilateral Path",
  },
  {
    id: "legs-uni-2",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Shrimp Squat",
    description:
      "Single-leg squat with the rear foot held behind — touch the back knee to the floor and stand back up. Exceptional ankle mobility, quad strength and balance are all demanded simultaneously.",
    exercises: ["Shrimp Squat"],
    masteryRequirement: {
      description: "Complete 5 reps per side with ≥80% form score in 4 sessions",
      minReps: 5,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-uni-1",
    path: "unilateral",
    pathLabel: "Unilateral Path",
  },
];

// ─── Equipment Specialty Nodes ────────────────────────────────────────────────

// ── PULL — Bar Specialist (branches from pull-2) ──────────────────────────────
const PULL_BAR_NODES: SkillNode[] = [
  {
    id: "pull-bar-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Bar Pull-Up Volume",
    description: "Build exceptional volume on the straight bar. Consistent sets of 12+ reps with textbook form lay the foundation for all bar-specific explosive skills.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 12 reps with ≥80% form score in 4 sessions",
      minReps: 12, minFormScore: 80, minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    path: "bar-specialist",
    pathLabel: "Bar Specialist",
    equipmentTag: "bar",
    equipmentSpecialty: true,
  },
  {
    id: "pull-bar-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "explosive",
    title: "Explosive Bar Pull-Up",
    description: "Accelerate through every rep until your chest clears the bar. This bar-specific power training is the direct gateway to the strict bar muscle-up.",
    exercises: ["Explosive Pull-Up"],
    masteryRequirement: {
      description: "Complete 6 reps with ≥82% form score in 5 sessions",
      minReps: 6, minFormScore: 82, minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-bar-1",
    path: "bar-specialist",
    pathLabel: "Bar Specialist",
    equipmentTag: "bar",
    equipmentSpecialty: true,
  },
  {
    id: "pull-bar-3",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Strict Bar Muscle-Up",
    description: "Zero swing, zero kip — pull through and press above the bar with pure upper-body strength. The gold standard of bar pulling excellence.",
    exercises: ["Muscle-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥88% form score in 5 sessions",
      minReps: 3, minFormScore: 88, minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-bar-2",
    path: "bar-specialist",
    pathLabel: "Bar Specialist",
    equipmentTag: "bar",
    equipmentSpecialty: true,
  },
];

// ── PULL — Rings Specialist (branches from pull-2) ────────────────────────────
const PULL_RINGS_NODES: SkillNode[] = [
  {
    id: "pull-rings-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Ring Support Hold",
    description: "Hold an active support on the rings — arms extended, body upright. This foundational position demands wrist, elbow and shoulder stability before any ring pulling work.",
    exercises: ["Ring Support Hold"],
    masteryRequirement: {
      description: "Hold 10 s with ≥70% form score in 3 sessions",
      minReps: 10, minFormScore: 70, minQualifyingSessions: 3,
    },
    prerequisiteId: "pull-2",
    path: "rings-specialist",
    pathLabel: "Rings Specialist",
    equipmentTag: "rings",
    equipmentSpecialty: true,
  },
  {
    id: "pull-rings-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Ring Pull-Up",
    description: "Full pull-ups on gymnastic rings demand grip stability and shoulder control that no fixed bar can replicate. The instability makes every rep harder.",
    exercises: ["Ring Pull-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥80% form score in 5 sessions",
      minReps: 8, minFormScore: 80, minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-rings-1",
    path: "rings-specialist",
    pathLabel: "Rings Specialist",
    equipmentTag: "rings",
    equipmentSpecialty: true,
  },
  {
    id: "pull-rings-3",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Ring Muscle-Up",
    description: "The pinnacle of ring pulling: a strict muscle-up on gymnastic rings demands elite transition power, shoulder stability, and wrist control under instability.",
    exercises: ["Ring Muscle-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥85% form score in 5 sessions",
      minReps: 3, minFormScore: 85, minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-rings-2",
    path: "rings-specialist",
    pathLabel: "Rings Specialist",
    equipmentTag: "rings",
    equipmentSpecialty: true,
  },
];

// ── PULL — Weighted Specialist (branches from pull-2) ─────────────────────────
const PULL_WEIGHTED_NODES: SkillNode[] = [
  {
    id: "pull-weighted-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Weighted Pull-Up",
    description: "Add a vest or belt and perform strict pull-ups under load. Starting at 10–20% bodyweight, the added resistance accelerates strength gains beyond pure bodyweight training.",
    exercises: ["Weighted Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥80% form score in 4 sessions",
      minReps: 5, minFormScore: 80, minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    path: "weighted-specialist",
    pathLabel: "Weighted Specialist",
    equipmentTag: "weighted",
    equipmentSpecialty: true,
  },
  {
    id: "pull-weighted-2",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Weighted Pull-Up Volume",
    description: "Sustain high-rep weighted pull-up sets. Volume under load builds the raw pulling strength needed for the weighted muscle-up and heavier loading.",
    exercises: ["Weighted Pull-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥82% form score in 5 sessions",
      minReps: 8, minFormScore: 82, minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-weighted-1",
    path: "weighted-specialist",
    pathLabel: "Weighted Specialist",
    equipmentTag: "weighted",
    equipmentSpecialty: true,
  },
  {
    id: "pull-weighted-3",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Weighted Muscle-Up",
    description: "A muscle-up with added load — one of the most powerful feats in calisthenics. Demands explosive pulling, precise transition timing, and total-body tension.",
    exercises: ["Weighted Muscle-Up"],
    masteryRequirement: {
      description: "Complete 2 reps with ≥85% form score in 4 sessions",
      minReps: 2, minFormScore: 85, minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-weighted-2",
    path: "weighted-specialist",
    pathLabel: "Weighted Specialist",
    equipmentTag: "weighted",
    equipmentSpecialty: true,
  },
];

// ── PUSH — Rings Specialist (branches from push-3 Dip Introduction) ───────────
const PUSH_RINGS_NODES: SkillNode[] = [
  {
    id: "push-rings-1",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Ring Dip",
    description: "Dip on gymnastic rings with controlled RTO (Rings Turned Out) at lockout. The instability demands elite tricep, chest, and shoulder stabilisation on every rep.",
    exercises: ["Ring Dip"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥82% form score in 4 sessions",
      minReps: 8, minFormScore: 82, minQualifyingSessions: 4,
    },
    prerequisiteId: "push-3",
    path: "push-rings-specialist",
    pathLabel: "Rings Specialist",
    equipmentTag: "rings",
    equipmentSpecialty: true,
  },
  {
    id: "push-rings-2",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Ring Muscle-Up",
    description: "Combine ring pulling and pressing power in a single explosive movement above the rings. The ultimate ring skill requires elite stability across the entire kinetic chain.",
    exercises: ["Ring Muscle-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥85% form score in 5 sessions",
      minReps: 3, minFormScore: 85, minQualifyingSessions: 5,
    },
    prerequisiteId: "push-rings-1",
    path: "push-rings-specialist",
    pathLabel: "Rings Specialist",
    equipmentTag: "rings",
    equipmentSpecialty: true,
  },
];

// ── PUSH — Weighted Specialist (branches from push-3 Dip Introduction) ────────
const PUSH_WEIGHTED_NODES: SkillNode[] = [
  {
    id: "push-weighted-1",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Weighted Dip",
    description: "Add a vest or belt and dip under load. Weighted dips build elite pressing strength faster than any other bodyweight compound movement.",
    exercises: ["Weighted Dip"],
    masteryRequirement: {
      description: "Complete 6 reps with ≥84% form score in 4 sessions",
      minReps: 6, minFormScore: 84, minQualifyingSessions: 4,
    },
    prerequisiteId: "push-3",
    path: "push-weighted-specialist",
    pathLabel: "Weighted Specialist",
    equipmentTag: "weighted",
    equipmentSpecialty: true,
  },
];

export const EQUIPMENT_SPECIALTY_NODES: SkillNode[] = [
  ...PULL_BAR_NODES,
  ...PULL_RINGS_NODES,
  ...PULL_WEIGHTED_NODES,
  ...PUSH_RINGS_NODES,
  ...PUSH_WEIGHTED_NODES,
];

// ─── New Category Path Nodes ───────────────────────────────────────────────────
export const NEW_CATEGORY_NODES: SkillNode[] = [
  ...PUSH_OVERHEAD_NODES,
  ...PULL_EXPLOSIVE_NODES,
  ...CORE_STATIC_HOLDS_NODES,
  ...LEGS_UNILATERAL_NODES,
];

// ─── Full registry ─────────────────────────────────────────────────────────────

/**
 * All nodes grouped by branch. Nodes within each array are ordered so that
 * prerequisites always appear before their dependents (important for evaluateSkillTree).
 * Note: specialty nodes are NOT included here — use EQUIPMENT_SPECIALTY_NODES directly.
 */
export const SKILL_TREE_BRANCHES: Record<SkillBranch, SkillNode[]> = {
  PUSH: PUSH_NODES,
  PULL: PULL_NODES,
  CORE: CORE_NODES,
  LEGS: LEGS_NODES,
};

export const ALL_SKILL_NODES: SkillNode[] = [
  ...PUSH_NODES,
  ...PULL_NODES,
  ...CORE_NODES,
  ...LEGS_NODES,
  ...EQUIPMENT_SPECIALTY_NODES,
  ...NEW_CATEGORY_NODES,
];

/** Core skill count (excludes equipment specialty paths) */
export const TOTAL_SKILL_COUNT = ALL_SKILL_NODES.filter(n => !n.equipmentSpecialty).length;
/** Equipment specialty skill count */
export const TOTAL_SPECIALTY_COUNT = EQUIPMENT_SPECIALTY_NODES.length;

// ─── Evaluation ───────────────────────────────────────────────────────────────

export type SkillStatus = "locked" | "unlocked" | "mastered";

// ─── Equipment Specialty ───────────────────────────────────────────────────────

export type EquipmentTag = "bar" | "rings" | "weighted";

export const EQUIPMENT_SPECIALTIES: Record<EquipmentTag, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
}> = {
  bar:      { label: "Bar Specialist",      shortLabel: "Bar",      color: "#f97316", bgColor: "rgba(249,115,22,0.12)" },
  rings:    { label: "Rings Specialist",    shortLabel: "Rings",    color: "#06b6d4", bgColor: "rgba(6,182,212,0.12)"  },
  weighted: { label: "Weighted Specialist", shortLabel: "Weighted", color: "#8b5cf6", bgColor: "rgba(139,92,246,0.12)" },
};

export interface SessionSummary {
  exerciseName: string;
  totalReps: number | null;
  avgFormScore: number | null;
  completedAt: string | null;
}

export interface EvaluatedSkill extends SkillNode {
  status: SkillStatus;
  progress: {
    qualifyingSessions: number;
    bestReps: number;
    bestFormScore: number;
  };
}

/**
 * Returns which equipment tags have been mastered at a given branch + level.
 * Used to detect "double mastery" across equipment specialty paths.
 */
export function getEquipmentMasteriesForLevel(
  branch: SkillBranch,
  level: number,
  allEvaluated: EvaluatedSkill[],
): EquipmentTag[] {
  return allEvaluated
    .filter(
      s =>
        s.branch === branch &&
        s.level === level &&
        s.equipmentSpecialty === true &&
        s.status === "mastered" &&
        s.equipmentTag !== undefined,
    )
    .map(s => s.equipmentTag!);
}

/**
 * Evaluate every skill node against completed session history.
 *
 * Rules:
 *   - A session QUALIFIES if: completedAt set, exerciseName matches,
 *     totalReps >= minReps, avgFormScore >= minFormScore.
 *   - For 'static' nodes, totalReps represents seconds held.
 *   - A skill is MASTERED when qualifyingSessions >= minQualifyingSessions.
 *   - A skill is UNLOCKED when its prerequisite is MASTERED (or it has none).
 *   - Otherwise the skill is LOCKED.
 *
 * Because ALL_SKILL_NODES is ordered prerequisites-first, prerequisites will
 * always be resolved before their dependents — including forked branches.
 */
export function evaluateSkillTree(
  sessions: SessionSummary[],
): EvaluatedSkill[] {
  const completedSessions = sessions.filter((s) => s.completedAt !== null);

  const evaluated = new Map<string, EvaluatedSkill>();

  for (const node of ALL_SKILL_NODES) {
    const req = node.masteryRequirement;

    const qualifying = completedSessions.filter(
      (s) =>
        node.exercises.some(
          (ex) => ex.toLowerCase() === s.exerciseName?.toLowerCase(),
        ) &&
        (s.totalReps ?? 0) >= req.minReps &&
        (s.avgFormScore ?? 0) >= req.minFormScore,
    );

    const bestReps = Math.max(0, ...qualifying.map((s) => s.totalReps ?? 0));
    const bestFormScore = Math.max(
      0,
      ...qualifying.map((s) => s.avgFormScore ?? 0),
    );

    const mastered = qualifying.length >= req.minQualifyingSessions;

    const primaryMet =
      node.prerequisiteId === null ||
      evaluated.get(node.prerequisiteId)?.status === "mastered";

    const secondaryMet = (node.secondaryPrerequisiteIds ?? []).every(
      (id) => evaluated.get(id)?.status === "mastered",
    );

    let status: SkillStatus;
    if (mastered) {
      status = "mastered";
    } else if (primaryMet && secondaryMet) {
      status = "unlocked";
    } else {
      status = "locked";
    }

    evaluated.set(node.id, {
      ...node,
      status,
      progress: {
        qualifyingSessions: qualifying.length,
        bestReps,
        bestFormScore,
      },
    });
  }

  return Array.from(evaluated.values());
}
