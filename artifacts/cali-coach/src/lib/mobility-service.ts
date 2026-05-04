/**
 * Mobility Service — daily flexibility routines
 *
 * Defines all available stretches and maps skill-tree goals to a 5-stretch
 * daily routine. The backend stores the goal; this module generates the actual
 * stretch list client-side so the DB stays lean.
 */

export interface Stretch {
  id: string;
  name: string;
  durationSeconds: number;
  targetMuscles: string[];
  description: string;
  coachingCue: string;
  /** Visual pose type for the Ghost Mode overlay */
  pose: GhostPose;
}

export type GhostPose =
  | "standing-arms-wide"
  | "standing-arm-up"
  | "kneeling-forward"
  | "seated-twist"
  | "lunge"
  | "forward-fold"
  | "hanging"
  | "kneeling-backward"
  | "wide-seated";

export type MobilityGoal =
  | "pull"
  | "front-lever"
  | "muscle-up"
  | "push"
  | "handstand"
  | "core"
  | "legs"
  | "general";

export const GOAL_LABELS: Record<MobilityGoal, string> = {
  pull: "Pull-Up Mastery",
  "front-lever": "Front Lever",
  "muscle-up": "Muscle-Up",
  push: "Push-Up Mastery",
  handstand: "Handstand Push-Up",
  core: "Dragon / Human Flag",
  legs: "Pistol Squat",
  general: "All-Round Mobility",
};

export const GOAL_OPTIONS: { value: MobilityGoal; label: string }[] = (
  Object.entries(GOAL_LABELS) as [MobilityGoal, string][]
).map(([value, label]) => ({ value, label }));

// ─── Stretch Library ─────────────────────────────────────────────────────────

const STRETCHES: Record<string, Stretch> = {
  wristExtension: {
    id: "wristExtension",
    name: "Wrist Extension Stretch",
    durationSeconds: 60,
    targetMuscles: ["Wrist Flexors", "Forearms"],
    description:
      "Kneel on the floor, place palms flat with fingers pointing back toward your knees. Gently lean back until you feel a stretch in the underside of your wrists.",
    coachingCue:
      "Keep arms straight. Ease off if you feel sharp pain — this should be a deep, tolerable stretch.",
    pose: "kneeling-forward",
  },
  wristFlexion: {
    id: "wristFlexion",
    name: "Wrist Flexion Stretch",
    durationSeconds: 60,
    targetMuscles: ["Wrist Extensors", "Forearms"],
    description:
      "Extend one arm forward, palm facing down. Use your other hand to gently pull the fingers toward you. Keep the elbow straight. Switch at 30 s.",
    coachingCue:
      "Point fingers toward the floor for the first 30 s, then switch sides. Breathe steadily.",
    pose: "standing-arm-up",
  },
  shoulderDislocates: {
    id: "shoulderDislocates",
    name: "Shoulder Dislocates",
    durationSeconds: 60,
    targetMuscles: ["Shoulders", "Chest", "Lats"],
    description:
      "Hold a band or towel wider than shoulder-width. Keep arms straight and slowly pass the band overhead and behind your back, then return. Repeat slowly.",
    coachingCue:
      "If you can't pass behind without bending elbows, widen your grip. Move slowly — control is key.",
    pose: "standing-arms-wide",
  },
  latStretch: {
    id: "latStretch",
    name: "Hanging Lat Stretch",
    durationSeconds: 60,
    targetMuscles: ["Lats", "Thoracic Spine", "Shoulders"],
    description:
      "Hang from a pull-up bar with straight arms. Actively relax your shoulders and let your bodyweight decompress the spine and open the lats.",
    coachingCue:
      "Don't try to pull yourself up — just hang. Breathe deeply into your ribcage to deepen the stretch.",
    pose: "hanging",
  },
  chestOpener: {
    id: "chestOpener",
    name: "Doorframe Chest Opener",
    durationSeconds: 60,
    targetMuscles: ["Chest", "Anterior Shoulders", "Biceps"],
    description:
      "Stand in a doorway with your forearms on the frame at 90°. Lean your body forward gently until you feel a stretch across your chest and front shoulders.",
    coachingCue:
      "Keep your core engaged and avoid arching your lower back. Breathe into the stretch.",
    pose: "standing-arms-wide",
  },
  hipFlexorLunge: {
    id: "hipFlexorLunge",
    name: "Low Lunge Hip Flexor",
    durationSeconds: 60,
    targetMuscles: ["Hip Flexors", "Quads", "Psoas"],
    description:
      "Drop into a low lunge with your back knee on the ground. Push your hips forward and down while keeping your torso upright. Switch at 30 s.",
    coachingCue:
      "Squeeze the glute on your back leg to deepen the stretch. Keep your front knee over your ankle.",
    pose: "lunge",
  },
  hamstring: {
    id: "hamstring",
    name: "Standing Hamstring Stretch",
    durationSeconds: 60,
    targetMuscles: ["Hamstrings", "Calves", "Lower Back"],
    description:
      "Stand with feet hip-width apart. Hinge at the hips with a neutral spine and reach toward the floor. Bend your knees slightly if needed at first.",
    coachingCue:
      "Focus on hinging from the hips, not rounding the back. With each exhale, fold a little deeper.",
    pose: "forward-fold",
  },
  thoracicRotation: {
    id: "thoracicRotation",
    name: "Seated Thoracic Rotation",
    durationSeconds: 60,
    targetMuscles: ["Thoracic Spine", "Obliques", "Rotator Cuff"],
    description:
      "Sit cross-legged. Place one hand on your opposite knee and rotate your upper body, looking over your shoulder as far as comfortable. Switch at 30 s.",
    coachingCue:
      "Keep your hips square to the front. Rotate from your mid-back, not your neck.",
    pose: "seated-twist",
  },
  pigeonPose: {
    id: "pigeonPose",
    name: "Pigeon Pose Hip Opener",
    durationSeconds: 60,
    targetMuscles: ["Hip External Rotators", "Glutes", "IT Band"],
    description:
      "From all-fours, bring one shin in front of you roughly parallel to your hands. Extend the other leg straight back. Fold forward over your front shin. Switch at 30 s.",
    coachingCue:
      "Square your hips as much as possible. Breathe into the tightest part of the hip.",
    pose: "kneeling-forward",
  },
  tricepsStretch: {
    id: "tricepsStretch",
    name: "Overhead Triceps Stretch",
    durationSeconds: 60,
    targetMuscles: ["Triceps", "Posterior Shoulder", "Lat"],
    description:
      "Raise one arm overhead, bend the elbow, and reach down your back. Use your other hand to gently press the elbow further. Switch sides at 30 s.",
    coachingCue:
      "Keep your core tall and avoid arching your lower back. Feel the stretch along the back of your arm.",
    pose: "standing-arm-up",
  },
  pancake: {
    id: "pancake",
    name: "Pancake Stretch",
    durationSeconds: 60,
    targetMuscles: ["Hamstrings", "Hip Adductors", "Lower Back"],
    description:
      "Sit in a wide straddle. With a flat back, hinge forward from the hips and walk your hands out in front. Relax and let gravity pull you deeper.",
    coachingCue:
      "Don't round your back. Hinge from the hips and let gravity do the work. Breathe and relax.",
    pose: "wide-seated",
  },
  shoulderFlexion: {
    id: "shoulderFlexion",
    name: "Reverse Shoulder Flexion",
    durationSeconds: 60,
    targetMuscles: ["Anterior Deltoid", "Chest", "Biceps"],
    description:
      "Kneel with your back to a low surface. Place both hands behind you on the surface, fingers pointing away. Slowly lower your hips to open the front of your shoulders.",
    coachingCue:
      "Keep elbows straight and lower slowly. You should feel a deep stretch across the front of both shoulders.",
    pose: "kneeling-backward",
  },
};

// ─── Goal → Routine Mapping ──────────────────────────────────────────────────

const GOAL_ROUTINES: Record<MobilityGoal, string[]> = {
  pull:           ["wristExtension", "shoulderDislocates", "latStretch", "chestOpener", "thoracicRotation"],
  "front-lever":  ["latStretch", "shoulderDislocates", "thoracicRotation", "hipFlexorLunge", "hamstring"],
  "muscle-up":    ["wristExtension", "shoulderDislocates", "latStretch", "chestOpener", "tricepsStretch"],
  push:           ["wristExtension", "wristFlexion", "chestOpener", "tricepsStretch", "shoulderDislocates"],
  handstand:      ["wristExtension", "wristFlexion", "shoulderDislocates", "shoulderFlexion", "hipFlexorLunge"],
  core:           ["thoracicRotation", "hipFlexorLunge", "hamstring", "latStretch", "chestOpener"],
  legs:           ["hipFlexorLunge", "hamstring", "pigeonPose", "pancake", "thoracicRotation"],
  general:        ["wristExtension", "shoulderDislocates", "hipFlexorLunge", "thoracicRotation", "chestOpener"],
};

export function getRoutineForGoal(goal: MobilityGoal | string): Stretch[] {
  const safeGoal = (GOAL_ROUTINES[goal as MobilityGoal] ? goal : "general") as MobilityGoal;
  return GOAL_ROUTINES[safeGoal].map((id) => STRETCHES[id]).filter(Boolean);
}

/**
 * Infer the most relevant mobility goal from recent session exercise names.
 * Falls back to "general" when no clear signal is found.
 */
export function inferGoalFromSessions(
  exerciseNames: string[],
): MobilityGoal {
  const names = new Set(exerciseNames);

  if (names.has("Tuck Front Lever") || names.has("Straddle Front Lever") || names.has("Full Front Lever"))
    return "front-lever";
  if (names.has("Muscle-Up") || names.has("Explosive Pull-Up"))
    return "muscle-up";
  if (names.has("Handstand Push-Up"))
    return "handstand";
  if (names.has("Dragon Flag") || names.has("Human Flag"))
    return "core";
  if (names.has("Pistol Squat") || names.has("Nordic Curls") || names.has("Archer Squat"))
    return "legs";
  if (names.has("Pull-Up") || names.has("Australian Rows") || names.has("Negative Pull-Ups") || names.has("Scapular Shrugs"))
    return "pull";
  if (names.has("Push-Up") || names.has("Diamond Push-Up") || names.has("Dip"))
    return "push";

  return "general";
}

/** Format seconds as M:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Total routine duration in minutes */
export function routineDurationMinutes(routine: Stretch[]): number {
  return Math.round(routine.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);
}
