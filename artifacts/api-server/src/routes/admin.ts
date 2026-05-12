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

// ── Serializer ───────────────────────────────────────────────────────────────
// Generates the TypeScript source block for one exercise entry in MOBILITY_POSE_LIBRARY.

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

// ── File updater ──────────────────────────────────────────────────────────────
// Finds the exercise block by name and replaces it with newly serialized content.
// The regex matches:   "Exercise Name": [  …  ],
// where the closing ],  has exactly 2 spaces of indentation (distinguishing it
// from inner array closings which use 4+ spaces).

async function updateExerciseBlock(exerciseName: string, newBlock: string): Promise<void> {
  const source = await readFile(POSES_FILE, "utf-8");

  const escaped = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match from the opening key line up to (and including) the next \n  ], at 2-space indent
  const blockRe = new RegExp(`  "${escaped}": \\[[\\s\\S]*?\\n  \\],`, "g");

  if (!blockRe.test(source)) {
    throw new Error(`Exercise "${exerciseName}" not found in MOBILITY_POSE_LIBRARY`);
  }
  blockRe.lastIndex = 0;

  const updated = source.replace(blockRe, newBlock);
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

  // Basic shape validation
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

export default router;
