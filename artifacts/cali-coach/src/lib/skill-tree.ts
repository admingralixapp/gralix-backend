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
// Main: push-1 → push-2 → push-3 → push-4 → push-5
// Sub-paths from push-2: Overhead (push-oh-*)
// Sub-paths from push-3: Planche  (push-pp-*)
// push-5 also requires cross-branch: core-hh-3 + push-pp-1

const PUSH_NODES: SkillNode[] = [
  {
    id: "push-1",
    branch: "PUSH",
    level: 1,
    levelName: "Beginner",
    type: "standard",
    title: "First Push-Up",
    description: "Achieve your first clean push-up: straight body line, chest touching the floor, full arm extension.",
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
    description: "Double your push-up capacity and tighten your form — consistent sets unlock the overhead and planche paths.",
    exercises: ["Push-Up"],
    masteryRequirement: {
      description: "Complete 15 reps with ≥75% form score in 4 sessions",
      minReps: 15,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-1",
  },
  {
    id: "push-3",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Diamond Push-Up",
    description: "Hands form a diamond under the chest, elbows track behind — isolates the triceps and inner chest for elite pressing density.",
    exercises: ["Diamond Push-Up"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥78% form score in 4 sessions",
      minReps: 10,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-2",
  },
  {
    id: "push-4",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Archer Push-Up",
    description: "One arm bends while the other extends wide — asymmetric drill that builds unilateral pressing strength toward one-arm work.",
    exercises: ["Archer Push-Up"],
    masteryRequirement: {
      description: "Complete 8 reps per side with ≥82% form score in 5 sessions",
      minReps: 8,
      minFormScore: 82,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-3",
  },
  {
    id: "push-5",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Pseudo Planche Push-Up",
    description: "Hands rotated out by your hips, body leaning forward — simulates planche loading on the wrists and shoulders while pressing.",
    exercises: ["Pseudo Planche Push-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥85% form score in 5 sessions",
      minReps: 5,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-4",
    secondaryPrerequisiteIds: ["core-hh-3", "push-pp-1"],
  },
];

// ─── PULL Branch ──────────────────────────────────────────────────────────────
// Shared: pull-1 → pull-2 → pull-3
// From pull-2: Front Lever Path (pull-fl-*) — requires core-hh-3
// From pull-3: Muscle-Up Path (pull-mu-*), Advanced Moves (pull-am-*)

const PULL_NODES: SkillNode[] = [
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
    description: "Develop reliable pull-up strength across multiple reps. Unlocks the Front Lever path.",
    exercises: ["Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥75% form score in 3 sessions",
      minReps: 5,
      minFormScore: 75,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "pull-1",
  },
  {
    id: "pull-3",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Negative Pull-Ups",
    description: "Start from chin-over-bar and lower yourself as slowly as possible. This eccentric-focused variation builds the explosive pulling power needed for the Muscle-Up path.",
    exercises: ["Negative Pull-Ups"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
  },
];

// ─── CORE Branch ──────────────────────────────────────────────────────────────
// Main: core-1 → core-2
// From core-1: Hollow Holds (core-hh-*), Bar Based (core-bb-1/2)
// From core-2: Human Flag (core-hf-*), Bar Based continues (core-bb-3/4)

const CORE_NODES: SkillNode[] = [
  {
    id: "core-1",
    branch: "CORE",
    level: 1,
    levelName: "Beginner",
    type: "static",
    title: "Plank Foundation",
    description: "Hold a perfect plank — body straight from head to heels, glutes and abs braced. The universal starting point for all core work.",
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
    type: "static",
    title: "Side Plank",
    description: "Prop on one forearm and lift your hips — creates lateral core stiffness that transfers directly into human flag and hanging leg work.",
    exercises: ["Side Plank"],
    masteryRequirement: {
      description: "Hold 20 s per side with ≥72% form score in 3 sessions",
      minReps: 20,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
  },
];

// ─── LEGS Branch ──────────────────────────────────────────────────────────────
// Main: legs-1 → legs-2 → legs-3 → legs-4
// From legs-2: L-Sit Path (legs-ls-*), Pistol Squat Path (legs-ps-*)

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
    description: "Increase squat volume and dial in knee tracking and depth. Unlocks the L-Sit and Pistol Squat paths.",
    exercises: ["Squat"],
    masteryRequirement: {
      description: "Complete 20 reps with ≥75% form score in 4 sessions",
      minReps: 20,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-1",
  },
  {
    id: "legs-3",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Shrimp Squat",
    description: "Single-leg squat with the rear foot held behind you — demands exceptional quad strength, ankle mobility and balance simultaneously.",
    exercises: ["Shrimp Squat"],
    masteryRequirement: {
      description: "Complete 5 reps per side with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-2",
  },
  {
    id: "legs-4",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Bulgarian Split Squat",
    description: "Rear foot elevated, front foot forward — sink until the rear knee grazes the floor. One of the most effective unilateral strength builders.",
    exercises: ["Bulgarian Split Squat"],
    masteryRequirement: {
      description: "Complete 8 reps per side with ≥80% form score in 5 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-3",
  },
];

// ─── Overhead Pressing Path (branches from push-2) ───────────────────────────
const PUSH_OVERHEAD_NODES: SkillNode[] = [
  {
    id: "push-oh-1",
    branch: "PUSH",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Pike Push-Up",
    description: "Hips high, hands shoulder-width — lower your head between your hands and press back up. Shifts load onto the shoulders, bridging the gap toward overhead pressing.",
    exercises: ["Pike Push-Up"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥72% form score in 3 sessions",
      minReps: 8,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "push-2",
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
    description: "Feet on a box or bench — the elevated angle increases shoulder range of motion and load, the direct step toward the handstand push-up.",
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
  {
    id: "push-oh-3",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Wall Handstand Push-Up",
    description: "Kick up against the wall and press your full bodyweight overhead — the most direct loading pattern for handstand push-up strength.",
    exercises: ["Handstand Push-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥82% form score in 4 sessions",
      minReps: 5,
      minFormScore: 82,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-oh-2",
    path: "overhead",
    pathLabel: "Overhead Path",
  },
  {
    id: "push-oh-4",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "Handstand",
    description: "Balance on your hands away from the wall — controlled inversion demanding shoulder strength, wrist flexibility and spatial awareness.",
    exercises: ["Handstand"],
    masteryRequirement: {
      description: "Hold 20 s with ≥78% form score in 4 sessions",
      minReps: 20,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-oh-3",
    path: "overhead",
    pathLabel: "Overhead Path",
  },
  {
    id: "push-oh-5",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    type: "standard",
    title: "Handstand Push-Up",
    description: "Press from the floor to full lockout while inverted — the pinnacle of calisthenics overhead pressing strength.",
    exercises: ["Handstand Push-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥85% form score in 5 sessions",
      minReps: 3,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-oh-4",
    path: "overhead",
    pathLabel: "Overhead Path",
  },
];

// ─── Planche Path (branches from push-3) ─────────────────────────────────────
const PUSH_PLANCHE_NODES: SkillNode[] = [
  {
    id: "push-pp-1",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Planche Lean",
    description: "Lean forward over your wrists in a push-up position with hands rotated out — conditions the wrists and anterior shoulder for planche loading.",
    exercises: ["Planche Lean"],
    masteryRequirement: {
      description: "Hold 30 s with ≥75% form score in 3 sessions",
      minReps: 30,
      minFormScore: 75,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "push-3",
    path: "planche",
    pathLabel: "Planche Path",
  },
  {
    id: "push-pp-2",
    branch: "PUSH",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tuck Planche",
    description: "Lift both feet off the ground while leaning over your wrists with knees tucked — the first true planche position.",
    exercises: ["Tuck Planche"],
    masteryRequirement: {
      description: "Hold 10 s with ≥78% form score in 4 sessions",
      minReps: 10,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-pp-1",
    secondaryPrerequisiteIds: ["core-hh-3"],
    path: "planche",
    pathLabel: "Planche Path",
  },
  {
    id: "push-pp-3",
    branch: "PUSH",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "Straddle Planche",
    description: "Legs extended wide in a straddle while holding the planche position — dramatically harder than the tuck, demanding total-body tension.",
    exercises: ["Straddle Planche"],
    masteryRequirement: {
      description: "Hold 5 s with ≥82% form score in 4 sessions",
      minReps: 5,
      minFormScore: 82,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "push-pp-2",
    path: "planche",
    pathLabel: "Planche Path",
  },
  {
    id: "push-pp-4",
    branch: "PUSH",
    level: 5,
    levelName: "Elite",
    type: "static",
    title: "Full Planche",
    description: "Body perfectly horizontal, legs together and locked — the legendary pinnacle of calisthenics pressing strength.",
    exercises: ["Planche"],
    masteryRequirement: {
      description: "Hold 3 s with ≥85% form score in 5 sessions",
      minReps: 3,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "push-pp-3",
    path: "planche",
    pathLabel: "Planche Path",
  },
];

// ─── Front Lever Path (branches from pull-2) ─────────────────────────────────
const PULL_FL_NODES: SkillNode[] = [
  {
    id: "pull-fl-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tuck Front Lever",
    description: "Hang from the bar, tuck your knees to your chest and hold your body horizontal. Builds the scapular depression and lat strength needed for the full lever.",
    exercises: ["Tuck Front Lever"],
    masteryRequirement: {
      description: "Hold 10 s with ≥75% form score in 4 sessions",
      minReps: 10,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-2",
    secondaryPrerequisiteIds: ["core-hh-3"],
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
    description: "Extend your legs out in a wide straddle and hold horizontal. Dramatically harder than the tuck — demands total-body tension.",
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
    description: "Body perfectly horizontal, arms straight, legs locked together — one of calisthenics' most iconic elite skills.",
    exercises: ["Full Front Lever"],
    masteryRequirement: {
      description: "Hold 5 s with ≥85% form score in 5 sessions",
      minReps: 5,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-fl-2",
    secondaryPrerequisiteIds: ["core-hh-5"],
    path: "front-lever",
    pathLabel: "Front Lever Path",
  },
];

// ─── Muscle-Up Path (branches from pull-3) ───────────────────────────────────
const PULL_MU_NODES: SkillNode[] = [
  {
    id: "pull-mu-1",
    branch: "PULL",
    level: 3,
    levelName: "Intermediate",
    type: "explosive",
    title: "Chest-to-Bar Pull-Up",
    description: "Explode past chin-over-bar — drive until your chest touches the bar. Demands far more pulling power than a standard pull-up.",
    exercises: ["Chest-to-Bar Pull-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-3",
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
    description: "Use a controlled hip kip to generate momentum through the bar transition. Master the timing before eliminating the kip.",
    exercises: ["Muscle-Up"],
    masteryRequirement: {
      description: "Complete 3 reps with ≥80% form score in 4 sessions",
      minReps: 3,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-mu-1",
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
    description: "Zero swing, zero kip — pull through and press above the bar with pure upper-body strength. The gold standard of pulling power.",
    exercises: ["Muscle-Up"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥88% form score in 5 sessions",
      minReps: 5,
      minFormScore: 88,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-mu-2",
    path: "muscle-up",
    pathLabel: "Muscle-Up Path",
  },
];

// ─── Advanced Moves Path (branches from pull-mu-1) ───────────────────────────
const PULL_AM_NODES: SkillNode[] = [
  {
    id: "pull-am-1",
    branch: "PULL",
    level: 4,
    levelName: "Advanced",
    type: "explosive",
    title: "Archer Pull-Up",
    description: "One arm pulls while the other extends straight — a brutally asymmetric drill that develops unilateral lat strength toward the one-arm pull-up.",
    exercises: ["Archer Pull-Up"],
    masteryRequirement: {
      description: "Complete 4 reps per side with ≥80% form score in 4 sessions",
      minReps: 4,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "pull-mu-1",
    path: "advanced-moves",
    pathLabel: "Advanced Moves Path",
  },
  {
    id: "pull-am-2",
    branch: "PULL",
    level: 5,
    levelName: "Elite",
    type: "explosive",
    title: "Typewriter Pull-Up",
    description: "Pull to the bar then slide laterally from hand to hand at the top — an extraordinary display of horizontal pulling strength and control.",
    exercises: ["Typewriter Pull-Up"],
    masteryRequirement: {
      description: "Complete 3 reps per side with ≥85% form score in 5 sessions",
      minReps: 3,
      minFormScore: 85,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "pull-am-1",
    path: "advanced-moves",
    pathLabel: "Advanced Moves Path",
  },
];

// ─── Hollow Holds Path (branches from core-1) ────────────────────────────────
// core-hh-1 → core-hh-2 (Back Extensions side branch)
//           → core-hh-3 → core-hh-4 → core-hh-5 (main Dragon Flag line)
const CORE_HH_NODES: SkillNode[] = [
  {
    id: "core-hh-1",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Dead Bug",
    description: "Lie on your back with arms and legs raised — lower opposite arm and leg while bracing. The foundational anti-extension core drill.",
    exercises: ["Dead Bug"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥70% form score in 3 sessions",
      minReps: 10,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
    path: "hollow-holds",
    pathLabel: "Hollow Holds Path",
  },
  {
    id: "core-hh-2",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Back Extensions",
    description: "Lie face-down and raise your chest and legs off the floor (Superman). Builds the posterior chain strength that balances hollow body work.",
    exercises: ["Superman"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥72% form score in 3 sessions",
      minReps: 10,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-hh-1",
    path: "hollow-holds",
    pathLabel: "Hollow Holds Path",
  },
  {
    id: "core-hh-3",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Hollow Body Hold",
    description: "Lie on your back and brace into a hollow curve — shoulders off the floor, straight legs raised low. The fundamental full-body tension skill underpinning every calisthenics movement.",
    exercises: ["Hollow Body Hold"],
    masteryRequirement: {
      description: "Hold 20 s with ≥75% form score in 4 sessions",
      minReps: 20,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-hh-1",
    path: "hollow-holds",
    pathLabel: "Hollow Holds Path",
  },
  {
    id: "core-hh-4",
    branch: "CORE",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Dragon Flag Negative",
    description: "Lie on a bench, grip behind your head, and lower your body slowly from vertical to horizontal. The eccentric loading phase that prepares you for the full dragon flag.",
    exercises: ["Dragon Flag Negative"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥78% form score in 4 sessions",
      minReps: 5,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-hh-3",
    path: "hollow-holds",
    pathLabel: "Hollow Holds Path",
  },
  {
    id: "core-hh-5",
    branch: "CORE",
    level: 5,
    levelName: "Elite",
    type: "standard",
    title: "Dragon Flag",
    description: "Grip behind your head and hold or lower your body perfectly horizontal — only your shoulders touch the bench. Total anti-extension strength at its peak.",
    exercises: ["Dragon Flag"],
    masteryRequirement: {
      description: "Complete 5 reps with ≥82% form score in 5 sessions",
      minReps: 5,
      minFormScore: 82,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "core-hh-4",
    path: "hollow-holds",
    pathLabel: "Hollow Holds Path",
  },
];

// ─── Bar Based Movements Path (branches from core-1 & core-2) ────────────────
const CORE_BB_NODES: SkillNode[] = [
  {
    id: "core-bb-1",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "static",
    title: "Active Hang",
    description: "Hang from the bar with shoulders actively depressed and packed — the foundation of all bar-based core and pulling work.",
    exercises: ["Active Hang"],
    masteryRequirement: {
      description: "Hold 30 s with ≥65% form score in 3 sessions",
      minReps: 30,
      minFormScore: 65,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
    path: "bar-based",
    pathLabel: "Bar Based Path",
  },
  {
    id: "core-bb-2",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Hanging Knee Tucks",
    description: "Hang from the bar and drive your knees to your chest. Builds the hip-flexor compression and shoulder stability needed for harder hanging core work.",
    exercises: ["Hanging Knee Tuck"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥70% form score in 3 sessions",
      minReps: 10,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-1",
    path: "bar-based",
    pathLabel: "Bar Based Path",
  },
  {
    id: "core-bb-3",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Hanging Leg Raises",
    description: "Hang from the bar and raise straight legs to horizontal — demands serious hip-flexor strength, grip endurance and full spinal control.",
    exercises: ["Hanging Leg Raise"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥75% form score in 4 sessions",
      minReps: 10,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-2",
    path: "bar-based",
    pathLabel: "Bar Based Path",
  },
  {
    id: "core-bb-4",
    branch: "CORE",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Toes to Bar",
    description: "From a hang, fold your entire body and touch your toes to the bar — complete hip-flexor strength, grip, and body-control in one movement.",
    exercises: ["Toes to Bar"],
    masteryRequirement: {
      description: "Complete 8 reps with ≥80% form score in 4 sessions",
      minReps: 8,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-bb-3",
    path: "bar-based",
    pathLabel: "Bar Based Path",
  },
];

// ─── Human Flag Path (branches from core-2) ──────────────────────────────────
const CORE_HF_NODES: SkillNode[] = [
  {
    id: "core-hf-1",
    branch: "CORE",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Hanging Windshield Wipers",
    description: "Hang from the bar, raise legs to horizontal and sweep them side to side. Builds the lateral core strength and hip mobility needed for the human flag.",
    exercises: ["Windshield Wiper"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥72% form score in 3 sessions",
      minReps: 10,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "core-2",
    path: "human-flag",
    pathLabel: "Human Flag Path",
  },
  {
    id: "core-hf-2",
    branch: "CORE",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tucked Human Flag",
    description: "Grip a vertical pole and hold your body horizontal with knees tucked — the first true human flag position requiring elite lateral force production.",
    exercises: ["Tucked Human Flag"],
    masteryRequirement: {
      description: "Hold 5 s with ≥75% form score in 4 sessions",
      minReps: 5,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-hf-1",
    path: "human-flag",
    pathLabel: "Human Flag Path",
  },
  {
    id: "core-hf-3",
    branch: "CORE",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "One-Leg Human Flag",
    description: "One leg extended, one leg bent — a transitional hold that dramatically reduces lever arm while training the lateral chain for the full flag.",
    exercises: ["One-Leg Human Flag"],
    masteryRequirement: {
      description: "Hold 3 s per side with ≥78% form score in 4 sessions",
      minReps: 3,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-hf-2",
    path: "human-flag",
    pathLabel: "Human Flag Path",
  },
  {
    id: "core-hf-4",
    branch: "CORE",
    level: 5,
    levelName: "Elite",
    type: "static",
    title: "Human Flag",
    description: "Grip a vertical pole and hold your entire body horizontal — a legendary feat demanding elite lateral core and shoulder strength.",
    exercises: ["Human Flag"],
    masteryRequirement: {
      description: "Hold 2 s with ≥82% form score in 4 sessions",
      minReps: 2,
      minFormScore: 82,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "core-hf-3",
    path: "human-flag",
    pathLabel: "Human Flag Path",
  },
];

// ─── L-Sit Path (branches from legs-2) ──────────────────────────────────────
const LEGS_LS_NODES: SkillNode[] = [
  {
    id: "legs-ls-1",
    branch: "LEGS",
    level: 2,
    levelName: "Novice",
    type: "static",
    title: "Pike Stretch",
    description: "Sit tall with legs straight and fold forward over them — builds the hamstring flexibility and hip-flexor activation needed for a full L-sit.",
    exercises: ["Pike Stretch"],
    masteryRequirement: {
      description: "Hold 30 s with ≥68% form score in 3 sessions",
      minReps: 30,
      minFormScore: 68,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-2",
    path: "l-sit",
    pathLabel: "L-Sit Path",
  },
  {
    id: "legs-ls-2",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "L-Sit Compressions",
    description: "Seated, drive your heels into the floor and try to lift them — builds the active hip-flexor compression that replaces flexibility with strength in the L-sit.",
    exercises: ["L-Sit Compression"],
    masteryRequirement: {
      description: "Complete 20 reps with ≥72% form score in 3 sessions",
      minReps: 20,
      minFormScore: 72,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-ls-1",
    path: "l-sit",
    pathLabel: "L-Sit Path",
  },
  {
    id: "legs-ls-3",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "static",
    title: "Tuck L-Sit",
    description: "Press on parallel bars or the floor and lift your hips clear — knees tucked to chest, arms locked out. The gateway position for the full L-sit.",
    exercises: ["Tuck L-Sit"],
    masteryRequirement: {
      description: "Hold 10 s with ≥75% form score in 4 sessions",
      minReps: 10,
      minFormScore: 75,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-ls-2",
    path: "l-sit",
    pathLabel: "L-Sit Path",
  },
  {
    id: "legs-ls-4",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    type: "static",
    title: "Full L-Sit",
    description: "Arms locked, hips lifted, legs straight and horizontal — a complete display of hip-flexor strength, pressing power and body compression.",
    exercises: ["L-Sit"],
    masteryRequirement: {
      description: "Hold 5 s with ≥80% form score in 4 sessions",
      minReps: 5,
      minFormScore: 80,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-ls-3",
    path: "l-sit",
    pathLabel: "L-Sit Path",
  },
];

// ─── Pistol Squat Path (branches from legs-2) ────────────────────────────────
const LEGS_PS_NODES: SkillNode[] = [
  {
    id: "legs-ps-1",
    branch: "LEGS",
    level: 2,
    levelName: "Novice",
    type: "standard",
    title: "Step-Ups",
    description: "Step onto an elevated surface under control — develops single-leg stability and quad activation as the first step toward the pistol squat.",
    exercises: ["Step-Up"],
    masteryRequirement: {
      description: "Complete 15 reps per side with ≥70% form score in 3 sessions",
      minReps: 15,
      minFormScore: 70,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-2",
    path: "pistol-squat",
    pathLabel: "Pistol Squat Path",
  },
  {
    id: "legs-ps-2",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Assisted Pistol Squat",
    description: "Full-depth single-leg squat holding a counterbalance or support — builds the strength and mobility pattern before removing assistance.",
    exercises: ["Assisted Pistol Squat"],
    masteryRequirement: {
      description: "Complete 5 reps per side with ≥75% form score in 3 sessions",
      minReps: 5,
      minFormScore: 75,
      minQualifyingSessions: 3,
    },
    prerequisiteId: "legs-ps-1",
    path: "pistol-squat",
    pathLabel: "Pistol Squat Path",
  },
  {
    id: "legs-ps-3",
    branch: "LEGS",
    level: 3,
    levelName: "Intermediate",
    type: "standard",
    title: "Close-Stance Squat",
    description: "Bilateral squat with feet together — approximates pistol squat mechanics and ankle mobility demands before going fully unilateral.",
    exercises: ["Close-Stance Squat"],
    masteryRequirement: {
      description: "Complete 10 reps with ≥78% form score in 4 sessions",
      minReps: 10,
      minFormScore: 78,
      minQualifyingSessions: 4,
    },
    prerequisiteId: "legs-ps-2",
    path: "pistol-squat",
    pathLabel: "Pistol Squat Path",
  },
  {
    id: "legs-ps-4",
    branch: "LEGS",
    level: 4,
    levelName: "Advanced",
    type: "standard",
    title: "Pistol Squat",
    description: "Full-depth single-leg squat with the free leg extended — demands quad strength, ankle mobility and total-body balance in one elite movement.",
    exercises: ["Pistol Squat"],
    masteryRequirement: {
      description: "Complete 5 reps per side with ≥82% form score in 5 sessions",
      minReps: 5,
      minFormScore: 82,
      minQualifyingSessions: 5,
    },
    prerequisiteId: "legs-ps-3",
    path: "pistol-squat",
    pathLabel: "Pistol Squat Path",
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

// ─── Full registry ─────────────────────────────────────────────────────────────

/**
 * All nodes ordered prerequisites-first so evaluateSkillTree resolves correctly.
 * CORE hollow holds come first because core-hh-3 and core-hh-5 are secondary
 * prerequisites for PUSH planche and PULL front lever nodes respectively.
 * push-5 (capstone) comes after PUSH_PLANCHE so its secondary prereq push-pp-1 is ready.
 */
export const ALL_SKILL_NODES: SkillNode[] = [
  // CORE first — provides cross-branch prereqs core-hh-3 and core-hh-5
  ...CORE_NODES,
  ...CORE_HH_NODES,
  ...CORE_BB_NODES,
  ...CORE_HF_NODES,
  // PUSH: main spine 1-4 → overhead → planche → push-5 capstone
  // (push-5 secondary prereqs: core-hh-3 ✓ and push-pp-1 ✓ — both resolved above)
  ...PUSH_NODES.slice(0, 4),
  ...PUSH_OVERHEAD_NODES,
  ...PUSH_PLANCHE_NODES,
  ...PUSH_NODES.slice(4),
  // PULL: shared → front lever (needs core-hh-3 ✓) → muscle-up → advanced
  ...PULL_NODES,
  ...PULL_FL_NODES,
  ...PULL_MU_NODES,
  ...PULL_AM_NODES,
  // LEGS
  ...LEGS_NODES,
  ...LEGS_LS_NODES,
  ...LEGS_PS_NODES,
  // Equipment specialty
  ...EQUIPMENT_SPECIALTY_NODES,
];

/** All non-specialty nodes by branch (includes all sub-paths) */
export const SKILL_TREE_BRANCHES: Record<SkillBranch, SkillNode[]> = {
  PUSH: [...PUSH_NODES, ...PUSH_OVERHEAD_NODES, ...PUSH_PLANCHE_NODES],
  PULL: [...PULL_NODES, ...PULL_FL_NODES, ...PULL_MU_NODES, ...PULL_AM_NODES],
  CORE: [...CORE_NODES, ...CORE_HH_NODES, ...CORE_BB_NODES, ...CORE_HF_NODES],
  LEGS: [...LEGS_NODES, ...LEGS_LS_NODES, ...LEGS_PS_NODES],
};

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
