/**
 * voiceService — ElevenLabs Eleven Flash v2.5 streaming TTS + Audio Ducking
 *
 * Architecture:
 *  1. Frontend calls `speak(text)`.
 *  2. Service POSTs to /api/tts, proxies to ElevenLabs, streams audio/mpeg back.
 *  3. AudioContext decodes the MP3 and starts playback immediately.
 *  4. Falls back to Web Speech API when ElevenLabs is unavailable.
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
 *   import { speak, cancelSpeech, getAudioContext, getDuckingGain } from "@/lib/voice-service";
 *   speak("Good rep! Keep your back straight.");
 *
 *   // Route a sound effect through the ducking gain:
 *   const src = getAudioContext().createBufferSource();
 *   src.buffer = sfxBuffer;
 *   src.connect(getDuckingGain());
 *   src.start();
 */

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
// On supporting platforms (Android Chrome, some iOS WKWebView) setting
// playbackState to 'playing' requests audio focus from the OS, which causes
// external music apps (Spotify, Apple Music, etc.) to duck automatically.

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

// ─── Web Speech API fallback ──────────────────────────────────────────────────

function fallbackSpeak(text: string): void {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.pitch = 0.95;
    u.volume = 1;

    // Duck non-speech audio via gain node even for the fallback path.
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speak the given text using ElevenLabs Flash v2.5 with streaming audio.
 * Automatically ducks all non-speech audio while the cue is playing and
 * smoothly restores it afterwards.
 * Falls back to Web Speech API if ElevenLabs is unavailable.
 */
export function speak(text: string): void {
  stopCurrentSource();
  window.speechSynthesis.cancel();

  _speakAsync(text).catch(() => {
    fallbackSpeak(text);
  });
}

async function _speakAsync(text: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    fallbackSpeak(text);
    return;
  }

  // 503 = API key not configured → fall back silently.
  if (res.status === 503) {
    fallbackSpeak(text);
    return;
  }

  if (!res.ok) {
    fallbackSpeak(text);
    return;
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await res.arrayBuffer();
  } catch {
    fallbackSpeak(text);
    return;
  }

  if (arrayBuffer.byteLength === 0) {
    fallbackSpeak(text);
    return;
  }

  try {
    const { ac, duckGain, speechGain } = getGains();

    // Resume if the browser suspended the context (autoplay policy).
    if (ac.state === "suspended") {
      await ac.resume();
    }

    const audioBuffer = await ac.decodeAudioData(arrayBuffer);

    // Cancel anything that started while we were awaiting decode.
    stopCurrentSource();

    // ── Apply ducking before playback begins ──────────────────────────────
    applyDuck(ac, duckGain);
    requestAudioFocus();

    // ── Route speech through the dedicated speechGain (not ducked) ────────
    const source = ac.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(speechGain);
    source.start(0);

    _currentSource = source;

    source.onended = () => {
      _currentSource = null;
      // ── Restore non-speech audio after cue finishes ───────────────────
      releaseDuck(ac, duckGain);
      abandonAudioFocus();
    };
  } catch {
    fallbackSpeak(text);
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
