/**
 * SkillMasteryCelebrationModal
 *
 * Full-screen RPG-style "SKILL MASTERED" celebration:
 *  - Branch-colored neon glow + scan-line aesthetic
 *  - Animated stick-figure doing the movement
 *  - Mini skill-tree showing new paths unlocked
 *  - Web Audio power-up tone + mobile haptics
 *  - "Share Mastery" button → JPEG share card
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X, ChevronRight, Unlock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSkillMasteryCard, shareSkillMasteryCard } from "@/lib/skill-mastery-card";
import type { SkillMasteryCelebration } from "./skill-mastery-context";
import type { SkillBranch } from "@/lib/skill-tree";

// ── Branch theming ────────────────────────────────────────────────────────────

const BRANCH_THEME: Record<SkillBranch, {
  color:     string;
  glow:      string;
  textClass: string;
  label:     string;
}> = {
  PUSH: { color: "#f97316", glow: "rgba(249,115,22,0.35)", textClass: "text-orange-400",  label: "PUSH" },
  PULL: { color: "#3b82f6", glow: "rgba(59,130,246,0.35)", textClass: "text-blue-400",    label: "PULL" },
  CORE: { color: "#a855f7", glow: "rgba(168,85,247,0.35)", textClass: "text-violet-400",  label: "CORE" },
  LEGS: { color: "#10b981", glow: "rgba(16,185,129,0.35)", textClass: "text-emerald-400", label: "LEGS" },
};

// ── Biomechanical compliments per branch ──────────────────────────────────────

const BRANCH_COMPLIMENT: Record<SkillBranch, string> = {
  PUSH: "Your pushing neuromuscular pathways have fully adapted. Your pectorals, anterior deltoids, and triceps now fire with optimal synchronisation.",
  PULL: "Your pulling chain has reached structural integrity. Your latissimus dorsi, rhomboids, and biceps brachii now exhibit elite motor recruitment.",
  CORE: "Your deep stabiliser network has hit a new threshold. Your transverse abdominis, obliques, and spinal erectors operate with precision-grade tension.",
  LEGS: "Your lower-chain force production is elite. Your quadriceps, glutes, and posterior chain generate and absorb force with athletic efficiency.",
};

// ── Stick figure animation ────────────────────────────────────────────────────

type Pt = [number, number];
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpPt([ax, ay]: Pt, [bx, by]: Pt, t: number): Pt {
  return [lerp(ax, bx, t), lerp(ay, by, t)];
}

interface FigurePose {
  lElbow: Pt; lWrist: Pt;
  rElbow: Pt; rWrist: Pt;
  lKnee:  Pt; lAnkle: Pt;
  rKnee:  Pt; rAnkle: Pt;
  bodyDy: number;
}

const POSES: Record<SkillBranch, [FigurePose, FigurePose]> = {
  PUSH: [
    { lElbow: [28,82], lWrist: [16,110], rElbow: [92,82], rWrist: [104,110], lKnee: [47,152], lAnkle: [44,192], rKnee: [73,152], rAnkle: [76,192], bodyDy: 0  },
    { lElbow: [40,80], lWrist: [44,106], rElbow: [80,80], rWrist: [76,106], lKnee: [47,152], lAnkle: [44,192], rKnee: [73,152], rAnkle: [76,192], bodyDy: 0  },
  ],
  PULL: [
    { lElbow: [34,38], lWrist: [30,14],  rElbow: [86,38], rWrist: [90,14],  lKnee: [47,152], lAnkle: [44,192], rKnee: [73,152], rAnkle: [76,192], bodyDy: 0  },
    { lElbow: [34,38], lWrist: [30,14],  rElbow: [86,38], rWrist: [90,14],  lKnee: [47,152], lAnkle: [44,192], rKnee: [73,152], rAnkle: [76,192], bodyDy: -30 },
  ],
  CORE: [
    { lElbow: [26,90], lWrist: [12,90],  rElbow: [94,90], rWrist: [108,90], lKnee: [47,150], lAnkle: [44,192], rKnee: [73,150], rAnkle: [76,192], bodyDy: 0  },
    { lElbow: [26,90], lWrist: [12,90],  rElbow: [94,90], rWrist: [108,90], lKnee: [36,118], lAnkle: [30,118], rKnee: [84,118], rAnkle: [90,118], bodyDy: 0  },
  ],
  LEGS: [
    { lElbow: [36,72], lWrist: [24,62],  rElbow: [84,72], rWrist: [96,62],  lKnee: [47,152], lAnkle: [44,192], rKnee: [73,152], rAnkle: [76,192], bodyDy: 0  },
    { lElbow: [24,72], lWrist: [8,68],   rElbow: [96,72], rWrist: [112,68], lKnee: [38,148], lAnkle: [28,178], rKnee: [82,148], rAnkle: [92,178], bodyDy: 22 },
  ],
};

function interpolatePose(a: FigurePose, b: FigurePose, t: number): FigurePose {
  return {
    lElbow: lerpPt(a.lElbow, b.lElbow, t), lWrist: lerpPt(a.lWrist, b.lWrist, t),
    rElbow: lerpPt(a.rElbow, b.rElbow, t), rWrist: lerpPt(a.rWrist, b.rWrist, t),
    lKnee:  lerpPt(a.lKnee,  b.lKnee,  t), lAnkle: lerpPt(a.lAnkle, b.lAnkle, t),
    rKnee:  lerpPt(a.rKnee,  b.rKnee,  t), rAnkle: lerpPt(a.rAnkle, b.rAnkle, t),
    bodyDy: lerp(a.bodyDy, b.bodyDy, t),
  };
}

function StickFigure({ branch, color }: { branch: SkillBranch; color: string }) {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const PERIOD = branch === "PULL" ? 1800 : 1400;

  useEffect(() => {
    function tick(t: number) {
      if (!startRef.current) startRef.current = t;
      const elapsed = (t - startRef.current) % PERIOD;
      const raw = elapsed / PERIOD;
      // Smooth sine-based oscillation
      setPhase(Math.sin(raw * Math.PI * 2) * 0.5 + 0.5);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [PERIOD]);

  const [poseA, poseB] = POSES[branch];
  const p = interpolatePose(poseA, poseB, phase);

  const SHOULDER_L: Pt = [40, 52];
  const SHOULDER_R: Pt = [80, 52];
  const HIP_L: Pt = [47, 110];
  const HIP_R: Pt = [73, 110];

  const stroke = { stroke: color, strokeWidth: 3.5, strokeLinecap: "round" as const, fill: "none" };
  const glow   = { filter: `drop-shadow(0 0 6px ${color})` };

  return (
    <svg viewBox="0 0 120 200" width={120} height={200} style={glow}>
      <g transform={`translate(0, ${p.bodyDy})`}>
        {/* Head */}
        <circle cx={60} cy={20} r={13} {...stroke} strokeWidth={3} />
        {/* Torso */}
        <line x1={60} y1={33} x2={60} y2={110} {...stroke} />
        {/* Shoulder bar */}
        <line x1={SHOULDER_L[0]} y1={SHOULDER_L[1]} x2={SHOULDER_R[0]} y2={SHOULDER_R[1]} {...stroke} />
        {/* Hip bar */}
        <line x1={HIP_L[0]} y1={HIP_L[1]} x2={HIP_R[0]} y2={HIP_R[1]} {...stroke} />

        {/* Left arm */}
        <line x1={SHOULDER_L[0]} y1={SHOULDER_L[1]} x2={p.lElbow[0]} y2={p.lElbow[1]} {...stroke} />
        <line x1={p.lElbow[0]} y1={p.lElbow[1]} x2={p.lWrist[0]} y2={p.lWrist[1]} {...stroke} />

        {/* Right arm */}
        <line x1={SHOULDER_R[0]} y1={SHOULDER_R[1]} x2={p.rElbow[0]} y2={p.rElbow[1]} {...stroke} />
        <line x1={p.rElbow[0]} y1={p.rElbow[1]} x2={p.rWrist[0]} y2={p.rWrist[1]} {...stroke} />

        {/* Left leg */}
        <line x1={HIP_L[0]} y1={HIP_L[1]} x2={p.lKnee[0]} y2={p.lKnee[1]} {...stroke} />
        <line x1={p.lKnee[0]} y1={p.lKnee[1]} x2={p.lAnkle[0]} y2={p.lAnkle[1]} {...stroke} />

        {/* Right leg */}
        <line x1={HIP_R[0]} y1={HIP_R[1]} x2={p.rKnee[0]} y2={p.rKnee[1]} {...stroke} />
        <line x1={p.rKnee[0]} y1={p.rKnee[1]} x2={p.rAnkle[0]} y2={p.rAnkle[1]} {...stroke} />

        {/* Joint dots */}
        {([
          [60, 20], SHOULDER_L, SHOULDER_R, HIP_L, HIP_R,
          p.lElbow, p.rElbow, p.lWrist, p.rWrist,
          p.lKnee, p.rKnee, p.lAnkle, p.rAnkle,
        ] as Pt[]).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={color} />
        ))}
      </g>
    </svg>
  );
}

// ── Mini Skill Tree preview ───────────────────────────────────────────────────

function MiniSkillTree({
  masteredTitle,
  unlockedTitles,
  color,
}: {
  masteredTitle:  string;
  unlockedTitles: string[];
  color:          string;
}) {
  if (unlockedTitles.length === 0) return null;

  const CX = 160;
  const MASTER_Y = 50;
  const UNLOCK_Y = 130;
  const nodeW = Math.min(280, (320 / Math.max(1, unlockedTitles.length)) - 12);
  const spacing = nodeW + 12;
  const totalW = spacing * unlockedTitles.length - 12;
  const startX = CX - totalW / 2 + nodeW / 2;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}33`,
      }}
    >
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <Unlock className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
          New Paths Unlocked
        </span>
      </div>

      <svg viewBox={`0 0 320 180`} width="100%" style={{ maxHeight: 180 }}>
        {/* Lines from mastered to unlocked nodes */}
        {unlockedTitles.map((_, i) => {
          const tx = startX + i * spacing;
          return (
            <motion.line
              key={i}
              x1={CX} y1={MASTER_Y + 18}
              x2={tx} y2={UNLOCK_Y - 18}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 0.5, pathLength: 1 }}
              transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
            />
          );
        })}

        {/* Mastered node */}
        <motion.circle
          cx={CX} cy={MASTER_Y} r={18}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={2}
          animate={{ r: [18, 21, 18] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx={CX} cy={MASTER_Y} r={18}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeOpacity={0.3}
          animate={{ r: [18, 30, 18], strokeOpacity: [0.4, 0, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <text x={CX} y={MASTER_Y} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={color}>★</text>
        <text x={CX} y={MASTER_Y + 32} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="white" fillOpacity={0.7}>
          {masteredTitle.length > 18 ? masteredTitle.slice(0, 17) + "…" : masteredTitle}
        </text>

        {/* Unlocked nodes */}
        {unlockedTitles.map((title, i) => {
          const tx = startX + i * spacing;
          return (
            <motion.g key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", delay: 0.5 + i * 0.15, stiffness: 260, damping: 18 }}
              style={{ transformOrigin: `${tx}px ${UNLOCK_Y}px` }}
            >
              <motion.circle
                cx={tx} cy={UNLOCK_Y} r={14}
                fill={`${color}18`}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                animate={{ strokeOpacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
              />
              <text x={tx} y={UNLOCK_Y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={color} fillOpacity={0.8}>🔓</text>
              <text x={tx} y={UNLOCK_Y + 24} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="white" fillOpacity={0.6}>
                {title.length > 14 ? title.slice(0, 13) + "…" : title}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Sound & Haptics ───────────────────────────────────────────────────────────

function playPowerUpSound() {
  try {
    const ctx = new AudioContext();

    function tone(freq: number, start: number, end: number, gain: number, startT: number, endT: number) {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq,  ctx.currentTime + startT);
      osc.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + endT);
      g.gain.setValueAtTime(gain, ctx.currentTime + startT);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + endT + 0.15);
      osc.start(ctx.currentTime + startT);
      osc.stop(ctx.currentTime  + endT + 0.2);
    }

    // Ascending power-up chord sweep
    tone(220, 220, 0,  0.00, 0.60, 0.15);
    tone(330, 440, 0,  0.10, 0.62, 0.20);
    tone(440, 880, 0,  0.15, 0.66, 0.28);
    tone(660, 1320, 0, 0.12, 0.72, 0.40);
  } catch {
    // AudioContext blocked — silent fallback
  }
}

function triggerHaptics() {
  if ("vibrate" in navigator) {
    navigator.vibrate([80, 40, 160, 40, 280]);
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface SkillMasteryCelebrationProps {
  celebration: SkillMasteryCelebration;
  onClose:     () => void;
}

export function SkillMasteryCelebrationModal({
  celebration,
  onClose,
}: SkillMasteryCelebrationProps) {
  const { masteredNode, newlyUnlockedNodes } = celebration;
  const branch  = masteredNode.branch;
  const theme   = BRANCH_THEME[branch];
  const [sharing, setSharing] = useState(false);
  const firedRef = useRef(false);

  // Sound + haptics on mount
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    playPowerUpSound();
    triggerHaptics();
  }, []);

  async function handleShare() {
    setSharing(true);
    try {
      await shareSkillMasteryCard(masteredNode, newlyUnlockedNodes);
    } finally {
      setSharing(false);
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="skill-mastery-overlay"
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={   { opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Scan-line overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)",
          }}
        />

        {/* Ambient corner glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${theme.glow} 0%, transparent 70%)`,
          }}
        />

        {/* Card */}
        <motion.div
          className="relative z-10 mx-4 max-w-sm w-full rounded-2xl overflow-hidden"
          style={{
            background: "rgba(6,9,18,0.96)",
            border:     `1.5px solid ${theme.color}55`,
            boxShadow:  `0 0 60px ${theme.glow}, 0 0 0 1px ${theme.color}22`,
          }}
          initial={{ scale: 0.6, y: 80, opacity: 0 }}
          animate={{ scale: 1,   y: 0,  opacity: 1 }}
          exit={   { scale: 0.85, y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)` }} />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-6 pt-6 pb-7 space-y-4">

            {/* Branch chip + SKILL MASTERED label */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.10 }}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={{ background: `${theme.color}22`, border: `1px solid ${theme.color}55` }}
              >
                <Zap className="w-3 h-3" style={{ color: theme.color }} />
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: theme.color }}
              >
                {theme.label} · Skill Mastered
              </span>
            </motion.div>

            {/* Skill name */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <h2
                className="text-2xl font-black tracking-tight leading-tight"
                style={{
                  color:      theme.color,
                  textShadow: `0 0 18px ${theme.glow}, 0 0 40px ${theme.glow}`,
                }}
              >
                {masteredNode.title}
              </h2>
              <p className="text-[11px] text-white/35 mt-0.5 font-medium tracking-wide uppercase">
                Level {masteredNode.level} · {masteredNode.levelName}
              </p>
            </motion.div>

            {/* Stick figure */}
            <motion.div
              className="flex justify-center items-center py-2"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 18 }}
            >
              <div
                className="rounded-2xl p-4 flex items-center justify-center"
                style={{
                  background: `radial-gradient(ellipse at center, ${theme.color}12 0%, transparent 70%)`,
                  border:     `1px solid ${theme.color}22`,
                  minWidth:   140,
                }}
              >
                <StickFigure branch={branch} color={theme.color} />
              </div>
            </motion.div>

            {/* Biomechanical compliment */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <p className="text-[12px] font-bold text-white/90 leading-snug">
                Your neural pathways have adapted. You now have the mechanical efficiency for{" "}
                <span style={{ color: theme.color }}>{masteredNode.title}</span>.
              </p>
              <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
                {BRANCH_COMPLIMENT[branch]}
              </p>
            </motion.div>

            {/* Mini skill tree */}
            {newlyUnlockedNodes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <MiniSkillTree
                  masteredTitle={masteredNode.title}
                  unlockedTitles={newlyUnlockedNodes.map((n) => n.title)}
                  color={theme.color}
                />
                <p className="text-[10px] text-white/35 mt-2 text-center">
                  Newly available:{" "}
                  <span className="font-semibold" style={{ color: theme.color }}>
                    {newlyUnlockedNodes.map((n) => n.title).join(", ")}
                  </span>
                </p>
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
              className="flex gap-3 pt-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.50 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                style={{
                  border:     `1px solid ${theme.color}44`,
                  color:      theme.color,
                  background: `${theme.color}0d`,
                }}
                onClick={handleShare}
                disabled={sharing}
              >
                <Share2 className="w-4 h-4" />
                {sharing ? "Saving…" : "Share"}
              </Button>

              <Button
                size="sm"
                className="flex-1 gap-1.5 font-bold border-0 text-black"
                style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.color}cc)` }}
                onClick={onClose}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
