import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Clock, Flame, Pause, Pencil, Play, Shuffle, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExerciseMotionSnapshot } from "@/components/exercise-motion-snapshot";
import { getPoseSet, getWorldObjects, getExerciseIntensity, type PoseData, type EnvAnchor } from "@/lib/exercise-poses";
import { useTranslation } from "react-i18next";
import {
  getTasksForPreferences,
  shuffleRoutine,
  routineDurationMinutes,
  GOAL_LABELS,
  type MobilityGoal,
  type Stretch,
  type StiffnessArea,
} from "@/lib/mobility-service";
import {
  useMobilityStatus,
  useCompleteMobility,
  useUpdateMobilitySettings,
  useNotificationScheduler,
} from "@/lib/use-mobility";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Questionnaire } from "@/components/mobility-questionnaire";

// ─── Circular Countdown Timer ────────────────────────────────────────────────

function CircularTimer({
  secondsLeft,
  total,
  paused,
}: {
  secondsLeft: number;
  total: number;
  paused: boolean;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - secondsLeft / total);

  return (
    <svg viewBox="0 0 120 120" width={148} height={148}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke={paused ? "#64748b" : "rgba(180,220,255,0.85)"}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s ease" }}
      />
      <text x={60} y={56} textAnchor="middle" fill="#f8fafc" fontSize={30} fontWeight="bold" fontFamily="monospace">
        {secondsLeft}
      </text>
      <text x={60} y={76} textAnchor="middle" fill={paused ? "#64748b" : "#94a3b8"} fontSize={11}>
        {paused ? "paused" : "seconds"}
      </text>
    </svg>
  );
}

// ─── Stretch Progress Dots ───────────────────────────────────────────────────

function ProgressDots({
  total,
  current,
  done,
}: {
  total: number;
  current: number;
  done: boolean;
}) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors duration-300",
            i < current
              ? "bg-primary"
              : i === current && !done
                ? "bg-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-background"
                : "bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

// ─── Bio-Mechanical Skeleton helpers ─────────────────────────────────────────

type BioSeg = { x1: number; y1: number; x2: number; y2: number };

function extractSegments(lines: [number, number][][]): BioSeg[] {
  const segs: BioSeg[] = [];
  for (const pts of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({ x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] });
    }
  }
  return segs;
}

function extractAllPoints(lines: [number, number][][]): [number, number][] {
  const out: [number, number][] = [];
  for (const pts of lines) for (const p of pts) out.push(p);
  return out;
}

// ─── Mobility LERP engine ─────────────────────────────────────────────────────
//
// Stretching demands a much slower, calmer tempo than strength-exercise previews.
// These constants produce a therapeutic 8.3-second loop:
//   Start→Mid  3 000 ms  (ease-in-out cubic)
//   Mid→End    3 000 ms  (ease-in-out cubic)
//   Hold End   1 500 ms  (static — user appreciates the peak stretch)
//   Fade-out     400 ms  (soft dissolve before reset)
//   Fade-in      400 ms  (gentle reappear at Start)
//   Total      8 300 ms

const MOB_TRANSITION_MS = 3_000;
const MOB_HOLD_MS       = 1_500;
const MOB_FADE_MS       =   400;
const MOB_CYCLE_MS      = 2 * MOB_TRANSITION_MS + MOB_HOLD_MS + 2 * MOB_FADE_MS; // 8 300 ms

function mobEase(t: number): number {
  // Ease-in-out cubic — slow start, fluid middle, gentle deceleration at peak.
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linearly interpolate between two PoseData frames.
 * Each line's 2-D points are interpolated pair-wise so every joint glides
 * smoothly rather than snapping between coordinate states.
 */
function lerpPoseData(a: PoseData, b: PoseData, rawT: number): PoseData {
  const t = mobEase(rawT);
  return {
    head: {
      cx: lerpNum(a.head.cx, b.head.cx, t),
      cy: lerpNum(a.head.cy, b.head.cy, t),
      r:  lerpNum(a.head.r ?? 7, b.head.r ?? 7, t),
    },
    lines: a.lines.map((lineA, li) =>
      lineA.map(([ax, ay], pi) => {
        const bp = b.lines[li]?.[pi];
        return [
          lerpNum(ax, bp?.[0] ?? ax, t),
          lerpNum(ay, bp?.[1] ?? ay, t),
        ] as [number, number];
      }),
    ),
  };
}

// ─── Focus zoom + directional force-overlay system ───────────────────────────
//
// For exercises targeting a small joint (wrists, ankles, fingers) the SVG
// viewBox is smoothly lerped from the default [0 0 100 100] to a cropped
// region so the relevant body part fills the canvas.  A pulsing neon indicator
// is drawn at the live joint position to reinforce the movement direction.

type OverlayType =
  | "press-down"    // downward weight arrow  — wrist extension / knuckle raises
  | "flex-up"       // upward arc arrows      — wrist flexion / finger pulses
  | "circle-cw"     // clockwise arc + tick   — ankle / wrist circles
  | "heel-press"    // heel-flat indicator    — calf stretch
  | "forward-drive"; // horizontal knee arrow — ankle dorsiflexion

interface FocusConfig {
  /** Target viewBox [x, y, w, h] to crop into the region of interest. */
  viewBox: [number, number, number, number];
  /** Force-indicator style to draw at the anchor joint. */
  overlay: OverlayType | null;
  /** Index into PoseData.lines; its *last* point is the overlay anchor. */
  overlayLineIdx: number;
}

/** Default full-body viewBox — fallback only. */
const FULL_VB: [number, number, number, number] = [0, 0, 100, 100];

/**
 * Compute a torso-anchored viewBox so every exercise renders at the same
 * apparent skeleton size regardless of where its raw coordinates sit in the
 * 0-100 SVG space.
 *
 * Anatomy convention used throughout the pose library:
 *   lines[0][0]        = neck / shoulder junction  (top of torso)
 *   lines[0][last]     = hip  / pelvis              (bottom of torso)
 *
 * The viewBox is sized so the neck→hip torso vector always occupies
 * TARGET_TORSO_VB units, and the hip is pinned at a fixed viewport fraction
 * (50 % across, 55 % down) so head + torso sit above the midpoint and the
 * legs have room below.
 */
const TARGET_TORSO_VB = 30;  // torso spans this many viewport units out of 100
const HIP_ANCHOR_X    = 0.50; // hip lands at 50 % of viewport width
const HIP_ANCHOR_Y    = 0.55; // hip lands at 55 % of viewport height

function computeNormViewBox(pose: PoseData): [number, number, number, number] {
  const line0 = pose.lines[0];
  if (!line0 || line0.length < 2) return [...FULL_VB];
  const [nx, ny] = line0[0]!;
  const [hx, hy] = line0[line0.length - 1]!;
  const T = Math.hypot(hx - nx, hy - ny);
  if (T < 2) return [...FULL_VB];
  // Viewport size in original SVG coordinate units
  const vw = T * (100 / TARGET_TORSO_VB);
  const vx = hx - HIP_ANCHOR_X * vw;
  const vy = hy - HIP_ANCHOR_Y * vw;
  return [vx, vy, vw, vw];
}

/**
 * Maps exercise name → focus + overlay config.
 * ViewBox values were derived from the actual pose coordinate ranges so the
 * region of interest fills approximately 60–80 % of the cropped canvas.
 */
const FOCUS_CONFIG: Record<string, FocusConfig> = {
  // ── Wrist / hand exercises ──────────────────────────────────────────────────
  "Wrist Extension Stretch":    { viewBox: [15, 36, 70, 56], overlay: "press-down",    overlayLineIdx: 1 },
  "Wrist Flexion Stretch":      { viewBox: [36, -2, 60, 52], overlay: "flex-up",       overlayLineIdx: 2 },
  "Finger Tendon Pulses":       { viewBox: [36, -2, 60, 52], overlay: "flex-up",       overlayLineIdx: 2 },
  "First Knuckle Raises":       { viewBox: [8,  26, 66, 44], overlay: "press-down",    overlayLineIdx: 1 },
  "Back-of-Hand Rocks":         { viewBox: [15, 36, 70, 56], overlay: "press-down",    overlayLineIdx: 1 },
  "Wrist Palm Peels":           { viewBox: [15, 36, 70, 56], overlay: "flex-up",       overlayLineIdx: 1 },
  "Wrist Rock Flow":            { viewBox: [8,  28, 70, 54], overlay: "circle-cw",     overlayLineIdx: 1 },
  "Wrist Circles (Closed Fist)":{ viewBox: [15, 36, 70, 56], overlay: "circle-cw",     overlayLineIdx: 1 },
  // ── Ankle / foot exercises ──────────────────────────────────────────────────
  "Ankle Mobility Circles":     { viewBox: [8,  48, 84, 50], overlay: "circle-cw",     overlayLineIdx: 4 },
  "Wall Calf Stretch":          { viewBox: [5,  46, 90, 52], overlay: "heel-press",    overlayLineIdx: 4 },
  "Weighted Ankle Dorsiflexion":{ viewBox: [22, 40, 68, 58], overlay: "forward-drive", overlayLineIdx: 3 },
};

// ── ForceOverlayLayer ─────────────────────────────────────────────────────────

/**
 * Pulsing neon directional indicator rendered in SVG space at a joint anchor.
 * `pulse` is a 0→1 sine value driven by the RAF clock.
 */
function ForceOverlayLayer({
  type, ax, ay, pulse,
}: {
  type: OverlayType;
  ax: number;
  ay: number;
  pulse: number; // 0–1 sine wave from the RAF clock
}) {
  const op  = 0.28 + 0.52 * pulse;
  const col = `rgba(180,220,255,${op.toFixed(2)})`;
  const off = pulse * 1.8; // subtle spatial bounce

  if (type === "press-down") {
    return (
      <g>
        {[-5, 0, 5].map(dx => (
          <g key={dx}>
            <line
              x1={ax + dx} y1={ay - 5.5 + off} x2={ax + dx} y2={ay + 1.5 + off}
              stroke={col} strokeWidth={1.4} strokeLinecap="round"
            />
            <polygon
              points={`${ax + dx},${ay + 4 + off} ${ax + dx - 2},${ay + 1 + off} ${ax + dx + 2},${ay + 1 + off}`}
              fill={col}
            />
          </g>
        ))}
      </g>
    );
  }

  if (type === "flex-up") {
    return (
      <g>
        {[-5, 5].map(dx => (
          <g key={dx}>
            <line
              x1={ax + dx} y1={ay + 4.5 - off} x2={ax + dx} y2={ay - 2.5 - off}
              stroke={col} strokeWidth={1.4} strokeLinecap="round"
            />
            <polygon
              points={`${ax + dx},${ay - 5 - off} ${ax + dx - 2},${ay - 2 - off} ${ax + dx + 2},${ay - 2 - off}`}
              fill={col}
            />
          </g>
        ))}
      </g>
    );
  }

  if (type === "circle-cw") {
    const r = 5.5 + 1.5 * pulse;
    return (
      <g>
        {/* CW arc — top-right → bottom-right */}
        <path
          d={`M ${ax + r},${ay} A ${r},${r} 0 0,1 ${ax},${ay + r}`}
          fill="none" stroke={col} strokeWidth={1.7} strokeLinecap="round"
        />
        {/* CW arc — bottom-right → bottom-left */}
        <path
          d={`M ${ax},${ay + r} A ${r},${r} 0 0,1 ${ax - r},${ay}`}
          fill="none" stroke={col} strokeWidth={1.7} strokeLinecap="round"
        />
        {/* Arrowhead at 3 o'clock pointing downward (clockwise direction) */}
        <polygon
          points={`${ax + r},${ay + 2.5} ${ax + r - 2},${ay - 0.5} ${ax + r + 2},${ay - 0.5}`}
          fill={col}
        />
      </g>
    );
  }

  if (type === "heel-press") {
    return (
      <g>
        <line
          x1={ax} y1={ay - 6.5 + off} x2={ax} y2={ay + 0.5 + off}
          stroke={col} strokeWidth={1.6} strokeLinecap="round"
        />
        <polygon
          points={`${ax},${ay + 3.5 + off} ${ax - 2.2},${ay + 0.5 + off} ${ax + 2.2},${ay + 0.5 + off}`}
          fill={col}
        />
        {/* Flat floor indicator line */}
        <line
          x1={ax - 6} y1={ay + 4.5 + off * 0.4}
          x2={ax + 6} y2={ay + 4.5 + off * 0.4}
          stroke={`rgba(180,220,255,${(op * 0.45).toFixed(2)})`} strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (type === "forward-drive") {
    return (
      <g>
        <line
          x1={ax - 5.5 + off} y1={ay} x2={ax + 2.5 + off} y2={ay}
          stroke={col} strokeWidth={1.6} strokeLinecap="round"
        />
        <polygon
          points={`${ax + 5.5 + off},${ay} ${ax + 2.5 + off},${ay - 2.2} ${ax + 2.5 + off},${ay + 2.2}`}
          fill={col}
        />
      </g>
    );
  }

  return null;
}

// ─── Environmental Anchor Layer ───────────────────────────────────────────────
// Renders behind the skeleton. Static (not animated) — the anchor never moves.
// The "locked joint" illusion comes from identical endpoint coords across frames.

function EnvLayer({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    const ticks = 12;
    const step = (env.x2 - env.x1) / ticks;
    return (
      <g>
        {/* Hatching below the floor line — gives a ground-plane texture */}
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 2 + i * step;
          return (
            <line
              key={i}
              x1={x} y1={env.y1}
              x2={x - 4} y2={env.y1 + 6}
              stroke="#475569" strokeWidth={0.7} opacity={0.3}
              strokeLinecap="round"
            />
          );
        })}
        {/* Shadow under floor line */}
        <line
          x1={env.x1} y1={env.y1 + 1.2} x2={env.x2} y2={env.y2 + 1.2}
          stroke="#0f172a" strokeWidth={2} opacity={0.25}
          strokeLinecap="round"
        />
        {/* Main floor line */}
        <line
          x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={1.8} strokeLinecap="round"
          opacity={0.6}
        />
      </g>
    );
  }

  if (env.type === "wall") {
    const ticks = 8;
    const step = (env.y2 - env.y1) / ticks;
    const onRight = env.x1 > 50;
    return (
      <g opacity={0.5}>
        {/* Shadow beside wall */}
        <line
          x1={env.x1 + (onRight ? 1.2 : -1.2)} y1={env.y1}
          x2={env.x2 + (onRight ? 1.2 : -1.2)} y2={env.y2}
          stroke="#0f172a" strokeWidth={2.5} opacity={0.2}
        />
        {/* Main wall line */}
        <line
          x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={2} strokeLinecap="round"
        />
        {/* Brick-style tick marks */}
        {Array.from({ length: ticks - 1 }).map((_, i) => {
          const y = env.y1 + (i + 1) * step;
          return (
            <line
              key={i}
              x1={env.x1} y1={y}
              x2={env.x1 + (onRight ? -6 : 6)} y2={y}
              stroke="#64748b" strokeWidth={0.8} opacity={0.35}
            />
          );
        })}
      </g>
    );
  }

  if (env.type === "bar") {
    const ticks = 9;
    const step = (env.x2 - env.x1 - 8) / (ticks - 1);
    return (
      <g>
        {/* Thick bar body */}
        <line
          x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#94a3b8" strokeWidth={3.5} strokeLinecap="round"
          opacity={0.55}
        />
        {/* Knurling marks */}
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 4 + i * step;
          return (
            <line
              key={i}
              x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5}
              stroke="#475569" strokeWidth={1} opacity={0.4}
            />
          );
        })}
        {/* End caps */}
        <line x1={env.x1} y1={env.y1 - 4} x2={env.x1} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
        <line x1={env.x2} y1={env.y1 - 4} x2={env.x2} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
      </g>
    );
  }

  if (env.type === "box") {
    const w = env.x2 - env.x1;
    const h = env.y2 - env.y1;
    return (
      <g opacity={0.5}>
        {/* Box fill */}
        <rect x={env.x1} y={env.y1} width={w} height={h}
          fill="rgba(71,85,105,0.15)" stroke="#64748b" strokeWidth={1.5} rx={1} />
        {/* Top face highlight */}
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y1}
          stroke="#94a3b8" strokeWidth={1.5} opacity={0.5} />
      </g>
    );
  }

  return null;
}

// ─── Thumbnail Env Layer (static, no hatching for small size) ─────────────────
function EnvLayerThumb({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    return (
      <line
        x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
        stroke="#64748b" strokeWidth={1.5} strokeLinecap="round" opacity={0.5}
      />
    );
  }
  if (env.type === "wall") {
    return (
      <line
        x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
        stroke="#64748b" strokeWidth={1.5} strokeLinecap="round" opacity={0.45}
      />
    );
  }
  if (env.type === "bar") {
    return (
      <line
        x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
        stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}
      />
    );
  }
  if (env.type === "box") {
    return (
      <rect
        x={env.x1} y={env.y1} width={env.x2 - env.x1} height={env.y2 - env.y1}
        fill="rgba(71,85,105,0.12)" stroke="#64748b" strokeWidth={1} rx={1} opacity={0.45}
      />
    );
  }
  return null;
}

// ─── BioSkeletonSVG — spring-morphing bio-mechanical hero figure ──────────────
// Renders a single already-interpolated PoseData frame as an SVG skeleton.
// No animation logic here — the RAF loop in HeroSkeleton drives all motion by
// calling lerpPoseData() every frame and passing the result as `pose`.

function BioSkeletonSVG({
  pose, paused, color = "rgba(255,255,255,0.88)", env, svgViewBox = "0 0 100 100", overlayProps,
}: {
  pose: PoseData;
  paused: boolean;
  color?: string;
  env?: EnvAnchor;
  /** Zoomed viewBox string — lerped by HeroSkeleton for smooth auto-zoom. */
  svgViewBox?: string;
  /** If set, a force-direction overlay is drawn at the given SVG coordinate. */
  overlayProps?: { type: OverlayType; ax: number; ay: number; pulse: number };
}) {
  const segs = extractSegments(pose.lines);
  const pts  = extractAllPoints(pose.lines);

  return (
    <svg
      viewBox={svgViewBox}
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{
        overflow: "visible",
        filter: paused
          ? "none"
          : "drop-shadow(0 0 6px rgba(200,228,255,0.22))",
        opacity: paused ? 0.32 : 1,
        animation: !paused ? "bioGhostPulse 2.5s ease-in-out infinite" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      <defs>
        <filter id="bio-joint-glow" x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Environmental anchor — rendered BEHIND skeleton */}
      {env && <EnvLayer env={env} />}

      {/* Capsule limbs — coordinates computed by LERP, not spring physics */}
      {segs.map((seg, i) => (
        <line
          key={i}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* Glowing joint nodes */}
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x} cy={y}
          r={3.2}
          fill={color}
          filter="url(#bio-joint-glow)"
        />
      ))}

      {/* Head — hollow halo ring + inner core dot */}
      <circle
        cx={pose.head.cx} cy={pose.head.cy}
        r={(pose.head.r ?? 7) + 2}
        fill="rgba(200,228,255,0.05)"
        stroke={color}
        strokeWidth={2}
      />
      <circle
        cx={pose.head.cx} cy={pose.head.cy}
        r={2.8}
        fill={color}
        opacity={0.5}
      />

      {/* Force-direction overlay — drawn on top of everything, in SVG space */}
      {overlayProps && (
        <ForceOverlayLayer
          type={overlayProps.type}
          ax={overlayProps.ax}
          ay={overlayProps.ay}
          pulse={overlayProps.pulse}
        />
      )}
    </svg>
  );
}

// ─── BioThumbnailSVG — static capsule-style figure for reference strips ───────

function BioThumbnailSVG({ pose, color, env }: { pose: PoseData; color: string; env?: EnvAnchor }) {
  const segs = extractSegments(pose.lines);
  const pts  = extractAllPoints(pose.lines);
  const isIce = !color.startsWith("rgba(239") && !color.startsWith("rgba(234");
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{
        overflow: "visible",
        filter: isIce ? "drop-shadow(0 0 3px rgba(200,228,255,0.20))" : "none",
      }}
    >
      {/* ── Environmental anchor behind skeleton ── */}
      {env && <EnvLayerThumb env={env} />}
      {segs.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
      ))}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={color} />
      ))}
      <circle
        cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 1.5}
        fill="none" stroke={color} strokeWidth={2}
      />
    </svg>
  );
}

// ─── Hero Skeleton — bio-mechanical figure cycling Start → Mid → End ──────────
//
// Uses a requestAnimationFrame loop with ease-in-out cubic interpolation so
// every joint glides smoothly between keyframes — same engine as the main
// Workout ExerciseAnimation component, tuned for slow therapeutic stretching.

function HeroSkeleton({
  exerciseName, paused, color = "rgba(255,255,255,0.88)",
}: {
  exerciseName: string; paused: boolean; color?: string;
}) {
  const poseSet    = getPoseSet(exerciseName);
  const env        = getWorldObjects(exerciseName)[0];
  const focusConfig = FOCUS_CONFIG[exerciseName] ?? null;

  // Torso-anchored baseline viewBox for this exercise — stable for the whole
  // animation cycle so scale never changes as joints move.
  const normVB = computeNormViewBox(poseSet[0]);

  // Live-rendered interpolated pose — starts at keyframe 0.
  const [renderedPose, setRenderedPose] = useState<PoseData>(() => poseSet[0]);
  // Separate opacity for the puppet wrapper (env stays solid during fade).
  const [puppetOpacity, setPuppetOpacity] = useState(1);
  // Current SVG viewBox string — smoothly lerped toward the focus target.
  const [svgViewBox, setSvgViewBox] = useState(() => normVB.map(v => v.toFixed(2)).join(" "));
  // 0→1 sine pulse for the force overlay animation.
  const [overlayPulse, setOverlayPulse] = useState(0);

  // Smooth viewBox lerp: ref holds current [x,y,w,h] floats, state holds the
  // rendered string.  We lerp ~5 % per frame → ~95 % convergence in ~1.2 s.
  const currentVBRef = useRef<[number, number, number, number]>([...normVB]);

  // Use a ref so the RAF callback always reads the latest paused value without
  // being part of the effect's dependency array (avoids restart on every toggle).
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const [start, mid, end] = poseSet;
    // For exercises with a FOCUS_CONFIG, lerp from the norm viewBox toward the
    // zoomed focus region.  For all others, snap directly to normVB (no lerp
    // needed since it IS the target) — keeping scale perfectly stable.
    const vbTarget = focusConfig?.viewBox ?? normVB;

    // Reset state whenever the exercise changes.
    setRenderedPose(start);
    setPuppetOpacity(1);
    // Snap to the torso-anchored viewBox immediately; focus-config exercises
    // will then ease in to their zoomed region over ~1.2 s.
    currentVBRef.current = [...normVB];
    setSvgViewBox(normVB.map(v => v.toFixed(2)).join(" "));

    let elapsed  = 0;
    let lastTime: number | null = null;

    function tick(now: number) {
      if (!pausedRef.current) {
        if (lastTime !== null) elapsed = (elapsed + (now - lastTime)) % MOB_CYCLE_MS;
        lastTime = now;
      } else {
        lastTime = null;
      }

      // ── Smooth viewBox zoom ──────────────────────────────────────────────────
      const cv = currentVBRef.current;
      const ZOOM_K = 0.05; // ~1.2 s to reach 95 % of target
      currentVBRef.current = [
        lerpNum(cv[0], vbTarget[0], ZOOM_K),
        lerpNum(cv[1], vbTarget[1], ZOOM_K),
        lerpNum(cv[2], vbTarget[2], ZOOM_K),
        lerpNum(cv[3], vbTarget[3], ZOOM_K),
      ];
      setSvgViewBox(currentVBRef.current.map(v => v.toFixed(2)).join(" "));

      // ── Overlay pulse (1.4 s sine wave, independent of stretch cycle) ───────
      setOverlayPulse(0.5 + 0.5 * Math.sin((elapsed / 1400) * Math.PI * 2));

      const cycleT = elapsed;

      if (cycleT < MOB_TRANSITION_MS) {
        // ── Phase 1: Start → Mid ──────────────────────────────────────────────
        setRenderedPose(lerpPoseData(start, mid, cycleT / MOB_TRANSITION_MS));
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS) {
        // ── Phase 2: Mid → End ────────────────────────────────────────────────
        setRenderedPose(lerpPoseData(mid, end, (cycleT - MOB_TRANSITION_MS) / MOB_TRANSITION_MS));
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS + MOB_HOLD_MS) {
        // ── Phase 3: Hold at End ──────────────────────────────────────────────
        setRenderedPose(end);
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS + MOB_HOLD_MS + MOB_FADE_MS) {
        // ── Phase 4: Fade-out (staying at End) ───────────────────────────────
        const t = (cycleT - 2 * MOB_TRANSITION_MS - MOB_HOLD_MS) / MOB_FADE_MS;
        setRenderedPose(end);
        setPuppetOpacity(1 - t);
      } else {
        // ── Phase 5: Fade-in (snapped to Start) ──────────────────────────────
        const t = (cycleT - 2 * MOB_TRANSITION_MS - MOB_HOLD_MS - MOB_FADE_MS) / MOB_FADE_MS;
        setRenderedPose(start);
        setPuppetOpacity(t);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [exerciseName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build overlay props: extract last point of the configured line as anchor.
  const overlayProps = (() => {
    if (!focusConfig?.overlay) return undefined;
    const line = renderedPose.lines[focusConfig.overlayLineIdx];
    if (!line?.length) return undefined;
    const [ax, ay] = line[line.length - 1]!;
    return { type: focusConfig.overlay, ax, ay, pulse: overlayPulse };
  })();

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* RAF-driven LERP skeleton — opacity controlled by puppetOpacity */}
      <div style={{ width: "100%", height: "100%", opacity: puppetOpacity }}>
        <BioSkeletonSVG
          pose={renderedPose}
          paused={paused}
          color={color}
          env={env}
          svgViewBox={svgViewBox}
          overlayProps={overlayProps}
        />
      </div>
    </div>
  );
}

// ─── Muscle Silhouette — body map with highlighted regions ────────────────────

const MUSCLE_REGION_MAP: Record<string, string[]> = {
  "wrist":              ["forearm-l", "forearm-r"],
  "forearm":            ["forearm-l", "forearm-r"],
  "shoulder":           ["shoulder-l", "shoulder-r"],
  "anterior shoulder":  ["shoulder-l", "shoulder-r", "chest"],
  "chest":              ["chest"],
  "lat":                ["lat-l", "lat-r"],
  "upper back":         ["lat-l", "lat-r"],
  "thoracic":           ["mid-back"],
  "oblique":            ["oblique-l", "oblique-r"],
  "core":               ["core"],
  "hip":                ["hip-l", "hip-r"],
  "quad":               ["quad-l", "quad-r"],
  "hamstring":          ["quad-l", "quad-r"],
  "glute":              ["hip-l", "hip-r"],
  "calf":               ["calf-l", "calf-r"],
  "ankle":              ["calf-l", "calf-r"],
  "tricep":             ["uarm-l", "uarm-r"],
  "bicep":              ["uarm-l", "uarm-r"],
};

function getActiveRegions(muscles: string[]): Set<string> {
  const s = new Set<string>();
  for (const m of muscles) {
    const lower = m.toLowerCase();
    for (const [key, regions] of Object.entries(MUSCLE_REGION_MAP)) {
      if (lower.includes(key)) regions.forEach((r) => s.add(r));
    }
  }
  return s;
}

function MuscleSilhouette({ muscles }: { muscles: string[] }) {
  const active = getActiveRegions(muscles);
  const C = "rgba(180,220,255,0.85)";
  const dim = "rgba(255,255,255,0.07)";
  const f = (id: string) => active.has(id) ? C : dim;
  const g = (id: string) => active.has(id) ? `drop-shadow(0 0 4px rgba(180,220,255,0.5))` : "none";
  const s = (id: string): React.CSSProperties => ({ fill: f(id), filter: g(id), transition: "fill 0.4s, filter 0.4s" });

  return (
    <svg viewBox="0 0 60 122" width={44} height={88} aria-hidden="true" style={{ flexShrink: 0 }}>
      {/* Head */}
      <circle cx={30} cy={7} r={6.5} fill="rgba(255,255,255,0.12)" />
      {/* Neck */}
      <rect x={27} y={13.5} width={6} height={5} rx={2} fill="rgba(255,255,255,0.08)" />
      {/* Shoulders */}
      <ellipse cx={15} cy={21} rx={6} ry={3.5} style={s("shoulder-l")} />
      <ellipse cx={45} cy={21} rx={6} ry={3.5} style={s("shoulder-r")} />
      {/* Upper arms */}
      <rect x={8.5} y={24.5} width={8} height={15} rx={4} style={s("uarm-l")} />
      <rect x={43.5} y={24.5} width={8} height={15} rx={4} style={s("uarm-r")} />
      {/* Forearms */}
      <rect x={9} y={41} width={7} height={14} rx={3.5} style={s("forearm-l")} />
      <rect x={44} y={41} width={7} height={14} rx={3.5} style={s("forearm-r")} />
      {/* Chest */}
      <ellipse cx={30} cy={25} rx={9} ry={5.5} style={s("chest")} />
      {/* Lats */}
      <ellipse cx={20} cy={32} rx={4.5} ry={7} style={s("lat-l")} />
      <ellipse cx={40} cy={32} rx={4.5} ry={7} style={s("lat-r")} />
      {/* Core */}
      <ellipse cx={30} cy={38} rx={7} ry={6} style={s("core")} />
      {/* Mid-back */}
      <ellipse cx={30} cy={32} rx={5} ry={4.5} style={s("mid-back")} />
      {/* Obliques */}
      <ellipse cx={19} cy={42} rx={4} ry={5.5} style={s("oblique-l")} />
      <ellipse cx={41} cy={42} rx={4} ry={5.5} style={s("oblique-r")} />
      {/* Hips */}
      <ellipse cx={24} cy={52} rx={7} ry={5} style={s("hip-l")} />
      <ellipse cx={36} cy={52} rx={7} ry={5} style={s("hip-r")} />
      {/* Quads */}
      <rect x={19.5} y={57} width={10} height={22} rx={5} style={s("quad-l")} />
      <rect x={30.5} y={57} width={10} height={22} rx={5} style={s("quad-r")} />
      {/* Calves */}
      <rect x={20.5} y={81} width={8} height={17} rx={4} style={s("calf-l")} />
      <rect x={31.5} y={81} width={8} height={17} rx={4} style={s("calf-r")} />
    </svg>
  );
}

// ─── Active Workout Player ────────────────────────────────────────────────────

interface ActiveWorkoutPlayerProps {
  routine: Stretch[];
  stretchIndex: number;
  secondsLeft: number;
  paused: boolean;
  onExit: () => void;
  onSkip: () => void;
  onPauseToggle: () => void;
}

function ActiveWorkoutPlayer({
  routine,
  stretchIndex,
  secondsLeft,
  paused,
  onExit,
  onSkip,
  onPauseToggle,
}: ActiveWorkoutPlayerProps) {
  const currentStretch = routine[stretchIndex];
  const nextStretch = routine[stretchIndex + 1];
  const isLast = stretchIndex + 1 >= routine.length;

  const { i18n } = useTranslation();

  // ── Viewport + scroll lock ────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";
    return () => {
      document.documentElement.style.overflow = "auto";
      document.documentElement.style.overscrollBehavior = "";
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "auto";
      document.body.style.height = "auto";
      document.body.style.overscrollBehavior = "";
      document.body.style.touchAction = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentStretch) return null;

  // Timer arc maths
  const timerR = 38;
  const timerCirc = 2 * Math.PI * timerR;
  const timerOffset = timerCirc * (1 - secondsLeft / currentStretch.durationSeconds);

  return (
    <>
      <style>{`
        @keyframes heroMuscleGlow  { 0%,100%{opacity:.06} 50%{opacity:.38} }
        @keyframes cockpitFadeIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bioGhostPulse   { 0%,100%{opacity:.78} 50%{opacity:1} }

        /* ── Shell: solid dark full-screen grid (4 rows) ── */
        #ms-shell {
          position: fixed; inset: 0;
          background: #080d12;
          display: grid;
          grid-template-rows: 52px auto 1fr 172px;
          overflow: hidden;
          touch-action: none; overscroll-behavior: none;
          user-select: none; -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
          z-index: 9999;
        }
        #ms-shell *, #ms-shell *::before, #ms-shell *::after {
          box-sizing: border-box; touch-action: none;
          overscroll-behavior: none; -webkit-tap-highlight-color: transparent;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        #ms-shell *::-webkit-scrollbar { display: none; }
        #ms-shell button { touch-action: manipulation; cursor: pointer; }

        /* ── ROW 1: Header bar — solid background creates hard stacking boundary ── */
        #ms-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px;
          background: #080d12;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          position: relative; z-index: 10;
          isolation: isolate;
        }
        #ms-hdr .exit-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none;
          color: rgba(100,116,139,0.9); font-size: 13px; font-weight: 500;
          padding: 6px 0;
        }
        #ms-hdr .ctrl-row { display: flex; align-items: center; gap: 16px; }
        #ms-hdr .ctrl-btn {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 6px 10px;
          display: flex; align-items: center; gap: 5px;
          color: rgba(148,163,184,0.9); font-size: 11px; font-weight: 600;
        }

        /* ── ROW 2: Title block — solid background, isolated stacking context ── */
        #ms-title {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 4px; padding: 10px 24px 8px;
          background: #080d12;
          position: relative; z-index: 5;
          isolation: isolate;
          contain: layout style paint;
          flex-shrink: 0;
        }
        #ms-title .chip {
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: #c8e4ff;
          background: rgba(180,220,255,0.10); border: 1px solid rgba(180,220,255,0.22);
          border-radius: 99px; padding: 2px 10px; line-height: 1.6;
        }
        #ms-title h2 {
          font-size: 21px; font-weight: 900; letter-spacing: -0.02em;
          margin: 0; line-height: 1.15; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: min(90vw, 480px); color: #f1f5f9;
        }

        /* ── ROW 3: Skeleton canvas — hard bounding box, nothing escapes ── */
        #ms-canvas {
          position: relative;
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          /* CSS Paint containment: browser guarantees nothing paints outside this box */
          contain: layout style paint;
          isolation: isolate;
          min-height: 0;
        }
        /* Radial ice-blue glow — contained within the canvas row */
        #ms-canvas::before {
          content: "";
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(180,220,255,0.06) 0%, transparent 70%);
        }
        /* Skeleton hero container — fills the full canvas cell */
        #ms-canvas .hero-inner {
          position: relative;
          width: 100%; height: 100%; max-width: 340px;
          z-index: 1;
          animation: cockpitFadeIn 0.22s ease-out both;
        }

        /* ── ROW 3: Symmetric info dock ── */
        #ms-dock {
          display: grid;
          grid-template-columns: 108px 1fr 108px;
          align-items: center;
          gap: 0;
          background: rgba(8,13,18,0.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(180,220,255,0.10);
          overflow: hidden; flex-shrink: 0;
        }

        /* Left cell: timer */
        #ms-dock .dock-timer {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 12px 8px 14px 12px; gap: 3px;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        #ms-dock .dock-timer .timer-label {
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(100,116,139,0.8);
          margin-top: 2px;
        }

        /* Center cell: cue + muscles */
        #ms-dock .dock-center {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 12px 12px 14px; gap: 8px; overflow: hidden;
        }
        #ms-dock .dock-cue {
          font-size: 11.5px; line-height: 1.55;
          color: rgba(148,163,184,0.9);
          text-align: center;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
          max-width: 240px;
        }
        #ms-dock .dock-muscles {
          display: flex; flex-wrap: wrap; gap: 5px; justify-content: center;
          align-items: center;
        }
        #ms-dock .muscle-pill {
          font-size: 9.5px; font-weight: 700; padding: 2px 8px;
          border-radius: 99px;
          background: rgba(180,220,255,0.08);
          color: rgba(180,220,255,0.85);
          border: 1px solid rgba(180,220,255,0.18);
        }

        /* Right cell: next exercise preview */
        #ms-dock .dock-right {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 10px 12px 12px 8px; gap: 5px;
          border-left: 1px solid rgba(255,255,255,0.05);
          overflow: hidden;
        }
        #ms-dock .next-header {
          font-size: 8px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(100,116,139,0.7);
        }
        #ms-dock .next-name {
          font-size: 9.5px; font-weight: 700; text-align: center;
          color: rgba(226,232,240,0.9); line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; max-width: 84px;
        }
        #ms-dock .last-strong {
          font-size: 9px; font-weight: 800;
          color: #c8e4ff; text-align: center; letter-spacing: 0.02em;
        }
      `}</style>

      <div id="ms-shell">

        {/* ── ROW 1: Header ────────────────────────────────────────────── */}
        <div id="ms-hdr">
          <button className="exit-btn" onClick={onExit}>
            <ArrowLeft size={14} /> Exit
          </button>

          <ProgressDots total={routine.length} current={stretchIndex} done={secondsLeft === 0} />

          <div className="ctrl-row">
            <button className="ctrl-btn" onClick={onPauseToggle} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
            </button>
            <button className="ctrl-btn" onClick={onSkip}>
              <SkipForward size={12} /> Skip
            </button>
          </div>
        </div>

        {/* ── ROW 2: Title block — its own grid row, skeleton cannot touch it ── */}
        <div id="ms-title">
          <AnimatePresence mode="wait">
            <motion.div key={`ttl-${stretchIndex}`}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className="chip">Stretch {stretchIndex + 1} of {routine.length}</div>
              <h2>{currentStretch.name}</h2>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── ROW 3: Skeleton canvas — strictly bounded, overflow hidden ── */}
        <div id="ms-canvas">
          <AnimatePresence mode="wait">
            <motion.div key={`hero-${stretchIndex}`} className="hero-inner"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <HeroSkeleton exerciseName={currentStretch.name} paused={paused} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── ROW 3: Symmetric info dock ────────────────────────────── */}
        <div id="ms-dock">

          {/* LEFT — Arc timer */}
          <div className="dock-timer">
            <svg width={80} height={80} viewBox="0 0 80 80">
              {/* Outer ring glow */}
              <circle cx={40} cy={40} r={timerR} fill="none"
                stroke="rgba(180,220,255,0.04)" strokeWidth={9} />
              {/* Track */}
              <circle cx={40} cy={40} r={timerR} fill="none"
                stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
              {/* Progress arc */}
              <circle cx={40} cy={40} r={timerR} fill="none"
                stroke={paused ? "#475569" : "rgba(180,220,255,0.85)"}
                strokeWidth={7} strokeLinecap="round"
                strokeDasharray={timerCirc} strokeDashoffset={timerOffset}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.35s ease" }}
              />
              <text x={40} y={37} textAnchor="middle" fill="#f1f5f9"
                fontSize={22} fontWeight="900" fontFamily="monospace">
                {secondsLeft}
              </text>
              <text x={40} y={52} textAnchor="middle"
                fill={paused ? "#475569" : "#64748b"} fontSize={9}>
                {paused ? "paused" : "seconds"}
              </text>
            </svg>
            <div className="timer-label">Timer</div>
          </div>

          {/* CENTER — Coaching cue + muscle pills with silhouette */}
          <div className="dock-center">
            <AnimatePresence mode="wait">
              <motion.p key={`cue-${stretchIndex}`} className="dock-cue"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}>
                {currentStretch.coachingCue}
              </motion.p>
            </AnimatePresence>
            <div className="dock-muscles">
              <MuscleSilhouette muscles={currentStretch.targetMuscles} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {currentStretch.targetMuscles.slice(0, 3).map((m) => (
                  <span key={m} className="muscle-pill">{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Next exercise preview (single mid-pose thumbnail) */}
          <div className="dock-right">
            {isLast || !nextStretch ? (
              <span className="last-strong">Last one — finish strong!</span>
            ) : (
              <>
                <span className="next-header">Up Next</span>
                {/* Single thumbnail — mid pose of next exercise */}
                <div style={{
                  width: 60, height: 60, borderRadius: 10, overflow: "visible",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)", padding: 5, flexShrink: 0,
                }}>
                  <BioThumbnailSVG
                    pose={getPoseSet(nextStretch.name)[0]}
                    color="rgba(100,116,139,0.5)"
                  />
                </div>
                <span className="next-name">{nextStretch.name}</span>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageState = "ready" | "active" | "done";

const LS_PREFS_KEY = "calicoach:dailyPrefs";
interface CachedPrefs { mobilityGoal: string; stiffnessAreas: string; dailyTimeMinutes: number }
function readCachedPrefs(): CachedPrefs | null {
  try { const r = localStorage.getItem(LS_PREFS_KEY); return r ? JSON.parse(r) as CachedPrefs : null; }
  catch { return null; }
}
function writeLocalPrefs(p: CachedPrefs): void {
  try { localStorage.setItem(LS_PREFS_KEY, JSON.stringify(p)); } catch { /* storage full */ }
}

export function MobilityPage({ onDismiss, autoStart = false }: { onDismiss?: () => void; autoStart?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { data: status, isLoading: statusLoading } = useMobilityStatus();
  const completeMobility = useCompleteMobility();
  const updateSettings   = useUpdateMobilitySettings();
  const { toast }        = useToast();

  useNotificationScheduler(status);

  // ── Optimistic local preferences ─────────────────────────────────────────
  // Initialised instantly from localStorage; overwritten once server data loads.
  const [localPrefs, setLocalPrefs] = useState<CachedPrefs>(() => {
    const c = readCachedPrefs();
    return c ?? { mobilityGoal: "general", stiffnessAreas: "", dailyTimeMinutes: 10 };
  });

  // Sync server data into localPrefs (server is authoritative)
  useEffect(() => {
    if (!status?.settings) return;
    const synced: CachedPrefs = {
      mobilityGoal:     status.settings.mobilityGoal     ?? "general",
      stiffnessAreas:   status.settings.stiffnessAreas   ?? "",
      dailyTimeMinutes: status.settings.dailyTimeMinutes  ?? 10,
    };
    setLocalPrefs(synced);
    writeLocalPrefs(synced);
  }, [
    status?.settings.mobilityGoal,
    status?.settings.stiffnessAreas,
    status?.settings.dailyTimeMinutes,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const goal             = localPrefs.mobilityGoal as MobilityGoal;
  const goalLabel        = GOAL_LABELS[goal] ?? goal;
  const rawAreas         = localPrefs.stiffnessAreas;
  const areasArray       = rawAreas ? (rawAreas.split(",").filter(Boolean) as StiffnessArea[]) : [];
  const dailyTimeMinutes = localPrefs.dailyTimeMinutes;

  const routine = getTasksForPreferences(goal, areasArray, dailyTimeMinutes);

  // Shuffle state — null means "use the default goal-based routine"
  const [shuffledRoutine, setShuffledRoutine] = useState<Stretch[] | null>(null);
  const activeRoutine = shuffledRoutine ?? routine;

  const [pageState,        setPageState]        = useState<PageState>(autoStart ? "active" : "ready");
  const [stretchIndex,     setStretchIndex]     = useState(0);
  const [secondsLeft,      setSecondsLeft]      = useState(0);
  const [paused,           setPaused]           = useState(false);
  const [finalStreak,      setFinalStreak]      = useState<number | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  function handleSavePreferences(newGoal: string, newAreas: string[], newTime: number) {
    const newPrefs: CachedPrefs = {
      mobilityGoal:     newGoal,
      stiffnessAreas:   newAreas.join(","),
      dailyTimeMinutes: newTime,
    };
    setLocalPrefs(newPrefs);
    writeLocalPrefs(newPrefs);
    setShuffledRoutine(null); // reset any active shuffle when prefs change
    setShowQuestionnaire(false);
    toast({ title: "Goals Updated!", description: "Your routine has been personalised." });
    updateSettings.mutate(newPrefs);
  }

  function handleShuffle() {
    const next = shuffleRoutine(goal, areasArray, dailyTimeMinutes);
    setShuffledRoutine(next);
    setStretchIndex(0);
    toast({ title: "Routine shuffled!", description: `${next.length} exercises · ~${routineDurationMinutes(next)} min` });
  }

  const currentStretch: Stretch | undefined = activeRoutine[stretchIndex];

  // ── Hard-scroll to origin on mount ──────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ── Reset timer + pause state when exercise changes ─────────────────────────
  useEffect(() => {
    if (pageState !== "active") return;
    if (!currentStretch) return;
    setSecondsLeft(currentStretch.durationSeconds);
    setPaused(false);
  }, [pageState, stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick the timer when active and not paused ───────────────────────────────
  useEffect(() => {
    if (pageState !== "active" || paused || secondsLeft === 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageState, paused, stretchIndex]); // restart interval on exercise change / pause toggle

  // ── Auto-advance when timer hits zero ──────────────────────────────────────
  useEffect(() => {
    if (pageState !== "active" || secondsLeft !== 0) return;
    const t = setTimeout(() => advanceStretch(), 600);
    return () => clearTimeout(t);
  }, [secondsLeft, pageState]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceStretch = useCallback(() => {
    if (stretchIndex + 1 >= activeRoutine.length) {
      completeSession();
    } else {
      setStretchIndex((i) => i + 1);
    }
  }, [stretchIndex, activeRoutine.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function completeSession() {
    completeMobility.mutate(
      { goal },
      {
        onSuccess: (data) => {
          setFinalStreak((data as { currentStreak: number }).currentStreak);
          setPageState("done");
        },
        onError: () => {
          setFinalStreak(status?.currentStreak ?? 1);
          setPageState("done");
        },
      },
    );
  }

  function startSession() {
    setStretchIndex(0);
    setPaused(false);
    setPageState("active");
  }

  function exitSession() {
    setPaused(false);
    document.documentElement.classList.remove("workout-active");
    document.body.classList.remove("workout-active");
    if (onDismiss) {
      onDismiss();
    } else {
      // Must reset pageState here — MobilityPage is embedded inside TrainingHub
      // at /training, so setLocation only changes search params and never
      // remounts the component. Without this, the active player stays rendered
      // at z-index 9999 and the Exit button appears dead.
      setPageState("ready");
      setLocation("/training?tab=daily");
    }
  }

  // ── READY STATE ──────────────────────────────────────────────────────────
  if (pageState === "ready") {
    return (
      <>
        <div className="p-5 max-w-lg mx-auto space-y-5 pb-8">

          {/* Page header */}
          <div className="flex items-start justify-between pt-1">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Daily Mobility</h1>
              <p className="text-sm text-muted-foreground font-light opacity-80 mt-0.5">
                Your personalised daily routine
              </p>
            </div>
            {(status?.currentStreak ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 rounded-full px-3 py-1 text-sm font-semibold shrink-0">
                <Flame className="w-4 h-4" />
                {status?.currentStreak} day streak
              </div>
            )}
          </div>

          {/* ── Current Goal card — always visible on load ── */}
          {statusLoading ? (
            <div className="glass-card p-4 space-y-3">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-6 w-40 rounded-lg" />
              <div className="border-t border-border/50 pt-3 flex gap-3">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
            </div>
          ) : (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                    Current Goal
                  </div>
                  <div className="font-extrabold text-lg leading-tight">{goalLabel}</div>
                  {areasArray.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {areasArray.map(a => (
                        <span
                          key={a}
                          className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowQuestionnaire(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Update Goals
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {dailyTimeMinutes} min per day
                </span>
                <span>·</span>
                <span>{activeRoutine.length} exercises · ~{routineDurationMinutes(activeRoutine)} min</span>
              </div>
            </div>
          )}

          {/* Completed today banner */}
          {status?.completedToday && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                You've already completed today's session — well done!
              </span>
            </div>
          )}

          {/* Stretch list + CTA */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{activeRoutine.length} stretches</span>
              <span>~{routineDurationMinutes(activeRoutine)} min total</span>
            </div>

            <div className="space-y-3">
              {activeRoutine.map((stretch, i) => (
                <div
                  key={stretch.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{stretch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stretch.targetMuscles.slice(0, 2).join(" · ")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono shrink-0">
                    {stretch.durationSeconds}s
                  </div>
                </div>
              ))}
            </div>

            {/* Action row: Shuffle + Begin */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleShuffle}
                className="flex-1 font-semibold border-border hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Shuffle
              </Button>
              <Button onClick={startSession} className="flex-[2] font-bold" size="lg">
                <Play className="w-5 h-5 mr-2" />
                {status?.completedToday ? "Repeat Session" : "Begin Session"}
              </Button>
            </div>
          </div>
        </div>

        {/* Questionnaire modal */}
        <AnimatePresence>
          {showQuestionnaire && (
            <Questionnaire
              initialGoal={goal}
              initialAreas={areasArray}
              initialTime={dailyTimeMinutes}
              onSave={handleSavePreferences}
              onClose={() => setShowQuestionnaire(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── DONE STATE ──────────────────────────────────────────────────────────────
  if (pageState === "done") {
    const streak = finalStreak ?? 1;
    const totalSeconds = routine.reduce((s, r) => s + r.durationSeconds, 0);
    const totalMin = Math.round(totalSeconds / 60);
    return createPortal(<motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          overscrollBehavior: "none",
        }}
        className="bg-background px-6"
      >
        {/* ── Success Icon ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
          className="w-24 h-24 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-8"
        >
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </motion.div>

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.32, ease: "easeOut" }}
          className="text-center mb-6"
        >
          <h2 className="text-4xl font-extrabold tracking-tight mb-3">Session Complete!</h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
            You completed {routine.length} stretch{routine.length !== 1 ? "es" : ""} in {totalMin} minute{totalMin !== 1 ? "s" : ""}.
          </p>
        </motion.div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26, duration: 0.32, ease: "easeOut" }}
          className="flex gap-4 mb-8"
        >
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-card border border-border">
            <span className="text-2xl font-bold text-foreground">{routine.length}</span>
            <span className="text-xs text-muted-foreground mt-0.5">stretches</span>
          </div>
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-card border border-border">
            <span className="text-2xl font-bold text-foreground">{totalMin}m</span>
            <span className="text-xs text-muted-foreground mt-0.5">total time</span>
          </div>
          <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/25">
            <span className="text-2xl font-bold text-orange-400 flex items-center gap-1">
              <Flame className="w-5 h-5" />{streak}
            </span>
            <span className="text-xs text-orange-400/70 mt-0.5">day streak</span>
          </div>
        </motion.div>

        {/* ── Buttons ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34, duration: 0.32, ease: "easeOut" }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          {onDismiss ? (
            <Button size="lg" className="w-full font-bold" onClick={onDismiss}>
              Back to Daily
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full font-bold"
              onClick={() => {
                setPageState("ready");
                setLocation("/training?tab=daily");
              }}
            >
              Back to Daily
            </Button>
          )}
          <Button size="lg" variant="outline" className="w-full" onClick={startSession}>
            <Play className="w-4 h-4 mr-2" />
            Repeat Session
          </Button>
        </motion.div>
      </motion.div>, document.body);
  }

  // ── ACTIVE STATE — portal-rendered so position:fixed is relative to viewport ─
  if (pageState === "active") {
    return createPortal(
      <ActiveWorkoutPlayer
        routine={activeRoutine}
        stretchIndex={stretchIndex}
        secondsLeft={secondsLeft}
        paused={paused}
        onExit={exitSession}
        onSkip={advanceStretch}
        onPauseToggle={() => setPaused((p) => !p)}
      />,
      document.body,
    );
  }

  return null;
}
