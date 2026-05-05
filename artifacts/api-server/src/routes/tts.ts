import { Router, type Request, type Response } from "express";
import { Readable } from "stream";

const router = Router();

/**
 * Default voice: "Adam" — clear, energetic coaching voice.
 * Override with ELEVENLABS_VOICE_ID environment variable.
 * Full list: https://api.elevenlabs.io/v1/voices
 */
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

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
    stability:        0.30,   // more expressive — lets warmth/enthusiasm through
    similarity_boost: 0.80,
    style:            0.35,   // add stylistic emphasis
    use_speaker_boost: true,
  },
  firm: {
    stability:        0.62,   // controlled, authoritative
    similarity_boost: 0.85,
    style:            0.05,
    use_speaker_boost: true,
  },
};

// ---------------------------------------------------------------------------
// POST /tts — proxy to ElevenLabs Eleven Flash v2.5 with full streaming
// ---------------------------------------------------------------------------
router.post("/tts", async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // Signal to the client that ElevenLabs is not yet configured so it can
  // fall back gracefully to Web Speech API.
  if (!apiKey) {
    res.status(503).json({ error: "ElevenLabs API key not configured" });
    return;
  }

  const { text, tone } = req.body as { text?: string; tone?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  // optimize_streaming_latency=4 = maximum latency optimization (Eleven Flash
  // v2.5 is already ultra-low latency, this squeezes out a few more ms).
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
    `?optimize_streaming_latency=4&output_format=mp3_44100_128`;

  const voiceSettings =
    VOICE_SETTINGS[tone ?? "neutral"] ?? VOICE_SETTINGS["neutral"];

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        model_id: "eleven_flash_v2_5",
        voice_settings: voiceSettings,
      }),
    });
  } catch (err) {
    req.log.error({ err }, "ElevenLabs fetch failed");
    res.status(502).json({ error: "Could not reach ElevenLabs" });
    return;
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    req.log.warn({ status: upstream.status, body }, "ElevenLabs error response");
    res.status(upstream.status).json({ error: body || "ElevenLabs error" });
    return;
  }

  if (!upstream.body) {
    res.status(502).json({ error: "Empty response from ElevenLabs" });
    return;
  }

  res.set({
    "Content-Type": "audio/mpeg",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache, no-store",
    "X-Accel-Buffering": "no",
  });

  // Pipe the ElevenLabs stream directly to the response — first bytes reach
  // the client as soon as ElevenLabs starts sending them (~75 ms with Flash).
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

export default router;
