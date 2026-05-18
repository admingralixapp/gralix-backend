import { Router, type Request, type Response } from "express";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

// process.cwd() = artifacts/api-server/ at runtime; one level up reaches artifacts/
const POSES_FILE = resolve(process.cwd(), "../cali-coach/src/lib/exercise-poses.ts");

// ── Types ────────────────────────────────────────────────────────────────────

interface PoseFrame {
  head: { cx: number; cy: number; r?: number };
  lines: [number, number][][];
  muscleGlow?: { cx: number; cy: number; rx: number; ry: number };
}

interface EnvAnchorPayload {
  type: "floor" | "wall" | "bar" | "box";
  x1: number; y1: number; x2: number; y2: number;
  rotation?: number;
}

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeFrame(frame: PoseFrame, label: string): string {
  const h = frame.head;
  const headStr = `      head: { cx: ${h.cx}, cy: ${h.cy}, r: ${h.r ?? 7} },`;
  const linesStr = frame.lines
    .map(pts => `        [${pts.map(([x, y]) => `[${x},${y}]`).join(",")}],`)
    .join("\n");
  let s = `    { ${label}\n${headStr}\n      lines: [\n${linesStr}\n      ],`;
  if (frame.muscleGlow) {
    const mg = frame.muscleGlow;
    s += `\n      muscleGlow: { cx: ${mg.cx}, cy: ${mg.cy}, rx: ${mg.rx}, ry: ${mg.ry} },`;
  }
  s += `\n    },`;
  return s;
}

function serializePoseSet(exerciseName: string, frames: PoseFrame[]): string {
  const labels = ["// START", "// MID", "// END"];
  return [
    `  "${exerciseName}": [`,
    ...frames.slice(0, 3).map((f, i) => serializeFrame(f, labels[i])),
    `  ],`,
  ].join("\n");
}

function serializeEnvAnchor(a: EnvAnchorPayload): string {
  const base = `    { type: "${a.type}", x1: ${a.x1}, y1: ${a.y1}, x2: ${a.x2}, y2: ${a.y2}`;
  return a.rotation != null && a.rotation !== 0
    ? base + `, rotation: ${a.rotation} },`
    : base + ` },`;
}

function serializeWorldObjectsEntry(exerciseName: string, anchors: EnvAnchorPayload[]): string {
  const rows = anchors.map(serializeEnvAnchor).join("\n");
  return `  "${exerciseName}": [\n${rows}\n  ],`;
}

// ── File updaters ─────────────────────────────────────────────────────────────

async function updateExerciseBlock(exerciseName: string, newBlock: string): Promise<void> {
  const source = await readFile(POSES_FILE, "utf-8");

  // Scope the replacement to ONLY the pose library section (before EXERCISE_WORLD_OBJECTS),
  // so saving frames can never corrupt the world-objects section.
  const WORLD_OBJECTS_MARKER = "export const EXERCISE_WORLD_OBJECTS";
  const markerIdx = source.indexOf(WORLD_OBJECTS_MARKER);
  if (markerIdx === -1) throw new Error("EXERCISE_WORLD_OBJECTS marker not found in exercise-poses.ts");

  const poseSection = source.slice(0, markerIdx);
  const worldSection = source.slice(markerIdx);

  const escaped = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`  "${escaped}": \\[[\\s\\S]*?\\n  \\],`, "g");

  if (blockRe.test(poseSection)) {
    // Exercise already exists in MOBILITY_POSE_LIBRARY — update it in place.
    blockRe.lastIndex = 0;
    const updatedPoseSection = poseSection.replace(blockRe, newBlock);
    await writeFile(POSES_FILE, updatedPoseSection + worldSection, "utf-8");
    return;
  }

  // Exercise not yet in MOBILITY_POSE_LIBRARY (e.g. a skill-tree exercise).
  // Insert it as a new entry immediately before the <<<MOBILITY_LIBRARY_END>>> sentinel.
  const SENTINEL = "// <<<MOBILITY_LIBRARY_END>>>";
  const sentinelIdx = poseSection.indexOf(SENTINEL);
  if (sentinelIdx === -1) {
    throw new Error(`Exercise "${exerciseName}" not found and MOBILITY_LIBRARY_END sentinel is missing — cannot insert.`);
  }

  const before  = poseSection.slice(0, sentinelIdx);
  const after   = poseSection.slice(sentinelIdx);          // includes sentinel + rest
  const updatedPoseSection = before + newBlock + "\n\n" + after;
  await writeFile(POSES_FILE, updatedPoseSection + worldSection, "utf-8");
}

async function updateWorldObjects(exerciseName: string, anchors: EnvAnchorPayload[]): Promise<void> {
  const source = await readFile(POSES_FILE, "utf-8");

  const SENTINEL = "// <<<WORLD_OBJECTS_END>>>";
  const SECTION_MARKER = "export const EXERCISE_WORLD_OBJECTS";

  const sentinelIdx = source.indexOf(SENTINEL);
  if (sentinelIdx === -1) {
    throw new Error("World objects sentinel not found in exercise-poses.ts");
  }
  const sectionIdx = source.indexOf(SECTION_MARKER);
  if (sectionIdx === -1) {
    throw new Error("EXERCISE_WORLD_OBJECTS declaration not found in exercise-poses.ts");
  }

  // Scope all regex operations to ONLY the EXERCISE_WORLD_OBJECTS section,
  // never touching MOBILITY_POSE_LIBRARY or any other part of the file.
  const beforeSection = source.slice(0, sectionIdx);
  const section      = source.slice(sectionIdx, sentinelIdx);
  const suffix       = source.slice(sentinelIdx);   // starts with SENTINEL

  const escaped = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryRe = new RegExp(`  "${escaped}": \\[[\\s\\S]*?\\n  \\],\\n`, "g");

  if (anchors.length === 0) {
    // Remove the entry if it exists inside the section
    const updatedSection = section.replace(entryRe, "");
    await writeFile(POSES_FILE, beforeSection + updatedSection + suffix, "utf-8");
    return;
  }

  const newEntry = serializeWorldObjectsEntry(exerciseName, anchors);

  if (entryRe.test(section)) {
    // Update existing entry inside the section
    entryRe.lastIndex = 0;
    const updatedSection = section.replace(entryRe, `${newEntry}\n`);
    await writeFile(POSES_FILE, beforeSection + updatedSection + suffix, "utf-8");
  } else {
    // No existing entry — insert new one immediately before the sentinel
    const updatedSuffix = suffix.replace(SENTINEL, `${newEntry}\n${SENTINEL}`);
    await writeFile(POSES_FILE, beforeSection + section + updatedSuffix, "utf-8");
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// PUT /api/admin/poses/:name — write updated frame data to exercise-poses.ts
router.put("/admin/poses/:name", async (req: Request, res: Response) => {
  const exerciseName = decodeURIComponent(req.params.name as string);
  const { frames } = req.body as { frames?: PoseFrame[] };

  if (!Array.isArray(frames) || frames.length < 3) {
    res.status(400).json({ error: "frames must be an array of 3 PoseData objects" });
    return;
  }

  for (let i = 0; i < 3; i++) {
    const f = frames[i];
    if (!f?.head || !Array.isArray(f.lines)) {
      res.status(400).json({ error: `Frame ${i} is missing head or lines` });
      return;
    }
  }

  try {
    const block = serializePoseSet(exerciseName, frames);
    await updateExerciseBlock(exerciseName, block);
    res.json({ ok: true, message: `Updated "${exerciseName}" in exercise-poses.ts` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// PUT /api/admin/poses/:name/env — write world objects to EXERCISE_WORLD_OBJECTS
router.put("/admin/poses/:name/env", async (req: Request, res: Response) => {
  const exerciseName = decodeURIComponent(req.params.name as string);
  const { objects } = req.body as { objects?: EnvAnchorPayload[] };

  if (!Array.isArray(objects)) {
    res.status(400).json({ error: "objects must be an array of EnvAnchor" });
    return;
  }

  for (const a of objects) {
    if (!a?.type || typeof a.x1 !== "number" || typeof a.y1 !== "number" ||
        typeof a.x2 !== "number" || typeof a.y2 !== "number") {
      res.status(400).json({ error: "Each anchor needs type, x1, y1, x2, y2" });
      return;
    }
  }

  try {
    await updateWorldObjects(exerciseName, objects);
    res.json({ ok: true, count: objects.length, message: `Saved ${objects.length} world object(s) for "${exerciseName}"` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
