/**
 * Equipment selection types, options, and modifier logic.
 *
 * The workout page reads these to:
 *  - Render the Gear Check UI
 *  - Pass pushDepthThreshold to processFrame
 *  - Apply rings stability bonus / jitter warning
 *  - Monitor floor wrist extension
 *  - Show ghost grip label badge
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PushGear = "floor" | "low-parallettes" | "high-parallettes";
export type PullGear = "pull-up-bar" | "gymnastic-rings" | "low-bar";
export type AddOn   = "none" | "resistance-band" | "weighted-vest";

export interface EquipmentSelection {
  pushGear: PushGear;
  pullGear: PullGear;
  addOn:    AddOn;
}

// ─── Default selection ────────────────────────────────────────────────────────

export const DEFAULT_EQUIPMENT: EquipmentSelection = {
  pushGear: "floor",
  pullGear: "pull-up-bar",
  addOn:    "none",
};

// ─── UI option arrays ─────────────────────────────────────────────────────────

export const PUSH_GEAR_OPTIONS: Array<{ value: PushGear; label: string }> = [
  { value: "floor",            label: "Floor"        },
  { value: "low-parallettes",  label: "Low P-Bars"   },
  { value: "high-parallettes", label: "High P-Bars / Dips" },
];

export const PULL_GEAR_OPTIONS: Array<{ value: PullGear; label: string }> = [
  { value: "pull-up-bar",     label: "Pull-up Bar"     },
  { value: "gymnastic-rings", label: "Gymnastic Rings" },
  { value: "low-bar",         label: "Low Bar (Rows)"  },
];

export const ADD_ON_OPTIONS: Array<{ value: AddOn; label: string }> = [
  { value: "none",             label: "None"            },
  { value: "resistance-band",  label: "Band"            },
  { value: "weighted-vest",    label: "Weighted Vest"   },
];

// ─── Exercise category helpers ────────────────────────────────────────────────

const PUSH_EXERCISE_SET = new Set([
  "Wall Push-Up", "Incline Push-Up", "Knee Push-Up", "Push-Up",
  "Diamond Push-Up", "Handstand Push-Up", "Dip",
]);

const PULL_EXERCISE_SET = new Set([
  "Scapular Shrugs", "Australian Rows", "Negative Pull-Ups", "Pull-Up",
  "Tuck Front Lever", "Straddle Front Lever", "Full Front Lever",
  "Explosive Pull-Up", "Muscle-Up",
]);

export function isPushExercise(name: string): boolean {
  return PUSH_EXERCISE_SET.has(name);
}

export function isPullExercise(name: string): boolean {
  return PULL_EXERCISE_SET.has(name);
}

// ─── Push depth threshold ─────────────────────────────────────────────────────

/**
 * Returns the elbow angle (°) the user must reach for a push rep to complete.
 *
 * High parallettes / dip bars allow the torso to drop below the hands, so a
 * more acute elbow angle still constitutes a complete rep.  Floor is strictest.
 *
 * Floor         → 150° (standard)
 * Low P-Bars    → 135° (moderate extra depth)
 * High P-Bars   → 120° (full below-bar range of motion)
 */
export function getPushDepthThreshold(gear: PushGear): number {
  if (gear === "high-parallettes") return 120;
  if (gear === "low-parallettes")  return 135;
  return 150;
}

// ─── Rings stability ──────────────────────────────────────────────────────────

/**
 * Bonus points added to the form score when the user is on rings AND their
 * wrists are steady (low jitter) — rewarding active ring stabilisation.
 */
export const RINGS_STABILITY_BONUS = 12;

/**
 * Mean absolute deviation of wrist x-positions over the last N frames that
 * counts as "jittering" (rings not under control).
 * ~1.5% of normalised frame width.
 */
export const RINGS_JITTER_THRESHOLD = 0.015;

// ─── Floor wrist extension ────────────────────────────────────────────────────

/**
 * z-depth difference between wrist and elbow landmarks that indicates the
 * wrist is pushing further into the floor (risk of hyper-extension).
 * MediaPipe pose z is a relative depth estimate: positive = further from camera.
 */
export const FLOOR_WRIST_Z_THRESHOLD = 0.10;

// ─── Ghost grip label ─────────────────────────────────────────────────────────

/**
 * Returns a short human-readable label describing the expected hand position
 * given the current equipment, shown as a small badge next to the Ghost Mode
 * indicator.  Returns null when no label is relevant.
 */
export function getGhostGripLabel(
  equipment: EquipmentSelection,
  isPush: boolean,
  isPull: boolean,
): string | null {
  if (isPush) {
    if (equipment.pushGear === "floor")            return "Flat-palm grip";
    if (equipment.pushGear === "low-parallettes")  return "Neutral grip";
    if (equipment.pushGear === "high-parallettes") return "Neutral grip · deep ROM";
  }
  if (isPull) {
    if (equipment.pullGear === "gymnastic-rings") return "Rings · stabilise";
    if (equipment.pullGear === "low-bar")         return "Underhand row grip";
  }
  if (equipment.addOn === "resistance-band")  return "+ Resistance band";
  if (equipment.addOn === "weighted-vest")    return "+ Weighted vest";
  return null;
}
