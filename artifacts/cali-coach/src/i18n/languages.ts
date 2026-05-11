export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en-GB", name: "English (United Kingdom)", nativeName: "English (UK)",  flag: "🇬🇧" },
  { code: "en-US", name: "English (United States)",  nativeName: "English (US)",  flag: "🇺🇸" },
  { code: "zh",  name: "Chinese (Mandarin)",   nativeName: "中文" },
  { code: "hi",  name: "Hindi",                nativeName: "हिन्दी" },
  { code: "es",  name: "Spanish",              nativeName: "Español" },
  { code: "fr",  name: "French",               nativeName: "Français" },
  { code: "ar",  name: "Arabic",               nativeName: "العربية",       rtl: true },
  { code: "bn",  name: "Bengali",              nativeName: "বাংলা" },
  { code: "ru",  name: "Russian",              nativeName: "Русский" },
  { code: "pt",  name: "Portuguese",           nativeName: "Português" },
  { code: "ur",  name: "Urdu",                 nativeName: "اردو",           rtl: true },
  { code: "id",  name: "Indonesian",           nativeName: "Bahasa Indonesia" },
  { code: "de",  name: "German",               nativeName: "Deutsch" },
  { code: "ja",  name: "Japanese",             nativeName: "日本語" },
  { code: "sw",  name: "Swahili",              nativeName: "Kiswahili" },
  { code: "mr",  name: "Marathi",              nativeName: "मराठी" },
  { code: "te",  name: "Telugu",               nativeName: "తెలుగు" },
  { code: "tr",  name: "Turkish",              nativeName: "Türkçe" },
  { code: "ta",  name: "Tamil",                nativeName: "தமிழ்" },
  { code: "vi",  name: "Vietnamese",           nativeName: "Tiếng Việt" },
  { code: "ko",  name: "Korean",               nativeName: "한국어" },
  { code: "it",  name: "Italian",              nativeName: "Italiano" },
  { code: "ha",  name: "Hausa",                nativeName: "Hausa" },
  { code: "th",  name: "Thai",                 nativeName: "ภาษาไทย" },
  { code: "gu",  name: "Gujarati",             nativeName: "ગુજરાતી" },
  { code: "kn",  name: "Kannada",              nativeName: "ಕನ್ನಡ" },
  { code: "pl",  name: "Polish",               nativeName: "Polski" },
  { code: "uk",  name: "Ukrainian",            nativeName: "Українська" },
  { code: "ml",  name: "Malayalam",            nativeName: "മലയാളം" },
  { code: "or",  name: "Odia",                 nativeName: "ଓଡ଼ିଆ" },
  { code: "ro",  name: "Romanian",             nativeName: "Română" },
  { code: "nl",  name: "Dutch",                nativeName: "Nederlands" },
  { code: "pa",  name: "Punjabi",              nativeName: "ਪੰਜਾਬੀ" },
  { code: "am",  name: "Amharic",              nativeName: "አማርኛ" },
  { code: "yo",  name: "Yoruba",               nativeName: "Yorùbá" },
  { code: "fa",  name: "Persian (Farsi)",      nativeName: "فارسی",          rtl: true },
  { code: "ig",  name: "Igbo",                 nativeName: "Igbo" },
  { code: "my",  name: "Burmese",              nativeName: "မြန်မာဘာသာ" },
  { code: "si",  name: "Sinhala",              nativeName: "සිංහල" },
  { code: "km",  name: "Khmer",                nativeName: "ភាសាខ្មែរ" },
  { code: "zu",  name: "Zulu",                 nativeName: "isiZulu" },
  { code: "el",  name: "Greek",                nativeName: "Ελληνικά" },
  { code: "cs",  name: "Czech",                nativeName: "Čeština" },
  { code: "hu",  name: "Hungarian",            nativeName: "Magyar" },
  { code: "sv",  name: "Swedish",              nativeName: "Svenska" },
  { code: "af",  name: "Afrikaans",            nativeName: "Afrikaans" },
  { code: "sr",  name: "Serbian",              nativeName: "Српски" },
  { code: "ne",  name: "Nepali",               nativeName: "नेपाली" },
  { code: "da",  name: "Danish",               nativeName: "Dansk" },
  { code: "fi",  name: "Finnish",              nativeName: "Suomi" },
  { code: "no",  name: "Norwegian",            nativeName: "Norsk" },
  { code: "he",  name: "Hebrew",               nativeName: "עברית",          rtl: true },
  { code: "sk",  name: "Slovak",               nativeName: "Slovenčina" },
  { code: "hr",  name: "Croatian",             nativeName: "Hrvatski" },
  { code: "ms",  name: "Malay",                nativeName: "Bahasa Melayu" },
  { code: "ca",  name: "Catalan",              nativeName: "Català" },
  { code: "tl",  name: "Filipino",             nativeName: "Filipino" },
  { code: "kk",  name: "Kazakh",               nativeName: "Қазақша" },
  { code: "az",  name: "Azerbaijani",          nativeName: "Azərbaycan" },
  { code: "uz",  name: "Uzbek",                nativeName: "O'zbek" },
  { code: "bg",  name: "Bulgarian",            nativeName: "Български" },
  { code: "lt",  name: "Lithuanian",           nativeName: "Lietuvių" },
  { code: "lv",  name: "Latvian",              nativeName: "Latviešu" },
  { code: "et",  name: "Estonian",             nativeName: "Eesti" },
  { code: "sl",  name: "Slovenian",            nativeName: "Slovenščina" },
  { code: "sq",  name: "Albanian",             nativeName: "Shqip" },
  { code: "mk",  name: "Macedonian",           nativeName: "Македонски" },
  { code: "bs",  name: "Bosnian",              nativeName: "Bosanski" },
  { code: "be",  name: "Belarusian",           nativeName: "Беларуская" },
  { code: "hy",  name: "Armenian",             nativeName: "Հայերեն" },
  { code: "ka",  name: "Georgian",             nativeName: "ქართული" },
  { code: "is",  name: "Icelandic",            nativeName: "Íslenska" },
  { code: "ga",  name: "Irish",                nativeName: "Gaeilge" },
  { code: "cy",  name: "Welsh",                nativeName: "Cymraeg" },
  { code: "eu",  name: "Basque",               nativeName: "Euskara" },
  { code: "gl",  name: "Galician",             nativeName: "Galego" },
  { code: "mt",  name: "Maltese",              nativeName: "Malti" },
  { code: "lb",  name: "Luxembourgish",        nativeName: "Lëtzebuergesch" },
  { code: "mn",  name: "Mongolian",            nativeName: "Монгол" },
  { code: "ky",  name: "Kyrgyz",               nativeName: "Кыргызча" },
  { code: "tg",  name: "Tajik",                nativeName: "Тоҷикӣ" },
  { code: "tk",  name: "Turkmen",              nativeName: "Türkmençe" },
  { code: "ps",  name: "Pashto",               nativeName: "پښتو",           rtl: true },
  { code: "so",  name: "Somali",               nativeName: "Soomaali" },
  { code: "mg",  name: "Malagasy",             nativeName: "Malagasy" },
  { code: "st",  name: "Sesotho",              nativeName: "Sesotho" },
  { code: "sn",  name: "Shona",                nativeName: "chiShona" },
  { code: "xh",  name: "Xhosa",                nativeName: "isiXhosa" },
  { code: "lo",  name: "Lao",                  nativeName: "ພາສາລາວ" },
  { code: "jv",  name: "Javanese",             nativeName: "Basa Jawa" },
  { code: "su",  name: "Sundanese",            nativeName: "Basa Sunda" },
  { code: "ceb", name: "Cebuano",              nativeName: "Cebuano" },
  { code: "ht",  name: "Haitian Creole",       nativeName: "Kreyòl ayisyen" },
  { code: "eo",  name: "Esperanto",            nativeName: "Esperanto" },
  { code: "ug",  name: "Uyghur",               nativeName: "ئۇيغۇرچە",       rtl: true },
  { code: "sd",  name: "Sindhi",               nativeName: "سنڌي",           rtl: true },
  { code: "ku",  name: "Kurdish (Sorani)",      nativeName: "کوردی",          rtl: true },
  { code: "bo",  name: "Tibetan",              nativeName: "བོད་སྐད།" },
  { code: "hmn", name: "Hmong",                nativeName: "Hmoob" },
];

export const RTL_LANGS = new Set(
  LANGUAGES.filter((l) => l.rtl).map((l) => l.code),
);

export function isRTL(lang: string): boolean {
  if (RTL_LANGS.has(lang)) return true;
  const base = lang.split("-")[0]!;
  return RTL_LANGS.has(base);
}

/**
 * Find a Language entry by its code. Checks exact match first (e.g. "en-GB"),
 * then falls back to base-code match (e.g. "en" → en-GB as first English entry).
 */
export function getLang(code: string): Language | undefined {
  // 1. Exact match (handles "en-GB", "en-US", "fr", etc.)
  const exact = LANGUAGES.find((l) => l.code === code);
  if (exact) return exact;
  // 2. Base-code match (legacy "en" → first English variant = en-GB)
  const base = code.split("-")[0]!.toLowerCase();
  return LANGUAGES.find((l) => l.code.split("-")[0]!.toLowerCase() === base);
}
