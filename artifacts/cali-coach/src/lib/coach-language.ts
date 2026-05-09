/**
 * coach-language — the 29 languages supported by ElevenLabs Multilingual v2.
 * Stored separately from the app UI language so users can coach in one language
 * while navigating the app in another.
 */

export interface CoachLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const COACH_LANGUAGES: CoachLanguage[] = [
  { code: "en", name: "English",    nativeName: "English" },
  { code: "es", name: "Spanish",    nativeName: "Español" },
  { code: "fr", name: "French",     nativeName: "Français" },
  { code: "de", name: "German",     nativeName: "Deutsch" },
  { code: "it", name: "Italian",    nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ja", name: "Japanese",   nativeName: "日本語" },
  { code: "zh", name: "Chinese",    nativeName: "中文" },
  { code: "ko", name: "Korean",     nativeName: "한국어" },
  { code: "hi", name: "Hindi",      nativeName: "हिन्दी" },
  { code: "ar", name: "Arabic",     nativeName: "العربية" },
  { code: "ru", name: "Russian",    nativeName: "Русский" },
  { code: "nl", name: "Dutch",      nativeName: "Nederlands" },
  { code: "tr", name: "Turkish",    nativeName: "Türkçe" },
  { code: "el", name: "Greek",      nativeName: "Ελληνικά" },
  { code: "sv", name: "Swedish",    nativeName: "Svenska" },
  { code: "fi", name: "Finnish",    nativeName: "Suomi" },
  { code: "da", name: "Danish",     nativeName: "Dansk" },
  { code: "no", name: "Norwegian",  nativeName: "Norsk" },
  { code: "cs", name: "Czech",      nativeName: "Čeština" },
  { code: "sk", name: "Slovak",     nativeName: "Slovenčina" },
  { code: "uk", name: "Ukrainian",  nativeName: "Українська" },
  { code: "ro", name: "Romanian",   nativeName: "Română" },
  { code: "hu", name: "Hungarian",  nativeName: "Magyar" },
  { code: "ta", name: "Tamil",      nativeName: "தமிழ்" },
  { code: "bg", name: "Bulgarian",  nativeName: "Български" },
  { code: "hr", name: "Croatian",   nativeName: "Hrvatski" },
  { code: "ms", name: "Malay",      nativeName: "Bahasa Melayu" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
];

const COACH_LANG_KEY = "calicoach_coach_language_v1";

/** Read the persisted coach language code (default: "en"). */
export function getCoachLanguage(): string {
  try {
    const stored = localStorage.getItem(COACH_LANG_KEY);
    if (stored && COACH_LANGUAGES.some((l) => l.code === stored)) return stored;
    return "en";
  } catch {
    return "en";
  }
}

/** Persist the selected coach language code. */
export function setCoachLanguage(code: string): void {
  try { localStorage.setItem(COACH_LANG_KEY, code); } catch {}
}

/** Human-readable name for a code (falls back to English). */
export function getCoachLanguageName(code: string): string {
  return COACH_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}
