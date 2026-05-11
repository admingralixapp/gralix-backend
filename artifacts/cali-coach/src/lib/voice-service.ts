/**
 * voiceService — ElevenLabs streaming TTS via new Audio() element
 *
 * Architecture for paid profiles (Monk, Noir Detective, Rio Flair, …):
 *   1. enqueueCue() is the primary entry point from workout.tsx.
 *   2. The queue guarantees atomic playback: the current sentence always plays
 *      to completion before the next cue starts.  Only SAFETY cues interrupt.
 *   3. A SILENCE_BUFFER_MS gap is enforced after every cue.
 *   4. A new Audio() element is created with src = /api/tts/stream?...
 *      (GET endpoint that does LLM personality injection + ElevenLabs TTS).
 *   5. NO fallback to browser TTS.  Silence = bug, not fallback.
 *
 * Architecture for free profiles (classic, classic_female):
 *   → browser Web Speech API only, no ElevenLabs, no network cost.
 *
 * Audio Ducking:
 *   Non-speech audio should connect through getDuckingGain() → destination.
 *   The ducking gain is ramped when a cue starts/ends.
 */

// ─── Mute flag ────────────────────────────────────────────────────────────────

let _muted = false;

export function setVoiceMuted(muted: boolean): void {
  _muted = muted;
}

// ─── Active voice profile ─────────────────────────────────────────────────────

let _activeProfileId: string = "classic";

export function setActiveVoiceProfile(profileId: string): void {
  _activeProfileId = profileId;
  console.log(`[CaliCoach Voice] Active profile set → "${profileId}"`);
}

// ─── Free-tier profiles (browser Web Speech only) ────────────────────────────
// classic and classic_female now use ElevenLabs, so they are NOT in this set.
// Only add a profile here if it genuinely has no ElevenLabs voice ID and must
// fall back to the browser Web Speech API.

const FREE_VOICE_PROFILES = new Set<string>([]);

// ─── Constants ────────────────────────────────────────────────────────────────

const DUCK_TARGET    = 0.3;
const DUCK_RAMP_DOWN = 0.08;
const DUCK_RAMP_UP   = 0.5;
const FULL_GAIN      = 1.0;

/**
 * Dead time (ms) between consecutive cues.
 * Prevents the coach from talking continuously; gives the user time to process.
 */
const SILENCE_BUFFER_MS = 900;

// ─── AudioContext + GainNode singletons (for non-speech ducking only) ─────────

let _ctx: AudioContext | null = null;
let _duckingGain: GainNode | null = null;
let _speechGain: GainNode | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
    _duckingGain = null;
    _speechGain  = null;
  }
  return _ctx;
}

function getGains(): { ac: AudioContext; duckGain: GainNode; speechGain: GainNode } {
  const ac = getCtx();
  if (!_duckingGain) {
    _duckingGain = ac.createGain();
    _duckingGain.gain.value = FULL_GAIN;
    _duckingGain.connect(ac.destination);
  }
  if (!_speechGain) {
    _speechGain = ac.createGain();
    _speechGain.gain.value = FULL_GAIN;
    _speechGain.connect(ac.destination);
  }
  return { ac, duckGain: _duckingGain, speechGain: _speechGain };
}

export function getAudioContext(): AudioContext {
  return getCtx();
}

export function getDuckingGain(): GainNode {
  return getGains().duckGain;
}

// ─── Ducking helpers ──────────────────────────────────────────────────────────

function applyDuck(ac: AudioContext, duckGain: GainNode): void {
  const now = ac.currentTime;
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setValueAtTime(duckGain.gain.value, now);
  duckGain.gain.linearRampToValueAtTime(DUCK_TARGET, now + DUCK_RAMP_DOWN);
}

function releaseDuck(ac: AudioContext, duckGain: GainNode): void {
  const now = ac.currentTime;
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setValueAtTime(duckGain.gain.value, now);
  duckGain.gain.linearRampToValueAtTime(FULL_GAIN, now + DUCK_RAMP_UP);
}

// ─── MediaSession ─────────────────────────────────────────────────────────────

function requestAudioFocus(): void {
  try {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  } catch { /* ignore */ }
}

function abandonAudioFocus(): void {
  try {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  } catch { /* ignore */ }
}

// ─── Current Audio element (paid profiles) ────────────────────────────────────

let _currentAudioEl: HTMLAudioElement | null = null;

function stopCurrentAudio(): void {
  if (_currentAudioEl) {
    try {
      // Null handlers BEFORE clearing src — prevents spurious onerror("Empty src attribute").
      _currentAudioEl.onerror  = null;
      _currentAudioEl.onended  = null;
      _currentAudioEl.pause();
      _currentAudioEl.src = "";
    } catch { /* ignore */ }
    _currentAudioEl = null;
  }
}

// ─── Locale helpers ───────────────────────────────────────────────────────────

import { resolveElevenLabsLang } from "./coach-language.js";
import { getTestPhrase } from "./cue-translations.js";

let _speechLang = "en-US";

/**
 * Read the active coach language live from localStorage at the moment of use.
 */
function getLiveCoachLang(): string {
  try {
    const stored = localStorage.getItem("calicoach_lang");
    return resolveElevenLabsLang(stored ?? "en");
  } catch {
    return "en";
  }
}

/**
 * Called by Settings / Workout whenever the UI language changes.
 */
export function setVoiceLanguage(bcp47: string): void {
  _speechLang = bcp47;
  try {
    localStorage.setItem("calicoach_lang", bcp47);
  } catch { /* ignore */ }
}

// ─── Browser TTS (FREE profiles ONLY) ────────────────────────────────────────

function browserSpeakForProfile(text: string, profileId: string): void {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = 1.1;
    u.pitch  = profileId === "classic_female" ? 1.5 : 0.95;
    u.volume = 1;
    u.lang   = _speechLang;

    if (profileId === "classic_female") {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          v.lang.startsWith(_speechLang.split("-")[0] ?? "en") &&
          /female|woman|girl|zira|samantha|karen|moira|tessa|fiona|victoria/i.test(v.name),
      );
      if (femaleVoice) u.voice = femaleVoice;
    }

    const { ac, duckGain } = getGains();
    if (ac.state !== "closed") applyDuck(ac, duckGain);
    requestAudioFocus();

    u.onend = () => {
      const { ac: ac2, duckGain: dg } = getGains();
      if (ac2.state !== "closed") releaseDuck(ac2, dg);
      abandonAudioFocus();
    };
    u.onerror = () => {
      const { ac: ac2, duckGain: dg } = getGains();
      if (ac2.state !== "closed") releaseDuck(ac2, dg);
      abandonAudioFocus();
    };

    window.speechSynthesis.speak(u);
  } catch {
    // Speech synthesis not available — silent fail.
  }
}

// ─── Paid-profile playback via new Audio() ────────────────────────────────────
/**
 * Creates a new Audio() element pointing at GET /api/tts/stream.
 * Does NOT stop any currently-playing audio — the caller (queue) guarantees
 * exclusivity.  Returns a Promise that resolves when playback finishes.
 */
function _speakWithAudioElement(
  text: string,
  profileId: string,
  exerciseName: string,
  cacheKey: string,
): Promise<void> {
  const params = new URLSearchParams({
    text:         text.slice(0, 500),
    profile:      profileId,
    exerciseName: exerciseName,
    cacheKey:     cacheKey,
    language:     getLiveCoachLang(),
  });

  const url = `/api/tts/stream?${params.toString()}`;
  console.log(`[CaliCoach Voice] new Audio() → ${url.slice(0, 120)}`);

  const audio = new Audio(url);
  audio.volume = 1.0;
  _currentAudioEl = audio;

  const { ac, duckGain } = getGains();
  if (ac.state !== "closed") applyDuck(ac, duckGain);
  requestAudioFocus();

  return new Promise<void>((resolve, reject) => {
    audio.play().then(() => {
      console.log(`[CaliCoach Voice] ▶️  Audio element playing — profile="${profileId}"`);
    }).catch((err: unknown) => {
      console.error(`[CaliCoach Voice] ❌ Audio element play() failed:`, err);
      if (_currentAudioEl === audio) _currentAudioEl = null;
      const { ac: ac2, duckGain: dg } = getGains();
      if (ac2.state !== "closed") releaseDuck(ac2, dg);
      abandonAudioFocus();
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    audio.onended = () => {
      console.log(`[CaliCoach Voice] ✅ Audio element finished — profile="${profileId}"`);
      if (_currentAudioEl === audio) _currentAudioEl = null;
      const { ac: ac2, duckGain: dg } = getGains();
      if (ac2.state !== "closed") releaseDuck(ac2, dg);
      abandonAudioFocus();
      resolve();
    };

    audio.onerror = () => {
      const code = (audio.error?.code ?? -1).toString();
      const msg  = audio.error?.message ?? "unknown";
      console.error(`[CaliCoach Voice] ❌ Audio element error code=${code}: ${msg}`);
      if (_currentAudioEl === audio) _currentAudioEl = null;
      const { ac: ac2, duckGain: dg } = getGains();
      if (ac2.state !== "closed") releaseDuck(ac2, dg);
      abandonAudioFocus();
      reject(new Error(`ElevenLabs audio error (code=${code}): ${msg}`));
    };
  });
}

// ─── Priority Queue ───────────────────────────────────────────────────────────

/**
 * Priority levels for the coaching cue queue.
 * Lower number = higher priority.
 *
 *  SAFETY       — Pain/injury warnings; immediately interrupts any active cue.
 *  FORM         — Form corrections; waits its turn but wins over phase/motivational.
 *  PHASE        — Phase-transition and pacer cues.
 *  MOTIVATIONAL — Rep counts, encouragement, milestone cues.
 */
export const CUE_PRIORITY = {
  SAFETY:       0,
  FORM:         1,
  PHASE:        2,
  MOTIVATIONAL: 3,
} as const;

export type CuePriority = typeof CUE_PRIORITY[keyof typeof CUE_PRIORITY];

export interface QueuedCue {
  text:         string;
  profileId:    string;
  exerciseName: string;
  cacheKey:     string;
  priority:     CuePriority;
  tone:         "encouraging" | "firm" | "neutral";
}

/** Highest-priority cue accumulated while playback is in progress. */
let _pendingCue:   QueuedCue | null = null;
/** True while a cue is actively playing (ElevenLabs request + audio duration). */
let _busy          = false;
/** setTimeout handle for the post-cue silence buffer. */
let _silenceTimer: ReturnType<typeof setTimeout> | null = null;

function _clearSilenceTimer(): void {
  if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
}

function _scheduleFlush(): void {
  if (_silenceTimer) return;
  _silenceTimer = setTimeout(() => {
    _silenceTimer = null;
    const cue = _pendingCue;
    _pendingCue = null;
    if (cue) void _executeCue(cue);
  }, SILENCE_BUFFER_MS);
}

async function _executeCue(cue: QueuedCue): Promise<void> {
  _busy = true;
  try {
    if (FREE_VOICE_PROFILES.has(cue.profileId)) {
      browserSpeakForProfile(cue.text, cue.profileId);
      // Browser TTS has no reliable completion callback across all browsers.
      // Wait a fixed upper-bound so the silence buffer still fires correctly.
      await new Promise<void>(res => setTimeout(res, 3500));
    } else {
      await _speakWithAudioElement(cue.text, cue.profileId, cue.exerciseName, cue.cacheKey);
    }
  } catch {
    // Errors already logged inside the underlying functions.
  }
  _busy = false;
  _scheduleFlush();
}

/**
 * Primary public API — enqueue a coaching cue with explicit priority.
 *
 * Guarantees:
 *  - Atomic: the current sentence always plays to completion.
 *  - Silence buffer: SILENCE_BUFFER_MS gap between consecutive cues.
 *  - Priority: while busy, the slot is held for the highest-priority pending cue.
 *  - Safety interrupt: CUE_PRIORITY.SAFETY stops active audio immediately.
 */
export function enqueueCue(cue: QueuedCue): void {
  if (_muted) return;

  // Safety cues: interrupt everything — pain warnings cannot wait.
  if (cue.priority === CUE_PRIORITY.SAFETY) {
    _clearSilenceTimer();
    _pendingCue = null;
    stopCurrentAudio();
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    _busy = false;
    void _executeCue(cue);
    return;
  }

  // Idle with no silence buffer → play immediately.
  if (!_busy && !_silenceTimer) {
    void _executeCue(cue);
    return;
  }

  // Busy or in silence buffer → hold the highest-priority pending cue.
  // Lower priority number = more important.
  if (!_pendingCue || cue.priority < _pendingCue.priority) {
    _pendingCue = cue;
  }
}

// ─── Legacy convenience wrappers (used by shop/test-voice flows) ──────────────

/**
 * Speak a general coaching cue.
 * Workout code should prefer enqueueCue() for explicit priority control.
 */
export function speak(text: string, tone: "encouraging" | "firm" | "neutral" = "neutral", priority: CuePriority = CUE_PRIORITY.MOTIVATIONAL): void {
  if (_muted) return;
  const lang = getLiveCoachLang();
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const cacheKey = lang !== "en" ? `${lang}:${slug(text)}` : `general:${slug(text)}`;

  enqueueCue({
    text,
    profileId:    _activeProfileId,
    exerciseName: "Coaching",
    cacheKey,
    priority,
    tone,
  });
}

/**
 * Speak a form-correction coaching cue with AI personality injection.
 */
export function speakCue(
  exerciseName: string,
  audioCue: string,
  profileId: string,
  cacheKey: string,
  priority: CuePriority = CUE_PRIORITY.FORM,
): void {
  if (_muted) return;

  enqueueCue({
    text:         audioCue,
    profileId,
    exerciseName,
    cacheKey,
    priority,
    tone:         "neutral",
  });
}

/**
 * Play a short sample cue for a personality so the user can preview it.
 * Called by the Shop "Test Voice" buttons.
 */
export function testCoachVoice(profileId: string, label?: string): Promise<void> {
  const SAMPLE_CUES: Record<string, string> = {
    classic:        "Keep your core tight and drive through that rep — great work, keep it up!",
    classic_female: "Stay focused, breathe through the movement — you're doing amazing!",
    sergeant:       "Get those hips up, recruit! You're sagging like a wet noodle!",
    sensei:         "The body follows the mind — align your core, find stillness.",
    cyborg:         "Hip angle deviation detected: 12 degrees below optimal. Correct now.",
    monk:           "Breathe in. Let the Ascension begin. Flow into perfect alignment.",
    noir_detective: "Those hips, kid — dropping like a bad lead in a cold case.",
    ogre:           "Smash down! Strong tiny-human! OGRE IS PROUD.",
    olympic_coach:  "Eccentric control is lacking — engage your v-taper and drive bio-mechanically.",
    aussie_legend:  "Mate, you're doing ripper work — stoked to see that! Reckon you've got this!",
    retro_gamer:    "COMBO BREAKER! Power-up your core or it's game over — finish that rep!",
    rio_flair:      "Vamos! Keep your chest up and drive through with power — Ginga is in your soul!",
  };

  const activeLang = getLiveCoachLang();

  const sampleText =
    activeLang !== "en"
      ? getTestPhrase(activeLang)
      : (SAMPLE_CUES[profileId] ??
         "Great form — keep your core tight and breathe through the movement.");

  console.log(
    `%c[CaliCoach Voice] Sending to ElevenLabs: "${sampleText}" in "${activeLang}"`,
    "color: #22c55e; font-weight: bold;",
  );

  if (FREE_VOICE_PROFILES.has(profileId)) {
    console.log(`[CaliCoach Voice] testCoachVoice() → FREE profile="${profileId}" — browser TTS (lang: ${activeLang})`);
    browserSpeakForProfile(sampleText, profileId);
    return Promise.resolve();
  }

  const voiceName = label ?? profileId;
  console.log(`[CaliCoach Voice] 🎙️ profile="${profileId}" (${voiceName}) → /api/tts/stream?language=${activeLang}`);

  // Test-voice bypasses the queue and stops current audio directly,
  // so the user gets immediate feedback when previewing profiles in the Shop.
  stopCurrentAudio();
  return _speakWithAudioElement(sampleText, profileId, "Demo", `${profileId}:test_${Date.now()}`);
}

/**
 * Stop all in-progress audio, clear the queue, and restore ducking.
 * Called when a workout ends or the user navigates away.
 */
export function cancelSpeech(): void {
  // Clear the queue so no pending cue fires after cancel.
  _clearSilenceTimer();
  _pendingCue = null;
  _busy = false;

  stopCurrentAudio();

  try {
    window.speechSynthesis.cancel();
  } catch { /* ignore */ }

  try {
    if (_duckingGain && _ctx && _ctx.state !== "closed") {
      const now = _ctx.currentTime;
      _duckingGain.gain.cancelScheduledValues(now);
      _duckingGain.gain.setValueAtTime(FULL_GAIN, now);
    }
  } catch { /* ignore */ }

  abandonAudioFocus();
}

/**
 * Clear any client-side audio cache.
 * (Kept for API compatibility — cache now lives on the server.)
 */
export function clearCueCache(): void {
  // No-op: caching is server-side. Browser HTTP cache handles repeat GET requests.
}
