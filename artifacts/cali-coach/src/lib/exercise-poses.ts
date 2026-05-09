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
  const poseType = EXERCISE_POSE_MAP[exerciseName] ?? "default";
  return POSE_LIBRARY[poseType];
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
