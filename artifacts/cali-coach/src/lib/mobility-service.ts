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
  /** One-line explanation of why this exercise matters for the current goal */
  why: string;
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
  pull:          "Pull-Up Mastery",
  "front-lever": "Front Lever",
  "muscle-up":   "Muscle-Up",
  push:          "Planche / Push",
  handstand:     "Handstand",
  core:          "Dragon / Human Flag",
  legs:          "Pistol Squat",
  general:       "All-Round Mobility",
};

export const GOAL_OPTIONS: { value: MobilityGoal; label: string }[] = (
  Object.entries(GOAL_LABELS) as [MobilityGoal, string][]
).map(([value, label]) => ({ value, label }));

/** Human-readable questionnaire options for the primary goal picker */
export const QUESTIONNAIRE_GOAL_OPTIONS: { value: MobilityGoal; label: string }[] = [
  { value: "handstand",     label: "Handstand" },
  { value: "muscle-up",     label: "Muscle-Up" },
  { value: "push",          label: "Planche" },
  { value: "legs",          label: "Pistol Squat" },
  { value: "front-lever",   label: "Front Lever" },
  { value: "pull",          label: "Pull-Up Mastery" },
  { value: "core",          label: "Dragon / Human Flag" },
  { value: "general",       label: "General Mobility" },
];

export const STIFFNESS_OPTIONS = [
  "Wrists",
  "Shoulders",
  "Lower Back",
  "Ankles",
  "Hips",
] as const;

export type StiffnessArea = (typeof STIFFNESS_OPTIONS)[number];

export const TIME_OPTIONS = [5, 10, 15] as const;
export type DailyTimeMinutes = (typeof TIME_OPTIONS)[number];

/**
 * Auto-recommended stiffness areas for each mobility goal.
 * Used to pre-populate the questionnaire when a user picks a goal from the
 * skill-tree search, so the routine immediately targets the right joints.
 */
export const GOAL_AUTO_AREAS: Record<MobilityGoal, string[]> = {
  handstand:      ["Wrists", "Shoulders"],
  "muscle-up":    ["Shoulders", "Wrists"],
  push:           ["Wrists", "Shoulders"],
  "front-lever":  ["Shoulders", "Lower Back"],
  pull:           ["Shoulders", "Lower Back"],
  core:           ["Lower Back", "Hips"],
  legs:           ["Ankles", "Hips"],
  general:        [],
};

// ─── Stretch Library ─────────────────────────────────────────────────────────

const STRETCHES: Record<string, Stretch> = {

  // ── General / shared ────────────────────────────────────────────────────

  wristExtension: {
    id: "wristExtension",
    name: "Wrist Extension Stretch",
    durationSeconds: 60,
    targetMuscles: ["Wrist Flexors", "Forearms"],
    description:
      "Kneel on the floor, place palms flat with fingers pointing back toward your knees. Gently lean back until you feel a stretch in the underside of your wrists.",
    coachingCue:
      "Keep arms straight. Ease off if you feel sharp pain — this should be a deep, tolerable stretch.",
    why: "Conditions the wrist flexors for load-bearing under straight-arm tension.",
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
    why: "Balances wrist extensors so both sides of the joint can handle impact evenly.",
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
    why: "Opens the full shoulder arc, protecting the rotator cuff under load.",
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
    why: "Decompresses the spine and increases pulling range of motion.",
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
    why: "Counter-stretches chest tightness that limits overhead and pulling range.",
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
    why: "Releases the psoas so your hips can fully extend under load.",
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
    why: "Lengthens the posterior chain so your lower back stays neutral under tension.",
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
    why: "Restores mid-back rotation that keeps your torso rigid under core tension.",
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
    why: "Necessary for the hip rotation and balance required on a single-leg squat.",
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
    why: "Frees the elbow lockout needed for full overhead and pressing strength.",
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
    why: "Improves adductor length for wider hip range in leg-dominant movements.",
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
    why: "Opens anterior shoulder range so your arms reach vertical behind your ears.",
    pose: "kneeling-backward",
  },

  ankleCircles: {
    id: "ankleCircles",
    name: "Ankle Mobility Circles",
    durationSeconds: 60,
    targetMuscles: ["Ankles", "Calves", "Achilles"],
    description:
      "Sit or stand on one foot. Lift the other foot and draw large slow circles with your toes — 10 clockwise, 10 counter-clockwise. Switch at 30 s.",
    coachingCue:
      "Make the circles as large as comfortable. Move from the ankle, not the whole leg.",
    why: "Improves ankle joint range so the knee can track forward during squats.",
    pose: "standing-arm-up",
  },

  calfStretch: {
    id: "calfStretch",
    name: "Wall Calf Stretch",
    durationSeconds: 60,
    targetMuscles: ["Calves", "Achilles", "Ankles"],
    description:
      "Stand facing a wall with hands on it for support. Step one foot back and press the heel into the floor with a straight knee. Switch at 30 s.",
    coachingCue:
      "Keep heel flat on the floor. Lean your body slightly forward to increase the stretch.",
    why: "Lengthens the Achilles so your heel stays down at the bottom of a squat.",
    pose: "lunge",
  },

  // ── Handstand-specific ──────────────────────────────────────────────────

  wallPuppyPose: {
    id: "wallPuppyPose",
    name: "Wall Puppy Pose",
    durationSeconds: 60,
    targetMuscles: ["Thoracic Spine", "Shoulder Flexors", "Lats"],
    description:
      "Stand an arm's length from the wall. Place both palms flat on the wall at shoulder height. Walk your feet back and hinge at the hips until your chest sinks toward the floor, arms straight.",
    coachingCue:
      "Let your chest drop — don't fight gravity. Keep arms straight and breathe into the stretch.",
    why: "Unlocks the thoracic extension and shoulder overhead range required for a straight handstand line.",
    pose: "kneeling-forward",
  },

  firstKnuckleRaises: {
    id: "firstKnuckleRaises",
    name: "First Knuckle Raises",
    durationSeconds: 60,
    targetMuscles: ["Wrist Flexors", "Finger Flexors", "Forearms"],
    description:
      "In a kneeling wrist extension position with palms flat, slowly raise your palms off the floor while keeping only your first knuckles down. Hold 2 s, lower, repeat.",
    coachingCue:
      "Control the movement — this is active wrist conditioning, not a passive stretch. Keep elbows straight.",
    why: "Builds the finger-braking power that stops you from over-balancing in a handstand.",
    pose: "kneeling-forward",
  },

  butchersBlock: {
    id: "butchersBlock",
    name: "Butcher's Block Stretch",
    durationSeconds: 60,
    targetMuscles: ["Triceps", "Lats", "Serratus"],
    description:
      "Kneel in front of a chair or bench. Place your elbows on the surface shoulder-width apart. Clasp hands behind your head and sink your chest toward the floor.",
    coachingCue:
      "Keep elbows shoulder-width — don't let them flare. Let gravity pull your chest down, don't force it.",
    why: "Removes lat and triceps tightness that pulls your arms forward and breaks the handstand line.",
    pose: "kneeling-forward",
  },

  // ── Muscle-Up-specific ──────────────────────────────────────────────────

  germanHang: {
    id: "germanHang",
    name: "German Hang (Passive)",
    durationSeconds: 45,
    targetMuscles: ["Shoulder Extension", "Anterior Shoulder", "Biceps"],
    description:
      "Hang from a bar or rings with a false grip, then slowly rotate your body backward so your shoulders extend behind you. Keep arms straight. Hold passively.",
    coachingCue:
      "Start with a very short hold (5–10 s) and build up. This is a deep shoulder opener — respect your limits.",
    why: "Essential for the deep transition phase of the muscle-up where the shoulder must pass behind the bar.",
    pose: "hanging",
  },

  skinTheCat: {
    id: "skinTheCat",
    name: "Skin the Cat (Partial)",
    durationSeconds: 60,
    targetMuscles: ["Shoulders", "Scapular Stabilisers", "Lats"],
    description:
      "Hang from a bar or rings. Tuck your knees to your chest and slowly rotate your hips overhead and through, going as far as comfortable. Reverse slowly.",
    coachingCue:
      "Never force the bottom range. If you feel shoulder pinching, stop. Control the descent — don't drop.",
    why: "Builds 360-degree shoulder health and the scapular strength required for rings work.",
    pose: "hanging",
  },

  deepLatStretch: {
    id: "deepLatStretch",
    name: "Deep Lat Foam Roll",
    durationSeconds: 60,
    targetMuscles: ["Lats", "Teres Major", "Thoracic Spine"],
    description:
      "Lie on your side on a foam roller with it under your armpit. Roll slowly from armpit to lower ribs, pausing on any tight spots for 5–10 s.",
    coachingCue:
      "Breathe into the tight spots. You can add an overhead reach to deepen the lat stretch as you roll.",
    why: "Increases pulling range of motion so you can reach full extension at the bottom of every rep.",
    pose: "wide-seated",
  },

  // ── Planche-specific ────────────────────────────────────────────────────

  plancheLeans: {
    id: "plancheLeans",
    name: "Planche Leans",
    durationSeconds: 45,
    targetMuscles: ["Wrists", "Shoulder Protraction", "Serratus"],
    description:
      "Start in a push-up position. Lean your entire body forward so your shoulders pass in front of your wrists, keeping arms straight. Hold, then return. Repeat slowly.",
    coachingCue:
      "Think 'shoulders forward over hands' not 'pike hips up'. Protract your scapulae throughout.",
    why: "The #1 conditioning drill for leaning further into a planche without wrist or shoulder injury.",
    pose: "kneeling-forward",
  },

  reverseTabletop: {
    id: "reverseTabletop",
    name: "Reverse Tabletop Stretch",
    durationSeconds: 60,
    targetMuscles: ["Anterior Deltoids", "Chest", "Wrist Extensors"],
    description:
      "Sit with knees bent, feet flat. Place hands behind you fingers pointing forward. Press hips up until body is parallel to the floor. Hold and breathe.",
    coachingCue:
      "Drive hips up with your glutes, not just your arms. Let your head drop back naturally.",
    why: "Counter-stretches the extreme anterior compression of planche work, protecting the shoulder joint.",
    pose: "kneeling-backward",
  },

  fingerPulses: {
    id: "fingerPulses",
    name: "Finger Tendon Pulses",
    durationSeconds: 60,
    targetMuscles: ["Finger Flexors", "Wrist Tendons", "Forearms"],
    description:
      "Hold one hand out palm-up. With the other hand, gently bend each finger back individually to a comfortable stretch. Hold 5 s per finger, then do gentle pulse stretches.",
    coachingCue:
      "Never force a finger stretch — tendons respond to gentle, consistent work. Warm the hands first.",
    why: "Prepares finger tendons for the extreme compressive load of straight-arm planche work.",
    pose: "standing-arm-up",
  },

  // ── Pistol Squat-specific ───────────────────────────────────────────────

  ankleDorsiflexion: {
    id: "ankleDorsiflexion",
    name: "Weighted Ankle Dorsiflexion",
    durationSeconds: 60,
    targetMuscles: ["Ankle Dorsiflexors", "Achilles", "Tibialis Anterior"],
    description:
      "Stand facing a wall, foot 10 cm away. Drive your knee forward to touch the wall while keeping your heel flat. Add a light plate on the knee for extra load. Switch at 30 s.",
    coachingCue:
      "Heel must stay flat the whole time. If the knee can't reach the wall, move foot closer and build range slowly.",
    why: "Allows your knee to travel forward over your toes so you don't fall backward in a pistol squat.",
    pose: "lunge",
  },

  cossackSquats: {
    id: "cossackSquats",
    name: "Cossack Squats",
    durationSeconds: 60,
    targetMuscles: ["Hip Adductors", "Glutes", "Ankles"],
    description:
      "Stand with feet wide. Shift your weight to one side and squat down on that leg while extending the other straight out. Keep the squatting foot flat. Switch sides at 30 s.",
    coachingCue:
      "Keep the extended foot flexed (toes up). Use a doorframe for balance assistance if needed at first.",
    why: "Improves lateral hip mobility essential for the deep hip tracking in a balanced pistol squat.",
    pose: "wide-seated",
  },

  // ── Front Lever-specific ────────────────────────────────────────────────

  scapularHangs: {
    id: "scapularHangs",
    name: "Active Scapular Hangs",
    durationSeconds: 60,
    targetMuscles: ["Serratus Anterior", "Lower Traps", "Scapular Retractors"],
    description:
      "Hang from a bar with straight arms. Without bending the elbows, alternately depress and elevate your shoulder blades — 'shrink' down, then 'reach' up. Slow and controlled.",
    coachingCue:
      "This is active work, not passive hanging. Think 'shoulder blades moving, arms staying straight'.",
    why: "Teaches you to keep your back flat under tension — the key to holding a horizontal body line.",
    pose: "hanging",
  },

  proneYRaises: {
    id: "proneYRaises",
    name: "Prone Y-Raises",
    durationSeconds: 60,
    targetMuscles: ["Lower Trapezius", "Posterior Deltoid", "Rhomboids"],
    description:
      "Lie face-down on the floor. Extend arms in a Y-shape (thumbs up). Squeeze your shoulder blades together and raise your arms as high as comfortable. Lower slowly. Repeat.",
    coachingCue:
      "Lead with the thumbs, not the elbows. Keep your neck neutral — don't crane upward.",
    why: "Strengthens the lower traps that prevent shoulder rounding under front lever tension.",
    pose: "wide-seated",
  },

  thoracicBridge: {
    id: "thoracicBridge",
    name: "Thoracic Bridge",
    durationSeconds: 60,
    targetMuscles: ["Thoracic Spine", "Glutes", "Hip Extensors"],
    description:
      "Lie on your back with knees bent, feet flat. Press up into a glute bridge, then slowly walk hands overhead on the floor and try to press your chest through. Hold 5 s, lower.",
    coachingCue:
      "The movement comes from your mid-back arching, not your lower back. Keep glutes engaged.",
    why: "Restores thoracic extension so you can engage your full posterior chain in the front lever hold.",
    pose: "kneeling-backward",
  },

};

// ─── Stiffness area → prioritized stretch IDs ────────────────────────────────

const STIFFNESS_STRETCH_IDS: Record<string, string[]> = {
  "Wrists":      ["wristExtension", "wristFlexion", "firstKnuckleRaises", "fingerPulses"],
  "Shoulders":   ["shoulderDislocates", "chestOpener", "tricepsStretch", "shoulderFlexion", "germanHang"],
  "Lower Back":  ["thoracicRotation", "hamstring", "hipFlexorLunge", "thoracicBridge"],
  "Ankles":      ["ankleCircles", "calfStretch", "ankleDorsiflexion"],
  "Hips":        ["hipFlexorLunge", "pigeonPose", "pancake", "cossackSquats"],
};

// ─── Goal → Routine Mapping ──────────────────────────────────────────────────

const GOAL_ROUTINES: Record<MobilityGoal, string[]> = {
  handstand:      ["wallPuppyPose", "firstKnuckleRaises", "butchersBlock", "wristExtension", "shoulderDislocates"],
  "muscle-up":    ["germanHang", "skinTheCat", "deepLatStretch", "shoulderDislocates", "wristExtension"],
  push:           ["plancheLeans", "reverseTabletop", "fingerPulses", "wristExtension", "shoulderDislocates"],
  legs:           ["ankleDorsiflexion", "pigeonPose", "cossackSquats", "hamstring", "hipFlexorLunge"],
  "front-lever":  ["scapularHangs", "proneYRaises", "thoracicBridge", "latStretch", "shoulderDislocates"],
  pull:           ["wristExtension", "shoulderDislocates", "latStretch", "chestOpener", "thoracicRotation"],
  core:           ["thoracicRotation", "hipFlexorLunge", "hamstring", "latStretch", "chestOpener"],
  general:        ["wristExtension", "shoulderDislocates", "hipFlexorLunge", "thoracicRotation", "chestOpener"],
};

// Full extended library for bonus stretches when time allows
const ALL_STRETCH_IDS = Object.keys(STRETCHES);

export function getRoutineForGoal(goal: MobilityGoal | string): Stretch[] {
  const safeGoal = (GOAL_ROUTINES[goal as MobilityGoal] ? goal : "general") as MobilityGoal;
  return GOAL_ROUTINES[safeGoal].map((id) => STRETCHES[id]).filter(Boolean);
}

/**
 * Generate a personalized task list based on questionnaire preferences.
 * - Prioritises stretches that target the user's stiffness areas
 * - Trims to match the daily time commitment
 *   5 min → 3 stretches, 10 min → 5 stretches, 15 min → up to 8 stretches
 */
export function getTasksForPreferences(
  goal: MobilityGoal | string,
  stiffnessAreas: string[],
  dailyTimeMinutes: number,
): Stretch[] {
  const safeGoal = (GOAL_ROUTINES[goal as MobilityGoal] ? goal : "general") as MobilityGoal;
  const baseIds = GOAL_ROUTINES[safeGoal];

  // Build priority set from stiffness areas
  const priorityIds = new Set<string>();
  for (const area of stiffnessAreas) {
    for (const id of (STIFFNESS_STRETCH_IDS[area] ?? [])) {
      priorityIds.add(id);
    }
  }

  // Sort base routine: stiffness-relevant first, then remaining in order
  const sorted = [
    ...baseIds.filter(id => priorityIds.has(id)),
    ...baseIds.filter(id => !priorityIds.has(id)),
  ];

  // Determine target count from time budget
  let targetCount = 5;
  if (dailyTimeMinutes <= 5)  targetCount = 3;
  else if (dailyTimeMinutes <= 10) targetCount = 5;
  else targetCount = 8;

  // If we need more than the base routine (15 min), pull stiffness + full library
  if (targetCount > sorted.length) {
    const bonusIds: string[] = [];
    for (const area of stiffnessAreas) {
      for (const id of (STIFFNESS_STRETCH_IDS[area] ?? [])) {
        if (!sorted.includes(id) && STRETCHES[id]) bonusIds.push(id);
      }
    }
    for (const id of ALL_STRETCH_IDS) {
      if (!sorted.includes(id) && !bonusIds.includes(id)) bonusIds.push(id);
    }
    sorted.push(...bonusIds.slice(0, targetCount - sorted.length));
  }

  return sorted.slice(0, targetCount).map(id => STRETCHES[id]).filter(Boolean);
}

/**
 * Infer the most relevant mobility goal from recent session exercise names.
 * Falls back to "general" when no clear signal is found.
 */
export function inferGoalFromSessions(exerciseNames: string[]): MobilityGoal {
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
