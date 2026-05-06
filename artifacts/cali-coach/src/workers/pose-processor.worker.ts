/**
 * Pose Processor Web Worker
 *
 * Offloads the exercise state-machine computation (angle maths + rep counting
 * logic) from the main thread so that the UI rendering and MediaPipe detection
 * loop get the full CPU budget without competing with coaching calculations.
 *
 * Message protocol:
 *   Main → Worker  : WorkerInput
 *   Worker → Main  : WorkerOutput | null  (null = exercise config not found)
 */

import { getExerciseConfig, LM } from "../lib/exercise-registry";
import type { Landmark, Phase, EquipmentContext } from "../lib/exercise-registry";

// ─── Message contract ─────────────────────────────────────────────────────────

export interface WorkerInput {
  landmarks:    Landmark[];
  prevPhase:    Phase;
  exerciseName: string;
  equipment?:   EquipmentContext;
  /** Primary joint angle from the previous detection frame (degrees). */
  prevKeyAngle: number | null;
  /** Milliseconds elapsed since the previous detection frame. */
  frameDeltaMs: number;
}

export interface WorkerOutput {
  repCounted:       boolean;
  repQuality:       "complete" | "incomplete" | null;
  newPhase:         Phase;
  formScore:        number;
  audioCue:         string | null;
  isHoldActive?:    boolean;
  isStatic:         boolean;
  /** Primary joint angle for this frame — sent back so main thread can pass
   *  it as prevKeyAngle on the next Worker call. */
  keyAngle:         number | null;
  /** True when the rep was counted via velocity-reversal assist rather than
   *  a clean threshold crossing. Used for logging/debugging. */
  velocityAssisted: boolean;
}

// ─── Angle helper (mirrors the private calcAngle in exercise-registry.ts) ──────

function calcAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * (180 / Math.PI));
  if (deg > 180) deg = 360 - deg;
  return deg;
}

// ─── Exercise categorisation for velocity assist ──────────────────────────────
//
// Push exercises: primary angle = elbow (decreases while descending).
//   Rep counted when elbow extends back above threshold after going down.
// Leg exercises:  primary angle = knee  (decreases while descending).
// Pull exercises: phase transitions use wrist-Y position, not a single angle,
//   so velocity assist on angle is not applicable.
// Static / other: no velocity assist.

const PUSH_EXERCISES = new Set([
  "Push-Up", "Wall Push-Up", "Incline Push-Up", "Knee Push-Up",
  "Diamond Push-Up", "Archer Push-Up", "Pseudo Planche Push-Up",
  "Pike Push-Up", "Elevated Pike Push-Up", "Handstand Push-Up",
  "Dip",
]);

const LEG_EXERCISES = new Set([
  "Squat", "Assisted Squat", "Archer Squat", "Pistol Squat",
  "Assisted Pistol Squat", "Close-Stance Squat", "Bulgarian Split Squat",
  "Shrimp Squat", "Lunge", "Step-Up",
]);

/**
 * The joint angle must drop *below* this value for the exercise to reach the
 * "down" phase (bottom of the movement).  Velocity assist fires when the
 * previous angle got within VELOCITY_BUFFER_DEG degrees of this threshold,
 * indicating the user genuinely reached the bottom even if the camera only
 * captured a single frame there before they pushed back up.
 */
const VELOCITY_BUFFER_DEG = 22;

function getDownThreshold(exerciseName: string): number | null {
  if (PUSH_EXERCISES.has(exerciseName)) return 90;
  if (LEG_EXERCISES.has(exerciseName)) return 100;
  return null;
}

function getKeyAngle(lm: Landmark[], exerciseName: string): number | null {
  if (PUSH_EXERCISES.has(exerciseName)) {
    const sh = lm[LM.LEFT_SHOULDER], el = lm[LM.LEFT_ELBOW], wr = lm[LM.LEFT_WRIST];
    if (sh && el && wr) return calcAngle(sh, el, wr);
  }
  if (LEG_EXERCISES.has(exerciseName)) {
    const hp = lm[LM.LEFT_HIP], kn = lm[LM.LEFT_KNEE], an = lm[LM.LEFT_ANKLE];
    if (hp && kn && an) return calcAngle(hp, kn, an);
  }
  return null;
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const {
    landmarks, prevPhase, exerciseName, equipment,
    prevKeyAngle, frameDeltaMs,
  } = e.data;

  const config = getExerciseConfig(exerciseName);
  if (!config) {
    self.postMessage(null);
    return;
  }

  const result   = config.processFrame(landmarks, prevPhase, equipment);
  const keyAngle = getKeyAngle(landmarks, exerciseName);

  // ── Velocity-assisted rep detection ───────────────────────────────────────
  //
  // At 30 fps there is a ~33 ms gap between frames.  For explosive movements
  // (e.g. a fast push-up) the joint may only spend a single frame near the
  // bottom before reversing direction.  If the threshold-crossing happened
  // between two frames — i.e. the angle went from above-threshold to
  // below-threshold-and-back in one interval — the position-based state
  // machine misses the rep.
  //
  // Fix: if the joint was clearly extending (positive angular velocity ≥ 0.25°/ms)
  // AND the previous angle was close enough to the "down" threshold to prove the
  // bottom was genuinely reached, force-count a rep.
  let velocityAssisted = false;

  if (
    !result.repCounted &&
    !config.isStatic &&
    prevPhase === "up" &&
    keyAngle !== null &&
    prevKeyAngle !== null &&
    frameDeltaMs > 0
  ) {
    const angularVelocity = (keyAngle - prevKeyAngle) / frameDeltaMs; // °/ms
    const downThreshold   = getDownThreshold(exerciseName);

    if (
      downThreshold !== null &&
      angularVelocity > 0.25 &&                            // joint clearly extending
      prevKeyAngle < downThreshold + VELOCITY_BUFFER_DEG   // was close to bottom
    ) {
      result.repCounted = true;
      result.repQuality = "complete";
      result.newPhase   = "up";  // rep complete — already back at top
      velocityAssisted  = true;
    }
  }

  const output: WorkerOutput = {
    repCounted:      result.repCounted,
    repQuality:      result.repQuality,
    newPhase:        result.newPhase,
    formScore:       result.formScore,
    audioCue:        result.audioCue,
    isHoldActive:    result.isHoldActive,
    isStatic:        config.isStatic,
    keyAngle,
    velocityAssisted,
  };

  self.postMessage(output);
};
