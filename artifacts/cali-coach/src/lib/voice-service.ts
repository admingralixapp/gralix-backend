/**
 * voiceService — ElevenLabs Eleven Flash v2.5 streaming TTS + Audio Ducking
 *
 * Architecture:
 *  1. Frontend calls `speak(text)` for simple predefined cues.
 *  2. Frontend calls `speakCue(...)` for AI-personalised dynamic coaching cues.
 *     • Checks a client-side AudioBuffer cache first (zero network cost on repeat).
 *     • On miss: POSTs to /api/tts/cue → LLM generates cue text → ElevenLabs speaks it.
 *  3. Service POSTs to /api/tts, proxies to ElevenLabs, streams audio/mpeg back.
 *  4. AudioContext decodes the MP3 and starts playback immediately.
 *  5. Falls back to Web Speech API when ElevenLabs is unavailable.
 *
 * Audio Ducking:
 *  • All non-speech audio (sound effects, app music) should connect through the
 *    exported `getDuckingGain()` node → AudioContext.destination.
 *  • When a coaching cue starts: duckingGain ramps to 30% in ~80 ms.
 *  • When the cue finishes: duckingGain ramps back to 100% over 500 ms.
 *  • Speech audio connects via a dedicated speechGain node (always at 100%).
 *  • MediaSession playbackState is set so the OS/browser can signal external
 *    apps (Spotify, etc.) to duck — supported on Android Chrome and some iOS
 *    WKWebView contexts; silently ignored elsewhere.
 *
 * Usage:
 *   import { speak, speakCue, cancelSpeech, getAudioContext, getDuckingGain } from "@/lib/voice-service";
 *   speak("Good rep! Keep your back straight.");
 *   speakCue("Plank", "Hips too high", "sergeant", "sergeant:plank:hips_too_high");
 *
 *   // Route a sound effect through the ducking gain:
 *   const src = getAudioContext().createBufferSource();
 *   src.buffer = sfxBuffer;
 *   src.connect(getDuckingGain());
 *   src.start();
 */

// ─── Mute flag (controlled by Settings › Voice Cues toggle) ──────────────────

let _muted = false;

/**
 * Silence all coaching cues for the duration of the current workout.
 * Called by the Workout page on mount based on the user's Voice Cues preference.
 */
export function setVoiceMuted(muted: boolean): void {
  _muted = muted;
}

// ─── Active voice profile (module-level so speak() can route correctly) ───────
// Defaults to "classic" (browser TTS). Updated by setActiveVoiceProfile()
// whenever the Workout mounts or the user changes their profile in Settings.

let _activeProfileId: string = "classic";

/**
 * Tell the voice service which personality is currently selected.
 * Must be called whenever:
 *   - The Workout page mounts (reads from localStorage).
 *   - The user switches personality in Settings (update fires immediately).
 *
 * All subsequent `speak()` calls will route through the correct ElevenLabs
 * voice until this is called again with a different value.
 */
export function setActiveVoiceProfile(profileId: string): void {
  _activeProfileId = profileId;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DUCK_TARGET    = 0.3;   // 30 % during coaching cue
const DUCK_RAMP_DOWN = 0.08;  // 80 ms fade-down when speech starts
const DUCK_RAMP_UP   = 0.5;   // 500 ms fade-up after speech ends
const FULL_GAIN      = 1.0;

// ─── AudioContext + GainNode singletons ──────────────────────────────────────

let _ctx: AudioContext | null = null;

/**
 * GainNode that all non-speech audio should connect through.
 * Ramped down during coaching cues, back up when they finish.
 */
let _duckingGain: GainNode | null = null;

/**
 * GainNode for speech audio — always at FULL_GAIN, bypasses ducking.
 */
let _speechGain: GainNode | null = null;

let _currentSource: AudioBufferSourceNode | null = null;

// ─── Client-side audio cache for dynamic cues ────────────────────────────────
// Key: `${profileId}:${cacheKey}` — value: decoded AudioBuffer.
// Keeps repeated cues (e.g. "Hips too high") near-instant on second fire.
const _cueCache = new Map<string, AudioBuffer>();
const MAX_CUE_CACHE = 200; // ~200 unique cues before LRU eviction

// ─── Context / gain initialisation ───────────────────────────────────────────

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
    _duckingGain = null; // invalidate gains when context is recreated
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

// ─── Public accessors for app audio routing ───────────────────────────────────

/**
 * Returns the shared AudioContext.
 * Use this to decode buffers or create nodes for sound effects / music.
 */
export function getAudioContext(): AudioContext {
  return getCtx();
}

/**
 * Returns the ducking GainNode.
 * Connect all non-speech audio sources to this node so they are automatically
 * attenuated while the AI coach is speaking.
 *
 *   const src = getAudioContext().createBufferSource();
 *   src.connect(getDuckingGain());   // ← will be ducked during cues
 *   src.start();
 */
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

// ─── MediaSession audio focus ─────────────────────────────────────────────────

function requestAudioFocus(): void {
  try {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  } catch {
    // Not available on this platform — safe to ignore.
  }
}

function abandonAudioFocus(): void {
  try {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  } catch {
    // ignore
  }
}

// ─── Source management ────────────────────────────────────────────────────────

function stopCurrentSource(): void {
  try {
    _currentSource?.stop();
  } catch {
    // already stopped — safe to ignore
  }
  _currentSource = null;
}

// ─── Play an already-decoded AudioBuffer ─────────────────────────────────────

async function playAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
  const { ac, duckGain, speechGain } = getGains();

  if (ac.state === "suspended") {
    await ac.resume();
  }

  stopCurrentSource();
  applyDuck(ac, duckGain);
  requestAudioFocus();

  const source = ac.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(speechGain);
  source.start(0);
  _currentSource = source;

  source.onended = () => {
    _currentSource = null;
    releaseDuck(ac, duckGain);
    abandonAudioFocus();
  };
}

// ─── Locale for speech synthesis ──────────────────────────────────────────────

let _speechLang = "en-US";

/**
 * Set the BCP-47 locale used by the Web Speech API fallback.
 * Call this whenever the user changes their language in Settings.
 */
export function setVoiceLanguage(bcp47: string): void {
  _speechLang = bcp47;
}

// ─── Web Speech API fallback ──────────────────────────────────────────────────

function fallbackSpeak(text: string): void {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.pitch = 0.95;
    u.volume = 1;
    u.lang = _speechLang;

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

// ─── Core async speak ─────────────────────────────────────────────────────────

async function _speakAsync(text: string, tone: "encouraging" | "firm" | "neutral" = "neutral"): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone }),
    });
  } catch {
    fallbackSpeak(text);
    return;
  }

  if (res.status === 503) { fallbackSpeak(text); return; }
  if (!res.ok)             { fallbackSpeak(text); return; }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await res.arrayBuffer();
  } catch {
    fallbackSpeak(text);
    return;
  }

  if (arrayBuffer.byteLength === 0) { fallbackSpeak(text); return; }

  try {
    const { ac } = getGains();
    if (ac.state === "suspended") await ac.resume();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    await playAudioBuffer(audioBuffer);
  } catch {
    fallbackSpeak(text);
  }
}

// ─── Free-tier profiles (browser Web Speech only, no ElevenLabs) ─────────────
// Must be declared BEFORE speak() which references this set.
const FREE_VOICE_PROFILES = new Set(["classic", "classic_female"]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speak the given text using the active voice personality.
 * Free profiles (classic / classic_female) → browser TTS immediately.
 * Paid profiles → ElevenLabs via /api/tts/cue with LLM character injection.
 * Automatically ducks all non-speech audio while the cue is playing and
 * smoothly restores it afterwards.
 * Falls back to Web Speech API if ElevenLabs is unavailable.
 *
 * Use `speakCue` for form-correction cues — it adds AI personality + caching.
 *
 * @param tone  Optional coaching tone: "encouraging" | "firm" | "neutral"
 */
export function speak(text: string, tone: "encouraging" | "firm" | "neutral" = "neutral"): void {
  if (_muted) return;
  stopCurrentSource();
  window.speechSynthesis.cancel();

  // ── Route through the active personality voice ────────────────────────────
  // Free profiles use browser TTS immediately; paid profiles go through
  // the ElevenLabs pipeline via /api/tts/cue (same as speakCue).
  if (FREE_VOICE_PROFILES.has(_activeProfileId)) {
    browserSpeakForProfile(text, _activeProfileId);
    return;
  }

  // Paid profile — generate a stable cache key from the cue text so
  // repeated cues like "Good rep" are served instantly from cache.
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const cacheKey = `general:${slug(text)}`;

  _speakCueAsync("Coaching", text, _activeProfileId, cacheKey).catch(() => {
    fallbackSpeak(text);
  });
}

/**
 * Returns the appropriate Web Speech API voice settings for a profile.
 * classic_female uses a higher pitch to distinguish from the default.
 */
function browserSpeakForProfile(text: string, profileId: string): void {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = 1.1;
    u.pitch = profileId === "classic_female" ? 1.5 : 0.95;
    u.volume = 1;
    u.lang = _speechLang;

    // Try to pick a female voice for classic_female
    if (profileId === "classic_female") {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          v.lang.startsWith(_speechLang.split("-")[0] ?? "en") &&
          /female|woman|girl|zira|samantha|karen|moira|tessa|fiona|victoria/i.test(
            v.name,
          ),
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

/**
 * Speak a form-correction coaching cue using the active voice personality.
 *
 * Flow:
 *   Free profiles (classic / classic_female):
 *     → browser Web Speech API immediately — no network, no cost.
 *
 *   Pro profiles (sergeant, sensei, cyborg, …):
 *     1. Check client-side AudioBuffer cache (zero network cost on repeat).
 *     2. On miss → POST /api/tts/cue:
 *          • Server checks its own MP3 cache.
 *          • On miss: LLM rephrases cue in character → ElevenLabs Flash v2.5.
 *     3. Decode + cache AudioBuffer locally.
 *     4. Play with audio ducking.
 *
 * @param exerciseName  e.g. "Plank"
 * @param audioCue      The raw cue from the coaching engine, e.g. "Hips too high"
 * @param profileId     Voice personality ID, e.g. "sergeant"
 * @param cacheKey      Stable string key generated by the caller
 */
export function speakCue(
  exerciseName: string,
  audioCue: string,
  profileId: string,
  cacheKey: string,
): void {
  if (_muted) return;
  stopCurrentSource();
  window.speechSynthesis.cancel();

  // Free-tier profiles skip ElevenLabs entirely — instant browser TTS.
  if (FREE_VOICE_PROFILES.has(profileId)) {
    browserSpeakForProfile(audioCue, profileId);
    return;
  }

  _speakCueAsync(exerciseName, audioCue, profileId, cacheKey).catch(() => {
    fallbackSpeak(audioCue);
  });
}

/**
 * Play a short sample cue for a given personality so the user can preview it
 * before a workout. Called by the Shop "Test Voice" buttons.
 *
 * Uses the full ElevenLabs pipeline for Pro profiles (results are cached so
 * repeat presses are instant). Free profiles use browser TTS immediately.
 */
export function testCoachVoice(profileId: string): void {
  const SAMPLE_CUES: Record<string, string> = {
    sergeant:      "Get those hips up, recruit! You're sagging like a wet noodle!",
    sensei:        "The body follows the mind — align your core, find stillness.",
    cyborg:        "Hip angle deviation detected: 12 degrees below optimal. Correct now.",
    monk:          "Breathe in. Soften the belly. Let the form arise from stillness.",
    noir_detective: "Your hips are lower than my expectations, and that's saying something.",
    retro_gamer:   "Warning! Form integrity at 40%! Activate core module or game over!",
    olympic_coach: "Posterior chain engagement insufficient — drive through the heels.",
    ppowerlifter:  "Stop being soft. Lock in that core. Every rep counts.",
    tokyo_tech:    "Core activation insufficient. Recalibrate spinal alignment immediately.",
    aussie_legend: "Mate, lift those hips! You're better than that, trust me!",
  };

  const sampleText =
    SAMPLE_CUES[profileId] ??
    "Great form — keep your core tight and breathe through the movement.";

  if (FREE_VOICE_PROFILES.has(profileId)) {
    browserSpeakForProfile(sampleText, profileId);
    return;
  }

  stopCurrentSource();
  window.speechSynthesis.cancel();

  _speakCueAsync("Demo", sampleText, profileId, `${profileId}:test_sample`).catch(() => {
    fallbackSpeak(sampleText);
  });
}

async function _speakCueAsync(
  exerciseName: string,
  audioCue: string,
  profileId: string,
  cacheKey: string,
): Promise<void> {
  const clientKey = `${profileId}:${cacheKey}`;

  // ── 1. Client-side cache hit — play immediately (no network) ────────────
  const cached = _cueCache.get(clientKey);
  if (cached) {
    await playAudioBuffer(cached);
    return;
  }

  // ── 2. Fetch from /api/tts/cue (server may return cached MP3) ───────────
  let res: Response;
  try {
    res = await fetch("/api/tts/cue", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseName, audioCue, profile: profileId, cacheKey }),
    });
  } catch {
    fallbackSpeak(audioCue);
    return;
  }

  if (res.status === 503) { fallbackSpeak(audioCue); return; }
  if (!res.ok)             { fallbackSpeak(audioCue); return; }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await res.arrayBuffer();
  } catch {
    fallbackSpeak(audioCue);
    return;
  }

  if (arrayBuffer.byteLength === 0) { fallbackSpeak(audioCue); return; }

  try {
    const { ac } = getGains();
    if (ac.state === "suspended") await ac.resume();

    const audioBuffer = await ac.decodeAudioData(arrayBuffer);

    // ── 3. Store in client-side cache (LRU evict when full) ─────────────
    if (_cueCache.size >= MAX_CUE_CACHE) {
      const oldestKey = _cueCache.keys().next().value;
      if (oldestKey) _cueCache.delete(oldestKey);
    }
    _cueCache.set(clientKey, audioBuffer);

    // ── 4. Play ─────────────────────────────────────────────────────────
    await playAudioBuffer(audioBuffer);
  } catch {
    fallbackSpeak(audioCue);
  }
}

/**
 * Stop any in-progress ElevenLabs or Web Speech audio immediately and
 * restore the ducking gain to full volume.
 * Call this when the workout ends or the component unmounts.
 */
export function cancelSpeech(): void {
  stopCurrentSource();

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  // Immediately restore ducking gain (no ramp — user explicitly cancelled).
  try {
    if (_duckingGain && _ctx && _ctx.state !== "closed") {
      const now = _ctx.currentTime;
      _duckingGain.gain.cancelScheduledValues(now);
      _duckingGain.gain.setValueAtTime(FULL_GAIN, now);
    }
  } catch {
    // ignore
  }

  abandonAudioFocus();
}

/**
 * Clear the client-side cue AudioBuffer cache.
 * Call when the user switches voice profiles so stale audio is evicted.
 */
export function clearCueCache(): void {
  _cueCache.clear();
}
