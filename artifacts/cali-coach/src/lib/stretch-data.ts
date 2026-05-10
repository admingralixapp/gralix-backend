/**
 * stretch-data.ts
 *
 * Anatomically accurate 3-frame pose sets (Start → Mid → End) for every
 * daily mobility stretch in CaliCoach.
 *
 * Coordinate system — 100×100 SVG viewBox:
 *   • Front-view  : bilateral / symmetric moves — head top, feet bottom
 *   • Side-view   : sagittal-plane moves — figure faces RIGHT
 *   • Horizontal  : lying-down moves — head on LEFT, feet on RIGHT
 *
 * Realistic proportions (viewBox units):
 *   Head radius   6   │  Neck          5
 *   Upper arm    14   │  Forearm       12
 *   Torso        30   │  Thigh         22
 *   Shin         20   │  Shoulder span 28
 */

import type { PoseData, PoseSet } from "./exercise-poses";

// ─── Neutral fallback ─────────────────────────────────────────────────────────

const NEUTRAL_FRAME: PoseData = {
  head: { cx: 50, cy: 9, r: 6 },
  lines: [
    [[50, 15], [50, 48]],
    [[36, 20], [30, 34], [28, 48]],
    [[64, 20], [70, 34], [72, 48]],
    [[44, 48], [42, 68], [42, 88]],
    [[56, 48], [58, 68], [58, 88]],
  ],
};
const NEUTRAL: PoseSet = [NEUTRAL_FRAME, NEUTRAL_FRAME, NEUTRAL_FRAME];

// ─── Library ──────────────────────────────────────────────────────────────────

const STRETCH_POSES: Record<string, PoseSet> = {

  // ══════════════════════════════════════════════════════════════════════════
  // SHOULDER DISLOCATES — front view
  // Full arc: arms low-front → overhead wide → behind back
  // ══════════════════════════════════════════════════════════════════════════
  shoulderDislocates: [
    {
      // Start: arms at sides, holding band wide at hip level
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [22, 34], [14, 50]],   // L arm — angled down and wide
        [[64, 20], [78, 34], [86, 50]],   // R arm
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
    {
      // Mid: arms fully overhead — wide V reaching up through the arc
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [14, 8], [2, 2]],      // L arm stretched overhead-wide
        [[64, 20], [86, 8], [98, 2]],     // R arm
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
      muscleGlow: { cx: 50, cy: 16, rx: 28, ry: 10 },
    },
    {
      // End: arms swept behind back — elbows slightly back, wrists at hip level behind
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [26, 36], [22, 52]],   // L arm — angled down-back
        [[64, 20], [74, 36], [78, 52]],   // R arm
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WRIST EXTENSION STRETCH — side view
  // Kneeling, palms flat on floor (fingers pointing BACK), leaning forward
  // ══════════════════════════════════════════════════════════════════════════
  wristExtension: [
    {
      // Start: kneeling upright, hands at sides
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 46]],
        [[50, 24], [62, 36], [64, 50]],   // front arm at side
        [[50, 24], [38, 36], [36, 50]],   // back arm at side
        [[44, 46], [42, 62], [40, 80]],   // front thigh (kneeling)
        [[56, 46], [56, 64], [58, 80]],   // back shin on floor
      ],
    },
    {
      // Mid: hands flat on floor, fingers pointing toward knees, body leaning forward
      head: { cx: 74, cy: 22, r: 6 },
      lines: [
        [[68, 28], [52, 36], [48, 52]],         // torso angled forward
        [[52, 36], [34, 34], [18, 40]],         // arms: wrist on floor, fingers pointing BACK
        [[52, 36], [56, 48], [60, 62]],         // back arm
        [[48, 52], [44, 68], [40, 84]],
        [[48, 52], [52, 68], [56, 84]],
      ],
      muscleGlow: { cx: 24, cy: 36, rx: 14, ry: 7 },
    },
    {
      // End: deeper lean — wrists under maximum extension load
      head: { cx: 76, cy: 28, r: 6 },
      lines: [
        [[70, 34], [54, 42], [50, 58]],
        [[54, 42], [34, 40], [16, 46]],         // wrists even further stretched
        [[54, 42], [58, 56], [62, 70]],
        [[50, 58], [46, 74], [42, 88]],
        [[50, 58], [54, 74], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WRIST FLEXION STRETCH — front view
  // One arm extended, palm down; other hand pulls fingers upward
  // ══════════════════════════════════════════════════════════════════════════
  wristFlexion: [
    {
      // Start: standing, arms at sides
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [30, 34], [28, 48]],
        [[64, 20], [70, 34], [72, 48]],
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
    {
      // Mid: right arm extended sideways at shoulder height (palm down);
      //      left arm crosses body to pull right fingers back
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[64, 20], [80, 20], [96, 20]],    // R arm: straight sideways to wrist
        [[36, 20], [42, 26], [62, 20]],    // L arm: crosses, hand on R fingers
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
      muscleGlow: { cx: 90, cy: 20, rx: 8, ry: 12 },
    },
    {
      // End: deeper pull — fingers bent back further toward forearm
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[64, 20], [80, 20], [96, 20]],
        [[36, 20], [44, 24], [64, 20]],    // L hand pressing harder into R fingers
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // HANGING LAT STRETCH — front view
  // Dead hang: arms overhead, body elongated, side-shift to deepen
  // ══════════════════════════════════════════════════════════════════════════
  latStretch: [
    {
      // Start: standing, arms reaching up toward bar
      head: { cx: 50, cy: 14, r: 6 },
      lines: [
        [[50, 20], [50, 52]],
        [[36, 24], [20, 10], [14, 4]],     // L arm reaching overhead to bar
        [[64, 24], [80, 10], [86, 4]],     // R arm
        [[44, 52], [42, 70], [42, 90]],
        [[56, 52], [58, 70], [58, 90]],
      ],
    },
    {
      // Mid: full dead hang — body elongated, shoulders passive
      head: { cx: 50, cy: 22, r: 6 },
      lines: [
        [[50, 28], [50, 62]],
        [[36, 26], [22, 14], [16, 6]],
        [[64, 26], [78, 14], [84, 6]],
        [[44, 62], [42, 80], [42, 96]],
        [[56, 62], [58, 80], [58, 96]],
      ],
      muscleGlow: { cx: 50, cy: 40, rx: 18, ry: 14 },
    },
    {
      // End: body drifts LEFT — deepens right-side lat stretch
      head: { cx: 44, cy: 22, r: 6 },
      lines: [
        [[44, 28], [44, 62]],
        [[36, 26], [22, 14], [16, 6]],     // arms stay at bar
        [[64, 26], [78, 14], [84, 6]],
        [[38, 62], [36, 80], [36, 96]],    // legs drifted left
        [[50, 62], [52, 80], [52, 96]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // DOORFRAME CHEST OPENER — front view
  // Forearms on frame at 90°, chest leaning through
  // ══════════════════════════════════════════════════════════════════════════
  chestOpener: [
    {
      // Start: standing, arms at sides
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [30, 34], [28, 48]],
        [[64, 20], [70, 34], [72, 48]],
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
    {
      // Mid: elbows wide at shoulder height, forearms vertical UP on doorframe
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [14, 20], [14, 6]],     // L: elbow out, forearm up on frame
        [[64, 20], [86, 20], [86, 6]],     // R: same
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
      muscleGlow: { cx: 50, cy: 22, rx: 22, ry: 9 },
    },
    {
      // End: body leaning forward through doorway (head / torso pushed forward)
      head: { cx: 50, cy: 11, r: 6 },
      lines: [
        [[50, 17], [50, 50]],
        [[36, 22], [14, 20], [14, 6]],     // arms on frame (same)
        [[64, 22], [86, 20], [86, 6]],
        [[44, 50], [42, 70], [42, 88]],
        [[56, 50], [58, 70], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // LOW LUNGE HIP FLEXOR — side view
  // Back knee on floor, hips forward; arm raises overhead in end frame
  // ══════════════════════════════════════════════════════════════════════════
  hipFlexorLunge: [
    {
      // Start: standing upright (before drop)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [62, 36], [64, 50]],
        [[50, 24], [38, 36], [34, 50]],
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [56, 68], [58, 88]],
      ],
    },
    {
      // Mid: low lunge — front knee 90°, back knee on floor, torso upright, hand on front knee
      head: { cx: 52, cy: 14, r: 6 },
      lines: [
        [[52, 20], [52, 50]],
        [[52, 30], [66, 32], [74, 24]],    // front arm, hand resting on front knee
        [[52, 30], [40, 40], [36, 54]],    // back arm
        [[52, 50], [68, 64], [72, 86]],    // front leg: hip → knee 90° → ankle
        [[52, 50], [36, 52], [26, 66]],    // back leg: hip → back-knee on floor → shin
      ],
      muscleGlow: { cx: 42, cy: 54, rx: 12, ry: 18 },
    },
    {
      // End: hips sunk lower, arm sweeps overhead to deepen thoracic opening
      head: { cx: 52, cy: 10, r: 6 },
      lines: [
        [[52, 16], [52, 50]],
        [[52, 26], [60, 14], [62, 4]],     // arm overhead
        [[52, 26], [40, 38], [36, 52]],    // back arm
        [[52, 50], [70, 60], [74, 82]],    // front leg (hips lower)
        [[52, 50], [34, 52], [24, 66]],    // back leg
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // STANDING HAMSTRING STRETCH — side view
  // Hip-hinge forward fold from standing
  // ══════════════════════════════════════════════════════════════════════════
  hamstring: [
    {
      // Start: standing tall
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [62, 34], [64, 48]],
        [[50, 24], [38, 34], [36, 48]],
        [[44, 48], [44, 68], [44, 88]],
        [[56, 48], [56, 68], [56, 88]],
      ],
    },
    {
      // Mid: hinge ~45° at hips, flat back, arms hanging forward
      head: { cx: 28, cy: 30, r: 6 },
      lines: [
        [[28, 36], [50, 44], [56, 50]],    // spine: angled forward
        [[36, 38], [24, 52], [18, 66]],    // arms hanging down
        [[36, 38], [50, 52], [56, 66]],
        [[56, 50], [56, 70], [56, 90]],    // legs (straight)
        [[56, 50], [60, 70], [60, 90]],
      ],
      muscleGlow: { cx: 56, cy: 64, rx: 7, ry: 20 },
    },
    {
      // End: full forward fold — torso horizontal, hands reaching toward floor
      head: { cx: 18, cy: 46, r: 6 },
      lines: [
        [[18, 52], [42, 50], [56, 50]],    // torso nearly horizontal
        [[24, 52], [12, 64], [8, 78]],     // arms hanging toward floor
        [[24, 52], [38, 64], [44, 78]],
        [[56, 50], [56, 70], [56, 90]],
        [[56, 50], [60, 70], [60, 90]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // SEATED THORACIC ROTATION — front / ¾ view
  // Cross-legged, spine twists while hips stay square
  // ══════════════════════════════════════════════════════════════════════════
  thoracicRotation: [
    {
      // Start: seated cross-legged, facing forward, hands on knees
      head: { cx: 50, cy: 16, r: 6 },
      lines: [
        [[50, 22], [50, 54]],
        [[36, 28], [28, 44], [24, 60]],    // L arm on L knee
        [[64, 28], [72, 44], [76, 60]],    // R arm on R knee
        [[50, 54], [28, 64], [16, 78]],    // L leg (cross-legged)
        [[50, 54], [72, 64], [84, 78]],    // R leg
      ],
    },
    {
      // Mid: torso rotated RIGHT — left shoulder drives forward, right elbow back
      head: { cx: 60, cy: 16, r: 6 },
      lines: [
        [[56, 22], [50, 54]],              // spine: upper body shifted right
        [[42, 26], [10, 28], [2, 38]],     // L arm: reaches far across to R knee
        [[62, 26], [84, 36], [92, 52]],    // R arm: behind body
        [[50, 54], [28, 64], [16, 78]],    // hips stay square
        [[50, 54], [72, 64], [84, 78]],
      ],
      muscleGlow: { cx: 58, cy: 36, rx: 12, ry: 22 },
    },
    {
      // End: maximum rotation — head looking far over right shoulder
      head: { cx: 68, cy: 16, r: 6 },
      lines: [
        [[62, 22], [50, 54]],
        [[40, 26], [6, 26], [0, 34]],      // L arm fully across
        [[64, 26], [88, 34], [96, 48]],    // R arm pushed back
        [[50, 54], [28, 64], [16, 78]],
        [[50, 54], [72, 64], [84, 78]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // PIGEON POSE HIP OPENER — side view
  // All-fours → pigeon (shin across) → folded forward
  // ══════════════════════════════════════════════════════════════════════════
  pigeonPose: [
    {
      // Start: all-fours (quadruped) — hands and knees on floor
      head: { cx: 80, cy: 24, r: 6 },
      lines: [
        [[74, 30], [60, 34], [46, 38]],    // spine horizontal
        [[60, 34], [44, 30], [28, 30]],    // arms forward to floor
        [[60, 34], [62, 44], [64, 56]],    // back arm
        [[46, 38], [40, 56], [36, 72]],    // front leg (knee under hip)
        [[46, 38], [52, 56], [60, 74]],    // back leg
      ],
    },
    {
      // Mid: pigeon — front shin across at 30°, back leg straight behind, torso upright
      head: { cx: 50, cy: 14, r: 6 },
      lines: [
        [[50, 20], [50, 52]],
        [[50, 28], [62, 40], [66, 54]],    // arm (support, hand to side on floor)
        [[50, 28], [38, 40], [34, 54]],
        [[50, 52], [36, 58], [20, 64], [18, 78]],  // front shin across floor
        [[50, 52], [62, 66], [78, 82], [86, 94]],  // back leg extended behind
      ],
      muscleGlow: { cx: 26, cy: 66, rx: 18, ry: 10 },
    },
    {
      // End: torso folded forward over front shin, arms extended on floor
      head: { cx: 24, cy: 54, r: 6 },
      lines: [
        [[24, 60], [42, 52], [52, 52]],    // torso folded forward
        [[42, 52], [20, 52], [6, 54]],     // arms extended forward on floor
        [[42, 52], [60, 52], [74, 54]],
        [[52, 52], [36, 58], [20, 66], [18, 80]],
        [[52, 52], [64, 66], [80, 82], [88, 94]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // OVERHEAD TRICEPS STRETCH — front view
  // One arm raised & bent, other hand presses the elbow
  // ══════════════════════════════════════════════════════════════════════════
  tricepsStretch: [
    {
      // Start: standing, both arms at sides
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [30, 34], [28, 48]],
        [[64, 20], [70, 34], [72, 48]],
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
    {
      // Mid: R arm raised, elbow bent (hand drops behind head);
      //      L arm crosses up to press R elbow
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[64, 20], [70, 8], [66, 0], [56, 6]],  // R arm: up → elbow bent → hand behind head
        [[36, 20], [40, 10], [54, 6]],            // L arm: reaches up to press R elbow
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
      muscleGlow: { cx: 66, cy: 6, rx: 10, ry: 14 },
    },
    {
      // End: deeper press — hand lower behind head, elbow pushed further down
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[64, 20], [70, 8], [64, 0], [54, 4]],   // tighter bend
        [[36, 20], [42, 8], [56, 4]],              // pressing harder
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // PANCAKE STRETCH — front view
  // Wide straddle seated, hinging forward with flat back
  // ══════════════════════════════════════════════════════════════════════════
  pancake: [
    {
      // Start: seated straddle, legs wide, torso upright
      head: { cx: 50, cy: 18, r: 7 },
      lines: [
        [[50, 25], [50, 56]],
        [[36, 32], [28, 48], [22, 62]],    // L arm at side
        [[64, 32], [72, 48], [78, 62]],    // R arm
        [[50, 56], [22, 64], [8, 78]],     // L leg — wide out
        [[50, 56], [78, 64], [92, 78]],    // R leg — wide out
      ],
    },
    {
      // Mid: hinging forward, flat back ~45°, arms reaching toward feet
      head: { cx: 50, cy: 34, r: 6 },
      lines: [
        [[50, 40], [50, 58]],
        [[40, 42], [24, 46], [10, 54]],    // L arm toward L foot
        [[60, 42], [76, 46], [90, 54]],    // R arm toward R foot
        [[50, 58], [20, 66], [6, 80]],
        [[50, 58], [80, 66], [94, 80]],
      ],
      muscleGlow: { cx: 50, cy: 60, rx: 30, ry: 9 },
    },
    {
      // End: chest much closer to floor — maximum forward fold
      head: { cx: 50, cy: 46, r: 6 },
      lines: [
        [[50, 52], [50, 60]],
        [[40, 54], [22, 58], [8, 66]],
        [[60, 54], [78, 58], [92, 66]],
        [[50, 60], [18, 68], [4, 82]],
        [[50, 60], [82, 68], [96, 82]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // REVERSE SHOULDER FLEXION — side view
  // Kneeling, hands behind on a surface, hips drop to open anterior shoulders
  // ══════════════════════════════════════════════════════════════════════════
  shoulderFlexion: [
    {
      // Start: kneeling upright, arms at sides
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 46]],
        [[50, 24], [62, 36], [66, 50]],
        [[50, 24], [38, 36], [34, 50]],
        [[44, 46], [42, 64], [40, 80]],
        [[56, 46], [56, 64], [58, 80]],
      ],
    },
    {
      // Mid: hands placed on surface behind body, arms straight, chest opening
      head: { cx: 50, cy: 12, r: 6 },
      lines: [
        [[50, 18], [50, 46]],
        [[50, 28], [66, 40], [82, 54]],    // R arm extended BACK to surface
        [[50, 28], [34, 40], [18, 54]],    // L arm extended BACK to surface
        [[44, 46], [42, 64], [40, 82]],
        [[56, 46], [56, 64], [60, 82]],
      ],
      muscleGlow: { cx: 50, cy: 20, rx: 16, ry: 9 },
    },
    {
      // End: hips drop lower — deeper anterior shoulder stretch
      head: { cx: 50, cy: 16, r: 6 },
      lines: [
        [[50, 22], [50, 52]],
        [[50, 34], [68, 48], [86, 62]],
        [[50, 34], [32, 48], [14, 62]],
        [[44, 52], [40, 70], [38, 88]],
        [[56, 52], [56, 70], [60, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // ANKLE MOBILITY CIRCLES — side view
  // Standing on one foot, other foot raised and circling
  // ══════════════════════════════════════════════════════════════════════════
  ankleCircles: [
    {
      // Start: standing on both feet
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [62, 36], [64, 50]],
        [[50, 24], [38, 36], [36, 50]],
        [[44, 48], [44, 68], [44, 88]],
        [[56, 48], [56, 68], [58, 88]],
      ],
    },
    {
      // Mid: weight on R leg; L foot raised, knee bent, foot circling outward
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 26], [62, 36], [66, 50]],    // arms slightly out for balance
        [[50, 26], [38, 36], [34, 50]],
        [[56, 48], [56, 68], [58, 88]],    // standing leg (R)
        [[44, 48], [38, 60], [30, 72], [22, 82]],  // lifted L leg: knee bent, foot out
      ],
      muscleGlow: { cx: 22, cy: 82, rx: 8, ry: 6 },
    },
    {
      // End: foot circles inward (toes pointing in and slightly up)
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 26], [62, 36], [66, 50]],
        [[50, 26], [38, 36], [34, 50]],
        [[56, 48], [56, 68], [58, 88]],
        [[44, 48], [38, 60], [32, 72], [28, 62]],  // foot pointing inward-up
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WALL CALF STRETCH — side view
  // Back foot heel flat on floor, front leg bent toward wall
  // ══════════════════════════════════════════════════════════════════════════
  calfStretch: [
    {
      // Start: standing, arms reaching forward to wall
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [66, 24], [82, 18]],    // arms forward reaching wall
        [[50, 24], [58, 36], [74, 30]],
        [[44, 48], [44, 68], [44, 88]],
        [[56, 48], [56, 68], [58, 88]],
      ],
    },
    {
      // Mid: front leg bent (knee toward wall), back leg STRAIGHT — heel flat on floor
      head: { cx: 58, cy: 14, r: 6 },
      lines: [
        [[58, 20], [58, 50]],
        [[58, 28], [74, 24], [90, 18]],    // arms on wall
        [[58, 28], [50, 40], [44, 52]],
        [[58, 50], [72, 58], [78, 78], [78, 96]],   // front leg: knee forward
        [[58, 50], [42, 54], [32, 68], [32, 88]],   // back leg: straight, heel flat
      ],
      muscleGlow: { cx: 32, cy: 78, rx: 7, ry: 14 },
    },
    {
      // End: deeper lean — greater calf stretch on back leg
      head: { cx: 60, cy: 12, r: 6 },
      lines: [
        [[60, 18], [60, 50]],
        [[60, 26], [78, 20], [94, 14]],
        [[60, 26], [52, 38], [46, 50]],
        [[60, 50], [74, 56], [80, 76], [80, 96]],
        [[60, 50], [42, 54], [30, 68], [30, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WALL PUPPY POSE — side view
  // Hands on wall, walk feet back, chest drops between arms
  // ══════════════════════════════════════════════════════════════════════════
  wallPuppyPose: [
    {
      // Start: standing, arms reaching forward to wall at shoulder height
      head: { cx: 56, cy: 12, r: 6 },
      lines: [
        [[56, 18], [56, 50]],
        [[56, 26], [76, 26], [92, 24]],    // arms reaching wall
        [[56, 26], [46, 38], [40, 52]],
        [[50, 50], [50, 68], [50, 88]],
        [[62, 50], [62, 68], [62, 88]],
      ],
    },
    {
      // Mid: feet walked back, hips over feet, torso angled ~45°, chest dropping
      head: { cx: 38, cy: 30, r: 6 },
      lines: [
        [[38, 36], [58, 38], [70, 42]],    // spine angled down
        [[58, 38], [80, 26], [96, 20]],    // arms straight on wall (elevated)
        [[58, 38], [60, 50], [62, 64]],    // back arm stub
        [[70, 42], [70, 60], [70, 80]],    // front leg (hip is now at 70,42)
        [[70, 42], [58, 54], [52, 74]],    // back leg
      ],
      muscleGlow: { cx: 64, cy: 34, rx: 16, ry: 10 },
    },
    {
      // End: chest fully dropped — armpits toward floor, arms outstretched on wall
      head: { cx: 32, cy: 38, r: 6 },
      lines: [
        [[32, 44], [56, 44], [72, 48]],    // spine nearly horizontal
        [[56, 44], [80, 30], [98, 24]],    // arms on wall
        [[56, 44], [60, 58], [64, 72]],
        [[72, 48], [72, 66], [70, 86]],
        [[72, 48], [58, 62], [52, 80]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // FIRST KNUCKLE RAISES — side view
  // Same kneeling position as wrist extension; palms raise, knuckles stay down
  // ══════════════════════════════════════════════════════════════════════════
  firstKnuckleRaises: [
    {
      // Start: hands flat on floor (wrist extension position), kneeling
      head: { cx: 74, cy: 22, r: 6 },
      lines: [
        [[68, 28], [52, 36], [48, 52]],
        [[52, 36], [34, 34], [18, 40]],    // arms: palms flat on floor
        [[52, 36], [56, 50], [60, 64]],
        [[48, 52], [44, 68], [40, 84]],
        [[48, 52], [52, 68], [56, 84]],
      ],
    },
    {
      // Mid: palms RAISED off floor, only knuckles remain on floor (arched wrist)
      head: { cx: 74, cy: 22, r: 6 },
      lines: [
        [[68, 28], [52, 36], [48, 52]],
        [[52, 36], [34, 34], [18, 46]],    // wrists lifted (knuckles stay low, palm up)
        [[52, 36], [56, 50], [60, 64]],
        [[48, 52], [44, 68], [40, 84]],
        [[48, 52], [52, 68], [56, 84]],
      ],
      muscleGlow: { cx: 22, cy: 40, rx: 10, ry: 7 },
    },
    {
      // End: palms lower back to flat on floor
      head: { cx: 74, cy: 22, r: 6 },
      lines: [
        [[68, 28], [52, 36], [48, 52]],
        [[52, 36], [34, 34], [18, 40]],    // palms flat again
        [[52, 36], [56, 50], [60, 64]],
        [[48, 52], [44, 68], [40, 84]],
        [[48, 52], [52, 68], [56, 84]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BUTCHER'S BLOCK STRETCH — side view
  // Kneeling, elbows on bench/surface, chest sinking to floor
  // ══════════════════════════════════════════════════════════════════════════
  butchersBlock: [
    {
      // Start: kneeling upright before stretch
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [62, 34], [66, 48]],
        [[50, 24], [38, 34], [34, 48]],
        [[44, 48], [42, 64], [40, 80]],
        [[56, 48], [56, 64], [58, 80]],
      ],
    },
    {
      // Mid: elbows on surface (at ~34 height), hands clasped behind head,
      //      torso angling down, chest beginning to sink
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50, 34], [50, 58]],
        [[50, 40], [34, 34], [22, 34]],    // L elbow on bench, forearm horizontal
        [[50, 40], [66, 34], [78, 34]],    // R elbow on bench
        [[50, 58], [44, 74], [40, 90]],
        [[50, 58], [56, 74], [60, 90]],
      ],
      muscleGlow: { cx: 50, cy: 34, rx: 20, ry: 8 },
    },
    {
      // End: chest dropped lower toward floor — maximum lat / triceps stretch
      head: { cx: 50, cy: 36, r: 6 },
      lines: [
        [[50, 42], [50, 62]],
        [[50, 48], [32, 36], [20, 36]],
        [[50, 48], [68, 36], [80, 36]],
        [[50, 62], [44, 78], [40, 94]],
        [[50, 62], [56, 78], [60, 94]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // GERMAN HANG (PASSIVE) — front view
  // Dead hang → knees tuck and body rotates backward → German hang
  // ══════════════════════════════════════════════════════════════════════════
  germanHang: [
    {
      // Start: dead hang (arms overhead at bar)
      head: { cx: 50, cy: 22, r: 6 },
      lines: [
        [[50, 28], [50, 62]],
        [[36, 26], [22, 14], [16, 6]],
        [[64, 26], [78, 14], [84, 6]],
        [[44, 62], [42, 80], [42, 96]],
        [[56, 62], [58, 80], [58, 96]],
      ],
    },
    {
      // Mid: knees tucked, body rotating backward through the bar
      head: { cx: 50, cy: 26, r: 6 },
      lines: [
        [[50, 32], [50, 52]],
        [[36, 26], [22, 14], [16, 6]],     // arms fixed at bar
        [[64, 26], [78, 14], [84, 6]],
        [[50, 52], [38, 40], [30, 28]],    // legs tucking back (knees UP through bar)
        [[50, 52], [62, 40], [70, 28]],
      ],
      muscleGlow: { cx: 50, cy: 24, rx: 24, ry: 10 },
    },
    {
      // End: German hang — shoulders fully extended behind bar, body inverted below
      head: { cx: 50, cy: 50, r: 6 },
      lines: [
        [[50, 44], [50, 30]],              // torso now shorter / inverted
        [[36, 26], [22, 14], [16, 6]],     // arms at bar (fixed)
        [[64, 26], [78, 14], [84, 6]],
        [[44, 44], [42, 60], [44, 78]],    // legs hanging below (post-rotation)
        [[56, 44], [58, 60], [56, 78]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // SKIN THE CAT (PARTIAL) — front view
  // Dead hang → inverted tuck overhead → reverse hang on the other side
  // ══════════════════════════════════════════════════════════════════════════
  skinTheCat: [
    {
      // Start: dead hang
      head: { cx: 50, cy: 22, r: 6 },
      lines: [
        [[50, 28], [50, 62]],
        [[36, 26], [22, 14], [16, 6]],
        [[64, 26], [78, 14], [84, 6]],
        [[44, 62], [42, 80], [42, 96]],
        [[56, 62], [58, 80], [58, 96]],
      ],
    },
    {
      // Mid: hips tucked overhead — inverted tuck, knees above bar line
      head: { cx: 50, cy: 54, r: 6 },
      lines: [
        [[50, 48], [50, 30]],              // spine rotated (head now at bottom of torso)
        [[36, 26], [22, 14], [16, 6]],
        [[64, 26], [78, 14], [84, 6]],
        [[50, 30], [38, 16], [28, 6]],     // legs tucked up through bar
        [[50, 30], [62, 16], [72, 6]],
      ],
      muscleGlow: { cx: 50, cy: 22, rx: 22, ry: 12 },
    },
    {
      // End: legs through to reverse hang — body hanging below on the far side
      head: { cx: 50, cy: 72, r: 6 },
      lines: [
        [[50, 66], [50, 42]],
        [[36, 26], [22, 14], [16, 6]],
        [[64, 26], [78, 14], [84, 6]],
        [[44, 42], [40, 26], [32, 14]],    // legs hanging on far side of bar
        [[56, 42], [60, 26], [68, 14]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // DEEP LAT FOAM ROLL — horizontal side view
  // Lying on side, roller under armpit, arm reaching overhead
  // ══════════════════════════════════════════════════════════════════════════
  deepLatStretch: [
    {
      // Start: lying on side, top arm resting along body
      head: { cx: 12, cy: 50, r: 6 },
      lines: [
        [[12, 56], [36, 56], [62, 58], [86, 60]],   // spine (horizontal)
        [[24, 52], [18, 42], [14, 34]],               // top arm at side
        [[24, 52], [40, 52], [56, 52]],               // lower arm
        [[86, 60], [86, 72], [84, 86]],               // legs
        [[86, 60], [80, 72], [78, 86]],
      ],
    },
    {
      // Mid: arm reaching overhead (lat fully lengthened over roller under armpit)
      head: { cx: 12, cy: 50, r: 6 },
      lines: [
        [[12, 56], [36, 56], [62, 58], [86, 60]],
        [[24, 52], [12, 40], [4, 30]],                // top arm reaching overhead
        [[24, 52], [40, 52], [56, 52]],
        [[86, 60], [86, 72], [84, 86]],
        [[86, 60], [80, 72], [78, 86]],
      ],
      muscleGlow: { cx: 40, cy: 52, rx: 14, ry: 8 },
    },
    {
      // End: arm reaching further overhead, body rolling slightly
      head: { cx: 12, cy: 52, r: 6 },
      lines: [
        [[12, 58], [36, 58], [62, 60], [86, 62]],
        [[24, 54], [10, 40], [2, 28]],                // max overhead reach
        [[24, 54], [40, 54], [58, 54]],
        [[86, 62], [86, 74], [84, 88]],
        [[86, 62], [80, 74], [78, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // PLANCHE LEANS — side view
  // Push-up position leaning forward past wrists; returns each rep
  // ══════════════════════════════════════════════════════════════════════════
  plancheLeans: [
    {
      // Start: straight plank / push-up position (hands under shoulders)
      head: { cx: 88, cy: 14, r: 6 },
      lines: [
        [[82, 20], [66, 22], [50, 24], [34, 28]],    // spine (head → hip)
        [[66, 22], [50, 22], [34, 22]],               // arms: shoulder → wrist on floor
        [[34, 28], [20, 40], [8, 54]],                // legs → feet
      ],
    },
    {
      // Mid: shoulders lean PAST wrists — forward body shift
      head: { cx: 80, cy: 14, r: 6 },
      lines: [
        [[74, 20], [58, 18], [42, 20], [26, 24]],    // spine shifted forward
        [[58, 18], [40, 18], [22, 18]],               // arms (wrists now BEHIND shoulder line)
        [[26, 24], [12, 36], [2, 50]],
      ],
      muscleGlow: { cx: 44, cy: 18, rx: 16, ry: 8 },
    },
    {
      // End: return to neutral plank
      head: { cx: 88, cy: 14, r: 6 },
      lines: [
        [[82, 20], [66, 22], [50, 24], [34, 28]],
        [[66, 22], [50, 22], [34, 22]],
        [[34, 28], [20, 40], [8, 54]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // REVERSE TABLETOP STRETCH — side view
  // Sitting → hips pressed up → head drops back, full anterior shoulder stretch
  // ══════════════════════════════════════════════════════════════════════════
  reverseTabletop: [
    {
      // Start: sitting, knees bent, hands behind on floor (fingers forward)
      head: { cx: 26, cy: 20, r: 6 },
      lines: [
        [[26, 26], [32, 52]],              // spine (sitting, leaning back slightly)
        [[26, 34], [44, 42], [60, 50]],    // arm back to floor
        [[26, 34], [14, 44], [6, 56]],
        [[32, 52], [48, 62], [56, 82]],    // front leg (bent)
        [[32, 52], [22, 64], [16, 84]],    // back leg (bent, sitting)
      ],
    },
    {
      // Mid: hips pressed up — body in reverse tabletop (spine horizontal)
      head: { cx: 22, cy: 28, r: 6 },
      lines: [
        [[22, 34], [40, 28], [58, 28]],    // spine horizontal
        [[40, 28], [58, 38], [74, 50]],    // arm back to floor (hands behind)
        [[40, 28], [26, 38], [14, 52]],
        [[58, 28], [64, 48], [68, 70]],    // front leg
        [[58, 28], [56, 52], [52, 72]],    // back leg
      ],
      muscleGlow: { cx: 38, cy: 26, rx: 18, ry: 8 },
    },
    {
      // End: head drops back, hips even higher, maximum anterior shoulder stretch
      head: { cx: 26, cy: 36, r: 6 },
      lines: [
        [[26, 30], [44, 24], [62, 24]],    // spine (hips high)
        [[44, 24], [62, 34], [78, 48]],
        [[44, 24], [30, 36], [18, 50]],
        [[62, 24], [68, 44], [72, 66]],
        [[62, 24], [60, 50], [56, 72]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // FINGER TENDON PULSES — front view
  // One arm extended palm-up, other hand gently bending fingers back
  // ══════════════════════════════════════════════════════════════════════════
  fingerPulses: [
    {
      // Start: standing, arms at sides
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [30, 34], [28, 48]],
        [[64, 20], [70, 34], [72, 48]],
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
    {
      // Mid: L arm extended forward at waist height (palm up);
      //      R hand reaching across to gently bend L fingers back
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [28, 32], [18, 42]],    // L arm: extended forward-down, palm up
        [[64, 20], [58, 32], [42, 42]],    // R arm: crossing to hold L fingers
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
      muscleGlow: { cx: 18, cy: 42, rx: 8, ry: 6 },
    },
    {
      // End: fingers bent further back — tendon at end-range
      head: { cx: 50, cy: 9, r: 6 },
      lines: [
        [[50, 15], [50, 48]],
        [[36, 20], [26, 34], [16, 46]],    // arm extended further
        [[64, 20], [56, 34], [40, 46]],    // R hand pressing harder
        [[44, 48], [42, 68], [42, 88]],
        [[56, 48], [58, 68], [58, 88]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WEIGHTED ANKLE DORSIFLEXION — side view
  // Knee drives forward over toes at wall, heel stays flat
  // ══════════════════════════════════════════════════════════════════════════
  ankleDorsiflexion: [
    {
      // Start: standing, one foot close to wall, arms reaching wall
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[50, 24], [66, 24], [82, 18]],    // arms forward to wall
        [[50, 24], [56, 36], [72, 30]],
        [[44, 48], [44, 68], [44, 88]],
        [[56, 48], [56, 68], [58, 88]],
      ],
    },
    {
      // Mid: knee driving FORWARD over toes — heel stays flat on floor
      head: { cx: 52, cy: 12, r: 6 },
      lines: [
        [[52, 18], [52, 48]],
        [[52, 26], [70, 22], [88, 16]],    // arms on wall
        [[52, 26], [42, 38], [36, 52]],
        [[52, 48], [68, 52], [82, 60], [82, 80]],   // front leg: knee FORWARD over toes
        [[52, 48], [42, 58], [38, 78], [40, 90]],   // other leg behind
      ],
      muscleGlow: { cx: 78, cy: 56, rx: 8, ry: 16 },
    },
    {
      // End: maximum dorsiflexion — knee even further forward
      head: { cx: 54, cy: 10, r: 6 },
      lines: [
        [[54, 16], [54, 48]],
        [[54, 24], [72, 18], [92, 12]],
        [[54, 24], [44, 36], [38, 50]],
        [[54, 48], [72, 50], [88, 56], [88, 76]],
        [[54, 48], [42, 58], [36, 78], [38, 90]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // COSSACK SQUATS — front view
  // Wide stance, alternating deep lateral squats
  // ══════════════════════════════════════════════════════════════════════════
  cossackSquats: [
    {
      // Start: wide stance standing
      head: { cx: 50, cy: 10, r: 6 },
      lines: [
        [[50, 16], [50, 48]],
        [[36, 22], [28, 36], [22, 50]],
        [[64, 22], [72, 36], [78, 50]],
        [[44, 48], [28, 62], [16, 88]],    // L leg wide
        [[56, 48], [72, 62], [84, 88]],    // R leg wide
      ],
    },
    {
      // Mid: shifted LEFT — deep squat on L leg, R leg fully extended flat
      head: { cx: 28, cy: 22, r: 6 },
      lines: [
        [[28, 28], [36, 56]],              // torso (shifted left, upright)
        [[28, 38], [14, 36], [4, 46]],     // arms out for balance
        [[28, 38], [44, 38], [56, 46]],
        [[36, 56], [24, 74], [16, 92]],    // L leg: deep squat (knee forward)
        [[36, 56], [62, 64], [84, 72], [94, 74]],  // R leg: fully extended, heel on floor
      ],
      muscleGlow: { cx: 18, cy: 80, rx: 10, ry: 16 },
    },
    {
      // End: shifted RIGHT — deep squat on R leg, L leg fully extended flat
      head: { cx: 72, cy: 22, r: 6 },
      lines: [
        [[72, 28], [64, 56]],
        [[72, 38], [86, 36], [96, 46]],
        [[72, 38], [56, 38], [44, 46]],
        [[64, 56], [76, 74], [84, 92]],    // R leg: deep squat
        [[64, 56], [38, 64], [16, 72], [6, 74]],   // L leg: fully extended flat
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE SCAPULAR HANGS — front view
  // Hanging, shoulder blades cycle: elevated (passive) → depressed (active)
  // ══════════════════════════════════════════════════════════════════════════
  scapularHangs: [
    {
      // Start: passive hang — scapulae ELEVATED (shrugged, body dropped low)
      head: { cx: 50, cy: 28, r: 6 },    // head lower — body has dropped
      lines: [
        [[50, 34], [50, 66]],             // spine (elongated)
        [[36, 30], [22, 16], [16, 8]],    // arms at bar
        [[64, 30], [78, 16], [84, 8]],
        [[44, 66], [42, 82], [42, 96]],
        [[56, 66], [58, 82], [58, 96]],
      ],
    },
    {
      // Mid: scapulae DEPRESSED — body RISES (shoulder blades pulled down & back)
      head: { cx: 50, cy: 20, r: 6 },    // head higher — body pulled up
      lines: [
        [[50, 26], [50, 56]],             // spine (shorter — body higher)
        [[36, 24], [22, 14], [16, 6]],
        [[64, 24], [78, 14], [84, 6]],
        [[44, 56], [42, 74], [42, 92]],
        [[56, 56], [58, 74], [58, 92]],
      ],
      muscleGlow: { cx: 50, cy: 30, rx: 20, ry: 10 },
    },
    {
      // End: scapulae elevated again — body drops (same as Start, completing the cycle)
      head: { cx: 50, cy: 28, r: 6 },
      lines: [
        [[50, 34], [50, 66]],
        [[36, 30], [22, 16], [16, 8]],
        [[64, 30], [78, 16], [84, 8]],
        [[44, 66], [42, 82], [42, 96]],
        [[56, 66], [58, 82], [58, 96]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // PRONE Y-RAISES — horizontal side view (face-down)
  // Arms raise in Y-shape from body, then lower back down
  // ══════════════════════════════════════════════════════════════════════════
  proneYRaises: [
    {
      // Start: lying face-down, arms resting along sides
      head: { cx: 88, cy: 50, r: 6 },
      lines: [
        [[82, 54], [62, 56], [40, 58], [18, 60]],   // spine (horizontal)
        [[62, 56], [56, 48], [50, 40]],               // top arm at side
        [[62, 56], [56, 64], [50, 72]],               // bottom arm at side
        [[18, 60], [12, 70], [8, 84]],
        [[18, 60], [22, 70], [24, 84]],
      ],
    },
    {
      // Mid: Y-raise — arms lifted diagonally in Y-shape (thumbs up)
      head: { cx: 88, cy: 48, r: 6 },
      lines: [
        [[82, 52], [62, 54], [40, 56], [18, 58]],
        [[62, 54], [44, 38], [26, 22]],               // top arm raised — Y branch
        [[62, 54], [44, 70], [26, 84]],               // bottom arm raised — Y branch
        [[18, 58], [12, 68], [8, 82]],
        [[18, 58], [22, 68], [24, 82]],
      ],
      muscleGlow: { cx: 44, cy: 50, rx: 16, ry: 16 },
    },
    {
      // End: arms lower back to sides
      head: { cx: 88, cy: 50, r: 6 },
      lines: [
        [[82, 54], [62, 56], [40, 58], [18, 60]],
        [[62, 56], [56, 48], [50, 40]],
        [[62, 56], [56, 64], [50, 72]],
        [[18, 60], [12, 70], [8, 84]],
        [[18, 60], [22, 70], [24, 84]],
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // THORACIC BRIDGE — side view (lying on back)
  // Lying → glute bridge → hands walk overhead, chest arches through
  // ══════════════════════════════════════════════════════════════════════════
  thoracicBridge: [
    {
      // Start: lying on back, knees bent, feet flat on floor
      head: { cx: 12, cy: 54, r: 6 },
      lines: [
        [[12, 60], [12, 64]],
        [[12, 64], [36, 64], [58, 64]],    // spine (flat on floor)
        [[58, 64], [62, 46], [68, 34]],    // upper leg (thigh, knee bent)
        [[68, 34], [72, 52], [76, 68]],    // lower leg (shin, foot on floor)
        [[12, 64], [12, 76], [14, 88]],    // back arm on floor
      ],
    },
    {
      // Mid: glute bridge — hips raised, spine forms diagonal, feet flat
      head: { cx: 12, cy: 60, r: 6 },
      lines: [
        [[12, 66], [12, 70]],
        [[12, 70], [36, 56], [58, 46]],    // spine (hips elevated)
        [[58, 46], [66, 64], [72, 84]],    // front leg (knee bent, foot flat)
        [[58, 46], [54, 68], [50, 86]],    // back leg (shin)
        [[12, 70], [12, 80], [14, 92]],    // arms on floor
      ],
      muscleGlow: { cx: 36, cy: 54, rx: 20, ry: 10 },
    },
    {
      // End: arms walked overhead on floor, chest arching through — thoracic extension
      head: { cx: 18, cy: 60, r: 6 },
      lines: [
        [[18, 66], [18, 70]],
        [[18, 70], [42, 52], [62, 44]],    // spine (arched, hips high)
        [[62, 44], [70, 62], [76, 82]],    // front leg
        [[62, 44], [58, 66], [54, 86]],    // back leg
        [[18, 70], [6, 58], [2, 44]],      // arms overhead on floor
      ],
    },
  ],

};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the anatomically accurate 3-frame PoseSet for a given stretch ID.
 * Falls back to a neutral standing pose if the ID is not yet defined.
 */
export function getStretchPoseSet(stretchId: string): PoseSet {
  return STRETCH_POSES[stretchId] ?? NEUTRAL;
}
