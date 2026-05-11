/**
 * CoachingEngine — Phase-based cues, Active Pacer logic, and tone-aware coaching.
 *
 * Responsible for:
 *  1. Choosing the right phrase when a movement phase changes
 *     (e.g. "Controlled descent — chest to floor." on descent start).
 *  2. Providing a sequence of tempo cues for the Active Pacer feature.
 *  3. Milestone cues when the user is fatiguing ("Last one — make it count.").
 *  4. Mapping current blended form score → coaching tone for ElevenLabs expressiveness.
 *  5. Safety cues (highest priority) — used sparingly for injury-prevention warnings.
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

// ── Phase transition cue tables ───────────────────────────────────────────────

interface PhaseCue {
  text: string;
  tone: CoachTone;
}

// Each key is `"${fromPhase}→${toPhase}"`.
// Arrays allow cycling through variants so the coach sounds less robotic.
// All cues are instructional — they tell the user what to do, not just what happened.
const PHASE_CUES: Record<ExerciseCategory, Partial<Record<string, PhaseCue[]>>> = {
  push: {
    "up→down": [
      { text: "Controlled descent — keep elbows tracking back.",  tone: "neutral"  },
      { text: "Slow it down — chest to floor, full range.",       tone: "neutral"  },
      { text: "Lower with control — elbows at 45 degrees.",       tone: "neutral"  },
    ],
    "down→up": [
      { text: "Drive the floor away — full extension at the top.",  tone: "encouraging" },
      { text: "Push through — lock out those elbows.",             tone: "encouraging" },
      { text: "Explode up — squeeze chest at the top.",            tone: "encouraging" },
    ],
  },
  pull: {
    "bottom→top": [
      { text: "Pull from the lats — drive elbows to your hips.",  tone: "neutral"      },
      { text: "Lead with the chest, not the chin.",               tone: "neutral"      },
      { text: "Initiate the pull with a shoulder depression.",    tone: "neutral"      },
    ],
    "top→bottom": [
      { text: "Lower with control — reach full dead hang.",       tone: "neutral"  },
      { text: "Slow descent — feel the stretch at the bottom.",   tone: "neutral"  },
    ],
  },
  squat: {
    "up→down": [
      { text: "Send the hips back — break parallel.",             tone: "neutral"  },
      { text: "Knees track over toes — controlled descent.",      tone: "neutral"  },
      { text: "Slow it down — sit back into depth.",              tone: "neutral"  },
    ],
    "down→up": [
      { text: "Drive through your heels — stand tall.",           tone: "encouraging" },
      { text: "Push the ground away — squeeze glutes at the top.",tone: "encouraging" },
      { text: "Full extension — lock out at the top.",            tone: "encouraging" },
    ],
  },
  leg: {
    "up→down": [
      { text: "Control the descent — knee stays stable.",         tone: "neutral"  },
      { text: "Lower slowly — feel the eccentric.",               tone: "neutral"  },
    ],
    "down→up": [
      { text: "Drive back up — powerful extension.",              tone: "encouraging" },
      { text: "Push off the heel — strong finish.",               tone: "encouraging" },
    ],
  },
  core: {
    "hold": [
      { text: "Breathe through it — posterior pelvic tilt.",      tone: "neutral"  },
      { text: "Stay tight — squeeze glutes, brace the core.",     tone: "neutral"  },
      { text: "Breathe — long exhale, don't hold your breath.",   tone: "neutral"  },
    ],
  },
  default: {
    "up→down":    [{ text: "Slow it down — controlled descent.",       tone: "neutral"      }],
    "down→up":    [{ text: "Full extension — drive all the way up.",    tone: "encouraging"  }],
    "bottom→top": [{ text: "Pull through — complete the range.",        tone: "encouraging"  }],
    "top→bottom": [{ text: "Lower with control — full range of motion.",tone: "neutral"      }],
  },
};

// Per-key cycling index so the same phrase isn't repeated every rep.
const cueIndexes: Partial<Record<string, number>> = {};

/**
 * Returns the phase-transition cue for the given exercise and phase change,
 * or null if no cue is configured for that transition.
 * Cycles through phrase variants on repeated calls.
 */
export function getPhaseTransitionCue(
  exerciseName: string,
  fromPhase: Phase,
  toPhase: Phase,
): PhaseCue | null {
  const cat    = categorise(exerciseName);
  const key    = `${fromPhase}→${toPhase}`;
  const catCues =
    PHASE_CUES[cat]?.[key] ??
    PHASE_CUES["default"]?.[key];
  if (!catCues?.length) return null;

  const idxKey = `${cat}:${key}`;
  const idx    = cueIndexes[idxKey] ?? 0;
  cueIndexes[idxKey] = (idx + 1) % catCues.length;
  return catCues[idx];
}

// ── Milestone / fatigue cues ──────────────────────────────────────────────────

const MILESTONE_CUES: PhaseCue[] = [
  { text: "Last one — full depth, full extension.",  tone: "encouraging" },
  { text: "One more — keep the form tight.",         tone: "encouraging" },
  { text: "Final rep — make it your cleanest one.",  tone: "firm"        },
  { text: "Grind it out — don't sacrifice the form.",tone: "firm"        },
];
let _milestoneIdx = 0;

/**
 * Returns a fatigue-stage encouragement cue (cycles through variants).
 * Call this when the user's rep pace has slowed significantly.
 */
export function getMilestoneCue(): PhaseCue {
  const cue = MILESTONE_CUES[_milestoneIdx % MILESTONE_CUES.length];
  _milestoneIdx++;
  return cue;
}

// ── Safety cues ───────────────────────────────────────────────────────────────

/**
 * Safety cues — the highest priority tier.
 * Use sparingly; only for genuine injury-risk situations.
 * These interrupt active playback via CUE_PRIORITY.SAFETY.
 */
export const SAFETY_CUES: PhaseCue[] = [
  { text: "Stop if you feel any sharp pain — don't push through it.",  tone: "firm" },
  { text: "Pain is a signal — rest and reset before continuing.",       tone: "firm" },
  { text: "Listen to your body — stop if something doesn't feel right.",tone: "firm" },
];
let _safetyIdx = 0;

/** Returns the next safety cue (cycles). */
export function getSafetyCue(): PhaseCue {
  const cue = SAFETY_CUES[_safetyIdx % SAFETY_CUES.length];
  _safetyIdx++;
  return cue;
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
