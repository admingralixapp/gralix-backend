import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { X } from "lucide-react";

const BRANCH_EMOJI: Record<string, string> = {
  PUSH: "💪",
  PULL: "🔵",
  CORE: "⚡",
  LEGS: "🟢",
};

const BRANCH_GRADIENT: Record<string, string> = {
  PUSH: "from-orange-500 to-amber-400",
  PULL: "from-blue-500 to-cyan-400",
  CORE: "from-violet-500 to-purple-400",
  LEGS: "from-emerald-500 to-green-400",
};

const BRANCH_GLOW: Record<string, string> = {
  PUSH: "shadow-orange-500/40",
  PULL: "shadow-blue-500/40",
  CORE: "shadow-violet-500/40",
  LEGS: "shadow-emerald-500/40",
};

interface CelebrationOverlayProps {
  skillTitle: string;
  branch: string;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 7000;

export function CelebrationOverlay({
  skillTitle,
  branch,
  onClose,
}: CelebrationOverlayProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const GOLD = ["#FFD700", "#FFA500", "#DAA520", "#FFEC6A", "#FFFFFF"];

    const burst = (opts?: confetti.Options) =>
      confetti({ colors: GOLD, ticks: 350, ...opts });

    // Initial triple burst
    burst({ particleCount: 160, spread: 160, origin: { x: 0.5, y: 0.55 } });
    burst({ particleCount: 90, angle: 60,  spread: 80,  origin: { x: 0, y: 0.75 } });
    burst({ particleCount: 90, angle: 120, spread: 80,  origin: { x: 1, y: 0.75 } });

    // Second wave at 1.6 s
    const t1 = setTimeout(() => {
      burst({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.4 } });
    }, 1600);

    // Third wave at 3.2 s
    const t2 = setTimeout(() => {
      burst({ particleCount: 60, spread: 100, origin: { x: 0.3, y: 0.5 } });
      burst({ particleCount: 60, spread: 100, origin: { x: 0.7, y: 0.5 } });
    }, 3200);

    // Countdown bar
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100);
      setProgress(pct);
      if (elapsed >= AUTO_CLOSE_MS) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, [onClose]);

  const gradient = BRANCH_GRADIENT[branch] ?? "from-yellow-500 to-amber-400";
  const glow = BRANCH_GLOW[branch] ?? "shadow-yellow-500/40";
  const emoji = BRANCH_EMOJI[branch] ?? "🏆";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 bg-[#0f0f14] border border-yellow-400/40 rounded-2xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Branch badge */}
        <div
          className={`w-28 h-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-5 shadow-xl ${glow}`}
          style={{ boxShadow: "0 0 40px 8px rgba(250,204,21,0.25)" }}
        >
          <span className="text-5xl" role="img">{emoji}</span>
        </div>

        {/* Label */}
        <div className="text-yellow-400 font-bold text-xs tracking-[0.2em] uppercase mb-2">
          🏆 Elite Mastery Unlocked!
        </div>

        {/* Skill name */}
        <h2 className="text-2xl font-extrabold tracking-tight mb-3">
          {skillTitle}
        </h2>

        {/* Sub-text */}
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
          Incredible achievement! Your mastery has been shared with your friends.
        </p>

        {/* Countdown bar */}
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full"
            style={{ width: `${progress}%`, transition: "width 50ms linear" }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
