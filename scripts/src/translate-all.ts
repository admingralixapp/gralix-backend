/**
 * translate-all.ts — AI-powered bulk translation for CaliCoach
 *
 * Reads the base English locale (public/locales/en/translation.json) and
 * translates every key into all 100 target languages using OpenAI's GPT model.
 *
 * Features:
 *  - Skips languages that already have a translation file (resume support)
 *  - Translates using athletic, motivating, and technically accurate phrasing
 *  - Retries on rate-limit errors with exponential backoff
 *  - Processes 3 languages concurrently for speed
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run translate
 *
 * Requirements:
 *   AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY
 *   (set automatically by Replit), or OPENAI_API_KEY for direct OpenAI access.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ── Setup ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../");
const EN_PATH = resolve(ROOT, "artifacts/cali-coach/public/locales/en/translation.json");
const OUT_DIR = resolve(ROOT, "artifacts/cali-coach/public/locales");

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? process.env["OPENAI_API_KEY"] ?? "no-key",
  timeout: 120_000, // 2 min per request
});

// ── Language list (must match src/i18n/languages.ts) ─────────────────────────

const ALL_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "zh",  name: "Mandarin Chinese" },
  { code: "hi",  name: "Hindi" },
  { code: "es",  name: "Spanish" },
  { code: "fr",  name: "French" },
  { code: "ar",  name: "Arabic" },
  { code: "bn",  name: "Bengali" },
  { code: "ru",  name: "Russian" },
  { code: "pt",  name: "Portuguese" },
  { code: "ur",  name: "Urdu" },
  { code: "id",  name: "Indonesian" },
  { code: "de",  name: "German" },
  { code: "ja",  name: "Japanese" },
  { code: "sw",  name: "Swahili" },
  { code: "mr",  name: "Marathi" },
  { code: "te",  name: "Telugu" },
  { code: "tr",  name: "Turkish" },
  { code: "ta",  name: "Tamil" },
  { code: "vi",  name: "Vietnamese" },
  { code: "ko",  name: "Korean" },
  { code: "it",  name: "Italian" },
  { code: "ha",  name: "Hausa" },
  { code: "th",  name: "Thai" },
  { code: "gu",  name: "Gujarati" },
  { code: "kn",  name: "Kannada" },
  { code: "pl",  name: "Polish" },
  { code: "uk",  name: "Ukrainian" },
  { code: "ml",  name: "Malayalam" },
  { code: "or",  name: "Odia" },
  { code: "ro",  name: "Romanian" },
  { code: "nl",  name: "Dutch" },
  { code: "pa",  name: "Punjabi" },
  { code: "am",  name: "Amharic" },
  { code: "yo",  name: "Yoruba" },
  { code: "fa",  name: "Persian (Farsi)" },
  { code: "ig",  name: "Igbo" },
  { code: "my",  name: "Burmese" },
  { code: "si",  name: "Sinhala" },
  { code: "km",  name: "Khmer" },
  { code: "zu",  name: "Zulu" },
  { code: "el",  name: "Greek" },
  { code: "cs",  name: "Czech" },
  { code: "hu",  name: "Hungarian" },
  { code: "sv",  name: "Swedish" },
  { code: "af",  name: "Afrikaans" },
  { code: "sr",  name: "Serbian" },
  { code: "ne",  name: "Nepali" },
  { code: "da",  name: "Danish" },
  { code: "fi",  name: "Finnish" },
  { code: "no",  name: "Norwegian" },
  { code: "he",  name: "Hebrew" },
  { code: "sk",  name: "Slovak" },
  { code: "hr",  name: "Croatian" },
  { code: "ms",  name: "Malay" },
  { code: "ca",  name: "Catalan" },
  { code: "tl",  name: "Filipino" },
  { code: "kk",  name: "Kazakh" },
  { code: "az",  name: "Azerbaijani" },
  { code: "uz",  name: "Uzbek" },
  { code: "bg",  name: "Bulgarian" },
  { code: "lt",  name: "Lithuanian" },
  { code: "lv",  name: "Latvian" },
  { code: "et",  name: "Estonian" },
  { code: "sl",  name: "Slovenian" },
  { code: "sq",  name: "Albanian" },
  { code: "mk",  name: "Macedonian" },
  { code: "bs",  name: "Bosnian" },
  { code: "be",  name: "Belarusian" },
  { code: "hy",  name: "Armenian" },
  { code: "ka",  name: "Georgian" },
  { code: "is",  name: "Icelandic" },
  { code: "ga",  name: "Irish" },
  { code: "cy",  name: "Welsh" },
  { code: "eu",  name: "Basque" },
  { code: "gl",  name: "Galician" },
  { code: "mt",  name: "Maltese" },
  { code: "lb",  name: "Luxembourgish" },
  { code: "mn",  name: "Mongolian" },
  { code: "ky",  name: "Kyrgyz" },
  { code: "tg",  name: "Tajik" },
  { code: "tk",  name: "Turkmen" },
  { code: "ps",  name: "Pashto" },
  { code: "so",  name: "Somali" },
  { code: "mg",  name: "Malagasy" },
  { code: "st",  name: "Sesotho" },
  { code: "sn",  name: "Shona" },
  { code: "xh",  name: "Xhosa" },
  { code: "lo",  name: "Lao" },
  { code: "jv",  name: "Javanese" },
  { code: "su",  name: "Sundanese" },
  { code: "ceb", name: "Cebuano" },
  { code: "ht",  name: "Haitian Creole" },
  { code: "eo",  name: "Esperanto" },
  { code: "ug",  name: "Uyghur" },
  { code: "sd",  name: "Sindhi" },
  { code: "ku",  name: "Kurdish (Sorani)" },
  { code: "bo",  name: "Tibetan" },
  { code: "hmn", name: "Hmong" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function flattenKeys(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      result[key] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(result, flattenKeys(v, key));
    }
  }
  return result;
}

function unflattenKeys(flat: Record<string, string>): unknown {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

// ── Core translation function ─────────────────────────────────────────────────

const CHUNK_SIZE = 100; // keep each API call small and fast

const SYSTEM_PROMPT_TEMPLATE = (lang: string) =>
  `You are a professional calisthenics coach and expert translator.
Translate the provided JSON UI strings into ${lang} using athletic, motivating, and technically accurate fitness terminology.

Rules:
- Keep the exact same JSON key names (do NOT translate keys)
- Preserve all template variables like {{name}}, {{count}}, {{price}} exactly as-is
- Keep calisthenics terms accurate (e.g. "rep", "set", "form score", "mastery")
- Use an energetic, motivating coaching tone appropriate for a fitness app
- Return ONLY valid JSON with no additional commentary or markdown fences`;

async function translateChunk(
  chunk: Record<string, string>,
  targetLanguage: string,
  retries = 4,
): Promise<Record<string, string>> {
  const jsonInput = JSON.stringify(chunk, null, 2);
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(targetLanguage);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: jsonInput },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      return JSON.parse(cleaned) as Record<string, string>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate limit");

      if (attempt < retries - 1) {
        const delay = isRateLimit
          ? Math.pow(2, attempt + 1) * 1000 + Math.random() * 500
          : 2000;
        if (isRateLimit) console.warn(`  ⚠ Rate limited — retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`All ${retries} retries exhausted for chunk in ${targetLanguage}`);
}

// ── Per-language runner ───────────────────────────────────────────────────────

async function translateLanguage(
  code: string,
  name: string,
  flatEn: Record<string, string>,
  originalTree: unknown,
): Promise<void> {
  const outPath = resolve(OUT_DIR, code, "translation.json");

  if (existsSync(outPath)) {
    console.log(`  ✓ ${name} (${code}) — already exists, skipping`);
    return;
  }

  const entries = Object.entries(flatEn);
  const totalChunks = Math.ceil(entries.length / CHUNK_SIZE);
  console.log(`  ⟳ ${name} (${code}) — translating ${entries.length} strings in ${totalChunks} chunks...`);

  const translated: Record<string, string> = {};
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunkEntries = entries.slice(i, i + CHUNK_SIZE);
    const chunkObj = Object.fromEntries(chunkEntries);
    const chunkResult = await translateChunk(chunkObj, name);
    Object.assign(translated, chunkResult);
    await sleep(200); // brief pause between chunks
  }

  const finalTree = rebuildTree(originalTree as Record<string, unknown>, translated);

  mkdirSync(resolve(OUT_DIR, code), { recursive: true });
  writeFileSync(outPath, JSON.stringify(finalTree, null, 2) + "\n", "utf8");
  console.log(`  ✅ ${name} (${code}) — done`);
}

function rebuildTree(
  original: Record<string, unknown>,
  translated: Record<string, string>,
  prefix = "",
): unknown {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(original)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      result[k] = translated[key] ?? v; // fall back to English if missing
    } else if (typeof v === "object" && v !== null) {
      result[k] = rebuildTree(v as Record<string, unknown>, translated, key);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── Batch concurrency ─────────────────────────────────────────────────────────

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const item = items[idx++];
      await fn(item!);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌍 CaliCoach Translation Pipeline");
  console.log(`   Source: ${EN_PATH}`);
  console.log(`   Target: ${ALL_LANGUAGES.length} languages\n`);

  const enJson = JSON.parse(readFileSync(EN_PATH, "utf8")) as unknown;
  const flatEn = flattenKeys(enJson);

  console.log(`📝 ${Object.keys(flatEn).length} strings to translate per language\n`);

  let completed = 0;
  let failed = 0;

  await runConcurrent(
    ALL_LANGUAGES,
    3, // 3 concurrent languages
    async ({ code, name }) => {
      try {
        await translateLanguage(code, name, flatEn, enJson);
        completed++;
      } catch (err) {
        console.error(`  ❌ ${name} (${code}) — FAILED: ${(err as Error).message}`);
        failed++;
      }
      // Small pause between batches to be kind to rate limits
      await sleep(300);
    },
  );

  console.log(`\n✨ Translation complete!`);
  console.log(`   ✅ ${completed} languages translated`);
  if (failed > 0) console.log(`   ❌ ${failed} languages failed (re-run to retry)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
