/**
 * voiceService — ElevenLabs streaming TTS via new Audio() element
 *
 * Architecture for paid profiles (Sergeant, Sensei, Cyborg, …):
 *   1. speak() / speakCue() / testCoachVoice() are called by workout.tsx.
 *   2. window.speechSynthesis is HARD-CANCELLED at every entry point.
 *   3. A new Audio() element is created with src = /api/tts/stream?...
 *      (GET endpoint that does LLM personality injection + ElevenLabs TTS).
 *   4. audio.volume = 1.0, audio.play() — browser handles streaming.
 *   5. NO fallback to browser TTS for paid profiles. Silence = bug, not fallback.
 *
 * Architecture for free profiles (classic, classic_female):
 *   → browser Web Speech API only, no ElevenLabs, no network cost.
 *
 * Audio Ducking:
 *   Non-speech audio should connect through getDuckingGain() → destination.
 *   The ducking gain is ramped when a cue starts/ends.
 *   (Ducking is applied via the AudioContext for non-speech sources only;
 *    the Audio element plays at full volume independently.)
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
  console.log(`[CaliCoach Voice] Active profile set → "${profileId}" (free: ${FREE_VOICE_PROFILES.has(profileId)})`);
}

// ─── Free-tier profiles (browser Web Speech only) ────────────────────────────

const FREE_VOICE_PROFILES = new Set(["classic", "classic_female"]);

// ─── Constants ────────────────────────────────────────────────────────────────

const DUCK_TARGET    = 0.3;
const DUCK_RAMP_DOWN = 0.08;
const DUCK_RAMP_UP   = 0.5;
const FULL_GAIN      = 1.0;

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
      _currentAudioEl.pause();
      _currentAudioEl.src = "";
    } catch { /* ignore */ }
    _currentAudioEl = null;
  }
}

// ─── Locale for browser TTS ───────────────────────────────────────────────────

let _speechLang = "en-US";

export function setVoiceLanguage(bcp47: string): void {
  _speechLang = bcp47;
}

// ─── Browser TTS (free profiles only) ────────────────────────────────────────

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
 * The server does LLM personality injection + ElevenLabs TTS, returns audio/mpeg.
 * Server-side caching means repeat cues are served in ~2 ms.
 *
 * NO fallback to browser TTS. If this fails, the result is silence.
 * Check the browser Network tab or console for errors.
 */
function _speakWithAudioElement(
  text: string,
  profileId: string,
  exerciseName: string,
  cacheKey: string,
): void {
  // Hard-kill any speechSynthesis that may be running from any source.
  window.speechSynthesis.cancel();

  // Stop previous audio element.
  stopCurrentAudio();

  const params = new URLSearchParams({
    text:         text.slice(0, 500),
    profile:      profileId,
    exerciseName: exerciseName,
    cacheKey:     cacheKey,
  });

  const url = `/api/tts/stream?${params.toString()}`;
  console.log(`[CaliCoach Voice] new Audio() → ${url.slice(0, 120)}`);

  const audio = new Audio(url);
  audio.volume = 1.0;
  _currentAudioEl = audio;

  const { ac, duckGain } = getGains();
  if (ac.state !== "closed") applyDuck(ac, duckGain);
  requestAudioFocus();

  audio.play().then(() => {
    console.log(`[CaliCoach Voice] ▶️  Audio element playing — profile="${profileId}"`);
  }).catch((err: unknown) => {
    console.error(`[CaliCoach Voice] ❌ Audio element play() failed:`, err);
    // NO BROWSER TTS FALLBACK — silence so the bug is visible.
    if (_currentAudioEl === audio) _currentAudioEl = null;
    const { ac: ac2, duckGain: dg } = getGains();
    if (ac2.state !== "closed") releaseDuck(ac2, dg);
    abandonAudioFocus();
  });

  audio.onended = () => {
    console.log(`[CaliCoach Voice] ✅ Audio element finished — profile="${profileId}"`);
    if (_currentAudioEl === audio) _currentAudioEl = null;
    const { ac: ac2, duckGain: dg } = getGains();
    if (ac2.state !== "closed") releaseDuck(ac2, dg);
    abandonAudioFocus();
  };

  audio.onerror = () => {
    const code = (audio.error?.code ?? -1).toString();
    const msg  = audio.error?.message ?? "unknown";
    console.error(`[CaliCoach Voice] ❌ Audio element error code=${code}: ${msg}`);
    if (_currentAudioEl === audio) _currentAudioEl = null;
    const { ac: ac2, duckGain: dg } = getGains();
    if (ac2.state !== "closed") releaseDuck(ac2, dg);
    abandonAudioFocus();
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speak a general coaching cue using the active voice personality.
 *
 * Paid profiles (sergeant, sensei, cyborg, …):
 *   → new Audio() → GET /api/tts/stream (LLM personality + ElevenLabs).
 *   → window.speechSynthesis is HARD-CANCELLED. No fallback.
 *
 * Free profiles (classic, classic_female):
 *   → browser Web Speech API immediately.
 */
export function speak(text: string, tone: "encouraging" | "firm" | "neutral" = "neutral"): void {
  if (_muted) return;

  // Hard-cancel any speechSynthesis regardless of profile — prevents bleed-over.
  window.speechSynthesis.cancel();

  if (FREE_VOICE_PROFILES.has(_activeProfileId)) {
    browserSpeakForProfile(text, _activeProfileId);
    return;
  }

  // Paid profile — stable cache key from the raw cue text.
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const cacheKey = `general:${slug(text)}`;

  console.log(`[CaliCoach Voice] speak() → paid profile="${_activeProfileId}" cue="${text.slice(0, 40)}"`);
  _speakWithAudioElement(text, _activeProfileId, "Coaching", cacheKey);
}

/**
 * Speak a form-correction coaching cue with AI personality injection.
 *
 * Paid profiles: new Audio() → /api/tts/stream (LLM rephrase + ElevenLabs).
 * Free profiles: browser Web Speech API.
 */
export function speakCue(
  exerciseName: string,
  audioCue: string,
  profileId: string,
  cacheKey: string,
): void {
  if (_muted) return;

  // Hard-cancel any speechSynthesis regardless of profile.
  window.speechSynthesis.cancel();

  if (FREE_VOICE_PROFILES.has(profileId)) {
    browserSpeakForProfile(audioCue, profileId);
    return;
  }

  console.log(`[CaliCoach Voice] speakCue() → paid profile="${profileId}" cue="${audioCue.slice(0, 40)}"`);
  _speakWithAudioElement(audioCue, profileId, exerciseName, cacheKey);
}

/**
 * Play a short sample cue for a personality so the user can preview it.
 * Called by the Shop "Test Voice" buttons.
 */
export function testCoachVoice(profileId: string): void {
  const SAMPLE_CUES: Record<string, string> = {
    sergeant:       "Get those hips up, recruit! You're sagging like a wet noodle!",
    sensei:         "The body follows the mind — align your core, find stillness.",
    cyborg:         "Hip angle deviation detected: 12 degrees below optimal. Correct now.",
    monk:           "Breathe in. Let the Ascension begin. Flow into perfect alignment.",
    noir_detective: "Those hips, kid — dropping like a bad lead in a cold case.",
    ogre:           "BRACE. PUSH. NOW. Every rep is survival.",
    olympic_coach:  "Eccentric control is lacking — engage your v-taper and drive bio-mechanically.",
    aussie_legend:  "Mate, you're doing ripper work — stoked to see that! Reckon you've got this!",
    retro_gamer:    "Warning! HP critical! Activate your core Buff and Level Up — game over is not an option!",
    tokyo_tech:     "Core activation insufficient. Recalibrate spinal alignment immediately.",
  };

  const sampleText =
    SAMPLE_CUES[profileId] ??
    "Great form — keep your core tight and breathe through the movement.";

  if (FREE_VOICE_PROFILES.has(profileId)) {
    window.speechSynthesis.cancel();
    browserSpeakForProfile(sampleText, profileId);
    return;
  }

  window.speechSynthesis.cancel();
  stopCurrentAudio();

  console.log(`[CaliCoach Voice] testCoachVoice() → profile="${profileId}"`);
  _speakWithAudioElement(sampleText, profileId, "Demo", `${profileId}:test_sample`);
}

/**
 * Stop all in-progress audio (ElevenLabs element + Web Speech) and restore ducking.
 */
export function cancelSpeech(): void {
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
