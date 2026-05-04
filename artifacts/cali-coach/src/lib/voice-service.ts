/**
 * voiceService — ElevenLabs Eleven Flash v2.5 streaming TTS
 *
 * Architecture:
 *  1. Frontend calls `speak(text)`.
 *  2. Service POSTs to /api/tts, which proxies to ElevenLabs and streams
 *     the audio/mpeg response back (chunked transfer, ~75 ms TTFB).
 *  3. AudioContext decodes the MP3 and starts playback immediately.
 *  4. If the API key is not configured or any error occurs, the service
 *     falls back transparently to the browser's Web Speech API.
 *
 * Usage:
 *   import { speak, cancelSpeech } from "@/lib/voice-service";
 *   speak("Good rep! Keep your back straight.");
 */

// ─── AudioContext singleton ───────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
let _currentSource: AudioBufferSourceNode | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
  }
  return _ctx;
}

function stopCurrentSource() {
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
    window.speechSynthesis.speak(u);
  } catch {
    // Speech synthesis not available — silent fail.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speak the given text using ElevenLabs Flash v2.5 with streaming audio.
 * Falls back to Web Speech API if ElevenLabs is unavailable.
 *
 * This function is fire-and-forget; errors are handled internally.
 */
export function speak(text: string): void {
  // Stop whatever is currently playing before starting new audio.
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
    const ac = getCtx();

    // Resume if the browser suspended the context (autoplay policy).
    if (ac.state === "suspended") {
      await ac.resume();
    }

    const audioBuffer = await ac.decodeAudioData(arrayBuffer);

    // Cancel anything that started while we were awaiting the response.
    stopCurrentSource();

    const source = ac.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ac.destination);
    source.start(0);

    _currentSource = source;
    source.onended = () => {
      _currentSource = null;
    };
  } catch {
    fallbackSpeak(text);
  }
}

/**
 * Stop any in-progress ElevenLabs or Web Speech audio immediately.
 * Call this when the workout ends or the component unmounts.
 */
export function cancelSpeech(): void {
  stopCurrentSource();
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
