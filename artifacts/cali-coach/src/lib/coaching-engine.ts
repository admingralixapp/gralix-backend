/**
 * CoachingEngine — Phase-based cues, Active Pacer logic, and tone-aware coaching.
 *
 * Responsible for:
 *  1. Choosing the right phrase when a movement phase changes
 *     (e.g. "Take a breath... and lower down." on descent start).
 *  2. Providing a sequence of tempo cues for the Active Pacer feature.
 *  3. Milestone cues when the user is fatiguing ("Last one, make it your best form.").
 *  4. Mapping current blended form score → coaching tone for ElevenLabs expressiveness.
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
  if (/push|dip|handstand/.test(n))             return "push";
  if (/pull|row|shrug|muscle|chin|negative/.test(n)) return "pull";
  if (/squat|pistol|archer/.test(n))            return "squat";
  if (/lunge|nordic|burpee/.test(n))            return "leg";
  if (/plank|lever|flag|dragon/.test(n))        return "core";
  return "default";
}

// ── Phase transition cue tables ───────────────────────────────────────────────

interface PhaseCue {
  text: string;
  tone: CoachTone;
}

// Each key is `"${fromPhase}→${toPhase}"`.
// Arrays allow cycling through variants so the coach sounds less robotic.
const PHASE_CUES: Record<ExerciseCategory, Partial<Record<string, PhaseCue[]>>> = {
  push: {
    "up→down": [
      { text: "Take a breath... and lower down.",      tone: "neutral" },
      { text: "Controlled descent — chest to floor.",  tone: "neutral" },
      { text: "Slow it down — make every inch count.", tone: "neutral" },
    ],
    "down→up": [
      { text: "Deep enough — now drive back up!",      tone: "encouraging" },
      { text: "Push the floor away!",                  tone: "encouraging" },
      { text: "Lock it out — all the way up!",         tone: "encouraging" },
    ],
  },
  pull: {
    "bottom→top": [
      { text: "Take a breath... and pull!",            tone: "neutral" },
      { text: "Engage those lats — here we go.",       tone: "neutral" },
      { text: "Pull from the back, not the arms.",     tone: "neutral" },
    ],
    "top→bottom": [
      { text: "Lower with control — full extension.",  tone: "neutral" },
      { text: "Dead hang — fully extend.",             tone: "neutral" },
    ],
  },
  squat: {
    "up→down": [
      { text: "Take a breath... and sit back into it.", tone: "neutral" },
      { text: "Send the hips back — controlled.",       tone: "neutral" },
      { text: "Nice and slow — break parallel.",        tone: "neutral" },
    ],
    "down→up": [
      { text: "Deep enough — drive those heels down!",  tone: "encouraging" },
      { text: "Stand tall — squeeze at the top.",       tone: "encouraging" },
      { text: "Push the ground away!",                  tone: "encouraging" },
    ],
  },
  leg: {
    "up→down": [
      { text: "Lower with control.",                   tone: "neutral" },
    ],
    "down→up": [
      { text: "Drive back up — strong finish!",        tone: "encouraging" },
    ],
  },
  core: {
    // Static holds don't have up/down transitions — cues handled by hold timer.
    "hold": [
      { text: "Breathe — don't hold your breath.",    tone: "neutral" },
      { text: "You're in the zone — hold it.",        tone: "neutral" },
    ],
  },
  default: {
    "up→down":    [{ text: "Take a breath... and lower down.",   tone: "neutral" }],
    "down→up":    [{ text: "Deep enough — now drive back up!",   tone: "encouraging" }],
    "bottom→top": [{ text: "Pull through — all the way!",        tone: "encouraging" }],
    "top→bottom": [{ text: "Lower with control.",                 tone: "neutral" }],
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

// ── Milestone / set-end cues ──────────────────────────────────────────────────

const MILESTONE_CUES: PhaseCue[] = [
  { text: "Last one — make it your best form.",  tone: "encouraging" },
  { text: "One more — perfect form now.",        tone: "encouraging" },
  { text: "Final push — give it everything.",    tone: "firm" },
];
let _milestoneIdx = 0;

/**
 * Returns a "last rep" encouragement cue (cycles through variants).
 * Call this when the user's rep pace has slowed significantly, indicating
 * they are near the end of their working set.
 */
export function getMilestoneCue(): PhaseCue {
  const cue = MILESTONE_CUES[_milestoneIdx % MILESTONE_CUES.length];
  _milestoneIdx++;
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
  { text: "Down...", tone: "neutral",     delayMs: 0    },
  { text: "Two...",  tone: "neutral",     delayMs: 1000 },
  { text: "One...",  tone: "neutral",     delayMs: 1800 },
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
 *  ≥ 80  → neutral   (good form, on track)
 *  50–79 → encouraging (struggling but not breaking down)
 *  < 50  → firm       (form is genuinely breaking down)
 */
export function toneFromScore(score: number): CoachTone {
  if (score >= 80) return "neutral";
  if (score >= 50) return "encouraging";
  return "firm";
}
