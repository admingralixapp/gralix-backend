/**
 * tag-exercises.ts — AI-powered semantic tagging for mobility exercises
 *
 * Analyses un-annotated exercise definitions and uses an LLM to produce
 * structured `goals` and `restrictions` tags compatible with the
 * STRETCH_TAGS map in mobility-service.ts.
 *
 * Output: artifacts/cali-coach/src/lib/mobility-tags.generated.json
 *   A flat JSON object keyed by exercise ID:
 *   {
 *     "exerciseId": {
 *       "goals":        ["handstand", "push", ...],   // MobilityGoal values
 *       "restrictions": ["Wrists", "Shoulders", ...]  // StiffnessArea values
 *     }
 *   }
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run tag-exercises
 *
 * Requirements:
 *   AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY
 *   (set automatically by Replit AI Integrations), or OPENAI_API_KEY.
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ── Setup ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "../../");
const OUT_PATH  = resolve(ROOT, "artifacts/cali-coach/src/lib/mobility-tags.generated.json");

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
  apiKey:  process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? process.env["OPENAI_API_KEY"] ?? "no-key",
  timeout: 60_000,
});

// ── Domain vocabulary ─────────────────────────────────────────────────────────

const VALID_GOALS = [
  "pull", "front-lever", "muscle-up", "push", "handstand", "core", "legs", "general",
] as const;

const VALID_RESTRICTIONS = [
  "Wrists", "Shoulders", "Lower Back", "Ankles", "Hips",
] as const;

type MobilityGoal  = (typeof VALID_GOALS)[number];
type StiffnessArea = (typeof VALID_RESTRICTIONS)[number];

interface ExerciseTags {
  goals:        MobilityGoal[];
  restrictions: StiffnessArea[];
}

type TagsOutput = Record<string, ExerciseTags>;

// ── Exercises to tag ──────────────────────────────────────────────────────────
//
// Add any new un-annotated exercises here before running.
// Each entry needs: id, name, targetMuscles, description.

interface ExerciseSpec {
  id:            string;
  name:          string;
  targetMuscles: string[];
  description:   string;
}

const EXERCISES_TO_TAG: ExerciseSpec[] = [
  // ── Examples — replace or extend with your new exercises ─────────────────
  {
    id:            "pike",
    name:          "Pike Stretch",
    targetMuscles: ["Hamstrings", "Lower Back", "Calves"],
    description:   "Stand with feet together. Hinge forward at the hips with a flat back, reaching both hands toward your feet. Hold and breathe deeply.",
  },
  {
    id:            "elephantWalks",
    name:          "Elephant Walks",
    targetMuscles: ["Hamstrings", "Calves", "Lower Back"],
    description:   "Start in a downward-dog position. Alternately bend one knee while straightening the other, 'walking' through the hamstrings. 10 reps each side.",
  },
  {
    id:            "hipFlexorStretch",
    name:          "Hip Flexor Stretch",
    targetMuscles: ["Hip Flexors", "Psoas", "Quads"],
    description:   "Kneel on one knee with the opposite foot forward. Push hips gently forward and down while keeping the torso upright. Hold 30 s each side.",
  },
  // Add more exercises here ...
];

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(exercises: ExerciseSpec[]): string {
  const exerciseList = exercises
    .map(
      (e, i) =>
        `${i + 1}. id="${e.id}" name="${e.name}"\n   muscles: ${e.targetMuscles.join(", ")}\n   description: ${e.description}`,
    )
    .join("\n\n");

  return `You are a calisthenics biomechanics expert. Analyse each mobility exercise below and return structured semantic tags.

VALID GOALS (skill-tree goals the stretch directly supports):
${VALID_GOALS.join(", ")}

VALID RESTRICTIONS (body areas whose tightness this stretch addresses):
${VALID_RESTRICTIONS.join(", ")}

TAGGING RULES:
- goals: Include every goal for which this stretch provides a meaningful benefit. A stretch targeting hamstrings + lower back should include "legs", "core", and "front-lever". A wrist-loading stretch should include "handstand", "push", "pull", "muscle-up". When unsure, be inclusive rather than exclusive.
- restrictions: Include every StiffnessArea that this stretch directly mobilises. If the description mentions multiple body regions, include all matching areas.
- Only use values from the VALID lists above — no other values.
- Always include at least one goal and one restriction per exercise.

EXERCISES:
${exerciseList}

Respond with a single JSON object (no markdown fences, no commentary):
{
  "exerciseId": { "goals": [...], "restrictions": [...] },
  ...
}`;
}

// ── Tag engine ────────────────────────────────────────────────────────────────

async function tagExercises(exercises: ExerciseSpec[]): Promise<TagsOutput> {
  if (exercises.length === 0) {
    console.log("No exercises to tag.");
    return {};
  }

  console.log(`Tagging ${exercises.length} exercise(s) via LLM...`);

  const completion = await openai.chat.completions.create({
    model:       "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role:    "user",
        content: buildPrompt(exercises),
      },
    ],
  });

  const rawText = completion.choices[0]?.message.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    console.error("LLM returned non-JSON response:\n", rawText);
    throw new Error("Failed to parse LLM response as JSON.");
  }

  // Validate and normalise the output
  const result: TagsOutput = {};
  for (const [id, raw] of Object.entries(parsed)) {
    const entry = raw as { goals?: unknown; restrictions?: unknown };

    const goals = (Array.isArray(entry.goals) ? entry.goals : []).filter(
      (g): g is MobilityGoal => (VALID_GOALS as readonly string[]).includes(g as string),
    );

    const restrictions = (
      Array.isArray(entry.restrictions) ? entry.restrictions : []
    ).filter(
      (r): r is StiffnessArea =>
        (VALID_RESTRICTIONS as readonly string[]).includes(r as string),
    );

    if (goals.length === 0) {
      console.warn(`  ⚠  No valid goals returned for "${id}" — skipping.`);
      continue;
    }
    if (restrictions.length === 0) {
      console.warn(`  ⚠  No valid restrictions returned for "${id}" — skipping.`);
      continue;
    }

    result[id] = { goals, restrictions };
    console.log(`  ✓  ${id}: goals=[${goals.join(", ")}] restrictions=[${restrictions.join(", ")}]`);
  }

  return result;
}

// ── Merge with existing output ────────────────────────────────────────────────

function loadExisting(): TagsOutput {
  if (!existsSync(OUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUT_PATH, "utf-8")) as TagsOutput;
  } catch {
    return {};
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const existing = loadExisting();

  // Only tag exercises not already in the output (resume support)
  const toTag = EXERCISES_TO_TAG.filter((e) => !(e.id in existing));

  if (toTag.length === 0) {
    console.log("All exercises already tagged. Nothing to do.");
    console.log("(Delete entries from the output file to re-tag them.)");
    return;
  }

  // Process in batches of 10 to stay within context limits
  const BATCH = 10;
  const merged: TagsOutput = { ...existing };

  for (let i = 0; i < toTag.length; i += BATCH) {
    const batch = toTag.slice(i, i + BATCH);
    console.log(`\nBatch ${Math.floor(i / BATCH) + 1}/${Math.ceil(toTag.length / BATCH)} (${batch.length} exercises)`);
    const tags = await tagExercises(batch);
    Object.assign(merged, tags);
  }

  writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  console.log(`\n✅  Tags saved to:\n   ${OUT_PATH}`);
  console.log("\nNext steps:");
  console.log("  1. Review the generated JSON for accuracy.");
  console.log("  2. Copy correct entries into the STRETCH_TAGS map in:");
  console.log("     artifacts/cali-coach/src/lib/mobility-service.ts");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
