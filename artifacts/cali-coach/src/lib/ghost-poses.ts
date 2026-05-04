/**
 * Ghost Pose System
 *
 * Provides:
 *   - Per-exercise "ideal form" defined as target joint angles per phase
 *   - computeGhostLandmarks(): transforms user's detected body to show perfect form
 *     (anchors to user's body so ghost always matches their scale + position)
 *   - getAnimatedGhostLandmarks(): interpolates between phase keyframes for smooth AR animation
 *   - calcSyncPct(): compares user landmarks to ghost landmarks, returns 0–100
 *   - drawGhostSkeleton(): renders cyan semi-transparent ghost on a canvas context
 *
 * All landmark indices follow MediaPipe Pose 33-keypoint model.
 */

import { type Landmark, type Phase } from "./exercise-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One joint-angle correction:
 * Rotate landmark at index `b` around `vertex` until
 * calcAngle(ghost[a], ghost[vertex], ghost[b]) === targetDeg.
 */
export interface AngleCorrection {
  a: number;
  vertex: number;
  b: number;
  targetDeg: number;
}

export interface GhostPhaseConfig {
  phase: Phase;
  corrections: AngleCorrection[];
  /** Landmarks whose positions are checked for sync (should be the corrected endpoints). */
  keyLandmarks: number[];
}

export interface GhostExerciseConfig {
  phases: GhostPhaseConfig[];
}

// ─── Landmark indices (mirrors exercise-registry LM) ─────────────────────────

const L_SH = 11;  // LEFT_SHOULDER
const R_SH = 12;  // RIGHT_SHOULDER
const L_EL = 13;  // LEFT_ELBOW
const R_EL = 14;  // RIGHT_ELBOW
const L_WR = 15;  // LEFT_WRIST
const R_WR = 16;  // RIGHT_WRIST
const L_HI = 23;  // LEFT_HIP
const R_HI = 24;  // RIGHT_HIP
const L_KN = 25;  // LEFT_KNEE
const R_KN = 26;  // RIGHT_KNEE
const L_AN = 27;  // LEFT_ANKLE
const R_AN = 28;  // RIGHT_ANKLE

// ─── Angle helpers ────────────────────────────────────────────────────────────

function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * (180 / Math.PI));
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/**
 * Rotate landmark `ghost[b]` around `ghost[vertex]` so that the angle
 * calcAngle(ghost[a], ghost[vertex], ghost[b]) approaches targetDeg.
 * The direction of rotation preserves the current "side" the limb is on.
 */
function applyAngleCorrection(
  ghost: Landmark[],
  a: number,
  vertex: number,
  b: number,
  targetDeg: number,
): void {
  const pA = ghost[a];
  const pV = ghost[vertex];
  const pB = ghost[b];
  if (!pA || !pV || !pB) return;

  // Vector from vertex to b
  const vBx = pB.x - pV.x;
  const vBy = pB.y - pV.y;
  // Vector from vertex to a
  const vAx = pA.x - pV.x;
  const vAy = pA.y - pV.y;

  // Signed angle from vA to vB (positive = counter-clockwise in screen space)
  const signedCurrent = Math.atan2(
    vBx * vAy - vBy * vAx,
    vBx * vAx + vBy * vAy,
  );

  // We want |signedCurrent| = targetDeg (in radians), preserving sign
  const targetRad = (signedCurrent >= 0 ? 1 : -1) * (targetDeg * Math.PI / 180);
  const delta = targetRad - signedCurrent;

  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  ghost[b] = {
    ...pB,
    x: pV.x + vBx * cos - vBy * sin,
    y: pV.y + vBx * sin + vBy * cos,
  };
}

// ─── Public: compute ghost landmarks ─────────────────────────────────────────

/**
 * Returns a copy of user landmarks with the given corrections applied.
 * Anchored to the user's body — ghost always overlays at the right scale.
 */
export function computeGhostLandmarks(
  user: Landmark[],
  corrections: AngleCorrection[],
): Landmark[] {
  const ghost = user.map(lm => ({ ...lm }));
  for (const { a, vertex, b, targetDeg } of corrections) {
    applyAngleCorrection(ghost, a, vertex, b, targetDeg);
  }
  return ghost;
}

/**
 * Returns an animated ghost that smoothly cycles between the "start" and "end"
 * phase keyframes for a rep exercise, using an independent timer.
 * `t` should be 0–1 (0 = start phase, 1 = end phase).
 */
export function computeAnimatedGhostLandmarks(
  user: Landmark[],
  config: GhostExerciseConfig,
  t: number,
): Landmark[] {
  const phases = config.phases;
  if (phases.length === 0) return user.map(lm => ({ ...lm }));
  if (phases.length === 1) return computeGhostLandmarks(user, phases[0].corrections);

  // Interpolate between first two keyframes
  const fromPhase = phases[0];
  const toPhase   = phases[1];

  // Interpolate target angles
  const blended: AngleCorrection[] = fromPhase.corrections.map((corr, i) => ({
    ...corr,
    targetDeg:
      corr.targetDeg +
      t * ((toPhase.corrections[i]?.targetDeg ?? corr.targetDeg) - corr.targetDeg),
  }));

  return computeGhostLandmarks(user, blended);
}

// ─── Public: sync calculation ─────────────────────────────────────────────────

const SYNC_THRESHOLD = 0.15; // 15% of the 0–1 normalised coordinate range

/**
 * Returns a 0–100 sync score representing how closely the user's
 * key landmarks match the ideal ghost landmark positions.
 */
export function calcSyncPct(
  user: Landmark[],
  ghost: Landmark[],
  keyLandmarks: number[],
): number {
  const visible = keyLandmarks.filter(
    i => user[i] && (user[i].visibility ?? 1) > 0.3,
  );
  if (visible.length === 0) return 100;

  let matches = 0;
  for (const i of visible) {
    const dist = Math.hypot(user[i].x - ghost[i].x, user[i].y - ghost[i].y);
    if (dist <= SYNC_THRESHOLD) matches++;
  }
  return (matches / visible.length) * 100;
}

// ─── Public: draw ghost skeleton ─────────────────────────────────────────────

// MediaPipe pose connections (subset of full 33-point model, covering the main limbs)
const GHOST_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21],
  [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 29], [27, 31], [29, 31],
  [28, 30], [28, 32], [30, 32],
];

/**
 * Renders a semi-transparent cyan ghost skeleton on the provided 2D context.
 * Call this BEFORE drawing the user's skeleton so the ghost appears behind.
 */
export function drawGhostSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number,
  syncPct: number,
): void {
  ctx.save();

  const synced = syncPct >= 85;
  const alpha  = 0.5;
  const color  = synced ? "0, 212, 255" : "255, 160, 0"; // cyan when synced, amber when not

  ctx.globalAlpha = alpha;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.lineWidth   = 3;

  // Draw connections
  ctx.strokeStyle = `rgb(${color})`;
  for (const [s, e] of GHOST_CONNECTIONS) {
    const a = landmarks[s];
    const b = landmarks[e];
    if (!a || !b) continue;
    if ((a.visibility ?? 1) < 0.2 || (b.visibility ?? 1) < 0.2) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
    ctx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
    ctx.stroke();
  }

  // Draw landmark dots
  ctx.fillStyle = `rgb(${color})`;
  for (const lm of landmarks) {
    if (!lm || (lm.visibility ?? 1) < 0.2) continue;
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Exercise ghost configurations ───────────────────────────────────────────

const PUSH_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_SH, vertex: L_EL, b: L_WR, targetDeg: 165 },
        { a: R_SH, vertex: R_EL, b: R_WR, targetDeg: 165 },
        { a: L_SH, vertex: L_HI, b: L_AN, targetDeg: 175 },
      ],
      keyLandmarks: [L_WR, R_WR, L_AN],
    },
    {
      phase: "down",
      corrections: [
        { a: L_SH, vertex: L_EL, b: L_WR, targetDeg: 75 },
        { a: R_SH, vertex: R_EL, b: R_WR, targetDeg: 75 },
        { a: L_SH, vertex: L_HI, b: L_AN, targetDeg: 175 },
      ],
      keyLandmarks: [L_WR, R_WR, L_AN],
    },
  ],
};

const HSPU_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
    {
      phase: "down",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 75 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 75 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
  ],
};

const PULL_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "bottom",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
    {
      phase: "top",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 50 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 50 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
  ],
};

const NEGATIVE_PULL_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "top",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 50 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 50 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
    {
      phase: "bottom",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
  ],
};

const SCAPULAR_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "bottom",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
    {
      phase: "top",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 155 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 155 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
  ],
};

const SQUAT_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 170 },
        { a: R_HI, vertex: R_KN, b: R_AN, targetDeg: 170 },
      ],
      keyLandmarks: [L_AN, R_AN],
    },
    {
      phase: "down",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 90 },
        { a: R_HI, vertex: R_KN, b: R_AN, targetDeg: 90 },
      ],
      keyLandmarks: [L_AN, R_AN],
    },
  ],
};

const LUNGE_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 160 },
      ],
      keyLandmarks: [L_AN],
    },
    {
      phase: "down",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 100 },
      ],
      keyLandmarks: [L_AN],
    },
  ],
};

const NORDIC_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 170 },
        { a: R_HI, vertex: R_KN, b: R_AN, targetDeg: 170 },
      ],
      keyLandmarks: [L_AN, R_AN],
    },
    {
      phase: "down",
      corrections: [
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 90 },
        { a: R_HI, vertex: R_KN, b: R_AN, targetDeg: 90 },
      ],
      keyLandmarks: [L_AN, R_AN],
    },
  ],
};

const DIP_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "up",
      corrections: [
        { a: L_SH, vertex: L_EL, b: L_WR, targetDeg: 165 },
        { a: R_SH, vertex: R_EL, b: R_WR, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
    {
      phase: "down",
      corrections: [
        { a: L_SH, vertex: L_EL, b: L_WR, targetDeg: 80 },
        { a: R_SH, vertex: R_EL, b: R_WR, targetDeg: 80 },
      ],
      keyLandmarks: [L_WR, R_WR],
    },
  ],
};

// ── Static holds ──────────────────────────────────────────────────────────────

const PLANK_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "hold",
      corrections: [
        { a: L_SH, vertex: L_EL, b: L_WR, targetDeg: 165 },
        { a: R_SH, vertex: R_EL, b: R_WR, targetDeg: 165 },
        { a: L_SH, vertex: L_HI, b: L_AN, targetDeg: 175 },
      ],
      keyLandmarks: [L_WR, R_WR, L_AN],
    },
  ],
};

const FRONT_LEVER_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "hold",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
        { a: L_SH, vertex: L_HI, b: L_KN, targetDeg: 175 },
      ],
      keyLandmarks: [L_WR, R_WR, L_KN],
    },
  ],
};

const DRAGON_FLAG_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "hold",
      corrections: [
        { a: L_SH, vertex: L_HI, b: L_KN, targetDeg: 175 },
        { a: R_SH, vertex: R_HI, b: R_KN, targetDeg: 175 },
        { a: L_HI, vertex: L_KN, b: L_AN, targetDeg: 175 },
      ],
      keyLandmarks: [L_KN, R_KN, L_AN],
    },
  ],
};

const HUMAN_FLAG_CONFIG: GhostExerciseConfig = {
  phases: [
    {
      phase: "hold",
      corrections: [
        { a: L_WR, vertex: L_EL, b: L_SH, targetDeg: 165 },
        { a: R_WR, vertex: R_EL, b: R_SH, targetDeg: 165 },
      ],
      keyLandmarks: [L_WR, R_WR, L_SH, R_SH],
    },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const GHOST_CONFIGS: Record<string, GhostExerciseConfig> = {
  "Wall Push-Up":       PUSH_CONFIG,
  "Incline Push-Up":    PUSH_CONFIG,
  "Knee Push-Up":       PUSH_CONFIG,
  "Push-Up":            PUSH_CONFIG,
  "Diamond Push-Up":    PUSH_CONFIG,
  "Handstand Push-Up":  HSPU_CONFIG,
  "Scapular Shrugs":    SCAPULAR_CONFIG,
  "Australian Rows":    PULL_CONFIG,
  "Negative Pull-Ups":  NEGATIVE_PULL_CONFIG,
  "Pull-Up":            PULL_CONFIG,
  "Explosive Pull-Up":  PULL_CONFIG,
  "Tuck Front Lever":     FRONT_LEVER_CONFIG,
  "Straddle Front Lever": FRONT_LEVER_CONFIG,
  "Full Front Lever":     FRONT_LEVER_CONFIG,
  "Assisted Squat": SQUAT_CONFIG,
  "Squat":          SQUAT_CONFIG,
  "Archer Squat":   SQUAT_CONFIG,
  "Nordic Curls":   NORDIC_CONFIG,
  "Pistol Squat":   SQUAT_CONFIG,
  "Plank":       PLANK_CONFIG,
  "Dragon Flag": DRAGON_FLAG_CONFIG,
  "Human Flag":  HUMAN_FLAG_CONFIG,
  "Dip":         DIP_CONFIG,
  "Lunge":       LUNGE_CONFIG,
};

/**
 * Returns the ghost config for the given exercise name (case-insensitive).
 * Returns null for unconfigured exercises — caller should skip ghost rendering.
 */
export function getGhostConfig(name: string): GhostExerciseConfig | null {
  const key = Object.keys(GHOST_CONFIGS).find(
    k => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? GHOST_CONFIGS[key] : null;
}

/**
 * Returns the phase config matching the given phase, or the first config if not found.
 */
export function getPhaseConfig(
  config: GhostExerciseConfig,
  phase: Phase,
): GhostPhaseConfig {
  return config.phases.find(p => p.phase === phase) ?? config.phases[0];
}
