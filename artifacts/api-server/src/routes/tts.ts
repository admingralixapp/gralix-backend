import { Router, type Request, type Response } from "express";
import { Readable } from "stream";
import OpenAI from "openai";
import { getVoiceProfile, DEFAULT_PROFILE_ID } from "../lib/voiceProfiles.js";

const router = Router();

// ── OpenAI client (for dynamic cue text generation) ────────────────────────
// Initialised lazily so the server still boots if the key is absent.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const key  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!base || !key) return null;
  _openai = new OpenAI({ apiKey: key, baseURL: base });
  return _openai;
}

// ── Server-side audio cache ─────────────────────────────────────────────────
// Key: `${profileId}:${cacheKey}` — value: the raw MP3 bytes from ElevenLabs.
// Lives in-process memory; refreshes on server restart. ~100KB per cached cue.
const _audioCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 500;

function setCached(key: string, buf: Buffer): void {
  if (_audioCache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entry when cap reached.
    const first = _audioCache.keys().next().value;
    if (first) _audioCache.delete(first);
  }
  _audioCache.set(key, buf);
}

// ---------------------------------------------------------------------------
// Voice-settings presets keyed by coaching tone.
//
//  neutral      — steady, on-track coaching (current default)
//  encouraging  — warmer + more expressive; lower stability lets more emotion through
//  firm         — authoritative; higher stability = less deviation, more controlled
// ---------------------------------------------------------------------------
const VOICE_SETTINGS: Record<string, {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}> = {
  neutral: {
    stability:        0.45,
    similarity_boost: 0.82,
    style:            0.00,
    use_speaker_boost: true,
  },
  encouraging: {
    stability:        0.30,
    similarity_boost: 0.80,
    style:            0.35,
    use_speaker_boost: true,
  },
  firm: {
    stability:        0.62,
    similarity_boost: 0.85,
    style:            0.05,
    use_speaker_boost: true,
  },
};

// ---------------------------------------------------------------------------
// Helper — send text to ElevenLabs and return the full MP3 as a Buffer.
// ---------------------------------------------------------------------------
async function elevenLabsTTS(
  text: string,
  voiceId: string,
  voiceSettings: typeof VOICE_SETTINGS[string],
  apiKey: string,
  langCode?: string,
): Promise<Buffer> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
    `?optimize_streaming_latency=4&output_format=mp3_44100_128`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key":   apiKey,
      "Content-Type": "application/json",
      Accept:         "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 500),
      model_id: "eleven_multilingual_v2",
      voice_settings: voiceSettings,
      // language_code tells ElevenLabs which language detection to prioritise.
      // The caller must ensure `text` is already in this language.
      ...(langCode ? { language_code: langCode } : {}),
    }),
  });

  console.log(`SENDING TO ELEVENLABS: { voiceId: "${voiceId}", textSnippet: "${text.slice(0, 60)}", model: "eleven_multilingual_v2" }`);

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    const detail = (() => {
      if (upstream.status === 401) return "Invalid ElevenLabs API Key";
      if (upstream.status === 422) return `Voice ID not found or invalid: "${voiceId}"`;
      if (upstream.status === 429) return "ElevenLabs rate limit exceeded";
      return body || `HTTP ${upstream.status}`;
    })();
    console.error(`[ElevenLabs] TTS failed — ${detail} (voiceId="${voiceId}")`);
    throw new Error(`ElevenLabs error ${upstream.status}: ${detail}`);
  }

  if (!upstream.body) throw new Error("Empty ElevenLabs response");

  const chunks: Uint8Array[] = [];
  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// POST /api/tts — simple text → ElevenLabs proxy (existing, unchanged).
// ---------------------------------------------------------------------------
router.post("/tts", async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "ElevenLabs API key not configured" });
    return;
  }

  const { text, tone } = req.body as { text?: string; tone?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const profile    = getVoiceProfile(DEFAULT_PROFILE_ID);
  const voiceId    = process.env.ELEVENLABS_VOICE_ID ?? profile.voiceId;
  const voiceSettings =
    VOICE_SETTINGS[tone ?? "neutral"] ?? VOICE_SETTINGS["neutral"]!;

  const elUrl =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
    `?optimize_streaming_latency=4&output_format=mp3_44100_128`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(elUrl, {
      method: "POST",
      headers: {
        "xi-api-key":   apiKey,
        "Content-Type": "application/json",
        Accept:         "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        model_id: "eleven_turbo_v2_5",
        voice_settings: voiceSettings,
      }),
    });
  } catch (err) {
    req.log.error({ err }, "ElevenLabs fetch failed — network error");
    console.error("[ElevenLabs] Network error reaching ElevenLabs API:", err);
    res.status(502).json({ error: "Could not reach ElevenLabs" });
    return;
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    const detail = (() => {
      if (upstream.status === 401) return "Invalid ElevenLabs API Key";
      if (upstream.status === 422) return `Voice ID not found: "${voiceId}"`;
      if (upstream.status === 429) return "Rate limit exceeded";
      return body || `HTTP ${upstream.status}`;
    })();
    req.log.warn({ status: upstream.status, voiceId, detail }, "ElevenLabs error response");
    console.error(`[ElevenLabs] /api/tts failed — ${detail} (voiceId="${voiceId}")`);
    res.status(upstream.status).json({ error: detail });
    return;
  }

  if (!upstream.body) {
    res.status(502).json({ error: "Empty response from ElevenLabs" });
    return;
  }

  res.set({
    "Content-Type":      "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Cache-Control":     "no-cache, no-store",
    "X-Accel-Buffering": "no",
  });

  try {
    const nodeStream = Readable.fromWeb(
      upstream.body as import("stream/web").ReadableStream<Uint8Array>,
    );
    nodeStream.pipe(res);
    nodeStream.on("error", () => res.end());
  } catch (err) {
    req.log.error({ err }, "Stream pipe error");
    if (!res.headersSent) res.status(500).json({ error: "Streaming failed" });
    else res.end();
  }
});

// ---------------------------------------------------------------------------
// POST /api/tts/cue — AI-personalised coaching cue.
//
// 1. Check server-side audio cache (profile + cacheKey).
// 2. If miss → ask LLM to rephrase the raw cue in the character's voice.
// 3. Send generated text to ElevenLabs using the profile's voice + settings.
// 4. Cache MP3 bytes, return audio/mpeg.
//
// Body: {
//   exerciseName : string   e.g. "Plank"
//   audioCue     : string   e.g. "Lower your hips"
//   profile      : string   e.g. "sergeant"
//   cacheKey     : string   stable key generated by the client
// }
// ---------------------------------------------------------------------------
router.post("/tts/cue", async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "ElevenLabs API key not configured" });
    return;
  }

  const { exerciseName, audioCue, profile: profileId, cacheKey } =
    req.body as {
      exerciseName?: string;
      audioCue?:     string;
      profile?:      string;
      cacheKey?:     string;
    };

  if (!exerciseName?.trim() || !audioCue?.trim()) {
    res.status(400).json({ error: "exerciseName and audioCue are required" });
    return;
  }

  const profile = getVoiceProfile(profileId ?? DEFAULT_PROFILE_ID);
  const serverCacheKey = `${profile.id}:${cacheKey ?? `${exerciseName}:${audioCue}`}`;

  // ── 1. Cache hit — return stored audio immediately ──────────────────────
  const cached = _audioCache.get(serverCacheKey);
  if (cached) {
    res.set({
      "Content-Type":  "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
      "X-Cache":       "HIT",
    });
    res.end(cached);
    return;
  }

  // ── 2. Generate cue text via LLM ────────────────────────────────────────
  let cueText = audioCue; // fallback: speak the raw cue if LLM unavailable
  const ai = getOpenAI();
  if (ai) {
    try {
      const completion = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 60,
        messages: [
          { role: "system", content: profile.systemPrompt },
          {
            role: "user",
            content:
              `Exercise: ${exerciseName}. Form issue detected: "${audioCue}". ` +
              `Generate exactly one coaching sentence in character. ` +
              `Do NOT use quotes. Max 15 words.`,
          },
        ],
      });
      const generated = completion.choices[0]?.message?.content?.trim();
      if (generated) cueText = generated;
    } catch (err) {
      req.log.warn({ err }, "LLM cue generation failed — falling back to raw audioCue");
    }
  }

  // ── 3. Convert text → ElevenLabs audio ──────────────────────────────────
  console.log(`[ElevenLabs] /api/tts/cue — profile="${profile.id}" voiceId="${profile.voiceId}" text="${cueText.slice(0, 60)}"`);
  let audioBuffer: Buffer;
  try {
    audioBuffer = await elevenLabsTTS(cueText, profile.voiceId, profile.voiceSettings, apiKey);
    console.log(`[ElevenLabs] /api/tts/cue — success, ${audioBuffer.byteLength} bytes`);
  } catch (err) {
    req.log.error({ err, profileId: profile.id, voiceId: profile.voiceId }, "ElevenLabs TTS failed for dynamic cue");
    console.error(`[ElevenLabs] /api/tts/cue FAILED — profile="${profile.id}" voiceId="${profile.voiceId}" error:`, err);
    res.status(502).json({ error: String(err) });
    return;
  }

  // ── 4. Cache and return ──────────────────────────────────────────────────
  setCached(serverCacheKey, audioBuffer);

  res.set({
    "Content-Type":  "audio/mpeg",
    "Cache-Control": "public, max-age=86400",
    "X-Cache":       "MISS",
  });
  res.end(audioBuffer);
});

// ---------------------------------------------------------------------------
// GET /api/tts/stream — streaming audio for new Audio() element playback.
//
// Same pipeline as POST /api/tts/cue but as a GET so the browser can set it
// as the src of a new Audio() element directly.
//
// Query params:
//   text         : string   Raw cue text (will be rephrased by LLM in character)
//   profile      : string   Voice profile ID, e.g. "sergeant"
//   exerciseName : string   e.g. "Plank" (used for LLM context)
//   cacheKey     : string   Stable key for server-side MP3 cache
// ---------------------------------------------------------------------------
router.get("/tts/stream", async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).end();
    return;
  }

  const { text, profile: profileId, exerciseName, cacheKey, language } = req.query as {
    text?:         string;
    profile?:      string;
    exerciseName?: string;
    cacheKey?:     string;
    language?:     string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const profile       = getVoiceProfile(profileId ?? DEFAULT_PROFILE_ID);
  const serverCacheKey = `${profile.id}:${cacheKey ?? `${exerciseName ?? ""}:${text}`}`;

  // ── 1. Cache hit — return stored audio immediately ──────────────────────
  const cached = _audioCache.get(serverCacheKey);
  if (cached) {
    res.set({
      "Content-Type":  "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
      "X-Cache":       "HIT",
    });
    res.end(cached);
    return;
  }

  // ── 2. LLM personality injection ────────────────────────────────────────
  let cueText = text.trim();
  const ai = getOpenAI();
  if (ai) {
    const langInstruction =
      language && language !== "en"
        ? ` Reply in the language with ISO 639-1 code "${language}". Do NOT switch to English.`
        : "";
    try {
      const completion = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 60,
        messages: [
          { role: "system", content: profile.systemPrompt },
          {
            role: "user",
            content:
              `Exercise: ${exerciseName?.trim() || "workout"}. Coaching cue: "${cueText}". ` +
              `Generate exactly one coaching sentence in character.` +
              `${langInstruction} Do NOT use quotes. Max 15 words.`,
          },
        ],
      });
      const generated = completion.choices[0]?.message?.content?.trim();
      if (generated) cueText = generated;
    } catch (err) {
      req.log.warn({ err }, "LLM cue generation failed — using raw text");
    }
  }

  // ── 3. ElevenLabs TTS ───────────────────────────────────────────────────
  console.log(`[ElevenLabs] /api/tts/stream — profile="${profile.id}" voiceId="${profile.voiceId}" text="${cueText.slice(0, 60)}"`);
  let audioBuffer: Buffer;
  try {
    audioBuffer = await elevenLabsTTS(
      cueText,
      profile.voiceId,
      profile.voiceSettings,
      apiKey,
      language && language !== "en" ? language : undefined,
    );
    console.log(`[ElevenLabs] /api/tts/stream — success, ${audioBuffer.byteLength} bytes`);
  } catch (err) {
    req.log.error({ err, profileId: profile.id, voiceId: profile.voiceId }, "ElevenLabs TTS failed for stream");
    console.error(`[ElevenLabs] /api/tts/stream FAILED — profile="${profile.id}" error:`, err);
    res.status(502).end();
    return;
  }

  // ── 4. Cache and return ──────────────────────────────────────────────────
  setCached(serverCacheKey, audioBuffer);

  res.set({
    "Content-Type":  "audio/mpeg",
    "Cache-Control": "public, max-age=86400",
    "X-Cache":       "MISS",
  });
  res.end(audioBuffer);
});

// ---------------------------------------------------------------------------
// GET /api/tts/profiles — list available voice personality profiles.
// ---------------------------------------------------------------------------
import { VOICE_PROFILES } from "../lib/voiceProfiles.js";

router.get("/tts/profiles", (_req: Request, res: Response) => {
  const list = Object.values(VOICE_PROFILES).map(({ id, label }) => ({ id, label }));
  res.json(list);
});

export default router;
