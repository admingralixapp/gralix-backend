/**
 * CoachingEngine — Phase-based cues, Active Pacer logic, and tone-aware coaching.
 *
 * Three-tier cue architecture:
 *  Tier 1 — Technical/form cues (exercise-registry.ts + form-cues.ts)
 *  Tier 2 — Motivational cues  (getMotivationalCue — medium priority, varied)
 *  Tier 3 — Flavor/goofy cues  (getFlavorCue — low priority, once per set)
 *
 * Also responsible for:
 *  - Phase-transition cues (what to do on each movement phase change).
 *  - Active Pacer tempo cues.
 *  - Milestone cues when the user is fatiguing.
 *  - Tone mapping: form score → ElevenLabs expressiveness.
 *  - Safety cues (highest priority).
 *
 * Cue design principles:
 *  - Every cue contains an actionable instruction, not just commentary.
 *  - Even in character voice modes the LLM preserves the instructional core.
 *  - Fatigue / milestone cues focus on quality, not just cheerleading.
 */

import type { Phase } from "./exercise-registry";

// ── Tone ──────────────────────────────────────────────────────────────────────

/**
 * Coaching tone — forwarded to /api/tts where it adjusts ElevenLabs voice_settings.
 *
 *  "encouraging" → warmer, more expressive (user is fatiguing or struggling)
 *  "firm"        → controlled, authoritative (form is breaking down)
 *  "neutral"     → steady coaching (things are going well)
 */
export type CoachTone = "encouraging" | "firm" | "neutral";

// ── Exercise categorisation ────────────────────────────────────────────────────

type ExerciseCategory = "push" | "pull" | "squat" | "leg" | "core" | "default";

function categorise(name: string): ExerciseCategory {
  const n = name.toLowerCase();
  if (/push|dip|handstand/.test(n))                  return "push";
  if (/pull|row|shrug|muscle|chin|negative/.test(n)) return "pull";
  if (/squat|pistol|archer/.test(n))                 return "squat";
  if (/lunge|nordic|burpee/.test(n))                 return "leg";
  if (/plank|lever|flag|dragon/.test(n))             return "core";
  return "default";
}

// ── Shared anti-repetition helper ─────────────────────────────────────────────

const _cueIndexes: Partial<Record<string, number>> = {};

function pickCue<T>(idxKey: string, pool: T[]): T {
  if (pool.length === 1) return pool[0]!;
  const last = _cueIndexes[idxKey] ?? -1;
  let idx: number;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * pool.length);
    attempts++;
  } while (idx === last && attempts < 10);
  _cueIndexes[idxKey] = idx;
  return pool[idx]!;
}

// ── Phase transition cue tables ───────────────────────────────────────────────

export interface PhaseCue {
  text: string;
  tone: CoachTone;
}

// Each key is `"${fromPhase}→${toPhase}"`.
// Arrays allow cycling through variants so the coach sounds less robotic.
// All cues are instructional — they tell the user what to do, not just what happened.
const PHASE_CUES: Record<ExerciseCategory, Partial<Record<string, PhaseCue[]>>> = {
  push: {
    "up→down": [
      { text: "Controlled descent — keep elbows tracking back.",         tone: "neutral" },
      { text: "Slow it down — chest to floor, full range.",              tone: "neutral" },
      { text: "Lower with control — elbows at 45 degrees.",              tone: "neutral" },
      { text: "Eccentric phase — make it slow and deliberate.",          tone: "neutral" },
      { text: "Lower the chest — feel the stretch across the pecs.",     tone: "neutral" },
      { text: "Gravity's free — use it. Slow, controlled descent.",      tone: "neutral" },
    ],
    "down→up": [
      { text: "Drive the floor away — full extension at the top.",       tone: "encouraging" },
      { text: "Push through — lock out those elbows.",                   tone: "encouraging" },
      { text: "Explode up — squeeze chest at the top.",                  tone: "encouraging" },
      { text: "Press hard — full lockout, squeeze the triceps.",         tone: "encouraging" },
      { text: "Push the earth down — rise strong.",                      tone: "encouraging" },
      { text: "Drive up — don't stop until elbows are straight.",        tone: "encouraging" },
    ],
  },
  pull: {
    "bottom→top": [
      { text: "Pull from the lats — drive elbows to your hips.",         tone: "neutral"     },
      { text: "Lead with the chest, not the chin.",                      tone: "neutral"     },
      { text: "Initiate the pull with a shoulder depression.",           tone: "neutral"     },
      { text: "Engage the lats first — then pull hard.",                 tone: "neutral"     },
      { text: "Pull your elbows down and back — drive to the top.",      tone: "neutral"     },
      { text: "Scapula down, then pull — don't skip that setup.",        tone: "neutral"     },
    ],
    "top→bottom": [
      { text: "Lower with control — reach full dead hang.",              tone: "neutral" },
      { text: "Slow descent — feel the stretch at the bottom.",          tone: "neutral" },
      { text: "Control the negative — don't just drop.",                 tone: "neutral" },
      { text: "Elongate through the bottom — let the lats stretch.",     tone: "neutral" },
      { text: "Eccentric down — smooth and steady to dead hang.",        tone: "neutral" },
    ],
  },
  squat: {
    "up→down": [
      { text: "Send the hips back — break parallel.",                    tone: "neutral" },
      { text: "Knees track over toes — controlled descent.",             tone: "neutral" },
      { text: "Slow it down — sit back into depth.",                     tone: "neutral" },
      { text: "Hip crease below knees — own that bottom position.",      tone: "neutral" },
      { text: "Hinge the hips back — let the knees follow.",             tone: "neutral" },
      { text: "Chest tall, sit deep — own the descent.",                 tone: "neutral" },
    ],
    "down→up": [
      { text: "Drive through your heels — stand tall.",                  tone: "encouraging" },
      { text: "Push the ground away — squeeze glutes at the top.",       tone: "encouraging" },
      { text: "Full extension — lock out at the top.",                   tone: "encouraging" },
      { text: "Explode up — drive knees out as you rise.",               tone: "encouraging" },
      { text: "Rise hard — chest up, hips through.",                     tone: "encouraging" },
      { text: "Stand all the way up — don't short-change the lockout.",  tone: "encouraging" },
    ],
  },
  leg: {
    "up→down": [
      { text: "Control the descent — knee stays stable.",                tone: "neutral" },
      { text: "Lower slowly — feel the eccentric.",                      tone: "neutral" },
      { text: "Slow and controlled — load the working leg.",             tone: "neutral" },
      { text: "Knee tracks over the toe — own the descent.",             tone: "neutral" },
    ],
    "down→up": [
      { text: "Drive back up — powerful extension.",                     tone: "encouraging" },
      { text: "Push off the heel — strong finish.",                      tone: "encouraging" },
      { text: "Full hip extension — squeeze the glute at the top.",      tone: "encouraging" },
      { text: "Drive hard — don't let fatigue steal the lockout.",       tone: "encouraging" },
    ],
  },
  core: {
    "hold": [
      { text: "Breathe through it — posterior pelvic tilt.",             tone: "neutral" },
      { text: "Stay tight — squeeze glutes, brace the core.",            tone: "neutral" },
      { text: "Breathe — long exhale, don't hold your breath.",          tone: "neutral" },
      { text: "Tension everywhere — from fingertips to toes.",           tone: "neutral" },
      { text: "Slow exhale — stay rigid, don't let anything go.",        tone: "neutral" },
      { text: "Fight every second — don't give the position away.",      tone: "neutral" },
    ],
  },
  default: {
    "up→down": [
      { text: "Slow it down — controlled descent.",         tone: "neutral"     },
      { text: "Eccentric phase — feel every inch of it.",   tone: "neutral"     },
      { text: "Control the lowering — make it deliberate.", tone: "neutral"     },
    ],
    "down→up": [
      { text: "Full extension — drive all the way up.",       tone: "encouraging" },
      { text: "Push hard — don't stop short of lockout.",     tone: "encouraging" },
      { text: "Drive through — complete the movement.",       tone: "encouraging" },
    ],
    "bottom→top": [
      { text: "Pull through — complete the range.",             tone: "encouraging" },
      { text: "Drive to the top — finish the pull.",            tone: "encouraging" },
      { text: "Pull hard — all the way to the top position.",   tone: "encouraging" },
    ],
    "top→bottom": [
      { text: "Lower with control — full range of motion.", tone: "neutral" },
      { text: "Slow descent — own the eccentric.",          tone: "neutral" },
      { text: "Control all the way down — no dropping.",    tone: "neutral" },
    ],
  },
};

/**
 * Returns the phase-transition cue for the given exercise and phase change,
 * or null if no cue is configured for that transition.
 * Cycles through phrase variants on repeated calls (anti-repetition).
 */
export function getPhaseTransitionCue(
  exerciseName: string,
  fromPhase: Phase,
  toPhase: Phase,
): PhaseCue | null {
  const cat    = categorise(exerciseName);
  const key    = `${fromPhase}→${toPhase}`;
  const pool =
    PHASE_CUES[cat]?.[key] ??
    PHASE_CUES["default"]?.[key];
  if (!pool?.length) return null;

  return pickCue(`phase:${cat}:${key}`, pool as PhaseCue[]);
}

// ── Tier 2 — Motivational cues ────────────────────────────────────────────────
//
// Medium-priority, exercise-category-aware encouragement. Fired once per
// workout at a configurable rep milestone (e.g. halfway through a set).
// Uses the same anti-repetition logic as phase cues.

const MOTIVATIONAL_CUES: Record<ExerciseCategory, PhaseCue[]> = {
  push: [
    { text: "Chest game strong — keep the reps clean.",            tone: "encouraging" },
    { text: "Upper body working — don't rush, quality over speed.", tone: "encouraging" },
    { text: "Each rep builds the next — stay deliberate.",         tone: "encouraging" },
    { text: "Triceps are burning — that means it's working.",      tone: "encouraging" },
    { text: "You're building real strength — keep the form tight.",tone: "encouraging" },
    { text: "Steady pace — every clean rep counts double.",        tone: "encouraging" },
    { text: "Pecs and triceps firing — push through to the end.",  tone: "encouraging" },
  ],
  pull: [
    { text: "Back's working hard — keep pulling with the lats.",   tone: "encouraging" },
    { text: "Grip tight, lats engaged — you've got more in you.",  tone: "encouraging" },
    { text: "Pulling strength is rare — you're building it now.",  tone: "encouraging" },
    { text: "Every rep you earn on the bar pays off later.",        tone: "encouraging" },
    { text: "Don't cheat the range — full hang, full pull.",        tone: "encouraging" },
    { text: "Lat strength is calisthenics currency — keep going.",  tone: "encouraging" },
    { text: "Upper back is switching on — push through the burn.",  tone: "encouraging" },
  ],
  squat: [
    { text: "Legs driving hard — own every inch of the movement.",  tone: "encouraging" },
    { text: "Quad and glute power — you're building it right now.", tone: "encouraging" },
    { text: "Lower body strength is the foundation — stay with it.",tone: "encouraging" },
    { text: "Every deep squat builds hip mobility — keep going.",   tone: "encouraging" },
    { text: "Legs are made in the bottom position — stay there.",   tone: "encouraging" },
    { text: "Glutes firing — push through, strong finish coming.",  tone: "encouraging" },
    { text: "Strong legs carry you everywhere — keep earning them.",tone: "encouraging" },
  ],
  leg: [
    { text: "Legs under load — keep the control, don't rush.",     tone: "encouraging" },
    { text: "Single-leg strength is elite — you're building it.",  tone: "encouraging" },
    { text: "Balance and power — this is where gains happen.",     tone: "encouraging" },
    { text: "Working leg is doing the heavy lifting — trust it.",  tone: "encouraging" },
    { text: "Hip stability on point — keep it up.",                tone: "encouraging" },
    { text: "Unilateral work is hard — that's exactly the point.", tone: "encouraging" },
  ],
  core: [
    { text: "Core under tension — breathe and hold it together.",  tone: "encouraging" },
    { text: "Every second here makes your whole body stronger.",   tone: "encouraging" },
    { text: "Iron core builds everything else — fight for it.",    tone: "encouraging" },
    { text: "Midsection locked in — this is elite-level work.",    tone: "encouraging" },
    { text: "Core stability is the foundation of all movement.",   tone: "encouraging" },
    { text: "Abs and back working together — hold the position.",  tone: "encouraging" },
    { text: "This is where your planche starts — own this hold.",  tone: "encouraging" },
  ],
  default: [
    { text: "Solid work — keep the quality high.",                 tone: "encouraging" },
    { text: "You're putting in the reps — make each one count.",   tone: "encouraging" },
    { text: "Consistency compounds — every session matters.",      tone: "encouraging" },
    { text: "Hard work in silence — results speak later.",         tone: "encouraging" },
    { text: "This is how progress is built — one rep at a time.",  tone: "encouraging" },
    { text: "Stay focused — the movement deserves your attention.",tone: "encouraging" },
    { text: "Keep the standard high — you set the bar.",           tone: "encouraging" },
  ],
};

/**
 * Returns a Tier 2 motivational cue for the given exercise.
 * Anti-repetition: won't return the same cue twice in a row per category.
 */
export function getMotivationalCue(exerciseName: string): PhaseCue {
  const cat = categorise(exerciseName);
  return pickCue(`motivational:${cat}`, MOTIVATIONAL_CUES[cat]);
}

// ── Tier 3 — Flavor / goofy cues ─────────────────────────────────────────────
//
// Low-priority, lighthearted one-liners. Fired at most ONCE per set
// (on the first rep). Controlled by flavorCueFiredThisSet in workout.tsx.
// Aim: make the workout feel less mechanical, bring a smile.

const FLAVOR_CUES: Record<ExerciseCategory, PhaseCue[]> = {
  push: [
    { text: "Imagine the floor owes you money. Collect.",              tone: "encouraging" },
    { text: "Push-ups: gravity's way of saying hi. Say hi back.",      tone: "encouraging" },
    { text: "Each rep is a down-payment on your future arms.",          tone: "encouraging" },
    { text: "The floor has met its match. Go.",                        tone: "encouraging" },
    { text: "You and the floor. Old rivals. You always win.",          tone: "encouraging" },
    { text: "Triceps don't grow by watching. Let's go.",               tone: "encouraging" },
    { text: "This is where chest days are earned, not bought.",        tone: "encouraging" },
  ],
  pull: [
    { text: "Gravity's talking. Give it a rude answer.",               tone: "encouraging" },
    { text: "Pull like the bar is the only thing between you and glory.",tone: "encouraging" },
    { text: "Lats so wide you'll need a wider door.",                  tone: "encouraging" },
    { text: "The bar doesn't care how you feel. Pull anyway.",         tone: "encouraging" },
    { text: "Every pull-up is a conversation with your future self.",  tone: "encouraging" },
    { text: "Flight is for birds. You earn it the hard way.",          tone: "encouraging" },
    { text: "Bar won't come to you. You go to it.",                    tone: "encouraging" },
  ],
  squat: [
    { text: "Legs so strong even your shadow respects them.",          tone: "encouraging" },
    { text: "Depth is not optional. It's the whole point.",            tone: "encouraging" },
    { text: "Somewhere, a chair is nervous.",                          tone: "encouraging" },
    { text: "Quads, glutes, willpower. In that order.",                tone: "encouraging" },
    { text: "Go deep enough to find what you're made of.",             tone: "encouraging" },
    { text: "Squat like the floor is a finish line.",                  tone: "encouraging" },
    { text: "Your legs are asking for a challenge. Deliver.",          tone: "encouraging" },
  ],
  leg: [
    { text: "Legs that don't quit. Neither do you.",                   tone: "encouraging" },
    { text: "One leg, full effort. That's the deal.",                  tone: "encouraging" },
    { text: "Balance is just controlled falling. Fall forward.",       tone: "encouraging" },
    { text: "Unilateral means no hiding. Both sides earn it.",         tone: "encouraging" },
    { text: "Strong legs carry the whole day. Build them here.",       tone: "encouraging" },
    { text: "Wobble is just your body learning. Keep going.",          tone: "encouraging" },
  ],
  core: [
    { text: "Your abs are not decorative. Make them prove it.",        tone: "encouraging" },
    { text: "Iron core, iron will. Build both right here.",            tone: "encouraging" },
    { text: "Planks don't care about your feelings. Neither do I.",    tone: "encouraging" },
    { text: "Somewhere between 'I can't' and 'I did'. You're there.", tone: "encouraging" },
    { text: "This position is how legends are built. Quietly.",        tone: "encouraging" },
    { text: "The shake means it's working. That's just physics.",      tone: "encouraging" },
    { text: "Hold it. Because you can. And that's enough.",            tone: "encouraging" },
  ],
  default: [
    { text: "No shortcuts. Just reps and results.",                    tone: "encouraging" },
    { text: "You showed up. That's already the first win.",            tone: "encouraging" },
    { text: "Effort today, results later. Keep going.",                tone: "encouraging" },
    { text: "The version of you that quits doesn't live here.",        tone: "encouraging" },
    { text: "Progress is quiet. Keep making it anyway.",               tone: "encouraging" },
    { text: "One more rep added to your story. Make it a good one.",   tone: "encouraging" },
    { text: "Training is the one argument where showing up wins.",     tone: "encouraging" },
  ],
};

/**
 * Returns a Tier 3 flavor cue for the given exercise.
 * Anti-repetition: won't return the same cue twice in a row per category.
 * Call at most once per set (gate with `flavorCueFiredThisSet` in workout.tsx).
 */
export function getFlavorCue(exerciseName: string): PhaseCue {
  const cat = categorise(exerciseName);
  return pickCue(`flavor:${cat}`, FLAVOR_CUES[cat]);
}

// ── Milestone / fatigue cues ──────────────────────────────────────────────────

const MILESTONE_CUES: PhaseCue[] = [
  { text: "Last one — full depth, full extension.",          tone: "encouraging" },
  { text: "One more — keep the form tight.",                 tone: "encouraging" },
  { text: "Final rep — make it your cleanest one.",          tone: "firm"        },
  { text: "Grind it out — don't sacrifice the form.",        tone: "firm"        },
  { text: "Almost there — give it everything on this last.", tone: "encouraging" },
  { text: "Final rep — treat it like the first one.",        tone: "firm"        },
  { text: "One more quality rep — that's all it takes.",     tone: "encouraging" },
  { text: "Last rep decides who you are today. Make it.",    tone: "firm"        },
];

/**
 * Returns a fatigue-stage encouragement cue (anti-repetition).
 * Call this when the user's rep pace has slowed significantly.
 */
export function getMilestoneCue(): PhaseCue {
  return pickCue("milestone", MILESTONE_CUES);
}

// ── Safety cues ───────────────────────────────────────────────────────────────

/**
 * Safety cues — the highest priority tier.
 * Use sparingly; only for genuine injury-risk situations.
 * These interrupt active playback via CUE_PRIORITY.SAFETY.
 */
export const SAFETY_CUES: PhaseCue[] = [
  { text: "Stop if you feel any sharp pain — don't push through it.",   tone: "firm" },
  { text: "Pain is a signal — rest and reset before continuing.",        tone: "firm" },
  { text: "Listen to your body — stop if something doesn't feel right.",tone: "firm" },
];

/** Returns the next safety cue (anti-repetition). */
export function getSafetyCue(): PhaseCue {
  return pickCue("safety", SAFETY_CUES);
}

// ── Active Pacer cue sequences ────────────────────────────────────────────────

export interface PacerCue {
  text: string;
  tone: CoachTone;
  /** Delay after phase start before speaking this cue, in milliseconds. */
  delayMs: number;
}

/**
 * Tempo cues queued when the user begins their descending phase.
 * Three cues spaced 1 s apart give a 3-beat controlled descent.
 */
export const DESCEND_PACER_CUES: PacerCue[] = [
  { text: "Down...", tone: "neutral", delayMs: 0    },
  { text: "Two...",  tone: "neutral", delayMs: 1000 },
  { text: "One...",  tone: "neutral", delayMs: 1800 },
];

/**
 * Cue fired immediately when the user reverses into the ascending phase.
 */
export const ASCEND_PACER_CUE: PacerCue = {
  text: "...and Up!",
  tone: "encouraging",
  delayMs: 0,
};

// ── Tone from form score ──────────────────────────────────────────────────────

/**
 * Maps the current blended form score → coaching tone.
 *
 *  ≥ 80  → neutral     (good form, on track)
 *  50–79 → encouraging (struggling but not breaking down)
 *  < 50  → firm        (form is genuinely breaking down)
 */
export function toneFromScore(score: number): CoachTone {
  if (score >= 80) return "neutral";
  if (score >= 50) return "encouraging";
  return "firm";
}
