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
  return `    { type: "${a.type}", x1: ${a.x1}, y1: ${a.y1}, x2: ${a.x2}, y2: ${a.y2} },`;
}

function serializeWorldObjectsEntry(exerciseName: string, anchors: EnvAnchorPayload[]): string {
  const rows = anchors.map(serializeEnvAnchor).join("\n");
  return `  "${exerciseName}": [\n${rows}\n  ],`;
}

// ── File updaters ─────────────────────────────────────────────────────────────

async function updateExerciseBlock(exerciseName: string, newBlock: string): Promise<void> {
  const source = await readFile(POSES_FILE, "utf-8");

  const escaped = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`  "${escaped}": \\[[\\s\\S]*?\\n  \\],`, "g");

  if (!blockRe.test(source)) {
    throw new Error(`Exercise "${exerciseName}" not found in MOBILITY_POSE_LIBRARY`);
  }
  blockRe.lastIndex = 0;

  const updated = source.replace(blockRe, newBlock);
  await writeFile(POSES_FILE, updated, "utf-8");
}

async function updateWorldObjects(exerciseName: string, anchors: EnvAnchorPayload[]): Promise<void> {
  const source = await readFile(POSES_FILE, "utf-8");

  const SENTINEL = "// <<<WORLD_OBJECTS_END>>>";
  if (!source.includes(SENTINEL)) {
    throw new Error("World objects sentinel not found in exercise-poses.ts");
  }

  const escaped = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryRe = new RegExp(`  "${escaped}": \\[[\\s\\S]*?\\n  \\],\\n`, "g");

  let updated: string;

  if (anchors.length === 0) {
    // Remove the entry if it exists
    updated = source.replace(entryRe, "");
  } else {
    const newEntry = serializeWorldObjectsEntry(exerciseName, anchors);
    if (entryRe.test(source)) {
      entryRe.lastIndex = 0;
      updated = source.replace(entryRe, `${newEntry}\n`);
    } else {
      // Insert before the sentinel
      updated = source.replace(SENTINEL, `${newEntry}\n${SENTINEL}`);
    }
  }

  await writeFile(POSES_FILE, updated, "utf-8");
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// PUT /api/admin/poses/:name — write updated frame data to exercise-poses.ts
router.put("/admin/poses/:name", async (req: Request, res: Response) => {
  const exerciseName = decodeURIComponent(req.params.name);
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
  const exerciseName = decodeURIComponent(req.params.name);
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
    res.json({ ok: true, message: `Updated world objects for "${exerciseName}"` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
