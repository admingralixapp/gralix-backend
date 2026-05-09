/**
 * translate-elevenlabs-gaps.ts
 * One-shot script: fills missing keys ONLY for the 13 remaining ElevenLabs languages.
 * Run once: pnpm --filter @workspace/scripts run translate:gaps
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../");
const EN_PATH = resolve(ROOT, "artifacts/cali-coach/public/locales/en/translation.json");
const OUT_DIR = resolve(ROOT, "artifacts/cali-coach/public/locales");

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? process.env["OPENAI_API_KEY"] ?? "no-key",
  timeout: 120_000,
});

const TARGETS: Array<{ code: string; name: string }> = [
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "es", name: "Spanish" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "zh", name: "Mandarin Chinese" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function flattenKeys(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") result[key] = v;
    else if (typeof v === "object" && v !== null) Object.assign(result, flattenKeys(v, key));
  }
  return result;
}

function rebuildTree(original: Record<string, unknown>, translated: Record<string, string>, prefix = ""): unknown {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(original)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") result[k] = translated[key] ?? v;
    else if (typeof v === "object" && v !== null) result[k] = rebuildTree(v as Record<string, unknown>, translated, key);
    else result[k] = v;
  }
  return result;
}

const SYSTEM_PROMPT = (lang: string) =>
  `You are a professional calisthenics coach and expert translator.
Translate the provided JSON UI strings into ${lang} using athletic, motivating, and technically accurate fitness terminology.
Rules:
- Keep the exact same JSON key names
- Preserve all template variables like {{name}}, {{count}}, {{date}} exactly as-is
- Keep calisthenics terms accurate (rep, set, form score, mastery)
- Use an energetic, motivating coaching tone
- Return ONLY valid JSON with no additional commentary or markdown fences`;

async function translateChunk(chunk: Record<string, string>, lang: string, retries = 4): Promise<Record<string, string>> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: SYSTEM_PROMPT(lang) },
          { role: "user", content: JSON.stringify(chunk, null, 2) },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      return JSON.parse(cleaned) as Record<string, string>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = msg.includes("429") || msg.toLowerCase().includes("rate limit");
      if (attempt < retries - 1) {
        const delay = isRate ? Math.pow(2, attempt + 1) * 1000 + Math.random() * 500 : 2000;
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("All retries exhausted");
}

async function processLanguage(code: string, name: string, flatEn: Record<string, string>, enTree: unknown) {
  const outPath = resolve(OUT_DIR, code, "translation.json");
  const existing = JSON.parse(readFileSync(outPath, "utf8")) as unknown;
  const flatExisting = flattenKeys(existing);
  const missing = Object.entries(flatEn).filter(([k]) => !(k in flatExisting));

  if (missing.length === 0) {
    console.log(`  ✓ ${name} (${code}) — already up to date`);
    return;
  }

  console.log(`  ⟳ ${name} (${code}) — filling ${missing.length} missing keys…`);
  const translated: Record<string, string> = {};
  const CHUNK = 100;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const obj = Object.fromEntries(missing.slice(i, i + CHUNK));
    Object.assign(translated, await translateChunk(obj, name));
    await sleep(200);
  }

  const merged = { ...flatExisting, ...translated };
  const finalTree = rebuildTree(enTree as Record<string, unknown>, merged);
  writeFileSync(outPath, JSON.stringify(finalTree, null, 2) + "\n", "utf8");
  console.log(`  ✅ ${name} (${code}) — done (+${missing.length} keys)`);
}

async function runConcurrent<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const item = items[idx++];
      await fn(item!);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  console.log("🌍 ElevenLabs Gap Fill — 13 languages × 54 keys\n");
  const enJson = JSON.parse(readFileSync(EN_PATH, "utf8")) as unknown;
  const flatEn = flattenKeys(enJson);

  await runConcurrent(TARGETS, 4, async ({ code, name }) => {
    try { await processLanguage(code, name, flatEn, enJson); }
    catch (err) { console.error(`  ❌ ${name} (${code}): ${(err as Error).message}`); }
    await sleep(250);
  });

  console.log("\n✨ Gap fill complete!");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
