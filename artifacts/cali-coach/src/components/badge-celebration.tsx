import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Share2, Dumbbell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MilestoneBadgeDef, MilestoneTier } from "@/lib/milestone-badges";
import { shareBadgeCard } from "@/lib/badge-card";

// ── Color palettes ─────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, {
  confetti:  string[];
  gradient:  string;
  glow:      string;
  text:      string;
  border:    string;
  chipBg:    string;
}> = {
  orange: {
    confetti: ["#f97316", "#fb923c", "#fcd34d", "#fff7ed", "#ffffff"],
    gradient: "from-orange-600 via-amber-500 to-yellow-400",
    glow:     "shadow-orange-500/50",
    text:     "text-orange-400",
    border:   "border-orange-500/40",
    chipBg:   "bg-orange-500/20",
  },
  blue: {
    confetti: ["#3b82f6", "#60a5fa", "#93c5fd", "#eff6ff", "#ffffff"],
    gradient: "from-blue-600 via-blue-500 to-cyan-400",
    glow:     "shadow-blue-500/50",
    text:     "text-blue-400",
    border:   "border-blue-500/40",
    chipBg:   "bg-blue-500/20",
  },
  purple: {
    confetti: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#f5f3ff", "#ffffff"],
    gradient: "from-violet-600 via-purple-500 to-fuchsia-400",
    glow:     "shadow-violet-500/50",
    text:     "text-violet-400",
    border:   "border-violet-500/40",
    chipBg:   "bg-violet-500/20",
  },
  green: {
    confetti: ["#22c55e", "#4ade80", "#86efac", "#f0fdf4", "#ffffff"],
    gradient: "from-emerald-600 via-green-500 to-lime-400",
    glow:     "shadow-emerald-500/50",
    text:     "text-emerald-400",
    border:   "border-emerald-500/40",
    chipBg:   "bg-emerald-500/20",
  },
};

const TIER_META: Record<MilestoneTier, { glow: string; ring: string; pulse: boolean }> = {
  Starter:  { glow: "shadow-gray-400/30",   ring: "ring-gray-400/40",   pulse: false },
  Bronze:   { glow: "shadow-amber-700/50",  ring: "ring-amber-600/50",  pulse: false },
  Silver:   { glow: "shadow-slate-300/50",  ring: "ring-slate-300/50",  pulse: false },
  Gold:     { glow: "shadow-yellow-400/60", ring: "ring-yellow-400/60", pulse: true  },
  Platinum: { glow: "shadow-cyan-300/70",   ring: "ring-cyan-300/60",   pulse: true  },
};

const TIER_GRADIENT: Record<MilestoneTier, string> = {
  Starter:  "from-gray-500 to-gray-400",
  Bronze:   "from-amber-800 via-amber-600 to-yellow-500",
  Silver:   "from-slate-400 via-slate-300 to-white",
  Gold:     "from-yellow-600 via-yellow-400 to-amber-300",
  Platinum: "from-cyan-500 via-sky-300 to-white",
};

// ── Component ──────────────────────────────────────────────────────────────────

interface BadgeCelebrationProps {
  badge:   MilestoneBadgeDef;
  onClose: () => void;
}

export function BadgeCelebrationModal({ badge, onClose }: BadgeCelebrationProps) {
  const [sharing, setSharing] = useState(false);
  const firedRef = useRef(false);

  const cat  = CAT_COLORS[badge.color] ?? CAT_COLORS.green!;
  const tier = TIER_META[badge.tier];

  // ── Confetti burst ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const colors = cat.confetti;

    const burst = (opts?: confetti.Options) =>
      confetti({ colors, ticks: 400, ...opts });

    burst({ particleCount: 180, spread: 180, origin: { x: 0.5, y: 0.6 } });
    burst({ particleCount: 100, angle: 55,  spread: 90,  origin: { x: 0,   y: 0.7 } });
    burst({ particleCount: 100, angle: 125, spread: 90,  origin: { x: 1,   y: 0.7 } });

    const t1 = setTimeout(() =>
      burst({ particleCount: 90, spread: 130, origin: { x: 0.5, y: 0.45 } }), 1400);
    const t2 = setTimeout(() => {
      burst({ particleCount: 60, spread: 110, origin: { x: 0.25, y: 0.5 } });
      burst({ particleCount: 60, spread: 110, origin: { x: 0.75, y: 0.5 } });
    }, 2800);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cat.confetti]);

  // ── Share handler ───────────────────────────────────────────────────────────

  async function handleShare() {
    setSharing(true);
    try {
      await shareBadgeCard(badge);
    } finally {
      setSharing(false);
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="badge-celebration-overlay"
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Card */}
        <motion.div
          className={`relative z-10 mx-4 max-w-sm w-full rounded-2xl
            border ${cat.border}
            bg-[#0a0f1a]/90 backdrop-blur-xl
            shadow-2xl ${cat.glow}`}
          initial={{ scale: 0.6, y: 60, opacity: 0 }}
          animate={{ scale: 1,   y: 0,  opacity: 1 }}
          exit={   { scale: 0.8, y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-8 pt-8 pb-7 text-center">
            {/* "NEW RANK UNLOCKED!" label */}
            <motion.div
              className={`text-xs font-bold tracking-[0.25em] uppercase mb-4 ${cat.text}`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              🏆 New Rank Unlocked!
            </motion.div>

            {/* Badge icon — spring pop */}
            <div className="flex justify-center mb-5">
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0,   opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
              >
                {/* Pulsing glow ring for Gold/Platinum */}
                {tier.pulse && (
                  <motion.div
                    className={`absolute inset-[-12px] rounded-full ${cat.border.replace("border", "bg").replace("/40", "/15")}`}
                    animate={{ scale: [1, 1.18, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                {/* Main badge circle */}
                <div
                  className={`w-32 h-32 rounded-full bg-gradient-to-br ${TIER_GRADIENT[badge.tier]}
                    flex items-center justify-center shadow-2xl ${tier.glow}
                    ring-2 ${tier.ring}`}
                >
                  <span className="text-6xl" role="img" aria-label={badge.name}>
                    {badge.icon}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Tier chip */}
            <motion.div
              className="flex justify-center mb-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <span className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase
                ${cat.chipBg} ${cat.text}`}>
                {badge.tier}
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h2
              className="text-2xl font-extrabold tracking-tight text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              {badge.name}
            </motion.h2>

            {/* Sub-heading */}
            <motion.p
              className={`text-sm font-semibold mb-1 ${cat.text}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.40 }}
            >
              You've reached <span className="font-bold">{badge.tier}</span> in{" "}
              <span className="font-bold capitalize">{badge.category}</span>!
            </motion.p>

            {/* Description */}
            <motion.p
              className="text-xs text-white/50 mb-7 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              {badge.description}
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.50 }}
            >
              <Button
                variant="outline"
                size="sm"
                className={`flex-1 gap-2 border ${cat.border} ${cat.text} hover:bg-white/5`}
                onClick={handleShare}
                disabled={sharing}
              >
                <Share2 className="w-4 h-4" />
                {sharing ? "Saving…" : "Share"}
              </Button>

              <Button
                size="sm"
                className={`flex-1 gap-2 bg-gradient-to-r ${cat.gradient} text-white font-bold
                  border-0 hover:opacity-90`}
                onClick={onClose}
              >
                <Dumbbell className="w-4 h-4" />
                Keep Grinding
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
