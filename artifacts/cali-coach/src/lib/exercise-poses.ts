/**
 * Exercise Pose Library
 *
 * Defines 3-frame stick-figure pose sets (start, mid, end) for every exercise
 * category in CaliCoach. Coordinates live in a 100×100 SVG viewBox.
 *
 * Each PoseData:
 *   head     — SVG circle params
 *   lines    — array of polylines; each polyline is an array of [x, y] points
 */

export interface PoseData {
  head: { cx: number; cy: number; r: number };
  lines: Array<[number, number][]>;
}

export type PoseSet = [PoseData, PoseData, PoseData]; // [start, mid, end]

export type PoseType =
  | "push-up"
  | "pull-up"
  | "squat"
  | "dip"
  | "plank"
  | "lunge"
  | "hang-core"
  | "muscle-up"
  | "front-lever"
  | "handstand"
  | "human-flag"
  | "dragon-flag"
  | "l-sit"
  | "row"
  | "burpee"
  | "nordic"
  | "mobility"
  | "default";

// ─────────────────────────────────────────────────────────────────────────────
// Pose Library
// Side-view silhouettes (facing right) unless noted.
// ─────────────────────────────────────────────────────────────────────────────

export const POSE_LIBRARY: Record<PoseType, PoseSet> = {

  // ── Push-Up (horizontal push, arms on floor) ───────────────────────────────
  "push-up": [
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],   // shoulder→elbow→wrist (extended)
        [[72,22],[62,30],[40,40],[18,48]],   // torso→hip→knee→ankle
      ],
    },
    {
      head: { cx: 84, cy: 26, r: 6 },
      lines: [
        [[79,30],[70,38],[60,44],[48,50]],   // arm bent (elbow draws back)
        [[70,38],[60,42],[40,52],[18,60]],   // torso→hip→knee→ankle
      ],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
  ],

  // ── Pull-Up (front view, hanging from bar) ─────────────────────────────────
  "pull-up": [
    {
      head: { cx: 50, cy: 33, r: 6 },
      lines: [
        [[50,27],[36,27],[28,14]],           // left arm straight up to bar
        [[50,27],[64,27],[72,14]],           // right arm straight up to bar
        [[50,27],[50,58]],                   // spine
        [[50,58],[42,76],[42,92]],           // left leg
        [[50,58],[58,76],[58,92]],           // right leg
      ],
    },
    {
      head: { cx: 50, cy: 26, r: 6 },
      lines: [
        [[50,20],[36,20],[32,10]],           // left arm (elbow bent, halfway)
        [[50,20],[64,20],[68,10]],           // right arm
        [[50,20],[50,55]],
        [[50,55],[42,72],[42,88]],
        [[50,55],[58,72],[58,88]],
      ],
    },
    {
      head: { cx: 50, cy: 18, r: 6 },
      lines: [
        [[50,12],[36,14],[32,6]],            // arms contracted (chin at bar)
        [[50,12],[64,14],[68,6]],
        [[50,12],[50,48]],
        [[50,48],[42,66],[42,82]],
        [[50,48],[58,66],[58,82]],
      ],
    },
  ],

  // ── Squat (front view, bilateral) ─────────────────────────────────────────
  "squat": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],                   // spine
        [[50,17],[34,26],[30,42]],           // left arm
        [[50,17],[66,26],[70,42]],           // right arm
        [[50,48],[42,68],[40,88]],           // left leg
        [[50,48],[58,68],[60,88]],           // right leg
      ],
    },
    {
      head: { cx: 50, cy: 22, r: 7 },
      lines: [
        [[50,29],[50,52]],                   // spine (torso tips forward)
        [[50,29],[32,36],[22,50]],           // arms out forward
        [[50,29],[68,36],[78,50]],
        [[50,52],[34,64],[28,82]],           // left leg (hip→knee wide out, deep squat)
        [[50,52],[66,64],[72,82]],           // right leg
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
  ],

  // ── Dip (side view, parallel bars) ───────────────────────────────────────
  "dip": [
    {
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50,16],[50,44]],                   // spine
        [[50,16],[34,20],[30,36]],           // left arm (straight down, on bar)
        [[50,16],[66,20],[70,36]],           // right arm
        [[50,44],[44,62],[44,80]],           // left leg (hanging)
        [[50,44],[56,62],[56,80]],           // right leg
      ],
    },
    {
      head: { cx: 50, cy: 20, r: 6 },
      lines: [
        [[50,26],[50,54]],                   // spine
        [[50,26],[34,28],[28,44]],           // left arm (elbow bent ~90°)
        [[50,26],[66,28],[72,44]],           // right arm
        [[50,54],[44,72],[44,88]],
        [[50,54],[56,72],[56,88]],
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50,16],[50,44]],
        [[50,16],[34,20],[30,36]],
        [[50,16],[66,20],[70,36]],
        [[50,44],[44,62],[44,80]],
        [[50,44],[56,62],[56,80]],
      ],
    },
  ],

  // ── Plank (side view, static horizontal hold) ─────────────────────────────
  "plank": [
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
  ],

  // ── Lunge (side view) ─────────────────────────────────────────────────────
  "lunge": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 60, cy: 16, r: 7 },
      lines: [
        [[60,23],[55,52]],                   // torso (slight forward lean)
        [[60,23],[46,30],[40,46]],           // arms
        [[60,23],[74,30],[78,46]],
        [[55,52],[62,70],[70,88]],           // front leg (knee forward)
        [[55,52],[44,68],[38,88]],           // back leg (knee on/near floor)
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
  ],

  // ── Hanging Core (hanging leg/knee raise) ─────────────────────────────────
  "hang-core": [
    {
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50,24],[36,24],[28,12]],           // left arm to bar
        [[50,24],[64,24],[72,12]],           // right arm to bar
        [[50,24],[50,58]],
        [[50,58],[44,78],[44,94]],           // legs hanging straight
        [[50,58],[56,78],[56,94]],
      ],
    },
    {
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50,22],[36,22],[28,10]],
        [[50,22],[64,22],[72,10]],
        [[50,22],[50,50]],
        [[50,50],[38,60],[32,74]],           // knees tucked / legs raised
        [[50,50],[62,60],[68,74]],
      ],
    },
    {
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50,24],[36,24],[28,12]],
        [[50,24],[64,24],[72,12]],
        [[50,24],[50,58]],
        [[50,58],[44,78],[44,94]],
        [[50,58],[56,78],[56,94]],
      ],
    },
  ],

  // ── Muscle-Up (pull → transition → push) ──────────────────────────────────
  "muscle-up": [
    {
      head: { cx: 50, cy: 33, r: 6 },
      lines: [
        [[50,27],[36,27],[28,14]],
        [[50,27],[64,27],[72,14]],
        [[50,27],[50,58]],
        [[50,58],[42,76],[42,92]],
        [[50,58],[58,76],[58,92]],
      ],
    },
    {
      head: { cx: 50, cy: 14, r: 6 },
      lines: [
        [[50,8],[34,10],[28,4]],             // arms — almost fully contracted
        [[50,8],[66,10],[72,4]],
        [[50,8],[50,36]],                    // body shorter (tucked transition)
        [[50,36],[44,52],[44,68]],
        [[50,36],[56,52],[56,68]],
      ],
    },
    {
      head: { cx: 50, cy: 12, r: 6 },
      lines: [
        [[50,6],[34,10],[30,22]],            // arms now BELOW (dip top position)
        [[50,6],[66,10],[70,22]],
        [[50,6],[50,38]],
        [[50,38],[44,56],[44,74]],
        [[50,38],[56,56],[56,74]],
      ],
    },
  ],

  // ── Front Lever (hanging horizontal lever) ────────────────────────────────
  "front-lever": [
    {
      head: { cx: 50, cy: 33, r: 6 },
      lines: [
        [[50,27],[36,27],[28,14]],
        [[50,27],[64,27],[72,14]],
        [[50,27],[50,58]],
        [[50,58],[44,76],[44,92]],
        [[50,58],[56,76],[56,92]],
      ],
    },
    {
      head: { cx: 20, cy: 36, r: 6 },
      lines: [
        [[14,32],[14,28],[14,18]],           // arms up to bar (body now going left→right)
        [[14,28],[40,28]],                   // shoulders bar
        [[14,28],[50,38],[78,45]],           // spine going horizontal
        [[78,45],[82,38],[90,32]],           // legs
        [[78,45],[84,52],[92,58]],
      ],
    },
    {
      head: { cx: 14, cy: 38, r: 6 },
      lines: [
        [[14,32],[14,26],[14,16]],
        [[14,26],[40,26]],
        [[14,26],[50,36],[82,36]],           // full lever (fully horizontal)
        [[82,36],[86,30],[90,24]],
        [[82,36],[86,42],[90,48]],
      ],
    },
  ],

  // ── Handstand (inverted, balance on hands) ────────────────────────────────
  "handstand": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 38, r: 6 },
      lines: [
        [[50,44],[50,66]],                   // torso (going down, partially inverted)
        [[50,44],[36,46],[30,60]],           // arms reaching floor
        [[50,44],[64,46],[70,60]],
        [[50,66],[42,52],[38,36]],           // legs going up
        [[50,66],[58,52],[62,36]],
      ],
    },
    {
      head: { cx: 50, cy: 88, r: 6 },
      lines: [
        [[50,82],[50,58]],                   // torso (fully inverted)
        [[50,58],[42,36],[40,14]],           // legs up straight
        [[50,58],[58,36],[60,14]],
        [[50,82],[36,88],[30,96]],           // arms on floor
        [[50,82],[64,88],[70,96]],
      ],
    },
  ],

  // ── Human Flag (side-body hold on vertical pole) ──────────────────────────
  "human-flag": [
    {
      head: { cx: 12, cy: 30, r: 6 },
      lines: [
        [[12,36],[12,62]],                   // body at pole (vertical)
        [[12,36],[6,26]],                    // upper arm at pole
        [[12,36],[22,26]],                   // lower arm at pole
        [[12,62],[6,78],[4,92]],
        [[12,62],[18,78],[20,92]],
      ],
    },
    {
      head: { cx: 12, cy: 36, r: 6 },
      lines: [
        [[12,42],[12,28]],                   // arms at pole
        [[12,28],[8,18]],
        [[12,28],[18,18]],
        [[12,42],[36,48],[56,54]],           // body going sideways (tuck)
        [[56,54],[58,44],[62,38]],           // legs tucked
        [[56,54],[60,62],[64,72]],
      ],
    },
    {
      head: { cx: 12, cy: 38, r: 6 },
      lines: [
        [[12,44],[12,30]],
        [[12,30],[8,20]],
        [[12,30],[18,20]],
        [[12,44],[40,44],[72,44],[88,44]],   // body fully horizontal
        [[88,44],[88,38],[88,32]],           // legs (feet)
        [[88,44],[88,50],[88,56]],
      ],
    },
  ],

  // ── Dragon Flag (supine, legs raised from bench) ──────────────────────────
  "dragon-flag": [
    {
      head: { cx: 14, cy: 50, r: 6 },
      lines: [
        [[14,56],[14,58]],                   // neck stub
        [[14,58],[50,58],[82,58]],           // body lying flat on bench
        [[82,58],[82,52],[82,44]],           // legs flat (pointing right)
        [[82,58],[82,64],[82,72]],
        [[14,56],[10,52]],                   // arms gripping behind head
        [[14,56],[18,52]],
      ],
    },
    {
      head: { cx: 14, cy: 52, r: 6 },
      lines: [
        [[14,58],[14,60]],
        [[14,60],[36,58],[52,52]],           // body angled upward
        [[52,52],[60,38],[64,24]],           // legs raised ~45°
        [[64,24],[68,18],[70,14]],
        [[14,58],[10,54]],
        [[14,58],[18,54]],
      ],
    },
    {
      head: { cx: 14, cy: 50, r: 6 },
      lines: [
        [[14,56],[14,58]],
        [[14,58],[50,58],[82,58]],
        [[82,58],[82,52],[82,44]],
        [[82,58],[82,64],[82,72]],
        [[14,56],[10,52]],
        [[14,56],[18,52]],
      ],
    },
  ],

  // ── L-Sit (support hold, legs horizontal) ─────────────────────────────────
  "l-sit": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,50]],                   // spine
        [[50,25],[32,30],[22,46]],           // arms straight down (pressing)
        [[50,25],[68,30],[78,46]],
        [[50,50],[38,50],[20,50]],           // left leg horizontal (L-sit)
        [[50,50],[62,50],[80,50]],           // right leg horizontal
      ],
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,50]],
        [[50,25],[32,30],[22,46]],
        [[50,25],[68,30],[78,46]],
        [[50,50],[38,50],[20,50]],
        [[50,50],[62,50],[80,50]],
      ],
    },
  ],

  // ── Row (Australian row / inverted row) ───────────────────────────────────
  "row": [
    {
      head: { cx: 12, cy: 28, r: 6 },
      lines: [
        [[12,34],[50,48],[88,62]],           // body angled (hanging below bar)
        [[12,34],[16,24]],                   // arms reaching up to bar
        [[12,34],[8,24]],
        [[88,62],[88,72],[88,82]],           // legs extended
        [[88,62],[84,72],[80,82]],
      ],
    },
    {
      head: { cx: 12, cy: 38, r: 6 },
      lines: [
        [[12,44],[50,50],[88,56]],           // body more horizontal (pulling up)
        [[12,44],[16,32]],
        [[12,44],[8,32]],
        [[88,56],[90,68],[92,80]],
        [[88,56],[84,68],[80,80]],
      ],
    },
    {
      head: { cx: 12, cy: 44, r: 6 },
      lines: [
        [[12,50],[50,52],[88,54]],           // chest near bar (body horizontal)
        [[12,50],[16,40]],
        [[12,50],[8,40]],
        [[88,54],[90,66],[92,78]],
        [[88,54],[84,66],[80,78]],
      ],
    },
  ],

  // ── Burpee (compound movement: stand→plank→stand+jump) ────────────────────
  "burpee": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
    {
      head: { cx: 50, cy: 4, r: 7 },        // jump — body higher, arms raised
      lines: [
        [[50,11],[50,42]],
        [[50,11],[30,4],[22,4]],             // arms overhead during jump
        [[50,11],[70,4],[78,4]],
        [[50,42],[40,60],[36,78]],           // legs bent (in air)
        [[50,42],[60,60],[64,78]],
      ],
    },
  ],

  // ── Nordic Curl (kneeling hamstring exercise) ──────────────────────────────
  "nordic": [
    {
      head: { cx: 50, cy: 20, r: 7 },
      lines: [
        [[50,27],[50,54]],                   // spine (kneeling upright)
        [[50,27],[34,36],[30,52]],
        [[50,27],[66,36],[70,52]],
        [[50,54],[42,72],[40,86]],           // lower legs folded under (kneeling)
        [[50,54],[58,72],[60,86]],
      ],
    },
    {
      head: { cx: 50, cy: 38, r: 7 },
      lines: [
        [[50,44],[50,66]],                   // spine (leaning forward)
        [[50,44],[34,40],[26,36]],           // arms out in front
        [[50,44],[66,40],[74,36]],
        [[50,66],[42,76],[42,88]],           // legs still kneeling
        [[50,66],[58,76],[58,88]],
      ],
    },
    {
      head: { cx: 50, cy: 58, r: 7 },       // near floor
      lines: [
        [[50,64],[50,80]],                   // spine nearly horizontal
        [[50,64],[34,60],[22,56]],           // arms bracing fall
        [[50,64],[66,60],[78,56]],
        [[50,80],[42,82],[40,88]],
        [[50,80],[58,82],[60,88]],
      ],
    },
  ],

  // ── Mobility / Stretch (generic daily mobility) ───────────────────────────
  "mobility": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 14, r: 7 },
      lines: [
        [[50,21],[50,50]],                   // spine (bending forward)
        [[50,21],[26,32],[14,48]],           // arms reaching down
        [[50,21],[74,32],[86,48]],
        [[50,50],[44,68],[42,86]],
        [[50,50],[56,68],[58,86]],
      ],
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,52]],
        [[50,25],[22,36],[10,52]],           // arms stretched wide/down
        [[50,25],[78,36],[90,52]],
        [[50,52],[44,70],[42,88]],
        [[50,52],[56,70],[58,88]],
      ],
    },
  ],

  // ── Default (standing, generic) ───────────────────────────────────────────
  "default": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[30,22],[24,38]],           // arms more active
        [[50,17],[70,22],[76,38]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Exercise → Pose Type mapping
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_POSE_MAP: Record<string, PoseType> = {
  // Push family
  "Wall Push-Up":              "push-up",
  "Incline Push-Up":           "push-up",
  "Knee Push-Up":              "push-up",
  "Push-Up":                   "push-up",
  "Diamond Push-Up":           "push-up",
  "Archer Push-Up":            "push-up",
  "Pseudo Planche Push-Up":    "push-up",
  "Pike Push-Up":              "push-up",
  "Elevated Pike Push-Up":     "push-up",
  "Handstand Push-Up":         "push-up",

  // Pull family
  "Scapular Shrugs":           "hang-core",
  "Australian Rows":           "row",
  "Negative Pull-Ups":         "pull-up",
  "Pull-Up":                   "pull-up",
  "Explosive Pull-Up":         "pull-up",
  "Chest-to-Bar Pull-Up":      "pull-up",
  "Archer Pull-Up":            "pull-up",
  "Typewriter Pull-Up":        "pull-up",
  "Weighted Pull-Up":          "pull-up",
  "Ring Pull-Up":              "pull-up",

  // Muscle-Up
  "Muscle-Up":                 "muscle-up",
  "Ring Muscle-Up":            "muscle-up",
  "Weighted Muscle-Up":        "muscle-up",

  // Dip family
  "Dip":                       "dip",
  "Ring Dip":                  "dip",
  "Ring Support Hold":         "dip",
  "Weighted Dip":              "dip",

  // Squat family
  "Assisted Squat":            "squat",
  "Squat":                     "squat",
  "Close-Stance Squat":        "squat",
  "Archer Squat":              "squat",
  "Goblet Squat":              "squat",
  "Weighted Goblet Squat":     "squat",

  // Single-leg squat
  "Pistol Squat":              "squat",
  "Assisted Pistol Squat":     "squat",
  "Shrimp Squat":              "squat",
  "Weighted Pistol Squat":     "squat",
  "Weighted Shrimp Squat":     "squat",

  // Lunge / split squat
  "Lunge":                     "lunge",
  "Bulgarian Split Squat":     "lunge",
  "Weighted Bulgarian Split Squat": "lunge",
  "Step-Up":                   "lunge",

  // Plank / isometric core
  "Plank":                     "plank",
  "Side Plank":                "plank",
  "Hollow Body Hold":          "plank",
  "Planche Lean":              "plank",
  "Tuck Planche":              "plank",
  "Straddle Planche":          "plank",
  "Planche":                   "plank",
  "Weighted Plank":            "plank",
  "Ring Support Hold ":        "plank",

  // Hang core
  "Active Hang":               "hang-core",
  "Hanging Knee Tuck":         "hang-core",
  "Hanging Leg Raise":         "hang-core",
  "Toes to Bar":               "hang-core",
  "Windshield Wiper":          "hang-core",
  "Ring Knee Raises":          "hang-core",

  // Front lever
  "Tuck Front Lever":          "front-lever",
  "Straddle Front Lever":      "front-lever",
  "Full Front Lever":          "front-lever",

  // Human flag
  "Tucked Human Flag":         "human-flag",
  "One-Leg Human Flag":        "human-flag",
  "Human Flag":                "human-flag",

  // Dragon flag
  "Dragon Flag":               "dragon-flag",
  "Dragon Flag Negative":      "dragon-flag",

  // Handstand
  "Handstand":                 "handstand",

  // L-Sit
  "Tuck L-Sit":                "l-sit",
  "L-Sit":                     "l-sit",
  "L-Sit Compression":         "l-sit",

  // Nordic
  "Nordic Curls":              "nordic",
  "Slider Hamstring Curls":    "nordic",

  // Burpee
  "Burpee":                    "burpee",

  // Mobility/daily stretches
  "Pike Stretch":              "mobility",
  "Dead Bug":                  "mobility",
  "Superman":                  "mobility",
  "Dead Bug Hold":             "mobility",
  "Cat-Cow Stretch":           "mobility",
  "Hip Flexor Stretch":        "mobility",
  "Child's Pose":              "mobility",
  "Pigeon Pose":               "mobility",
  "Seated Forward Fold":       "mobility",
  "Standing Quad Stretch":     "mobility",
  "Doorway Pec Stretch":       "mobility",
  "Thread the Needle":         "mobility",
  "World's Greatest Stretch":  "mobility",
  "90-90 Hip Stretch":         "mobility",
  "Couch Stretch":             "mobility",
  "Banded Pallof Press":       "plank",
  "Ab Roller Rollout":         "push-up",
  "Box Jumps":                 "burpee",
  "Banded Lateral Walks":      "lunge",
  "Ring Rollouts":             "push-up",
};

export function getPoseSet(exerciseName: string): PoseSet {
  const poseType = EXERCISE_POSE_MAP[exerciseName] ?? "default";
  return POSE_LIBRARY[poseType];
}
