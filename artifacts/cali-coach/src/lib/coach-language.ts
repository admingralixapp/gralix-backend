/**
 * coach-language — ElevenLabs Multilingual v2 supported languages.
 *
 * The voice language is now derived automatically from the app's global UI
 * language (i18next). No separate user preference is stored.
 */

/** ISO 639-1 codes supported by ElevenLabs eleven_multilingual_v2. */
export const ELEVENLABS_SUPPORTED = new Set([
  "en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko", "hi",
  "ar", "ru", "nl", "tr", "el", "sv", "fi", "da", "no", "cs",
  "sk", "uk", "ro", "hu", "ta", "bg", "hr", "ms", "id",
]);

/**
 * Map a BCP-47 language tag (e.g. "zh-TW", "en-US", "fr") to the ISO 639-1
 * base code supported by ElevenLabs. Falls back to "en" for unsupported languages
 * so voice cues never error while the UI stays in the user's chosen language.
 */
export function resolveElevenLabsLang(bcp47: string): string {
  const base = (bcp47 ?? "en").split("-")[0]!.toLowerCase();
  return ELEVENLABS_SUPPORTED.has(base) ? base : "en";
}
