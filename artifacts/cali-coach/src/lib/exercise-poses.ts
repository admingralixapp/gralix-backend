/**
 * Exercise Pose Library
 *
 * 3-frame stick-figure sets (start, mid, end) for every exercise in CaliCoach.
 * Coordinates live in a 100×100 SVG viewBox (side-view unless noted).
 *
 * PoseData.muscleGlow — optional pulsating ellipse on the MID frame only,
 * covering the primary muscle being worked.
 */

export interface PoseData {
  head: { cx: number; cy: number; r: number };
  lines: Array<[number, number][]>;
  /** Pulsating SVG ellipse drawn in the mid-frame only */
  muscleGlow?: { cx: number; cy: number; rx: number; ry: number };
}

export type PoseSet = [PoseData, PoseData, PoseData]; // [start, mid, end]

// ─── Environmental Anchor ─────────────────────────────────────────────────────
// Describes a static prop drawn in the SVG behind the skeleton.
// All coordinates are in the 100×100 viewBox space.
// • floor  — horizontal ground line          (y1 = y2, span x1→x2)
// • wall   — vertical surface behind figure  (x1 = x2, span y1→y2)
// • bar    — overhead horizontal bar         (y1 = y2, span x1→x2)
// • box    — solid rectangular block         (x1,y1 top-left → x2,y2 bottom-right)
export type AnchorType = "floor" | "wall" | "bar" | "box";
export interface EnvAnchor {
  type: AnchorType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type ExerciseIntensity = "strenuous" | "relaxed" | "neutral";

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
  // ── new mobility-specific types ──────────────────────────────────────────
  | "wrist-kneeling"
  | "shoulder-arc"
  | "forward-fold"
  | "seated-twist"
  | "pigeon"
  | "wide-straddle"
  | "reverse-shoulder"
  | "tricep-overhead"
  | "planche-lean"
  | "prone"
  | "bridge"
  | "cossack"
  | "german-hang"
  | "mobility"
  | "default";

// ─────────────────────────────────────────────────────────────────────────────
// Pose Library
// ─────────────────────────────────────────────────────────────────────────────

export const POSE_LIBRARY: Record<PoseType, PoseSet> = {

  // ── Push-Up (horizontal push, arms on floor) ───────────────────────────────
  "push-up": [
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
    {
      head: { cx: 84, cy: 26, r: 6 },
      lines: [
        [[79,30],[70,38],[60,44],[48,50]],
        [[70,38],[60,42],[40,52],[18,60]],
      ],
      muscleGlow: { cx: 68, cy: 40, rx: 16, ry: 8 },
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
        [[50,27],[36,27],[28,14]],
        [[50,27],[64,27],[72,14]],
        [[50,27],[50,58]],
        [[50,58],[42,76],[42,92]],
        [[50,58],[58,76],[58,92]],
      ],
    },
    {
      head: { cx: 50, cy: 26, r: 6 },
      lines: [
        [[50,20],[36,20],[32,10]],
        [[50,20],[64,20],[68,10]],
        [[50,20],[50,55]],
        [[50,55],[42,72],[42,88]],
        [[50,55],[58,72],[58,88]],
      ],
      muscleGlow: { cx: 50, cy: 32, rx: 18, ry: 10 },
    },
    {
      head: { cx: 50, cy: 18, r: 6 },
      lines: [
        [[50,12],[36,14],[32,6]],
        [[50,12],[64,14],[68,6]],
        [[50,12],[50,48]],
        [[50,48],[42,66],[42,82]],
        [[50,48],[58,66],[58,82]],
      ],
    },
  ],

  // ── Squat (front view) ─────────────────────────────────────────────────────
  "squat": [
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
      head: { cx: 50, cy: 22, r: 7 },
      lines: [
        [[50,29],[50,52]],
        [[50,29],[32,36],[22,50]],
        [[50,29],[68,36],[78,50]],
        [[50,52],[34,64],[28,82]],
        [[50,52],[66,64],[72,82]],
      ],
      muscleGlow: { cx: 50, cy: 70, rx: 18, ry: 12 },
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

  // ── Dip ────────────────────────────────────────────────────────────────────
  "dip": [
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
    {
      head: { cx: 50, cy: 20, r: 6 },
      lines: [
        [[50,26],[50,54]],
        [[50,26],[34,28],[28,44]],
        [[50,26],[66,28],[72,44]],
        [[50,54],[44,72],[44,88]],
        [[50,54],[56,72],[56,88]],
      ],
      muscleGlow: { cx: 50, cy: 36, rx: 18, ry: 10 },
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

  // ── Plank ──────────────────────────────────────────────────────────────────
  "plank": [
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [[[83,18],[72,22],[56,22],[42,30]],[[72,22],[62,30],[40,40],[18,48]]],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [[[83,18],[72,22],[56,22],[42,30]],[[72,22],[62,30],[40,40],[18,48]]],
      muscleGlow: { cx: 62, cy: 30, rx: 14, ry: 8 },
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [[[83,18],[72,22],[56,22],[42,30]],[[72,22],[62,30],[40,40],[18,48]]],
    },
  ],

  // ── Lunge ──────────────────────────────────────────────────────────────────
  "lunge": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 60, cy: 16, r: 7 },
      lines: [
        [[60,23],[55,52]],[[60,23],[46,30],[40,46]],[[60,23],[74,30],[78,46]],
        [[55,52],[62,70],[70,88]],[[55,52],[44,68],[38,88]],
      ],
      muscleGlow: { cx: 56, cy: 60, rx: 12, ry: 18 },
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
  ],

  // ── Hanging Core ───────────────────────────────────────────────────────────
  "hang-core": [
    {
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50,24],[36,24],[28,12]],[[50,24],[64,24],[72,12]],
        [[50,24],[50,58]],[[50,58],[44,78],[44,94]],[[50,58],[56,78],[56,94]],
      ],
    },
    {
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50,22],[36,22],[28,10]],[[50,22],[64,22],[72,10]],
        [[50,22],[50,50]],[[50,50],[38,60],[32,74]],[[50,50],[62,60],[68,74]],
      ],
      muscleGlow: { cx: 50, cy: 50, rx: 14, ry: 10 },
    },
    {
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50,24],[36,24],[28,12]],[[50,24],[64,24],[72,12]],
        [[50,24],[50,58]],[[50,58],[44,78],[44,94]],[[50,58],[56,78],[56,94]],
      ],
    },
  ],

  // ── Muscle-Up ──────────────────────────────────────────────────────────────
  "muscle-up": [
    {
      head: { cx: 50, cy: 33, r: 6 },
      lines: [
        [[50,27],[36,27],[28,14]],[[50,27],[64,27],[72,14]],
        [[50,27],[50,58]],[[50,58],[42,76],[42,92]],[[50,58],[58,76],[58,92]],
      ],
    },
    {
      head: { cx: 50, cy: 14, r: 6 },
      lines: [
        [[50,8],[34,10],[28,4]],[[50,8],[66,10],[72,4]],
        [[50,8],[50,36]],[[50,36],[44,52],[44,68]],[[50,36],[56,52],[56,68]],
      ],
      muscleGlow: { cx: 50, cy: 16, rx: 22, ry: 10 },
    },
    {
      head: { cx: 50, cy: 12, r: 6 },
      lines: [
        [[50,6],[34,10],[30,22]],[[50,6],[66,10],[70,22]],
        [[50,6],[50,38]],[[50,38],[44,56],[44,74]],[[50,38],[56,56],[56,74]],
      ],
    },
  ],

  // ── Front Lever ────────────────────────────────────────────────────────────
  "front-lever": [
    {
      head: { cx: 50, cy: 33, r: 6 },
      lines: [
        [[50,27],[36,27],[28,14]],[[50,27],[64,27],[72,14]],
        [[50,27],[50,58]],[[50,58],[44,76],[44,92]],[[50,58],[56,76],[56,92]],
      ],
    },
    {
      head: { cx: 20, cy: 36, r: 6 },
      lines: [
        [[14,32],[14,28],[14,18]],[[14,28],[40,28]],
        [[14,28],[50,38],[78,45]],[[78,45],[82,38],[90,32]],[[78,45],[84,52],[92,58]],
      ],
      muscleGlow: { cx: 46, cy: 36, rx: 22, ry: 8 },
    },
    {
      head: { cx: 14, cy: 38, r: 6 },
      lines: [
        [[14,32],[14,26],[14,16]],[[14,26],[40,26]],
        [[14,26],[50,36],[82,36]],[[82,36],[86,30],[90,24]],[[82,36],[86,42],[90,48]],
      ],
    },
  ],

  // ── Handstand ──────────────────────────────────────────────────────────────
  "handstand": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 38, r: 6 },
      lines: [
        [[50,44],[50,66]],[[50,44],[36,46],[30,60]],[[50,44],[64,46],[70,60]],
        [[50,66],[42,52],[38,36]],[[50,66],[58,52],[62,36]],
      ],
      muscleGlow: { cx: 50, cy: 52, rx: 14, ry: 10 },
    },
    {
      head: { cx: 50, cy: 88, r: 6 },
      lines: [
        [[50,82],[50,58]],[[50,58],[42,36],[40,14]],[[50,58],[58,36],[60,14]],
        [[50,82],[36,88],[30,96]],[[50,82],[64,88],[70,96]],
      ],
    },
  ],

  // ── Human Flag ─────────────────────────────────────────────────────────────
  "human-flag": [
    {
      head: { cx: 12, cy: 30, r: 6 },
      lines: [
        [[12,36],[12,62]],[[12,36],[6,26]],[[12,36],[22,26]],
        [[12,62],[6,78],[4,92]],[[12,62],[18,78],[20,92]],
      ],
    },
    {
      head: { cx: 12, cy: 36, r: 6 },
      lines: [
        [[12,42],[12,28]],[[12,28],[8,18]],[[12,28],[18,18]],
        [[12,42],[36,48],[56,54]],[[56,54],[58,44],[62,38]],[[56,54],[60,62],[64,72]],
      ],
      muscleGlow: { cx: 34, cy: 50, rx: 20, ry: 8 },
    },
    {
      head: { cx: 12, cy: 38, r: 6 },
      lines: [
        [[12,44],[12,30]],[[12,30],[8,20]],[[12,30],[18,20]],
        [[12,44],[40,44],[72,44],[88,44]],[[88,44],[88,38],[88,32]],[[88,44],[88,50],[88,56]],
      ],
    },
  ],

  // ── Dragon Flag ────────────────────────────────────────────────────────────
  "dragon-flag": [
    {
      head: { cx: 14, cy: 50, r: 6 },
      lines: [
        [[14,56],[14,58]],[[14,58],[50,58],[82,58]],
        [[82,58],[82,52],[82,44]],[[82,58],[82,64],[82,72]],
        [[14,56],[10,52]],[[14,56],[18,52]],
      ],
    },
    {
      head: { cx: 14, cy: 52, r: 6 },
      lines: [
        [[14,58],[14,60]],[[14,60],[36,58],[52,52]],
        [[52,52],[60,38],[64,24]],[[64,24],[68,18],[70,14]],
        [[14,58],[10,54]],[[14,58],[18,54]],
      ],
      muscleGlow: { cx: 34, cy: 56, rx: 18, ry: 8 },
    },
    {
      head: { cx: 14, cy: 50, r: 6 },
      lines: [
        [[14,56],[14,58]],[[14,58],[50,58],[82,58]],
        [[82,58],[82,52],[82,44]],[[82,58],[82,64],[82,72]],
        [[14,56],[10,52]],[[14,56],[18,52]],
      ],
    },
  ],

  // ── L-Sit ──────────────────────────────────────────────────────────────────
  "l-sit": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,50]],[[50,25],[32,30],[22,46]],[[50,25],[68,30],[78,46]],
        [[50,50],[38,50],[20,50]],[[50,50],[62,50],[80,50]],
      ],
      muscleGlow: { cx: 50, cy: 40, rx: 16, ry: 10 },
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,50]],[[50,25],[32,30],[22,46]],[[50,25],[68,30],[78,46]],
        [[50,50],[38,50],[20,50]],[[50,50],[62,50],[80,50]],
      ],
    },
  ],

  // ── Row ────────────────────────────────────────────────────────────────────
  "row": [
    {
      head: { cx: 12, cy: 28, r: 6 },
      lines: [
        [[12,34],[50,48],[88,62]],[[12,34],[16,24]],[[12,34],[8,24]],
        [[88,62],[88,72],[88,82]],[[88,62],[84,72],[80,82]],
      ],
    },
    {
      head: { cx: 12, cy: 38, r: 6 },
      lines: [
        [[12,44],[50,50],[88,56]],[[12,44],[16,32]],[[12,44],[8,32]],
        [[88,56],[90,68],[92,80]],[[88,56],[84,68],[80,80]],
      ],
      muscleGlow: { cx: 50, cy: 44, rx: 20, ry: 8 },
    },
    {
      head: { cx: 12, cy: 44, r: 6 },
      lines: [
        [[12,50],[50,52],[88,54]],[[12,50],[16,40]],[[12,50],[8,40]],
        [[88,54],[90,66],[92,78]],[[88,54],[84,66],[80,78]],
      ],
    },
  ],

  // ── Burpee ─────────────────────────────────────────────────────────────────
  "burpee": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 88, cy: 13, r: 6 },
      lines: [[[83,18],[72,22],[56,22],[42,30]],[[72,22],[62,30],[40,40],[18,48]]],
      muscleGlow: { cx: 64, cy: 30, rx: 18, ry: 8 },
    },
    {
      head: { cx: 50, cy: 4, r: 7 },
      lines: [
        [[50,11],[50,42]],[[50,11],[30,4],[22,4]],[[50,11],[70,4],[78,4]],
        [[50,42],[40,60],[36,78]],[[50,42],[60,60],[64,78]],
      ],
    },
  ],

  // ── Nordic Curl ────────────────────────────────────────────────────────────
  "nordic": [
    {
      head: { cx: 50, cy: 20, r: 7 },
      lines: [
        [[50,27],[50,54]],[[50,27],[34,36],[30,52]],[[50,27],[66,36],[70,52]],
        [[50,54],[42,72],[40,86]],[[50,54],[58,72],[60,86]],
      ],
    },
    {
      head: { cx: 50, cy: 38, r: 7 },
      lines: [
        [[50,44],[50,66]],[[50,44],[34,40],[26,36]],[[50,44],[66,40],[74,36]],
        [[50,66],[42,76],[42,88]],[[50,66],[58,76],[58,88]],
      ],
      muscleGlow: { cx: 50, cy: 72, rx: 14, ry: 10 },
    },
    {
      head: { cx: 50, cy: 58, r: 7 },
      lines: [
        [[50,64],[50,80]],[[50,64],[34,60],[22,56]],[[50,64],[66,60],[78,56]],
        [[50,80],[42,82],[40,88]],[[50,80],[58,82],[60,88]],
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────────
  // Mobility-specific poses (daily stretch exercises)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Wrist Kneeling (Wrist Extension, First Knuckle Raises, Butcher's Block) ─
  "wrist-kneeling": [
    {
      // Start: kneeling upright
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50,16],[50,48]],
        [[50,26],[36,36],[32,52]],
        [[50,26],[64,36],[68,52]],
        [[50,48],[44,66],[36,80]],
        [[50,48],[56,66],[64,80]],
      ],
    },
    {
      // Mid: hands flat on floor, leaning forward (wrists stretched)
      head: { cx: 80, cy: 22, r: 6 },
      lines: [
        [[75,26],[62,32],[50,40]],
        [[62,32],[44,36],[28,44]],
        [[62,32],[68,40],[72,48]],
        [[50,40],[44,58],[36,74]],
        [[50,40],[56,58],[64,74]],
      ],
      muscleGlow: { cx: 38, cy: 38, rx: 18, ry: 7 },
    },
    {
      // End: deeper lean
      head: { cx: 82, cy: 27, r: 6 },
      lines: [
        [[77,31],[64,37],[52,44]],
        [[64,37],[46,41],[30,49]],
        [[64,37],[70,45],[74,53]],
        [[52,44],[46,62],[38,78]],
        [[52,44],[58,62],[66,78]],
      ],
    },
  ],

  // ── Shoulder Arc (Shoulder Dislocates, Doorframe Chest Opener) ────────────
  "shoulder-arc": [
    {
      // Start: standing, arms low holding band
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,50]],
        [[50,17],[32,22],[26,42]],
        [[50,17],[68,22],[74,42]],
        [[50,50],[42,70],[40,88]],
        [[50,50],[58,70],[60,88]],
      ],
    },
    {
      // Mid: arms fully overhead (Y shape)
      head: { cx: 50, cy: 14, r: 7 },
      lines: [
        [[50,21],[50,54]],
        [[50,21],[22,10],[8,4]],
        [[50,21],[78,10],[92,4]],
        [[50,54],[42,72],[40,90]],
        [[50,54],[58,72],[60,90]],
      ],
      muscleGlow: { cx: 50, cy: 24, rx: 24, ry: 9 },
    },
    {
      // End: arms behind back (full arc)
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,50]],
        [[50,17],[28,26],[18,46]],
        [[50,17],[72,26],[82,46]],
        [[50,50],[42,70],[40,88]],
        [[50,50],[58,70],[60,88]],
      ],
    },
  ],

  // ── Forward Fold (Standing Hamstring Stretch) ─────────────────────────────
  "forward-fold": [
    {
      // Start: standing upright
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,48],[44,68],[42,88]],
        [[50,48],[56,68],[58,88]],
      ],
    },
    {
      // Mid: deep forward fold, hands near floor (side view)
      head: { cx: 24, cy: 58, r: 6 },
      lines: [
        [[24,52],[40,46],[54,42]],
        [[54,42],[52,64],[48,88]],
        [[54,42],[58,64],[62,88]],
        [[40,46],[26,64],[16,80]],
        [[40,46],[52,64],[54,80]],
      ],
      muscleGlow: { cx: 53, cy: 58, rx: 8, ry: 18 },
    },
    {
      // End: same deep fold held
      head: { cx: 22, cy: 60, r: 6 },
      lines: [
        [[22,54],[38,48],[54,44]],
        [[54,44],[52,66],[48,90]],
        [[54,44],[58,66],[62,90]],
        [[38,48],[22,66],[12,82]],
        [[38,48],[52,66],[54,82]],
      ],
    },
  ],

  // ── Seated Twist (Seated Thoracic Rotation) ───────────────────────────────
  "seated-twist": [
    {
      // Start: cross-legged, facing forward
      head: { cx: 50, cy: 18, r: 6 },
      lines: [
        [[50,24],[50,52]],
        [[50,30],[34,40],[28,56]],
        [[50,30],[66,40],[72,56]],
        [[50,52],[30,64],[24,78]],
        [[50,52],[70,64],[76,78]],
      ],
    },
    {
      // Mid: torso rotated to the right
      head: { cx: 60, cy: 18, r: 6 },
      lines: [
        [[56,24],[50,52]],
        [[50,32],[18,28],[8,32]],
        [[50,32],[72,38],[86,50]],
        [[50,52],[30,64],[24,78]],
        [[50,52],[70,64],[76,78]],
      ],
      muscleGlow: { cx: 54, cy: 36, rx: 12, ry: 18 },
    },
    {
      // End: deeper rotation
      head: { cx: 68, cy: 18, r: 6 },
      lines: [
        [[62,24],[50,52]],
        [[50,32],[14,26],[4,28]],
        [[50,32],[76,36],[90,44]],
        [[50,52],[30,64],[24,78]],
        [[50,52],[70,64],[76,78]],
      ],
    },
  ],

  // ── Pigeon (Pigeon Pose Hip Opener) ───────────────────────────────────────
  "pigeon": [
    {
      // Start: all-fours (quadruped position)
      head: { cx: 80, cy: 24, r: 6 },
      lines: [
        [[75,28],[62,30],[50,34]],
        [[62,30],[44,30],[30,34]],
        [[62,30],[68,42],[74,52]],
        [[50,34],[44,52],[42,70]],
        [[50,34],[58,52],[68,72]],
      ],
    },
    {
      // Mid: pigeon pose (shin forward, back leg extended, torso upright)
      head: { cx: 50, cy: 16, r: 6 },
      lines: [
        [[50,22],[50,54]],
        [[50,30],[34,40],[28,56]],
        [[50,30],[66,40],[72,56]],
        [[50,54],[36,62],[22,70],[24,80]],
        [[50,54],[62,66],[80,80],[88,88]],
      ],
      muscleGlow: { cx: 28, cy: 70, rx: 14, ry: 9 },
    },
    {
      // End: folded forward over front shin
      head: { cx: 28, cy: 58, r: 6 },
      lines: [
        [[28,52],[42,46],[54,46]],
        [[54,46],[38,60],[22,66],[24,78]],
        [[54,46],[64,62],[82,78],[90,88]],
        [[42,46],[28,62],[16,74]],
        [[42,46],[58,62],[62,74]],
      ],
    },
  ],

  // ── Wide Straddle (Pancake Stretch) ───────────────────────────────────────
  "wide-straddle": [
    {
      // Start: seated, legs wide
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,52]],
        [[50,36],[32,46],[22,60]],
        [[50,36],[68,46],[78,60]],
        [[50,52],[24,64],[10,76]],
        [[50,52],[76,64],[90,76]],
      ],
    },
    {
      // Mid: deeply folded forward, chest low
      head: { cx: 50, cy: 58, r: 6 },
      lines: [
        [[50,64],[50,76]],
        [[50,76],[22,70],[8,78]],
        [[50,76],[78,70],[92,78]],
        [[50,64],[34,66],[20,72]],
        [[50,64],[66,66],[80,72]],
      ],
      muscleGlow: { cx: 50, cy: 70, rx: 26, ry: 8 },
    },
    {
      // End: chest nearer to floor (same shape held)
      head: { cx: 50, cy: 62, r: 6 },
      lines: [
        [[50,68],[50,78]],
        [[50,78],[20,74],[6,82]],
        [[50,78],[80,74],[94,82]],
        [[50,68],[32,70],[18,76]],
        [[50,68],[68,70],[82,76]],
      ],
    },
  ],

  // ── Reverse Shoulder (Reverse Shoulder Flexion, Reverse Tabletop) ─────────
  "reverse-shoulder": [
    {
      // Start: kneeling, arms hanging
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,50]],
        [[50,17],[34,26],[30,42]],
        [[50,17],[66,26],[70,42]],
        [[50,50],[42,68],[40,86]],
        [[50,50],[58,68],[60,86]],
      ],
    },
    {
      // Mid: hands behind on surface, chest open, head dropping back
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,24],[50,54]],
        [[50,34],[70,48],[80,62]],
        [[50,34],[30,48],[20,62]],
        [[50,54],[44,72],[42,88]],
        [[50,54],[56,72],[58,88]],
      ],
      muscleGlow: { cx: 50, cy: 26, rx: 22, ry: 9 },
    },
    {
      // End: deeper stretch (hips lower, full chest open)
      head: { cx: 50, cy: 22, r: 7 },
      lines: [
        [[50,28],[50,58]],
        [[50,38],[74,52],[86,66]],
        [[50,38],[26,52],[14,66]],
        [[50,58],[44,76],[42,90]],
        [[50,58],[56,76],[58,90]],
      ],
    },
  ],

  // ── Tricep Overhead (Overhead Triceps Stretch) ────────────────────────────
  "tricep-overhead": [
    {
      // Start: standing
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
      // Mid: one arm raised, elbow bent, other hand pressing it
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[64,12],[62,2],[54,16]],
        [[50,17],[34,28],[70,18]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
      muscleGlow: { cx: 62, cy: 8, rx: 10, ry: 14 },
    },
    {
      // End: same, slightly deeper press
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[64,12],[60,0],[52,14]],
        [[50,17],[34,28],[72,18]],
        [[50,48],[42,68],[40,88]],
        [[50,48],[58,68],[60,88]],
      ],
    },
  ],

  // ── Planche Lean ──────────────────────────────────────────────────────────
  "planche-lean": [
    {
      // Start: plank position
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
    {
      // Mid: shoulders past wrists (forward lean)
      head: { cx: 82, cy: 15, r: 6 },
      lines: [
        [[77,19],[64,18],[44,22],[28,30]],
        [[64,18],[56,28],[34,38],[12,46]],
      ],
      muscleGlow: { cx: 64, cy: 18, rx: 14, ry: 9 },
    },
    {
      // End: back to plank
      head: { cx: 88, cy: 13, r: 6 },
      lines: [
        [[83,18],[72,22],[56,22],[42,30]],
        [[72,22],[62,30],[40,40],[18,48]],
      ],
    },
  ],

  // ── Prone (Prone Y-Raises, Deep Lat Foam Roll) ────────────────────────────
  "prone": [
    {
      // Start: lying face down, arms at sides
      head: { cx: 88, cy: 48, r: 6 },
      lines: [
        [[83,52],[58,54],[30,56],[12,58]],
        [[58,54],[50,44],[44,38]],
        [[58,54],[50,64],[44,70]],
      ],
    },
    {
      // Mid: Y-raises — arms lifted in Y shape
      head: { cx: 88, cy: 46, r: 6 },
      lines: [
        [[83,50],[58,52],[30,54],[12,56]],
        [[58,52],[42,36],[26,22]],
        [[58,52],[42,68],[26,82]],
      ],
      muscleGlow: { cx: 46, cy: 50, rx: 14, ry: 12 },
    },
    {
      // End: lower back down
      head: { cx: 88, cy: 48, r: 6 },
      lines: [
        [[83,52],[58,54],[30,56],[12,58]],
        [[58,54],[50,44],[44,38]],
        [[58,54],[50,64],[44,70]],
      ],
    },
  ],

  // ── Bridge (Thoracic Bridge, Glute Bridge) ────────────────────────────────
  "bridge": [
    {
      // Start: lying on back, knees bent
      head: { cx: 14, cy: 60, r: 6 },
      lines: [
        [[14,66],[14,68]],
        [[14,68],[40,66],[60,64]],
        [[60,64],[68,46],[76,34]],
        [[60,64],[68,80],[76,90]],
        [[14,68],[14,74],[16,84]],
      ],
    },
    {
      // Mid: hips raised (glute bridge)
      head: { cx: 14, cy: 66, r: 6 },
      lines: [
        [[14,72],[14,74]],
        [[14,74],[38,60],[60,50]],
        [[60,50],[70,68],[76,84]],
        [[60,50],[56,70],[52,86]],
        [[14,74],[14,80],[18,88]],
      ],
      muscleGlow: { cx: 38, cy: 58, rx: 18, ry: 10 },
    },
    {
      // End: thoracic extension — arms overhead, chest through
      head: { cx: 18, cy: 62, r: 6 },
      lines: [
        [[18,68],[18,70]],
        [[18,70],[44,54],[66,42]],
        [[66,42],[76,60],[82,78]],
        [[66,42],[60,64],[56,82]],
        [[18,70],[10,58],[8,44]],
      ],
    },
  ],

  // ── Cossack Squat ─────────────────────────────────────────────────────────
  "cossack": [
    {
      // Start: wide stance standing
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],
        [[50,17],[36,26],[30,42]],
        [[50,17],[64,26],[70,42]],
        [[50,48],[28,64],[18,84]],
        [[50,48],[72,64],[82,84]],
      ],
    },
    {
      // Mid: shifted left — deep squat left leg, right leg extended
      head: { cx: 28, cy: 20, r: 7 },
      lines: [
        [[28,27],[34,56]],
        [[28,27],[14,36],[8,54]],
        [[28,27],[44,36],[54,52]],
        [[34,56],[22,74],[14,92]],
        [[34,56],[58,66],[82,72],[92,74]],
      ],
      muscleGlow: { cx: 22, cy: 72, rx: 10, ry: 16 },
    },
    {
      // End: shifted right (other side)
      head: { cx: 72, cy: 20, r: 7 },
      lines: [
        [[72,27],[66,56]],
        [[72,27],[86,36],[92,54]],
        [[72,27],[56,36],[46,52]],
        [[66,56],[78,74],[86,92]],
        [[66,56],[42,66],[18,72],[8,74]],
      ],
    },
  ],

  // ── German Hang (German Hang, Skin the Cat, Active Scapular Hangs) ─────────
  "german-hang": [
    {
      // Start: dead hang
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50,24],[36,24],[28,12]],
        [[50,24],[64,24],[72,12]],
        [[50,24],[50,58]],
        [[50,58],[44,78],[44,94]],
        [[50,58],[56,78],[56,94]],
      ],
    },
    {
      // Mid: knees tucked and rotating backward
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50,22],[36,22],[28,10]],
        [[50,22],[64,22],[72,10]],
        [[50,22],[50,44]],
        [[50,44],[36,32],[28,22]],
        [[50,44],[64,32],[72,22]],
      ],
      muscleGlow: { cx: 50, cy: 22, rx: 22, ry: 10 },
    },
    {
      // End: German hang — shoulders fully extended behind bar
      head: { cx: 50, cy: 42, r: 6 },
      lines: [
        [[50,36],[36,28],[28,14]],
        [[50,36],[64,28],[72,14]],
        [[50,36],[50,58]],
        [[50,58],[40,74],[30,88]],
        [[50,58],[60,74],[70,88]],
      ],
    },
  ],

  // ── Mobility (generic; fallback for remaining mobility moves) ─────────────
  "mobility": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 14, r: 7 },
      lines: [
        [[50,21],[50,50]],[[50,21],[26,32],[14,48]],[[50,21],[74,32],[86,48]],
        [[50,50],[44,68],[42,86]],[[50,50],[56,68],[58,86]],
      ],
      muscleGlow: { cx: 50, cy: 34, rx: 22, ry: 10 },
    },
    {
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50,25],[50,52]],[[50,25],[22,36],[10,52]],[[50,25],[78,36],[90,52]],
        [[50,52],[44,70],[42,88]],[[50,52],[56,70],[58,88]],
      ],
    },
  ],

  // ── Default (generic fallback) ─────────────────────────────────────────────
  "default": [
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[30,22],[24,38]],[[50,17],[70,22],[76,38]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
    {
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50,17],[50,48]],[[50,17],[34,26],[30,42]],[[50,17],[66,26],[70,42]],
        [[50,48],[42,68],[40,88]],[[50,48],[58,68],[60,88]],
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-exercise Daily Mobility pose sets
// Keyed by the EXACT exercise name from mobility-service.ts.
// getPoseSet() checks this map FIRST before falling back to POSE_LIBRARY.
//
// Coordinate conventions (100×100 viewBox, y ↓ increases downward):
//   Side view  — person faces RIGHT  (head on right side of canvas)
//   Front view — person faces viewer (head centred at top)
//   Prone view — person lies face-down, head on right
// ─────────────────────────────────────────────────────────────────────────────

const MOBILITY_POSE_LIBRARY: Record<string, PoseSet> = {

  // ── WRIST EXTENSION STRETCH ───────────────────────────────────────────────
  // Side view. Kneeling (person faces RIGHT). Floor line at y=67.
  // START: kneeling upright, elbows BENT, hands already touching floor (y=67).
  // MID:   body leans forward, arms STRAIGHT, palms flat, fingers toward knees.
  // END:   hips sink BACK toward heels — hands stay LOCKED at MID positions.
  "Wrist Extension Stretch": [
    { // START — kneeling upright, elbows bent, hands touching floor (y=67)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50,16],[50,48]],
        [[50,26],[36,36],[32,52]],
        [[50,26],[64,36],[68,52]],
        [[50,48],[44,66],[36,80]],
        [[50,48],[56,66],[64,80]],
      ],
    },
    { // MID — body leans forward, arms straight, palms flat
      head: { cx: 80, cy: 22, r: 6 },
      lines: [
        [[75,26],[62,32],[50,40]],
        [[62,32],[44,36],[28,44]],
        [[62,32],[68,40],[72,48]],
        [[50,40],[44,58],[36,74]],
        [[50,40],[56,58],[64,74]],
      ],
      muscleGlow: { cx: 38, cy: 38, rx: 18, ry: 7 },
    },
    { // END — hips sink back toward heels, hands locked at mid positions
      head: { cx: 82, cy: 27, r: 6 },
      lines: [
        [[77,31],[64,37],[52,44]],
        [[64,37],[46,41],[30,49]],
        [[64,37],[70,45],[74,53]],
        [[52,44],[46,62],[38,78]],
        [[52,44],[58,62],[66,78]],
      ],
    },
  ],

  // ── WRIST FLEXION STRETCH ─────────────────────────────────────────────────
  // Side view. Standing. One arm extended forward palm-down; the other hand
  // gently pulls the fingers upward into wrist flexion.
  "Wrist Flexion Stretch": [
    { // START — standing, arms relaxed at sides
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [62, 32], [70, 44]],
        [[50, 22], [38, 32], [30, 44]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
    { // MID — R-arm extended forward at shoulder height; L-hand bends fingers up
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [64, 22], [80, 22]],                    // R-arm horizontal forward
        [[50, 22], [62, 20], [78, 20], [82, 12]],          // L-hand at R-wrist, pulls fingers up
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
      muscleGlow: { cx: 80, cy: 18, rx: 8, ry: 12 },
    },
    { // END — deeper pull, wrist more fully flexed (fingers nearer to forearm)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [64, 22], [80, 22]],
        [[50, 22], [62, 20], [78, 20], [84, 8]],           // fingers bent further
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
  ],

  // ── SHOULDER DISLOCATES ───────────────────────────────────────────────────
  // Side view (person faces RIGHT). Standing. Band/towel traces a full 180°
  // arc: hands at hips FRONT → straight OVERHEAD → hands at hips BACK.
  // Arms sweep together; both shown slightly staggered for depth.
  "Shoulder Dislocates": [
    { // START
      head: { cx: 49.5, cy: 22.5, r: 6 },
      lines: [
        [[50,31.5],[50,56]],
        [[50,36.5],[66.5,54]],
        [[50,36.5],[63,59]],
        [[50,56],[48,73.5],[44,87]],
        [[50,56],[56,73],[58,87]],
      ],
    },
    { // MID
      head: { cx: 57, cy: 27.5, r: 6 },
      lines: [
        [[51.5,34],[50,56]],
        [[50,42.5],[44,14]],
        [[50,42.5],[36.5,21.5]],
        [[50,56],[48,73.5],[43.5,88]],
        [[50,56],[56,73],[57,88]],
      ],
    },
    { // END
      head: { cx: 54, cy: 24.5, r: 6 },
      lines: [
        [[50,31.5],[50,56]],
        [[50,36.5],[38,47],[31.5,57.5]],
        [[50,36.5],[42,54],[40,62]],
        [[50,56],[48,73.5],[43.5,88]],
        [[50,56],[56,73],[58,87]],
      ],
    },
  ],

  // ── HANGING LAT STRETCH ───────────────────────────────────────────────────
  // Side view (person faces RIGHT). Overhead bar at y=8.
  // START: standing upright, arms reaching up toward bar (pre-grip).
  // MID:   hands LOCKED on bar, dead hang — body elongates vertically.
  // END:   hips sink BACK creating a lateral C-curve side-body stretch.
  "Hanging Lat Stretch": [
    { // START — standing, arms reaching UP toward bar (not yet gripping)
      head: { cx: 50, cy: 14, r: 6 },
      lines: [
        [[50, 20], [50, 54]],                              // spine (standing upright)
        [[50, 26], [46, 16], [44, 10]],                    // near arm: reaching toward bar at y=8
        [[50, 26], [54, 16], [56, 10]],                    // far arm: reaching up
        [[50, 54], [44, 72], [42, 90]],                    // near leg
        [[50, 54], [56, 72], [58, 90]],                    // far leg
      ],
    },
    { // MID — dead hang, hands LOCKED on bar (y=8); body hangs straight down
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50, 24], [46, 16], [44, 8]],                     // near arm LOCKED to bar [44,8]
        [[50, 24], [54, 16], [56, 8]],                     // far arm LOCKED to bar [56,8]
        [[50, 24], [50, 62]],                              // torso hanging straight
        [[50, 62], [44, 80], [42, 96]],                    // near leg dangling
        [[50, 62], [56, 80], [58, 96]],                    // far leg dangling
      ],
      muscleGlow: { cx: 50, cy: 42, rx: 16, ry: 16 },
    },
    { // END — hips sink BACK (left); body curves into C-shape; hands LOCKED on bar
      head: { cx: 46, cy: 30, r: 6 },
      lines: [
        [[48, 24], [44, 16], [44, 8]],                     // near arm — endpoint [44,8] LOCKED
        [[48, 24], [54, 16], [56, 8]],                     // far arm  — endpoint [56,8] LOCKED
        [[44, 30], [38, 58]],                              // torso arcs LEFT (hips sinking back)
        [[38, 58], [30, 78], [26, 96]],                    // near leg: hips back, leg trails behind
        [[38, 58], [48, 76], [52, 94]],                    // far leg
      ],
    },
  ],

  // ── DOORFRAME CHEST OPENER ────────────────────────────────────────────────
  // Side view (person faces RIGHT toward wall at x=94).
  // Single-arm version: one arm in a 90° L on the frame; torso rotates away.
  // START: arm held in L-shape (upper arm horizontal, forearm vertical, pre-press).
  // MID:   forearm PRESSED against wall — elbow [86,24] & wrist [88,8] LOCKED.
  // END:   torso steps/rotates AWAY (LEFT) — shoulder moves; locked arm stays.
  "Doorframe Chest Opener": [
    { // START — arm poised in 90° L-shape, body facing right (not yet pressing wall)
      head: { cx: 64, cy: 10, r: 7 },
      lines: [
        [[60, 17], [50, 52]],                              // spine (upright, facing right)
        [[56, 24], [82, 24], [84, 8]],                     // arm: upper-arm horizontal → forearm UP (the L)
        [[56, 24], [42, 32], [34, 48]],                    // other arm relaxed at side
        [[50, 52], [44, 70], [42, 90]],
        [[50, 52], [56, 70], [58, 90]],
      ],
    },
    { // MID — forearm AGAINST frame; elbow [86,24] & wrist [88,8] are LOCKED anchors
      head: { cx: 64, cy: 10, r: 7 },
      lines: [
        [[60, 17], [50, 52]],
        [[56, 24], [86, 24], [88, 8]],                     // arm: elbow LOCKED [86,24], wrist LOCKED [88,8]
        [[56, 24], [40, 32], [32, 48]],
        [[50, 52], [44, 70], [42, 90]],
        [[50, 52], [56, 70], [58, 90]],
      ],
      muscleGlow: { cx: 54, cy: 26, rx: 20, ry: 9 },
    },
    { // END — torso rotates AWAY (steps LEFT); shoulder moves but arm stays on wall
      head: { cx: 52, cy: 11, r: 7 },
      lines: [
        [[48, 18], [40, 54]],                              // spine shifted LEFT (body rotated away)
        [[46, 26], [86, 24], [88, 8]],                     // shoulder moved to [46,26]; elbow/wrist LOCKED
        [[46, 26], [32, 34], [24, 50]],
        [[40, 54], [34, 72], [32, 92]],
        [[40, 54], [46, 72], [48, 92]],
      ],
    },
  ],

  // ── LOW LUNGE HIP FLEXOR ──────────────────────────────────────────────────
  // Side view (person faces RIGHT). Floor at y=88.
  // START: 90/90 kneeling — both knees at 90°, back knee on floor, torso tall.
  // MID:   hands braced on front knee, upright torso over the lunge.
  // END:   hips DRIVE FORWARD and DOWN — front knee past ankle; deeper stretch.
  "Low Lunge Hip Flexor": [
    { // START — 90/90 kneeling: front knee 90°, back knee on floor, arms at sides
      head: { cx: 58, cy: 11, r: 6 },
      lines: [
        [[54, 17], [52, 52]],                              // spine (tall, upright)
        [[52, 28], [66, 30], [76, 36]],                    // near arm relaxed at hip
        [[52, 28], [38, 34], [28, 44]],                    // far arm at side
        [[52, 52], [68, 66], [72, 88]],                    // front (R) leg: hip→knee(90°)→foot on floor
        [[52, 52], [34, 68], [24, 88]],                    // back (L) leg: hip→back-knee on floor
      ],
    },
    { // MID — hands ON front knee; torso upright; back shin flat on floor behind
      head: { cx: 60, cy: 11, r: 6 },
      lines: [
        [[56, 17], [54, 52]],                              // spine upright
        [[54, 28], [68, 36], [70, 52]],                    // near arm: hand BRACED on front knee
        [[54, 28], [40, 36], [42, 52]],                    // far arm: other hand on knee
        [[54, 52], [70, 66], [74, 88]],                    // front (R) leg: hip→knee→foot
        [[54, 52], [36, 68], [22, 88]],                    // back (L) leg: hip→back-knee on floor
      ],
      muscleGlow: { cx: 38, cy: 68, rx: 16, ry: 14 },
    },
    { // END — hips drive FORWARD and DOWN; front knee passes over ankle; deeper psoas
      head: { cx: 64, cy: 12, r: 6 },
      lines: [
        [[60, 18], [58, 54]],                              // spine (slight forward lean; hips lower)
        [[58, 28], [74, 34], [80, 48]],                    // near arm: hands reaching to more-forward knee
        [[58, 28], [44, 34], [46, 50]],                    // far arm: other hand
        [[58, 54], [76, 68], [78, 92]],                    // front (R) leg: knee driven forward past ankle
        [[58, 54], [38, 72], [24, 88]],                    // back (L) leg: hip forward stretches psoas
      ],
    },
  ],

  // ── STANDING HAMSTRING STRETCH ────────────────────────────────────────────
  // Side view. Hip hinge with flat back; hands drop progressively toward the
  // floor to lengthen the posterior chain.
  "Standing Hamstring Stretch": [
    { // START — standing upright, neutral spine
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [44, 66], [42, 88]],
        [[50, 48], [56, 66], [58, 88]],
      ],
    },
    { // MID — hinging from hips, back flat, hands toward mid-shin (side view)
      head: { cx: 22, cy: 50, r: 6 },
      lines: [
        [[22, 44], [40, 40], [56, 38]],                    // neck/spine flat (hip hinge)
        [[56, 38], [52, 62], [48, 88]],                    // front leg (straight)
        [[56, 38], [60, 62], [64, 88]],                    // back leg (straight)
        [[36, 40], [22, 56], [12, 72]],                    // arms hanging toward floor
        [[36, 40], [50, 54], [58, 68]],                    // other arm
      ],
      muscleGlow: { cx: 54, cy: 62, rx: 8, ry: 20 },
    },
    { // END — deeper fold, hands near ankles, head hanging down
      head: { cx: 18, cy: 56, r: 6 },
      lines: [
        [[18, 50], [38, 44], [56, 40]],
        [[56, 40], [52, 64], [48, 90]],
        [[56, 40], [60, 64], [64, 90]],
        [[34, 44], [18, 62], [8, 78]],
        [[34, 44], [50, 58], [60, 72]],
      ],
    },
  ],

  // ── SEATED THORACIC ROTATION ──────────────────────────────────────────────
  // Front view. Sitting cross-legged. HIPS AND LEGS ARE IDENTICAL IN ALL 3
  // FRAMES (they do not rotate). Only the upper spine, shoulders, and head
  // rotate ~90° to the right.
  "Seated Thoracic Rotation": [
    { // START — cross-legged, whole torso facing forward
      head: { cx: 50, cy: 16, r: 6 },
      lines: [
        [[50, 22], [50, 52]],                              // spine (vertical, facing viewer)
        [[50, 30], [32, 40], [22, 54]],                    // L-arm (neutral)
        [[50, 30], [68, 40], [78, 54]],                    // R-arm (neutral)
        [[50, 52], [28, 60], [16, 74]],                    // L-leg (cross-legged — FIXED)
        [[50, 52], [72, 60], [84, 74]],                    // R-leg (cross-legged — FIXED)
      ],
    },
    { // MID — upper body rotated RIGHT ~90°; hips/legs completely unchanged
      head: { cx: 64, cy: 16, r: 6 },                     // head turns with upper torso
      lines: [
        [[58, 22], [50, 52]],                              // upper spine tilted R; hip anchor fixed
        [[50, 30], [14, 26], [4, 28]],                     // L-arm sweeps wide open to the right
        [[50, 30], [74, 36], [88, 50]],                    // R-arm drives toward R knee
        [[50, 52], [28, 60], [16, 74]],                    // L-leg — UNCHANGED
        [[50, 52], [72, 60], [84, 74]],                    // R-leg — UNCHANGED
      ],
      muscleGlow: { cx: 52, cy: 36, rx: 14, ry: 20 },
    },
    { // END — deeper rotation (looking further over R shoulder); hips still fixed
      head: { cx: 72, cy: 16, r: 6 },
      lines: [
        [[64, 22], [50, 52]],                              // upper spine rotated further R
        [[50, 30], [10, 24], [0, 24]],                     // L-arm extends fully behind
        [[50, 30], [78, 34], [92, 46]],                    // R-arm deeper push
        [[50, 52], [28, 60], [16, 74]],                    // L-leg — UNCHANGED
        [[50, 52], [72, 60], [84, 74]],                    // R-leg — UNCHANGED
      ],
    },
  ],

  // ── PIGEON POSE HIP OPENER ────────────────────────────────────────────────
  // Side view. Front shin lies horizontal across the mat; back leg extends
  // straight behind. Torso progresses from upright to folded over the shin.
  "Pigeon Pose Hip Opener": [
    { // START — all-fours (quadruped) about to transition
      head: { cx: 82, cy: 22, r: 6 },
      lines: [
        [[78, 26], [62, 28], [46, 32]],                    // spine (horizontal)
        [[62, 28], [44, 28], [28, 32]],                    // L-arm to floor
        [[62, 28], [66, 40], [70, 52]],                    // R-arm (other side)
        [[46, 32], [40, 52], [38, 70]],                    // L-leg (front, becoming shin)
        [[46, 32], [56, 52], [70, 72]],                    // R-leg (back)
      ],
    },
    { // MID — front shin across mat, back leg extended, torso upright over hip
      head: { cx: 50, cy: 16, r: 6 },
      lines: [
        [[50, 22], [50, 56]],                              // torso upright
        [[50, 30], [34, 40], [26, 54]],                    // L-arm
        [[50, 30], [66, 40], [74, 54]],                    // R-arm
        [[50, 56], [34, 62], [18, 62], [24, 74]],          // front leg: hip→shin horizontal→foot
        [[50, 56], [64, 70], [84, 84], [92, 92]],          // back leg: extends far behind on floor
      ],
      muscleGlow: { cx: 26, cy: 64, rx: 14, ry: 10 },
    },
    { // END — folded forward over front shin, chest sinking toward floor
      head: { cx: 28, cy: 54, r: 6 },
      lines: [
        [[28, 48], [44, 44], [56, 46]],                    // torso folded (near horizontal)
        [[56, 46], [38, 60], [20, 64], [24, 76]],          // front shin
        [[56, 46], [68, 62], [86, 76], [94, 86]],          // back leg extended
        [[40, 44], [24, 58], [12, 70]],                    // arm reaching forward
        [[40, 44], [56, 58], [64, 68]],                    // other arm
      ],
    },
  ],

  // ── OVERHEAD TRICEPS STRETCH ──────────────────────────────────────────────
  // Front view. One arm raised, elbow bent so hand drops behind head; the
  // other hand presses the elbow to deepen the stretch.
  "Overhead Triceps Stretch": [
    { // START — standing, arms at sides
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
    { // MID — R-arm: upper-arm vertical, elbow bent, hand behind head; L-hand on elbow
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [62, 12], [68, 2], [58, 16]],           // R upper-arm up → elbow → hand down behind head
        [[50, 22], [36, 16], [66, 10]],                    // L-arm reaching across to R-elbow
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
      muscleGlow: { cx: 62, cy: 8, rx: 8, ry: 14 },
    },
    { // END — deeper elbow press, hand further down behind back
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [62, 10], [70, 0], [58, 14]],
        [[50, 22], [34, 14], [68, 8]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
  ],

  // ── PANCAKE STRETCH ───────────────────────────────────────────────────────
  // Front view. Wide straddle seated; hinging forward from the hips with a
  // flat back, walking hands out until chest approaches the floor.
  "Pancake Stretch": [
    { // START — seated, legs wide, torso upright
      head: { cx: 50, cy: 16, r: 7 },
      lines: [
        [[50, 22], [50, 54]],
        [[50, 36], [32, 46], [20, 58]],
        [[50, 36], [68, 46], [80, 58]],
        [[50, 54], [22, 62], [8, 74]],                     // L-leg wide left
        [[50, 54], [78, 62], [92, 74]],                    // R-leg wide right
      ],
    },
    { // MID — hinged forward ~45°, hands walking out, chest getting lower
      head: { cx: 50, cy: 50, r: 6 },
      lines: [
        [[50, 44], [50, 66]],                              // short spine (folded forward)
        [[50, 66], [22, 62], [8, 72]],                     // L-leg
        [[50, 66], [78, 62], [92, 72]],                    // R-leg
        [[50, 44], [28, 56], [12, 64]],                    // L-arm walking out
        [[50, 44], [72, 56], [88, 64]],                    // R-arm walking out
      ],
      muscleGlow: { cx: 50, cy: 66, rx: 26, ry: 8 },
    },
    { // END — chest near floor, hands fully extended, maximum depth
      head: { cx: 50, cy: 62, r: 6 },
      lines: [
        [[50, 56], [50, 72]],
        [[50, 72], [20, 68], [6, 78]],
        [[50, 72], [80, 68], [94, 78]],
        [[50, 56], [24, 64], [8, 72]],
        [[50, 56], [76, 64], [92, 72]],
      ],
    },
  ],

  // ── REVERSE SHOULDER FLEXION ──────────────────────────────────────────────
  // Side view. Kneeling, hands placed behind on a low surface with fingers
  // pointing away; hips lower to progressively open the anterior shoulders.
  "Reverse Shoulder Flexion": [
    { // START — kneeling upright, arms at sides
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50, 17], [50, 48]],
        [[50, 23], [36, 32], [28, 46]],
        [[50, 23], [64, 32], [72, 46]],
        [[50, 48], [42, 66], [40, 84]],
        [[50, 48], [58, 66], [60, 84]],
      ],
    },
    { // MID — hands on surface BEHIND (fingers pointing away), chest opening, head back
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50, 25], [50, 56]],
        [[50, 34], [72, 46], [86, 58]],                    // R-arm reaches BEHIND body to surface
        [[50, 34], [28, 46], [14, 58]],                    // L-arm reaches BEHIND body to surface
        [[50, 56], [44, 72], [42, 88]],
        [[50, 56], [56, 72], [58, 88]],
      ],
      muscleGlow: { cx: 50, cy: 28, rx: 22, ry: 9 },
    },
    { // END — hips lower, arms more extended, deeper anterior shoulder stretch
      head: { cx: 50, cy: 22, r: 7 },
      lines: [
        [[50, 29], [50, 60]],
        [[50, 38], [76, 52], [92, 64]],
        [[50, 38], [24, 52], [8, 64]],
        [[50, 60], [44, 76], [42, 92]],
        [[50, 60], [56, 76], [58, 92]],
      ],
    },
  ],

  // ── ANKLE MOBILITY CIRCLES ────────────────────────────────────────────────
  // Front view. Standing on one leg; raised foot draws large slow circles,
  // showing two opposite points in the arc (outward then inward).
  "Ankle Mobility Circles": [
    { // START — standing, both feet flat (bilateral, about to lift one)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
    { // MID — standing on R-leg; L-knee raised, foot at outer arc (toe out-down)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [56, 66], [60, 88]],                    // R-leg (standing, straight)
        [[50, 48], [42, 62], [36, 76], [44, 86]],          // L-leg raised: knee up, foot circling outward
      ],
      muscleGlow: { cx: 42, cy: 82, rx: 10, ry: 8 },
    },
    { // END — foot has circled to inner arc (toe now pointing inward-down)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [56, 66], [60, 88]],
        [[50, 48], [42, 62], [36, 76], [28, 82]],          // foot circled to inner position
      ],
    },
  ],

  // ── WALL CALF STRETCH ─────────────────────────────────────────────────────
  // Side view. One foot stepped back with heel pressed flat to floor and knee
  // straight; body leans forward into a wall to stretch the calf/Achilles.
  "Wall Calf Stretch": [
    { // START — standing upright, facing wall (arms forward reaching up)
      head: { cx: 54, cy: 10, r: 6 },
      lines: [
        [[54, 16], [52, 48]],
        [[52, 24], [66, 20], [78, 16]],                    // arms on wall
        [[52, 24], [40, 28], [30, 30]],
        [[52, 48], [48, 66], [44, 88]],
        [[52, 48], [58, 66], [62, 88]],
      ],
    },
    { // MID — R-foot back, heel flat, R-knee straight; L-knee bent forward; leaning in
      head: { cx: 58, cy: 12, r: 6 },
      lines: [
        [[58, 18], [54, 50]],                              // torso (slight forward lean)
        [[54, 26], [70, 18], [84, 12]],                    // arms on wall (forward)
        [[54, 26], [38, 24], [22, 20]],
        [[54, 50], [62, 66], [68, 86], [66, 94]],          // front (L) leg: knee bent
        [[54, 50], [40, 66], [32, 86], [24, 94]],          // back (R) leg: STRAIGHT, heel flat
      ],
      muscleGlow: { cx: 34, cy: 84, rx: 10, ry: 14 },
    },
    { // END — deeper lean, more calf/Achilles stretch
      head: { cx: 62, cy: 14, r: 6 },
      lines: [
        [[62, 20], [56, 52]],
        [[56, 28], [74, 20], [88, 12]],
        [[56, 28], [38, 26], [20, 22]],
        [[56, 52], [66, 68], [72, 88], [70, 96]],
        [[56, 52], [40, 68], [30, 88], [20, 96]],
      ],
    },
  ],

  // ── WALL PUPPY POSE ───────────────────────────────────────────────────────
  // Side view. Palms on wall, feet walked back; hips hinge back and down as
  // the chest drops to unlock thoracic extension and shoulder overhead range.
  "Wall Puppy Pose": [
    { // START — standing close to wall, palms on wall at shoulder height
      head: { cx: 68, cy: 12, r: 6 },
      lines: [
        [[64, 18], [58, 50]],
        [[62, 24], [78, 14], [90, 8]],                     // arms reaching up-right to wall
        [[62, 24], [52, 34], [46, 46]],
        [[58, 50], [54, 68], [52, 88]],
        [[58, 50], [64, 68], [68, 88]],
      ],
    },
    { // MID — feet walked back, hips hinging down, chest starting to drop
      head: { cx: 82, cy: 36, r: 6 },
      lines: [
        [[78, 32], [60, 38], [44, 48]],                    // spine (angled forward-down as body hinges)
        [[62, 34], [80, 20], [90, 10]],                    // arms straight to wall (right edge)
        [[62, 34], [74, 18], [84, 8]],
        [[44, 48], [36, 68], [30, 88]],                    // legs (feet now far behind)
        [[44, 48], [44, 68], [42, 88]],
      ],
      muscleGlow: { cx: 66, cy: 28, rx: 20, ry: 10 },
    },
    { // END — chest fully dropped, maximum thoracic extension
      head: { cx: 86, cy: 46, r: 6 },
      lines: [
        [[82, 42], [62, 48], [40, 58]],
        [[62, 44], [82, 26], [92, 14]],
        [[62, 44], [76, 26], [86, 12]],
        [[40, 58], [30, 74], [24, 92]],
        [[40, 58], [40, 74], [38, 92]],
      ],
    },
  ],

  // ── FIRST KNUCKLE RAISES ──────────────────────────────────────────────────
  // Side view. Same kneeling base as wrist extension. Palms are progressively
  // raised off the floor leaving only the first knuckles in contact.
  "First Knuckle Raises": [
    { // START — kneeling, palms fully flat on floor (rest position)
      head: { cx: 80, cy: 22, r: 6 },
      lines: [
        [[76, 26], [60, 32], [44, 40]],
        [[60, 32], [44, 38], [22, 46]],
        [[60, 32], [54, 38], [34, 46]],
        [[44, 40], [38, 58], [22, 60]],
        [[44, 40], [44, 58], [28, 60]],
      ],
    },
    { // MID — palms RAISED, only knuckles on floor (active wrist contraction)
      head: { cx: 80, cy: 22, r: 6 },
      lines: [
        [[76, 26], [60, 32], [44, 40]],
        [[60, 32], [44, 36], [28, 42], [22, 50]],          // arm: hand raised, knuckle pivot at floor
        [[60, 32], [54, 36], [38, 42], [32, 50]],          // other arm same
        [[44, 40], [38, 58], [22, 60]],
        [[44, 40], [44, 58], [28, 60]],
      ],
      muscleGlow: { cx: 28, cy: 46, rx: 14, ry: 8 },
    },
    { // END — palms lowered back to flat (return phase of rep)
      head: { cx: 80, cy: 22, r: 6 },
      lines: [
        [[76, 26], [60, 32], [44, 40]],
        [[60, 32], [44, 38], [22, 46]],
        [[60, 32], [54, 38], [34, 46]],
        [[44, 40], [38, 58], [22, 60]],
        [[44, 40], [44, 58], [28, 60]],
      ],
    },
  ],

  // ── BUTCHER'S BLOCK STRETCH ───────────────────────────────────────────────
  // Side view. Kneeling in front of a bench/chair; elbows on surface,
  // hands clasped behind head, chest sinking under gravity.
  "Butcher's Block Stretch": [
    { // START — kneeling upright in front of bench
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [42, 66], [28, 68]],
        [[50, 48], [58, 66], [44, 68]],
      ],
    },
    { // MID — elbows on bench, chest starting to drop
      head: { cx: 72, cy: 28, r: 6 },
      lines: [
        [[68, 24], [54, 36], [40, 50]],                    // spine angling forward-down
        [[60, 30], [76, 20], [88, 18]],                    // R upper-arm: elbow on bench surface
        [[60, 30], [72, 28], [80, 36]],                    // hands clasped behind head
        [[40, 50], [32, 68], [18, 70]],
        [[40, 50], [40, 68], [26, 70]],
      ],
      muscleGlow: { cx: 54, cy: 30, rx: 18, ry: 10 },
    },
    { // END — chest fully dropped, maximum lat/triceps stretch
      head: { cx: 76, cy: 38, r: 6 },
      lines: [
        [[72, 34], [56, 44], [38, 56]],
        [[62, 38], [80, 26], [92, 22]],
        [[62, 38], [76, 36], [84, 44]],
        [[38, 56], [28, 72], [14, 74]],
        [[38, 56], [38, 72], [22, 74]],
      ],
    },
  ],

  // ── GERMAN HANG (PASSIVE) ─────────────────────────────────────────────────
  // Side view. Starting from a dead hang, the body slowly rotates backward
  // until the shoulders are fully extended behind the bar.
  "German Hang (Passive)": [
    { // START — dead hang, arms overhead, body straight down
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50, 24], [36, 24], [28, 10]],                    // L-arm up to bar
        [[50, 24], [64, 24], [72, 10]],                    // R-arm up to bar
        [[50, 24], [50, 58]],                              // torso
        [[50, 58], [44, 78], [44, 94]],
        [[50, 58], [56, 78], [56, 94]],
      ],
    },
    { // MID — body rotating backward; legs tucking up as shoulders extend
      head: { cx: 50, cy: 40, r: 6 },
      lines: [
        [[50, 34], [36, 20], [28, 8]],                     // L-arm still at bar
        [[50, 34], [64, 20], [72, 8]],                     // R-arm still at bar
        [[50, 34], [48, 58]],                              // torso angling back
        [[48, 58], [36, 44], [28, 30]],                    // legs tucking up-back
        [[48, 58], [60, 44], [68, 30]],
      ],
      muscleGlow: { cx: 50, cy: 26, rx: 22, ry: 10 },
    },
    { // END — full German hang; shoulders extended far BEHIND bar, body below
      head: { cx: 50, cy: 52, r: 6 },
      lines: [
        [[50, 46], [36, 22], [28, 8]],                     // L-arm: shoulder far below, reaches UP-FORWARD to bar
        [[50, 46], [64, 22], [72, 8]],                     // R-arm same
        [[50, 46], [50, 72]],                              // torso hanging below-behind
        [[50, 72], [40, 88], [34, 96]],
        [[50, 72], [60, 88], [66, 96]],
      ],
    },
  ],

  // ── SKIN THE CAT (PARTIAL) ────────────────────────────────────────────────
  // Side view. From a dead hang, knees tuck and hips rotate overhead;
  // the body passes through an inverted position under control.
  "Skin the Cat (Partial)": [
    { // START — dead hang
      head: { cx: 50, cy: 30, r: 6 },
      lines: [
        [[50, 24], [36, 24], [28, 10]],
        [[50, 24], [64, 24], [72, 10]],
        [[50, 24], [50, 58]],
        [[50, 58], [44, 78], [44, 94]],
        [[50, 58], [56, 78], [56, 94]],
      ],
    },
    { // MID — knees tucked to chest, hips rotating overhead (inverted transition)
      head: { cx: 50, cy: 36, r: 6 },
      lines: [
        [[50, 30], [36, 20], [28, 8]],
        [[50, 30], [64, 20], [72, 8]],
        [[50, 30], [50, 52]],
        [[50, 52], [40, 36], [36, 20]],                    // legs tucked (knees toward bar)
        [[50, 52], [60, 36], [64, 20]],
      ],
      muscleGlow: { cx: 50, cy: 24, rx: 22, ry: 12 },
    },
    { // END — body inverted, legs passing through (below-and-behind position)
      head: { cx: 50, cy: 62, r: 6 },
      lines: [
        [[50, 56], [36, 18], [28, 6]],                     // arms to bar (shoulder now far down)
        [[50, 56], [64, 18], [72, 6]],
        [[50, 56], [50, 36]],                              // torso pointing upward (inverted)
        [[50, 36], [40, 18], [38, 6]],                     // legs pointing up through
        [[50, 36], [60, 18], [62, 6]],
      ],
    },
  ],

  // ── DEEP LAT FOAM ROLL ────────────────────────────────────────────────────
  // Prone side view. Lying on the side with a foam roller under the armpit;
  // the top arm reaches overhead to maximise the lat stretch as it rolls.
  "Deep Lat Foam Roll": [
    { // START — lying on side, roller at armpit, top arm resting
      head: { cx: 88, cy: 46, r: 6 },
      lines: [
        [[84, 50], [60, 52], [36, 54], [16, 56]],          // torso (horizontal, on side)
        [[66, 52], [56, 42], [48, 34]],                    // top arm resting forward
        [[66, 52], [58, 62], [52, 70]],                    // bottom arm (support on floor)
        [[16, 56], [10, 68], [8, 80]],
        [[36, 54], [30, 66], [26, 78]],
      ],
    },
    { // MID — top arm reaching FULLY OVERHEAD (maximum lat stretch on the roller)
      head: { cx: 88, cy: 46, r: 6 },
      lines: [
        [[84, 50], [60, 52], [36, 54], [16, 56]],
        [[68, 50], [62, 36], [56, 22], [52, 8]],           // arm reaching fully overhead
        [[68, 50], [60, 62], [54, 72]],                    // bottom arm (support)
        [[16, 56], [10, 68], [8, 80]],
        [[36, 54], [30, 66], [26, 78]],
      ],
      muscleGlow: { cx: 64, cy: 50, rx: 14, ry: 22 },
    },
    { // END — roller moved slightly toward lower ribs, arm still extended
      head: { cx: 88, cy: 48, r: 6 },
      lines: [
        [[84, 52], [58, 54], [34, 56], [14, 58]],
        [[62, 52], [56, 38], [50, 22], [46, 8]],
        [[62, 52], [56, 64], [50, 74]],
        [[14, 58], [8, 70], [6, 82]],
        [[34, 56], [28, 68], [24, 80]],
      ],
    },
  ],

  // ── PLANCHE LEANS ─────────────────────────────────────────────────────────
  // Side view. Starting from a neutral plank, the whole body leans forward
  // until the shoulders pass in front of the wrists, then returns.
  "Planche Leans": [
    { // START — neutral plank position
      head: { cx: 88, cy: 14, r: 6 },
      lines: [
        [[84, 18], [68, 20], [50, 22], [34, 26]],          // body line (horizontal)
        [[68, 20], [58, 28], [44, 36]],                    // arms (wrists at floor)
        [[50, 22], [42, 30], [30, 38]],
        [[34, 26], [24, 42], [12, 54]],                    // legs
        [[34, 26], [38, 44], [18, 56]],
      ],
    },
    { // MID — shoulders PAST WRISTS (full forward lean, scapular protraction)
      head: { cx: 80, cy: 14, r: 6 },
      lines: [
        [[76, 18], [60, 18], [42, 22], [26, 26]],          // body tilted forward
        [[60, 18], [52, 28], [40, 38]],                    // arms (shoulder now in front of hands)
        [[42, 22], [36, 30], [24, 40]],
        [[26, 26], [16, 42], [4, 54]],
        [[26, 26], [28, 44], [8, 56]],
      ],
      muscleGlow: { cx: 54, cy: 20, rx: 16, ry: 9 },
    },
    { // END — returned to plank (completing the lean cycle)
      head: { cx: 88, cy: 14, r: 6 },
      lines: [
        [[84, 18], [68, 20], [50, 22], [34, 26]],
        [[68, 20], [58, 28], [44, 36]],
        [[50, 22], [42, 30], [30, 38]],
        [[34, 26], [24, 42], [12, 54]],
        [[34, 26], [38, 44], [18, 56]],
      ],
    },
  ],

  // ── REVERSE TABLETOP STRETCH ──────────────────────────────────────────────
  // Side view. Sitting with knees bent and hands behind; hips press up until
  // the body is table-flat, then the head drops back to open the chest.
  "Reverse Tabletop Stretch": [
    { // START — sitting, knees bent, hands planted behind, slightly reclined
      head: { cx: 28, cy: 24, r: 6 },
      lines: [
        [[28, 30], [38, 56]],                              // spine (reclined)
        [[34, 38], [56, 46], [74, 52]],                    // R-arm behind (on floor)
        [[34, 38], [18, 44], [4, 50]],                     // L-arm behind
        [[38, 56], [58, 62], [74, 56]],                    // R-leg (knee bent, foot flat)
        [[38, 56], [30, 72], [28, 88]],                    // L-leg
      ],
    },
    { // MID — hips FULLY RAISED, body horizontal (tabletop position), head drops back
      head: { cx: 20, cy: 22, r: 6 },
      lines: [
        [[22, 28], [44, 32], [66, 36]],                    // spine horizontal (tabletop!)
        [[44, 32], [68, 44], [84, 56]],                    // R-arm going down-behind to floor
        [[44, 32], [20, 44], [6, 56]],                     // L-arm going down-behind to floor
        [[66, 36], [78, 52], [82, 72]],                    // R-leg (knee bent, foot flat)
        [[66, 36], [72, 54], [76, 74]],                    // L-leg
      ],
      muscleGlow: { cx: 40, cy: 28, rx: 24, ry: 8 },
    },
    { // END — same tabletop held (glutes engaged, deeper anterior stretch)
      head: { cx: 18, cy: 24, r: 6 },
      lines: [
        [[20, 30], [44, 34], [68, 38]],
        [[44, 34], [70, 46], [86, 58]],
        [[44, 34], [18, 46], [2, 58]],
        [[68, 38], [80, 54], [84, 74]],
        [[68, 38], [74, 56], [78, 76]],
      ],
    },
  ],

  // ── FINGER TENDON PULSES ──────────────────────────────────────────────────
  // Front view. One arm extended palm-up; the other hand bends each finger
  // individually back into gentle extension.
  "Finger Tendon Pulses": [
    { // START — standing, arms at sides
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [36, 30], [28, 44]],
        [[50, 22], [64, 30], [72, 44]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
    { // MID — R-arm extended palm-up; L-hand bends finger back (gentle pull)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [64, 22], [82, 22]],                    // R-arm horizontal, palm up
        [[50, 22], [62, 22], [78, 18], [82, 14]],          // L-hand at R-wrist, finger bent up
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
      muscleGlow: { cx: 80, cy: 20, rx: 8, ry: 10 },
    },
    { // END — finger fully extended (deeper pulse)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 22], [64, 22], [82, 22]],
        [[50, 22], [62, 22], [78, 18], [84, 10]],
        [[50, 48], [44, 66], [42, 86]],
        [[50, 48], [56, 66], [58, 86]],
      ],
    },
  ],

  // ── WEIGHTED ANKLE DORSIFLEXION ───────────────────────────────────────────
  // Side view. Foot ~10 cm from wall; knee driven progressively forward over
  // the toes to touch the wall while the heel stays flat.
  "Weighted Ankle Dorsiflexion": [
    { // START — standing upright, foot close to wall
      head: { cx: 54, cy: 10, r: 6 },
      lines: [
        [[54, 16], [52, 48]],
        [[52, 24], [66, 22], [80, 20]],                    // arms on wall
        [[52, 24], [38, 28], [28, 32]],
        [[52, 48], [48, 66], [46, 88]],
        [[52, 48], [58, 66], [62, 88]],
      ],
    },
    { // MID — knee driven FORWARD over toes (dorsiflexion); heel flat on floor
      head: { cx: 58, cy: 12, r: 6 },
      lines: [
        [[58, 18], [54, 50]],
        [[54, 26], [70, 18], [84, 12]],                    // hands on wall
        [[54, 26], [40, 22], [26, 18]],
        [[54, 50], [66, 64], [72, 82], [68, 92]],          // front leg: knee driven forward, heel flat
        [[54, 50], [46, 68], [42, 88]],                    // back leg (straight support)
      ],
      muscleGlow: { cx: 66, cy: 82, rx: 10, ry: 10 },
    },
    { // END — slightly deeper knee drive (further dorsiflexion range)
      head: { cx: 60, cy: 12, r: 6 },
      lines: [
        [[60, 18], [56, 50]],
        [[56, 26], [72, 18], [86, 12]],
        [[56, 26], [40, 22], [24, 18]],
        [[56, 50], [70, 64], [76, 82], [70, 92]],
        [[56, 50], [46, 68], [40, 88]],
      ],
    },
  ],

  // ── COSSACK SQUATS ────────────────────────────────────────────────────────
  // Front view. Wide stance; weight shifts to one side into a deep lateral
  // squat while the opposite leg extends fully along the floor.
  "Cossack Squats": [
    { // START — wide-stance standing
      head: { cx: 50, cy: 10, r: 7 },
      lines: [
        [[50, 17], [50, 48]],
        [[50, 23], [36, 32], [28, 46]],
        [[50, 23], [64, 32], [72, 46]],
        [[50, 48], [26, 64], [14, 86]],
        [[50, 48], [74, 64], [86, 86]],
      ],
    },
    { // MID — shifted LEFT: deep squat on L-leg (heel flat), R-leg extended straight
      head: { cx: 28, cy: 22, r: 7 },
      lines: [
        [[28, 29], [32, 60]],                              // torso upright over squatting leg
        [[28, 38], [12, 46], [6, 58]],                     // L-arm (balance)
        [[28, 38], [44, 44], [56, 52]],                    // R-arm on knee
        [[32, 60], [18, 76], [10, 96]],                    // L-leg: deep squat, heel flat
        [[32, 60], [60, 68], [88, 74], [96, 76]],          // R-leg: fully extended to the right
      ],
      muscleGlow: { cx: 20, cy: 76, rx: 12, ry: 16 },
    },
    { // END — shifted RIGHT: deep squat on R-leg, L-leg extended to the left
      head: { cx: 72, cy: 22, r: 7 },
      lines: [
        [[72, 29], [68, 60]],
        [[72, 38], [88, 46], [94, 58]],
        [[72, 38], [56, 44], [44, 52]],
        [[68, 60], [82, 76], [90, 96]],                    // R-leg: deep squat
        [[68, 60], [40, 68], [12, 74], [4, 76]],           // L-leg: extended to the left
      ],
    },
  ],

  // ── ACTIVE SCAPULAR HANGS ─────────────────────────────────────────────────
  // Front view. Hanging from bar. Scapulae alternate between active depression
  // (body "rises") and full elevation (body "drops") — arms stay straight.
  "Active Scapular Hangs": [
    { // START — dead hang, shoulders fully ELEVATED (passive, scapulae high)
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50, 22], [36, 22], [28, 8]],                     // L-arm to bar
        [[50, 22], [64, 22], [72, 8]],                     // R-arm to bar
        [[50, 22], [50, 56]],                              // torso
        [[50, 56], [44, 74], [42, 92]],
        [[50, 56], [56, 74], [58, 92]],
      ],
    },
    { // MID — scapulae actively DEPRESSED; body rises in the socket
      head: { cx: 50, cy: 36, r: 6 },
      lines: [
        [[50, 30], [36, 16], [28, 4]],                     // arms (shoulders now LOWER = pulled down)
        [[50, 30], [64, 16], [72, 4]],
        [[50, 30], [50, 64]],                              // torso slightly longer (body "rose")
        [[50, 64], [44, 80], [42, 96]],
        [[50, 64], [56, 80], [58, 96]],
      ],
      muscleGlow: { cx: 50, cy: 40, rx: 18, ry: 12 },
    },
    { // END — scapulae re-elevated (top of full range cycle)
      head: { cx: 50, cy: 24, r: 6 },
      lines: [
        [[50, 18], [36, 24], [28, 10]],                    // shoulders elevated again
        [[50, 18], [64, 24], [72, 10]],
        [[50, 18], [50, 52]],
        [[50, 52], [44, 70], [42, 88]],
        [[50, 52], [56, 70], [58, 88]],
      ],
    },
  ],

  // ── PRONE Y-RAISES ────────────────────────────────────────────────────────
  // Prone view (face-down, head to the right). Arms raise from resting at
  // sides up into a Y formation with thumbs pointing up.
  "Prone Y-Raises": [
    { // START — face down, arms resting at sides (T prep)
      head: { cx: 88, cy: 50, r: 6 },
      lines: [
        [[84, 54], [60, 54], [36, 56], [14, 58]],          // torso (horizontal)
        [[66, 54], [54, 48], [44, 44]],                    // top arm at side
        [[66, 54], [54, 60], [44, 66]],                    // bottom arm at side
        [[14, 58], [10, 66], [8, 78]],
        [[36, 56], [30, 64], [26, 76]],
      ],
    },
    { // MID — arms raised in Y formation (thumbs up, scapulae squeezed together)
      head: { cx: 88, cy: 48, r: 6 },
      lines: [
        [[84, 52], [60, 52], [36, 54], [14, 56]],
        [[66, 52], [50, 36], [34, 22]],                    // top arm raised (Y, upper branch)
        [[66, 52], [50, 68], [34, 82]],                    // bottom arm raised (Y, lower branch)
        [[14, 56], [10, 64], [8, 76]],
        [[36, 54], [30, 62], [26, 74]],
      ],
      muscleGlow: { cx: 56, cy: 50, rx: 14, ry: 14 },
    },
    { // END — arms lowering back toward sides
      head: { cx: 88, cy: 50, r: 6 },
      lines: [
        [[84, 54], [60, 54], [36, 56], [14, 58]],
        [[66, 54], [54, 46], [46, 40]],
        [[66, 54], [54, 62], [46, 68]],
        [[14, 58], [10, 66], [8, 78]],
        [[36, 56], [30, 64], [26, 76]],
      ],
    },
  ],

  // ── THORACIC BRIDGE ───────────────────────────────────────────────────────
  // Side view. Lying on back → glute bridge → thoracic extension with arms
  // walking overhead until the chest arches through the mid-back.
  "Thoracic Bridge": [
    { // START — lying on back, knees bent, feet flat, arms at sides
      head: { cx: 14, cy: 60, r: 6 },
      lines: [
        [[14, 66], [40, 64], [62, 62]],                    // torso (lying flat on floor)
        [[62, 62], [70, 46], [76, 32]],                    // R-leg: knee bent (shin goes up)
        [[62, 62], [72, 76], [78, 88]],                    // L-leg: other bent knee
        [[14, 66], [14, 78], [18, 90]],                    // arm at side
        [[40, 64], [42, 76], [44, 86]],
      ],
    },
    { // MID — hips raised (glute bridge), torso angled, arms walking overhead
      head: { cx: 14, cy: 66, r: 6 },
      lines: [
        [[14, 72], [40, 58], [62, 48]],                    // torso (hips raised, body angled)
        [[62, 48], [72, 66], [76, 86]],                    // R-leg: knee bent, foot flat
        [[62, 48], [58, 68], [52, 86]],                    // L-leg
        [[14, 72], [14, 82], [18, 90]],
        [[40, 58], [36, 72], [34, 84]],
      ],
      muscleGlow: { cx: 38, cy: 58, rx: 20, ry: 10 },
    },
    { // END — thoracic EXTENSION: chest arched upward through mid-back, arms overhead
      head: { cx: 22, cy: 60, r: 6 },
      lines: [
        [[22, 66], [46, 52], [68, 40]],                    // spine arching upward (mid-back ext.)
        [[68, 40], [78, 60], [82, 82]],                    // R-leg: knee bent
        [[68, 40], [64, 62], [58, 84]],                    // L-leg
        [[22, 66], [12, 54], [8, 40], [10, 26]],           // arms reaching OVERHEAD on floor
        [[22, 66], [16, 54], [12, 38], [14, 24]],
      ],
    },
  ],

  // ── Wrist Rock Flow ───────────────────────────────────────────────────────
  // START: all-fours neutral wrist — figure kneeling, hands flat, wrists neutral
  // MID:   wrist in full extension — body rocked forward, weight on fingertips
  // END:   wrist in flexion — body rocked backward, fingers curled
  "Wrist Rock Flow": [
    {
      // START — all-fours, neutral wrist position
      head: { cx: 75, cy: 24, r: 6 },
      lines: [
        [[75, 30], [56, 38], [40, 48]],
        [[40, 48], [26, 54]],
        [[40, 48], [26, 50]],
        [[56, 38], [54, 58], [52, 76]],
        [[56, 38], [66, 58], [68, 76]],
      ],
    },
    {
      // MID — rocked forward, full wrist extension (weight over fingertips)
      head: { cx: 80, cy: 20, r: 6 },
      lines: [
        [[80, 26], [60, 34], [42, 44]],
        [[42, 44], [24, 52]],
        [[42, 44], [22, 48]],
        [[60, 34], [58, 56], [56, 76]],
        [[60, 34], [70, 56], [72, 76]],
      ],
      muscleGlow: { cx: 36, cy: 50, rx: 14, ry: 8 },
    },
    {
      // END — rocked backward, wrist in flexion / decompressed
      head: { cx: 70, cy: 28, r: 6 },
      lines: [
        [[70, 34], [52, 42], [36, 52]],
        [[36, 52], [28, 58]],
        [[36, 52], [30, 54]],
        [[52, 42], [50, 62], [48, 80]],
        [[52, 42], [62, 62], [64, 80]],
      ],
    },
  ],

  // ── Cat-Cow & Jefferson Curl ──────────────────────────────────────────────
  // START: all-fours neutral (table top)
  // MID:   full cat (spine rounded upward)
  // END:   Jefferson Curl bottom — spine fully flexed, hanging forward
  "Cat-Cow & Jefferson Curl": [
    { // START
      head: { cx: 79.5, cy: 55.5, r: 6 },
      lines: [
        [[71,52.5],[61.5,48],[46,44.5],[36.5,46],[27,51.5]],
        [[27.5,51.5],[30.5,75.5],[26.5,79],[23.5,79.5]],
        [[27.5,51.5],[23,73],[15,79],[11.5,79]],
        [[61.5,48],[57,64.5],[54.5,76],[58.5,76]],
        [[61.5,48],[67,65],[68.5,77.5],[72,77]],
      ],
    },
    { // MID
      head: { cx: 78, cy: 44.5, r: 6 },
      lines: [
        [[69.5,51],[61.5,54.5],[51.5,57.5],[38.5,57],[30.5,54]],
        [[30.5,54],[41.5,76.5],[32.5,79],[29.5,78.5]],
        [[30.5,54],[22,76],[13,77],[10,75.5]],
        [[61.5,54.5],[59.5,71.5],[59,75.5],[62.5,76]],
        [[61.5,54.5],[69.5,69.5],[72,75.5],[75.5,75.5]],
      ],
      muscleGlow: { cx: 52, cy: 36, rx: 20, ry: 9 },
    },
    { // END
      head: { cx: 79.5, cy: 55.5, r: 6 },
      lines: [
        [[71,52.5],[61.5,48],[46,44.5],[36.5,46],[27,51.5]],
        [[27.5,51.5],[30.5,75.5],[26.5,79],[23.5,79.5]],
        [[27.5,51.5],[23,73],[15,79],[11.5,79]],
        [[61.5,48],[57,64.5],[54.5,76],[58.5,76]],
        [[61.5,48],[67,65],[68.5,77.5],[72,77]],
      ],
    },
  ],

};

// ─────────────────────────────────────────────────────────────────────────────
// Exercise → Pose Type mapping (covers all exercises + all daily mobility)
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_POSE_MAP: Record<string, PoseType> = {
  // Push family
  "Wall Push-Up":             "push-up",
  "Incline Push-Up":          "push-up",
  "Knee Push-Up":             "push-up",
  "Push-Up":                  "push-up",
  "Diamond Push-Up":          "push-up",
  "Archer Push-Up":           "push-up",
  "Pseudo Planche Push-Up":   "push-up",
  "Pike Push-Up":             "push-up",
  "Elevated Pike Push-Up":    "push-up",
  "Handstand Push-Up":        "push-up",
  "Ab Roller Rollout":        "push-up",
  "Ring Rollouts":            "push-up",

  // Pull family
  "Scapular Shrugs":          "hang-core",
  "Australian Rows":          "row",
  "Negative Pull-Ups":        "pull-up",
  "Pull-Up":                  "pull-up",
  "Explosive Pull-Up":        "pull-up",
  "Chest-to-Bar Pull-Up":     "pull-up",
  "Archer Pull-Up":           "pull-up",
  "Typewriter Pull-Up":       "pull-up",
  "Weighted Pull-Up":         "pull-up",
  "Ring Pull-Up":             "pull-up",

  // Muscle-Up
  "Muscle-Up":                "muscle-up",
  "Ring Muscle-Up":           "muscle-up",
  "Weighted Muscle-Up":       "muscle-up",

  // Dip family
  "Dip":                      "dip",
  "Ring Dip":                 "dip",
  "Ring Support Hold":        "dip",
  "Weighted Dip":             "dip",

  // Squat family
  "Assisted Squat":           "squat",
  "Squat":                    "squat",
  "Close-Stance Squat":       "squat",
  "Archer Squat":             "squat",

  // Pistol / single-leg
  "Pistol Squat":             "squat",
  "Assisted Pistol Squat":    "squat",
  "Shrimp Squat":             "squat",

  // Lunge / split
  "Lunge":                    "lunge",
  "Bulgarian Split Squat":    "lunge",
  "Step-Up":                  "lunge",

  // Plank / isometric
  "Plank":                    "plank",
  "Side Plank":               "plank",
  "Hollow Body Hold":         "plank",
  "Planche Lean":             "planche-lean",
  "Tuck Planche":             "plank",
  "Straddle Planche":         "plank",
  "Planche":                  "plank",

  // Hang core
  "Active Hang":              "hang-core",
  "Hanging Knee Tuck":        "hang-core",
  "Hanging Leg Raise":        "hang-core",
  "Toes to Bar":              "hang-core",
  "Windshield Wiper":         "hang-core",

  // Front lever
  "Tuck Front Lever":         "front-lever",
  "Straddle Front Lever":     "front-lever",
  "Full Front Lever":         "front-lever",

  // Human flag
  "Tucked Human Flag":        "human-flag",
  "One-Leg Human Flag":       "human-flag",
  "Human Flag":               "human-flag",

  // Dragon flag
  "Dragon Flag":              "dragon-flag",
  "Dragon Flag Negative":     "dragon-flag",

  // Handstand
  "Handstand":                "handstand",

  // L-Sit
  "Tuck L-Sit":               "l-sit",
  "L-Sit":                    "l-sit",
  "L-Sit Compression":        "l-sit",

  // Nordic / hamstring
  "Nordic Curls":             "nordic",
  "Slider Hamstring Curls":   "nordic",

  // Burpee / plyometric
  "Burpee":                   "burpee",
  "Box Jumps":                "burpee",

  // Equipment extras
  "Banded Pallof Press":      "plank",
  "Banded Lateral Walks":     "lunge",

  // ── Daily Mobility exercises ────────────────────────────────────────────────
  "Wrist Extension Stretch":  "wrist-kneeling",
  "Wrist Flexion Stretch":    "tricep-overhead",
  "Shoulder Dislocates":      "shoulder-arc",
  "Hanging Lat Stretch":      "hang-core",
  "Doorframe Chest Opener":   "shoulder-arc",
  "Low Lunge Hip Flexor":     "lunge",
  "Standing Hamstring Stretch": "forward-fold",
  "Seated Thoracic Rotation": "seated-twist",
  "Pigeon Pose Hip Opener":   "pigeon",
  "Overhead Triceps Stretch": "tricep-overhead",
  "Pancake Stretch":          "wide-straddle",
  "Reverse Shoulder Flexion": "reverse-shoulder",
  "Ankle Mobility Circles":   "cossack",
  "Wall Calf Stretch":        "lunge",
  "Wall Puppy Pose":          "wrist-kneeling",
  "First Knuckle Raises":     "wrist-kneeling",
  "Butcher's Block Stretch":  "wrist-kneeling",
  "Wrist Rock Flow":          "wrist-kneeling",
  "Cat-Cow & Jefferson Curl": "mobility",
  "German Hang (Passive)":    "german-hang",
  "Skin the Cat (Partial)":   "german-hang",
  "Deep Lat Foam Roll":       "prone",
  "Planche Leans":            "planche-lean",
  "Reverse Tabletop Stretch": "reverse-shoulder",
  "Finger Tendon Pulses":     "tricep-overhead",
  "Weighted Ankle Dorsiflexion": "lunge",
  "Cossack Squats":           "cossack",
  "Active Scapular Hangs":    "german-hang",
  "Prone Y-Raises":           "prone",
  "Thoracic Bridge":          "bridge",
};

export function getPoseSet(exerciseName: string): PoseSet {
  if (MOBILITY_POSE_LIBRARY[exerciseName]) return MOBILITY_POSE_LIBRARY[exerciseName];
  const poseType = EXERCISE_POSE_MAP[exerciseName] ?? "default";
  return POSE_LIBRARY[poseType];
}

// ─── Environment Engine ───────────────────────────────────────────────────────
// Maps exercise names → their static environment anchor.
// Only exercises with a defined anchor appear here; all others render no env.
// Anchor coordinates are in the 100×100 SVG viewBox.
//
// LOCKED-JOINT CONTRACT: for any joint that must stay touching an anchor across
// frames, ensure its [x, y] endpoint is identical in every relevant PoseData
// entry inside MOBILITY_POSE_LIBRARY.  The spring animator will then produce
// zero movement on that point while the rest of the skeleton morphs naturally.

const MOBILITY_ENV_MAP: Record<string, EnvAnchor> = {
  // ── Wrist Extension — kneeling on floor, hands flat on ground ────────────
  "Wrist Extension Stretch": { type: "floor", x1: 4, y1: 67, x2: 96, y2: 67 },

  // ── First Knuckle Raises — same kneeling floor position ──────────────────
  "First Knuckle Raises": { type: "floor", x1: 4, y1: 67, x2: 96, y2: 67 },

  // ── Planche Leans — hands on floor, body in push-up lean ─────────────────
  "Planche Leans": { type: "floor", x1: 4, y1: 67, x2: 96, y2: 67 },

  // ── Hanging exercises — overhead bar ─────────────────────────────────────
  "Hanging Lat Stretch":       { type: "bar", x1: 20, y1: 8, x2: 80, y2: 8 },
  "German Hang (Passive)":     { type: "bar", x1: 20, y1: 8, x2: 80, y2: 8 },
  "Skin the Cat (Partial)":    { type: "bar", x1: 20, y1: 8, x2: 80, y2: 8 },
  "Active Scapular Hangs":     { type: "bar", x1: 20, y1: 8, x2: 80, y2: 8 },

  // ── Wall-based exercises ──────────────────────────────────────────────────
  "Wall Puppy Pose":    { type: "wall", x1: 94, y1: 4, x2: 94, y2: 96 },
  "Wall Calf Stretch":  { type: "wall", x1: 94, y1: 4, x2: 94, y2: 96 },
  "Doorframe Chest Opener": { type: "wall", x1: 94, y1: 4, x2: 94, y2: 96 },

  // ── Box/bench exercises ───────────────────────────────────────────────────
  "Butcher's Block Stretch": { type: "box", x1: 56, y1: 44, x2: 96, y2: 58 },
  "Reverse Tabletop Stretch": { type: "box", x1: 4,  y1: 52, x2: 44, y2: 66 },

  // ── Floor-based non-kneeling exercises ───────────────────────────────────
  "Standing Hamstring Stretch": { type: "floor", x1: 4, y1: 86, x2: 96, y2: 86 },
  "Pancake Stretch":            { type: "floor", x1: 4, y1: 86, x2: 96, y2: 86 },
  "Pigeon Pose Hip Opener":     { type: "floor", x1: 4, y1: 82, x2: 96, y2: 82 },
  "Thoracic Bridge":            { type: "floor", x1: 4, y1: 82, x2: 96, y2: 82 },
  "Prone Y-Raises":             { type: "floor", x1: 4, y1: 82, x2: 96, y2: 82 },
  "Deep Lat Foam Roll":         { type: "floor", x1: 4, y1: 82, x2: 96, y2: 82 },
  "Cossack Squats":             { type: "floor", x1: 4, y1: 86, x2: 96, y2: 86 },
};

/** Returns the environmental anchor for a named mobility exercise, or undefined. */
export function getMobilityEnv(exerciseName: string): EnvAnchor | undefined {
  return MOBILITY_ENV_MAP[exerciseName];
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise intensity — drives animation personality
// ─────────────────────────────────────────────────────────────────────────────

const STRENUOUS_SET = new Set([
  "Pull-Up", "Explosive Pull-Up", "Chest-to-Bar Pull-Up", "Archer Pull-Up",
  "Typewriter Pull-Up", "Weighted Pull-Up", "Ring Pull-Up", "Negative Pull-Ups",
  "Muscle-Up", "Ring Muscle-Up", "Weighted Muscle-Up",
  "Tuck Front Lever", "Straddle Front Lever", "Full Front Lever",
  "Handstand", "Handstand Push-Up",
  "Human Flag", "Tucked Human Flag", "One-Leg Human Flag",
  "Dragon Flag", "Dragon Flag Negative",
  "L-Sit", "Tuck L-Sit",
  "Planche", "Tuck Planche", "Straddle Planche",
  "Ring Support Hold", "Ring Dip",
  "Active Scapular Hangs", "German Hang (Passive)", "Skin the Cat (Partial)",
  "Toes to Bar", "Windshield Wiper",
  "Nordic Curls", "Slider Hamstring Curls",
]);

const RELAXED_SET = new Set([
  "Wrist Extension Stretch", "Wrist Flexion Stretch", "Shoulder Dislocates",
  "Hanging Lat Stretch", "Doorframe Chest Opener", "Low Lunge Hip Flexor",
  "Standing Hamstring Stretch", "Seated Thoracic Rotation", "Pigeon Pose Hip Opener",
  "Overhead Triceps Stretch", "Pancake Stretch", "Reverse Shoulder Flexion",
  "Ankle Mobility Circles", "Wall Calf Stretch", "Wall Puppy Pose",
  "First Knuckle Raises", "Butcher's Block Stretch", "Deep Lat Foam Roll",
  "Planche Leans", "Reverse Tabletop Stretch", "Finger Tendon Pulses",
  "Weighted Ankle Dorsiflexion", "Cossack Squats", "Prone Y-Raises",
  "Thoracic Bridge", "L-Sit Compression", "Pike Stretch",
  "Dead Bug", "Superman",
]);

export function getExerciseIntensity(exerciseName: string): ExerciseIntensity {
  if (STRENUOUS_SET.has(exerciseName)) return "strenuous";
  if (RELAXED_SET.has(exerciseName))   return "relaxed";
  return "neutral";
}
export function getMobilityExerciseNames(): string[] {
  return Object.keys(MOBILITY_POSE_LIBRARY);
}

// ─── World Objects ────────────────────────────────────────────────────────────
// Per-exercise arrays of EnvAnchor objects rendered behind the skeleton in the
// animation lab and in playback.  Written by PUT /api/admin/poses/:name/env.

export const EXERCISE_WORLD_OBJECTS: Record<string, EnvAnchor[]> = {
// <<<WORLD_OBJECTS_END>>>
};

/** Returns world-object anchors for an exercise.
 *  New map has priority; falls back to the legacy MOBILITY_ENV_MAP entry. */
export function getWorldObjects(exerciseName: string): EnvAnchor[] {
  const wo = EXERCISE_WORLD_OBJECTS[exerciseName];
  if (wo?.length) return wo;
  const legacy = MOBILITY_ENV_MAP[exerciseName];
  return legacy ? [legacy] : [];
}
