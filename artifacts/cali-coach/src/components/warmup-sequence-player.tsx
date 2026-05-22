/**
 * WarmupSequencePlayer — full-screen live animation player for targeted warmup
 * sequences. Mirrors the ActiveWorkoutPlayer in mobility.tsx, using the same
 * HeroSkeleton / PuppetFrame / MuscleSilhouette architecture, but designed as a
 * standalone portal overlay that closes itself via `onComplete` or `onExit`.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Pause, Play, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPoseSet,
  getWorldObjects,
  legacyToNamed,
  type PoseData,
  type NamedPoseData,
  type EnvAnchor,
} from "@/lib/exercise-poses";
import { PuppetFrame } from "@/components/exercise-animation";
import type { Stretch } from "@/lib/mobility-service";

// ─── Animation constants ─────────────────────────────────────────────────────
const MOB_TRANSITION_MS = 3_000;
const MOB_HOLD_MS       = 1_500;
const MOB_FADE_MS       =   400;
const MOB_CYCLE_MS      = 2 * MOB_TRANSITION_MS + MOB_HOLD_MS + 2 * MOB_FADE_MS;

function mobEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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

// ─── Torso normalisation ──────────────────────────────────────────────────────
const TARGET_TORSO_PX = 30;
const HIP_ANCHOR_X    = 50;
const HIP_ANCHOR_Y    = 62;

interface TorsoXfm { scale: number; tx: number; ty: number }

function computeTorsoXfm(p: NamedPoseData): TorsoXfm | null {
  const s = p.spine;
  if (s.length < 2) return null;
  const [nx, ny] = s[0]!;
  const [hx, hy] = s[s.length - 1]!;
  const len = Math.hypot(hx - nx, hy - ny);
  if (len < 1) return null;
  const scale = TARGET_TORSO_PX / len;
  return { scale, tx: HIP_ANCHOR_X - hx * scale, ty: HIP_ANCHOR_Y - hy * scale };
}

function xfmPts(pts: [number, number][], x: TorsoXfm): [number, number][] {
  return pts.map(([px, py]) => [px * x.scale + x.tx, py * x.scale + x.ty]);
}

function applyTorsoXfm(p: NamedPoseData, x: TorsoXfm): NamedPoseData {
  return {
    head:     { cx: p.head.cx * x.scale + x.tx, cy: p.head.cy * x.scale + x.ty, r: p.head.r * x.scale },
    spine:    xfmPts(p.spine,    x),
    leftArm:  xfmPts(p.leftArm,  x),
    rightArm: xfmPts(p.rightArm, x),
    leftLeg:  xfmPts(p.leftLeg,  x),
    rightLeg: xfmPts(p.rightLeg, x),
    muscleGlow: p.muscleGlow,
  };
}

// ─── Overlay types ────────────────────────────────────────────────────────────
type OverlayType =
  | "press-down"
  | "flex-up"
  | "circle-cw"
  | "heel-press"
  | "forward-drive";

interface FocusConfig {
  overlay: OverlayType | null;
  overlayLineIdx: number;
}

const FOCUS_CONFIG: Record<string, FocusConfig> = {
  "Wrist Extension Stretch":     { overlay: "press-down",  overlayLineIdx: 1 },
  "Wrist Flexion Stretch":       { overlay: "flex-up",     overlayLineIdx: 2 },
  "Finger Tendon Pulses":        { overlay: "flex-up",     overlayLineIdx: 2 },
  "First Knuckle Raises":        { overlay: "press-down",  overlayLineIdx: 1 },
  "Back-of-Hand Rocks":          { overlay: "press-down",  overlayLineIdx: 1 },
  "Wrist Palm Peels":            { overlay: "flex-up",     overlayLineIdx: 1 },
  "Wrist Rock Flow":             { overlay: "circle-cw",   overlayLineIdx: 1 },
  "Wrist Circles (Closed Fist)": { overlay: "circle-cw",   overlayLineIdx: 1 },
  "Ankle Mobility Circles":      { overlay: "circle-cw",   overlayLineIdx: 4 },
  "Wall Calf Stretch":           { overlay: "heel-press",  overlayLineIdx: 4 },
  "Ankle Dorsiflexion":          { overlay: "forward-drive", overlayLineIdx: 4 },
};

// ─── ForceOverlayLayer ────────────────────────────────────────────────────────
function ForceOverlayLayer({ type, ax, ay, pulse }: { type: OverlayType; ax: number; ay: number; pulse: number }) {
  const op  = 0.35 + 0.55 * pulse;
  const col = `rgba(23,117,72,${op.toFixed(2)})`;
  const off = pulse * 1.8;

  if (type === "press-down") {
    return (
      <g>
        {[-5, 0, 5].map(dx => (
          <g key={dx}>
            <line x1={ax + dx} y1={ay - 5.5 + off} x2={ax + dx} y2={ay + 1.5 + off} stroke={col} strokeWidth={1.4} strokeLinecap="round" />
            <polygon points={`${ax + dx},${ay + 4 + off} ${ax + dx - 2},${ay + 1 + off} ${ax + dx + 2},${ay + 1 + off}`} fill={col} />
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
            <line x1={ax + dx} y1={ay + 4.5 - off} x2={ax + dx} y2={ay - 2.5 - off} stroke={col} strokeWidth={1.4} strokeLinecap="round" />
            <polygon points={`${ax + dx},${ay - 5 - off} ${ax + dx - 2},${ay - 2 - off} ${ax + dx + 2},${ay - 2 - off}`} fill={col} />
          </g>
        ))}
      </g>
    );
  }
  if (type === "circle-cw") {
    const r = 5.5 + 1.5 * pulse;
    return (
      <g>
        <path d={`M ${ax + r},${ay} A ${r},${r} 0 0,1 ${ax},${ay + r}`} fill="none" stroke={col} strokeWidth={1.7} strokeLinecap="round" />
        <path d={`M ${ax},${ay + r} A ${r},${r} 0 0,1 ${ax - r},${ay}`} fill="none" stroke={col} strokeWidth={1.7} strokeLinecap="round" />
        <polygon points={`${ax + r},${ay + 2.5} ${ax + r - 2},${ay - 0.5} ${ax + r + 2},${ay - 0.5}`} fill={col} />
      </g>
    );
  }
  if (type === "heel-press") {
    return (
      <g>
        <line x1={ax} y1={ay - 6.5 + off} x2={ax} y2={ay + 0.5 + off} stroke={col} strokeWidth={1.6} strokeLinecap="round" />
        <polygon points={`${ax},${ay + 3.5 + off} ${ax - 2.2},${ay + 0.5 + off} ${ax + 2.2},${ay + 0.5 + off}`} fill={col} />
        <line x1={ax - 6} y1={ay + 4.5 + off * 0.4} x2={ax + 6} y2={ay + 4.5 + off * 0.4} stroke={`rgba(23,117,72,${(op * 0.45).toFixed(2)})`} strokeWidth={1} strokeLinecap="round" />
      </g>
    );
  }
  if (type === "forward-drive") {
    return (
      <g>
        <line x1={ax - 5.5 + off} y1={ay} x2={ax + 2.5 + off} y2={ay} stroke={col} strokeWidth={1.6} strokeLinecap="round" />
        <polygon points={`${ax + 5.5 + off},${ay} ${ax + 2.5 + off},${ay - 2.2} ${ax + 2.5 + off},${ay + 2.2}`} fill={col} />
      </g>
    );
  }
  return null;
}

// ─── EnvLayer ─────────────────────────────────────────────────────────────────
function EnvLayer({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    const ticks = 12;
    const step = (env.x2 - env.x1) / ticks;
    return (
      <g>
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 2 + i * step;
          return <line key={i} x1={x} y1={env.y1} x2={x - 4} y2={env.y1 + 6} stroke="#475569" strokeWidth={0.7} opacity={0.3} strokeLinecap="round" />;
        })}
        <line x1={env.x1} y1={env.y1 + 1.2} x2={env.x2} y2={env.y2 + 1.2} stroke="#0f172a" strokeWidth={2} opacity={0.25} strokeLinecap="round" />
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  }
  if (env.type === "wall") {
    const ticks = 8;
    const step = (env.y2 - env.y1) / ticks;
    const onRight = env.x1 > 50;
    return (
      <g opacity={0.5}>
        <line x1={env.x1 + (onRight ? 1.2 : -1.2)} y1={env.y1} x2={env.x2 + (onRight ? 1.2 : -1.2)} y2={env.y2} stroke="#0f172a" strokeWidth={2.5} opacity={0.2} />
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#64748b" strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: ticks - 1 }).map((_, i) => {
          const y = env.y1 + (i + 1) * step;
          return <line key={i} x1={env.x1} y1={y} x2={env.x1 + (onRight ? -6 : 6)} y2={y} stroke="#64748b" strokeWidth={0.8} opacity={0.35} />;
        })}
      </g>
    );
  }
  if (env.type === "bar") {
    const ticks = 9;
    const step = (env.x2 - env.x1 - 8) / (ticks - 1);
    return (
      <g>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#94a3b8" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 4 + i * step;
          return <line key={i} x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5} stroke="#475569" strokeWidth={1} opacity={0.4} />;
        })}
        <line x1={env.x1} y1={env.y1 - 4} x2={env.x1} y2={env.y1 + 4} stroke="#64748b" strokeWidth={2} opacity={0.45} />
        <line x1={env.x2} y1={env.y1 - 4} x2={env.x2} y2={env.y1 + 4} stroke="#64748b" strokeWidth={2} opacity={0.45} />
      </g>
    );
  }
  if (env.type === "box") {
    const w = env.x2 - env.x1;
    const h = env.y2 - env.y1;
    return (
      <g opacity={0.5}>
        <rect x={env.x1} y={env.y1} width={w} height={h} fill="rgba(71,85,105,0.15)" stroke="#64748b" strokeWidth={1.5} rx={1} />
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y1} stroke="#94a3b8" strokeWidth={1.5} opacity={0.5} />
      </g>
    );
  }
  return null;
}

// ─── EnvLayerThumb ────────────────────────────────────────────────────────────
function EnvLayerThumb({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") return <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#64748b" strokeWidth={1.5} strokeLinecap="round" opacity={0.45} />;
  if (env.type === "wall")  return <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#64748b" strokeWidth={1.5} strokeLinecap="round" opacity={0.45} />;
  if (env.type === "bar")   return <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2} stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />;
  return null;
}

// ─── BioSkeletonSVG ───────────────────────────────────────────────────────────
function BioSkeletonSVG({
  pose, paused, color = "#177548", env, frozenXfm, overlayProps,
}: {
  pose: PoseData;
  paused: boolean;
  color?: string;
  env?: EnvAnchor;
  frozenXfm: TorsoXfm | null;
  overlayProps?: { type: OverlayType; ax: number; ay: number; pulse: number };
}) {
  const raw  = legacyToNamed(pose);
  const norm = frozenXfm ? applyTorsoXfm(raw, frozenXfm) : raw;
  const normOverlay = overlayProps && frozenXfm ? {
    ...overlayProps,
    ax: overlayProps.ax * frozenXfm.scale + frozenXfm.tx,
    ay: overlayProps.ay * frozenXfm.scale + frozenXfm.ty,
  } : overlayProps;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{
      overflow: "visible",
      filter: paused ? "none" : `drop-shadow(0 0 10px ${color}44)`,
      opacity: paused ? 0.40 : 1,
      animation: !paused ? "wsp-bioGhostPulse 2.5s ease-in-out infinite" : "none",
      transition: "opacity 0.4s ease",
    }}>
      {env && <EnvLayer env={env} />}
      <PuppetFrame pose={norm} color={color} />
      {normOverlay && (
        <ForceOverlayLayer
          type={normOverlay.type}
          ax={normOverlay.ax}
          ay={normOverlay.ay}
          pulse={normOverlay.pulse}
        />
      )}
    </svg>
  );
}

// ─── BioThumbnailSVG ──────────────────────────────────────────────────────────
function BioThumbnailSVG({ pose, color = "#177548", env }: { pose: PoseData; color?: string; env?: EnvAnchor }) {
  const named = legacyToNamed(pose);
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ overflow: "visible", filter: `drop-shadow(0 0 3px ${color}4d)` }}>
      {env && <EnvLayerThumb env={env} />}
      <PuppetFrame pose={named} color={color} />
    </svg>
  );
}

// ─── HeroSkeleton ─────────────────────────────────────────────────────────────
function HeroSkeleton({ exerciseName, paused, color = "#177548" }: { exerciseName: string; paused: boolean; color?: string }) {
  const poseSet     = getPoseSet(exerciseName);
  const env         = getWorldObjects(exerciseName)[0];
  const focusConfig = FOCUS_CONFIG[exerciseName] ?? null;

  const frozenXfm = useMemo(
    () => computeTorsoXfm(legacyToNamed(poseSet[0])),
    [exerciseName], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [renderedPose, setRenderedPose] = useState<PoseData>(() => poseSet[0]);
  const [puppetOpacity, setPuppetOpacity] = useState(1);
  const [overlayPulse, setOverlayPulse] = useState(0);

  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const [start, mid, end] = poseSet;
    setRenderedPose(start);
    setPuppetOpacity(1);
    let elapsed = 0;
    let lastTime: number | null = null;

    function tick(now: number) {
      if (!pausedRef.current) {
        if (lastTime !== null) elapsed = (elapsed + (now - lastTime)) % MOB_CYCLE_MS;
        lastTime = now;
      } else {
        lastTime = null;
      }
      setOverlayPulse(0.5 + 0.5 * Math.sin((elapsed / 1400) * Math.PI * 2));
      const cycleT = elapsed;
      if (cycleT < MOB_TRANSITION_MS) {
        setRenderedPose(lerpPoseData(start, mid, cycleT / MOB_TRANSITION_MS));
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS) {
        setRenderedPose(lerpPoseData(mid, end, (cycleT - MOB_TRANSITION_MS) / MOB_TRANSITION_MS));
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS + MOB_HOLD_MS) {
        setRenderedPose(end);
        setPuppetOpacity(1);
      } else if (cycleT < 2 * MOB_TRANSITION_MS + MOB_HOLD_MS + MOB_FADE_MS) {
        const t = (cycleT - 2 * MOB_TRANSITION_MS - MOB_HOLD_MS) / MOB_FADE_MS;
        setRenderedPose(end);
        setPuppetOpacity(1 - t);
      } else {
        const t = (cycleT - 2 * MOB_TRANSITION_MS - MOB_HOLD_MS - MOB_FADE_MS) / MOB_FADE_MS;
        setRenderedPose(start);
        setPuppetOpacity(t);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [exerciseName]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayProps = (() => {
    if (!focusConfig?.overlay) return undefined;
    const line = renderedPose.lines[focusConfig.overlayLineIdx];
    if (!line?.length) return undefined;
    const [ax, ay] = line[line.length - 1]!;
    return { type: focusConfig.overlay, ax, ay, pulse: overlayPulse };
  })();

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ width: "100%", height: "100%", opacity: puppetOpacity }}>
        <BioSkeletonSVG pose={renderedPose} paused={paused} color={color} env={env} frozenXfm={frozenXfm} overlayProps={overlayProps} />
      </div>
    </div>
  );
}

// ─── ProgressDots ─────────────────────────────────────────────────────────────
function ProgressDots({ total, current, done }: { total: number; current: number; done: boolean }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn(
          "w-2 h-2 rounded-full transition-colors duration-300",
          i < current
            ? "bg-primary"
            : i === current && !done
              ? "bg-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-white"
              : "bg-black/20",
        )} />
      ))}
    </div>
  );
}

// ─── MuscleSilhouette ─────────────────────────────────────────────────────────
const MUSCLE_REGION_MAP: Record<string, string[]> = {
  "wrist":             ["forearm-l", "forearm-r"],
  "forearm":           ["forearm-l", "forearm-r"],
  "shoulder":          ["shoulder-l", "shoulder-r"],
  "anterior shoulder": ["shoulder-l", "shoulder-r", "chest"],
  "chest":             ["chest"],
  "lat":               ["lat-l", "lat-r"],
  "upper back":        ["lat-l", "lat-r"],
  "thoracic":          ["mid-back"],
  "oblique":           ["oblique-l", "oblique-r"],
  "core":              ["core"],
  "hip":               ["hip-l", "hip-r"],
  "quad":              ["quad-l", "quad-r"],
  "hamstring":         ["quad-l", "quad-r"],
  "glute":             ["hip-l", "hip-r"],
  "calf":              ["calf-l", "calf-r"],
  "ankle":             ["calf-l", "calf-r"],
  "tricep":            ["uarm-l", "uarm-r"],
  "bicep":             ["uarm-l", "uarm-r"],
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
  const C = "#177548";
  const dim = "rgba(0,0,0,0.08)";
  const f = (id: string) => active.has(id) ? C : dim;
  const g = (id: string) => active.has(id) ? `drop-shadow(0 0 4px rgba(23,117,72,0.5))` : "none";
  const s = (id: string): React.CSSProperties => ({ fill: f(id), filter: g(id), transition: "fill 0.4s, filter 0.4s" });
  return (
    <svg viewBox="0 0 60 122" width={44} height={88} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={30} cy={7} r={6.5} fill="rgba(0,0,0,0.12)" />
      <rect x={27} y={13.5} width={6} height={5} rx={2} fill="rgba(0,0,0,0.08)" />
      <ellipse cx={15} cy={21} rx={6} ry={3.5} style={s("shoulder-l")} />
      <ellipse cx={45} cy={21} rx={6} ry={3.5} style={s("shoulder-r")} />
      <rect x={8.5} y={24.5} width={8} height={15} rx={4} style={s("uarm-l")} />
      <rect x={43.5} y={24.5} width={8} height={15} rx={4} style={s("uarm-r")} />
      <rect x={9} y={41} width={7} height={14} rx={3.5} style={s("forearm-l")} />
      <rect x={44} y={41} width={7} height={14} rx={3.5} style={s("forearm-r")} />
      <ellipse cx={30} cy={25} rx={9} ry={5.5} style={s("chest")} />
      <ellipse cx={20} cy={32} rx={4.5} ry={7} style={s("lat-l")} />
      <ellipse cx={40} cy={32} rx={4.5} ry={7} style={s("lat-r")} />
      <ellipse cx={30} cy={38} rx={7} ry={6} style={s("core")} />
      <ellipse cx={30} cy={32} rx={5} ry={4.5} style={s("mid-back")} />
      <ellipse cx={19} cy={42} rx={4} ry={5.5} style={s("oblique-l")} />
      <ellipse cx={41} cy={42} rx={4} ry={5.5} style={s("oblique-r")} />
      <ellipse cx={24} cy={52} rx={7} ry={5} style={s("hip-l")} />
      <ellipse cx={36} cy={52} rx={7} ry={5} style={s("hip-r")} />
      <rect x={19.5} y={57} width={10} height={22} rx={5} style={s("quad-l")} />
      <rect x={30.5} y={57} width={10} height={22} rx={5} style={s("quad-r")} />
      <rect x={20.5} y={81} width={8} height={17} rx={4} style={s("calf-l")} />
      <rect x={31.5} y={81} width={8} height={17} rx={4} style={s("calf-r")} />
    </svg>
  );
}

// ─── WarmupSequencePlayer — main exported component ───────────────────────────

export interface WarmupSequencePlayerProps {
  stretches: Stretch[];
  onComplete: () => void;
  onExit: () => void;
}

export function WarmupSequencePlayer({ stretches, onComplete, onExit }: WarmupSequencePlayerProps) {
  const [stretchIndex, setStretchIndex] = useState(0);
  const [secondsLeft,  setSecondsLeft]  = useState(0);
  const [paused,       setPaused]       = useState(false);

  const currentStretch = stretches[stretchIndex];
  const nextStretch    = stretches[stretchIndex + 1];
  const isLast         = stretchIndex + 1 >= stretches.length;

  // ── Scroll + body lock ──────────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100vw";
    document.body.style.height = "100vh";
    return () => {
      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "auto";
      document.body.style.height = "auto";
    };
  }, []);

  // ── Reset timer when exercise changes ──────────────────────────────────────
  useEffect(() => {
    if (!currentStretch) return;
    setSecondsLeft(currentStretch.durationSeconds);
    setPaused(false);
  }, [stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (paused || secondsLeft === 0) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, stretchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-advance at zero ───────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (stretchIndex + 1 >= stretches.length) {
      onComplete();
    } else {
      setStretchIndex(i => i + 1);
    }
  }, [stretchIndex, stretches.length, onComplete]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    const t = setTimeout(advance, 600);
    return () => clearTimeout(t);
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentStretch) return null;

  const timerR    = 38;
  const timerCirc = 2 * Math.PI * timerR;
  const timerOffset = timerCirc * (1 - secondsLeft / currentStretch.durationSeconds);

  return createPortal(
    <>
      <style>{`
        @keyframes wsp-bioGhostPulse { 0%,100%{opacity:.82} 50%{opacity:1} }
        @keyframes wsp-cockpitFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        #wsp-shell {
          position: fixed; inset: 0;
          background: #ffffff;
          display: grid;
          grid-template-rows: 52px auto 1fr 172px;
          overflow: hidden;
          touch-action: none; overscroll-behavior: none;
          user-select: none; -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
          z-index: 9999;
        }
        #wsp-shell *, #wsp-shell *::before, #wsp-shell *::after {
          box-sizing: border-box; touch-action: none;
          overscroll-behavior: none; -webkit-tap-highlight-color: transparent;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        #wsp-shell *::-webkit-scrollbar { display: none; }
        #wsp-shell button { touch-action: manipulation; cursor: pointer; }

        #wsp-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px;
          background: #ffffff;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          position: relative; z-index: 10;
        }
        #wsp-hdr .exit-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none;
          color: rgba(0,0,0,0.45); font-size: 13px; font-weight: 500;
          padding: 6px 0;
        }
        #wsp-hdr .ctrl-row { display: flex; align-items: center; gap: 16px; }
        #wsp-hdr .ctrl-btn {
          background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.10);
          border-radius: 8px; padding: 6px 10px;
          display: flex; align-items: center; gap: 5px;
          color: rgba(0,0,0,0.55); font-size: 11px; font-weight: 600;
        }

        #wsp-title {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 4px; padding: 10px 24px 8px;
          background: #ffffff;
          position: relative; z-index: 5;
          flex-shrink: 0;
        }
        #wsp-title .chip {
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: #177548;
          background: rgba(23,117,72,0.08); border: 1px solid rgba(23,117,72,0.20);
          border-radius: 99px; padding: 2px 10px; line-height: 1.6;
        }
        #wsp-title h2 {
          font-size: 21px; font-weight: 900; letter-spacing: -0.02em;
          margin: 0; line-height: 1.15; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: min(90vw, 480px); color: #000000;
        }

        #wsp-canvas {
          position: relative; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; min-height: 0; background: #f8fafc;
        }
        #wsp-canvas .hero-inner {
          position: relative; width: 100%; height: 100%; max-width: 340px;
          z-index: 1; animation: wsp-cockpitFadeIn 0.22s ease-out both;
        }

        #wsp-dock {
          display: grid; grid-template-columns: 108px 1fr 108px;
          align-items: center;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(0,0,0,0.08);
          overflow: hidden; flex-shrink: 0;
        }
        #wsp-dock .dock-timer {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 12px 8px 14px 12px; gap: 3px;
          border-right: 1px solid rgba(0,0,0,0.08);
        }
        #wsp-dock .dock-timer .timer-label {
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(0,0,0,0.38); margin-top: 2px;
        }
        #wsp-dock .dock-center {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 12px 12px 14px; gap: 8px; overflow: hidden;
        }
        #wsp-dock .dock-cue {
          font-size: 11.5px; line-height: 1.55; color: rgba(0,0,0,0.60);
          text-align: center;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden; max-width: 240px;
        }
        #wsp-dock .dock-muscles {
          display: flex; flex-wrap: wrap; gap: 5px;
          justify-content: center; align-items: center;
        }
        #wsp-dock .muscle-pill {
          font-size: 9.5px; font-weight: 700; padding: 2px 8px;
          border-radius: 99px;
          background: rgba(23,117,72,0.08); color: rgba(23,117,72,0.90);
          border: 1px solid rgba(23,117,72,0.20);
        }
        #wsp-dock .dock-right {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 10px 12px 12px 8px; gap: 5px;
          border-left: 1px solid rgba(0,0,0,0.08); overflow: hidden;
        }
        #wsp-dock .next-header {
          font-size: 8px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(0,0,0,0.35);
        }
        #wsp-dock .next-name {
          font-size: 9.5px; font-weight: 700; text-align: center;
          color: rgba(0,0,0,0.75); line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; max-width: 84px;
        }
        #wsp-dock .last-strong {
          font-size: 9px; font-weight: 800;
          color: #177548; text-align: center; letter-spacing: 0.02em;
        }
      `}</style>

      <div id="wsp-shell">

        {/* ── ROW 1: Header ─────────────────────────────────────────────── */}
        <div id="wsp-hdr">
          <button className="exit-btn" onClick={onExit}>
            <ArrowLeft size={14} /> Exit
          </button>

          <ProgressDots total={stretches.length} current={stretchIndex} done={secondsLeft === 0} />

          <div className="ctrl-row">
            <button className="ctrl-btn" onClick={() => setPaused(p => !p)} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
            </button>
            <button className="ctrl-btn" onClick={advance} aria-label="Skip">
              <SkipForward size={12} /> Skip
            </button>
          </div>
        </div>

        {/* ── ROW 2: Title block ────────────────────────────────────────── */}
        <div id="wsp-title">
          <AnimatePresence mode="wait">
            <motion.div key={`ttl-${stretchIndex}`}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className="chip">Stretch {stretchIndex + 1} of {stretches.length}</div>
              <h2>{currentStretch.name}</h2>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── ROW 3: Skeleton canvas ────────────────────────────────────── */}
        <div id="wsp-canvas">
          <AnimatePresence mode="wait">
            <motion.div key={`hero-${stretchIndex}`} className="hero-inner"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <HeroSkeleton exerciseName={currentStretch.name} paused={paused} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── ROW 4: Info dock ──────────────────────────────────────────── */}
        <div id="wsp-dock">

          {/* LEFT — Arc timer */}
          <div className="dock-timer">
            <svg width={80} height={80} viewBox="0 0 80 80">
              <circle cx={40} cy={40} r={timerR} fill="none" stroke="rgba(23,117,72,0.10)" strokeWidth={9} />
              <circle cx={40} cy={40} r={timerR} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={7} />
              <circle cx={40} cy={40} r={timerR} fill="none"
                stroke={paused ? "#9ca3af" : "#177548"}
                strokeWidth={7} strokeLinecap="round"
                strokeDasharray={timerCirc} strokeDashoffset={timerOffset}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.35s ease" }}
              />
              <text x={40} y={37} textAnchor="middle" fill="#000000" fontSize={22} fontWeight="900" fontFamily="monospace">
                {secondsLeft}
              </text>
              <text x={40} y={52} textAnchor="middle" fill={paused ? "#9ca3af" : "#6b7280"} fontSize={9}>
                {paused ? "paused" : "seconds"}
              </text>
            </svg>
            <div className="timer-label">Timer</div>
          </div>

          {/* CENTER — Coaching cue + muscle pills */}
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
                {currentStretch.targetMuscles.slice(0, 3).map(m => (
                  <span key={m} className="muscle-pill">{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Next exercise preview */}
          <div className="dock-right">
            {isLast || !nextStretch ? (
              <span className="last-strong">Last one — finish strong!</span>
            ) : (
              <>
                <span className="next-header">Up Next</span>
                <div style={{ width: 60, height: 60, borderRadius: 10, overflow: "visible", border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)", padding: 5, flexShrink: 0 }}>
                  <BioThumbnailSVG pose={getPoseSet(nextStretch.name)[0]} color="rgba(100,116,139,0.5)" env={getWorldObjects(nextStretch.name)[0]} />
                </div>
                <span className="next-name">{nextStretch.name}</span>
              </>
            )}
          </div>

        </div>
      </div>
    </>,
    document.body,
  );
}
