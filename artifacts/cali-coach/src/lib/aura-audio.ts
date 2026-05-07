/**
 * aura-audio.ts — Language-aware audio routing for Aura voice packs.
 *
 * Path convention:
 *   /assets/audio/{voiceId}/{lang}/{filename}
 *
 * Fallback chain:
 *   1. Try /{voiceId}/{lang}/{filename}
 *   2. Fall back to /{voiceId}/en/{filename}
 *
 * Usage:
 *   import { playAura, setAuraLanguage } from "@/lib/aura-audio";
 *
 *   // Set once when the user's language changes
 *   setAuraLanguage("es");
 *
 *   // Play a cue from the active aura (with language fallback)
 *   playAura("drill-sergeant", "rep-complete.mp3");
 */

const BASE = "/assets/audio";

let _lang = "en";

/**
 * Set the current user language for audio routing.
 * Call this whenever i18n.language changes.
 */
export function setAuraLanguage(lang: string): void {
  _lang = lang.split("-")[0].toLowerCase();
}

/**
 * Return the current aura language (base code only).
 */
export function getAuraLanguage(): string {
  return _lang;
}

/** Active AudioContext for aura clips (separate from voice coaching). */
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
  }
  return _ctx;
}

/** In-flight cache so the same clip isn't fetched twice. */
const _cache = new Map<string, Promise<AudioBuffer>>();

async function fetchBuffer(url: string): Promise<AudioBuffer> {
  if (_cache.has(url)) return _cache.get(url)!;

  const p = fetch(url, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`404: ${url}`);
      return r.arrayBuffer();
    })
    .then((ab) => {
      const ctx = getCtx();
      return ctx.decodeAudioData(ab);
    });

  _cache.set(url, p);
  return p;
}

/**
 * Play an aura audio clip with full language fallback.
 *
 * @param voiceId   e.g. "drill-sergeant" | "zen" | "hype" | "classic"
 * @param filename  e.g. "rep-complete.mp3" | "good-form.mp3"
 * @param lang      override the current aura language (optional)
 */
export async function playAura(
  voiceId: string,
  filename: string,
  lang?: string,
): Promise<void> {
  const targetLang = (lang ?? _lang).split("-")[0].toLowerCase();
  const langUrl = `${BASE}/${voiceId}/${targetLang}/${filename}`;
  const fallbackUrl = `${BASE}/${voiceId}/en/${filename}`;

  let buffer: AudioBuffer;
  try {
    buffer = await fetchBuffer(targetLang !== "en" ? langUrl : fallbackUrl);
  } catch {
    if (targetLang === "en") return; // nothing to fall back to
    try {
      buffer = await fetchBuffer(fallbackUrl);
    } catch {
      return; // audio asset not present — silently skip
    }
  }

  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

/**
 * Preload aura clips for the given voice into memory cache.
 * Call after user activates an aura pack to reduce first-play latency.
 */
export function preloadAuraClips(
  voiceId: string,
  filenames: string[],
  lang?: string,
): void {
  const targetLang = (lang ?? _lang).split("-")[0].toLowerCase();
  for (const filename of filenames) {
    const url = `${BASE}/${voiceId}/${targetLang}/${filename}`;
    fetchBuffer(url).catch(() => {
      // try English fallback silently
      fetchBuffer(`${BASE}/${voiceId}/en/${filename}`).catch(() => {/* no asset */});
    });
  }
}
