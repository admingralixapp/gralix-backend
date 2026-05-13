import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Crown,
  CheckCircle2,
  Zap,
  GitBranch,
  BarChart3,
} from "lucide-react";
import { useCompleteOnboarding, useMyProfile } from "@/lib/social";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOUR_LS_KEY = "calicoach_tour_pending";
const PAD = 14;

// ── Tour step definitions ─────────────────────────────────────────────────────

interface TourStep {
  navKey: string | null;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    navKey: "home",
    title: "Your Daily Engine",
    body: "Track your consistency and see your weekly stats at a glance.",
  },
  {
    navKey: "training",
    title: "Choose Your Focus",
    body: "Access AI-verified workouts or your personalized Daily Mobility routine.",
  },
  {
    navKey: "mastery",
    title: "The Skill Tree",
    body: "Visualize your path from fundamentals to elite calisthenics moves.",
  },
  {
    navKey: null,
    title: "Technical Analytics",
    body: "See your Time Under Tension and Skill Readiness scores in the Progress tab.",
  },
];

// ── Pro upgrade modal ─────────────────────────────────────────────────────────

const PRO_BENEFITS = [
  { icon: Zap,        text: "Full AI Form Analysis (Ghost Coach)" },
  { icon: GitBranch,  text: "Unlimited Skill Tree Access" },
  { icon: BarChart3,  text: "Advanced Technical Analytics" },
];

function ProUpgradeModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();

  function handleTrial() {
    onClose();
    setLocation("/shop");
  }

  return (
    <motion.div
      key="pro-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        key="pro-modal-card"
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(8, 8, 24, 0.96)",
          border: "1px solid rgba(168,85,247,0.45)",
          borderRadius: 28,
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.1), 0 0 80px rgba(168,85,247,0.2), 0 32px 64px rgba(0,0,0,0.6)",
          padding: "40px 36px 32px",
          maxWidth: 440,
          width: "100%",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 6,
            cursor: "pointer",
            color: "#64748b",
            display: "flex",
            lineHeight: 0,
          }}
        >
          <X size={16} />
        </button>

        {/* Crown icon */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 68,
              height: 68,
              borderRadius: 22,
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(124,58,237,0.25))",
              border: "1px solid rgba(168,85,247,0.5)",
              boxShadow:
                "0 0 24px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              marginBottom: 18,
            }}
          >
            <Crown size={32} style={{ color: "#a855f7" }} />
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.5px",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Unlock Your Full Potential
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#94a3b8",
              lineHeight: 1.7,
            }}
          >
            You've completed setup. Take CaliCoach to the next level with Pro.
          </div>
        </div>

        {/* Benefits */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {PRO_BENEFITS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(168,85,247,0.06)",
                border: "1px solid rgba(168,85,247,0.15)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={15} style={{ color: "#a855f7" }} />
              </div>
              <span style={{ fontSize: 13.5, color: "#e2e8f0", flex: 1 }}>
                {text}
              </span>
              <CheckCircle2
                size={15}
                style={{ color: "#a855f7", flexShrink: 0 }}
              />
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleTrial}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(135deg, #9333ea, #7c3aed)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow:
              "0 0 24px rgba(147,51,234,0.5), 0 4px 12px rgba(0,0,0,0.3)",
            marginBottom: 10,
            letterSpacing: "-0.2px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.opacity = "0.9")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.opacity = "1")
          }
        >
          Start My 3-Day Free Trial
        </button>

        {/* Secondary */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 12,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#64748b",
            fontSize: 14,
            cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.color = "#94a3b8")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.color = "#64748b")
          }
        >
          Maybe Later — I'll explore first
        </button>

        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#334155",
            marginTop: 14,
          }}
        >
          £14.99/mo after trial · Cancel anytime
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Spotlight + tooltip ───────────────────────────────────────────────────────

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TourSpotlight({
  rect,
  step,
  stepIndex,
  total,
  onNext,
  onSkip,
}: {
  rect: SpotRect | null;
  step: TourStep;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isCenter = rect === null;

  const spotTop  = rect ? rect.top  - PAD : 0;
  const spotLeft = rect ? rect.left - PAD : 0;
  const spotW    = rect ? rect.width  + PAD * 2 : 0;
  const spotH    = rect ? rect.height + PAD * 2 : 0;

  const isDesktop =
    typeof window !== "undefined" && window.innerWidth >= 768;

  let tooltipStyle: React.CSSProperties;
  if (isCenter) {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 10001,
      width: 340,
      maxWidth: "calc(100vw - 48px)",
    };
  } else if (isDesktop && rect) {
    tooltipStyle = {
      position: "fixed",
      top: Math.max(12, spotTop + spotH / 2 - 100),
      left: spotLeft + spotW + 18,
      zIndex: 10001,
      width: 300,
    };
  } else if (rect) {
    const distFromBottom =
      typeof window !== "undefined"
        ? window.innerHeight - spotTop
        : 200;
    tooltipStyle = {
      position: "fixed",
      bottom: distFromBottom + 18,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 10001,
      width: 300,
      maxWidth: "calc(100vw - 48px)",
    };
  } else {
    tooltipStyle = {};
  }

  return (
    <>
      {/* Spotlight hole (box-shadow trick) */}
      {rect && (
        <div
          style={{
            position: "fixed",
            top: spotTop,
            left: spotLeft,
            width: spotW,
            height: spotH,
            borderRadius: 16,
            zIndex: 9999,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.74)",
            border: "2px solid rgba(0,255,100,0.55)",
            pointerEvents: "none",
            transition: "top 0.35s cubic-bezier(.4,0,.2,1), left 0.35s cubic-bezier(.4,0,.2,1), width 0.35s cubic-bezier(.4,0,.2,1), height 0.35s cubic-bezier(.4,0,.2,1)",
          }}
        />
      )}

      {/* Solid overlay for center-card step (no target element) */}
      {isCenter && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.74)",
            pointerEvents: "all",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Tooltip card */}
      <motion.div
        key={`step-${stepIndex}`}
        initial={{ opacity: 0, scale: 0.94, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 6 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          ...tooltipStyle,
          background: "rgba(8, 14, 30, 0.97)",
          border: "1px solid rgba(0,255,100,0.22)",
          borderRadius: 20,
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow:
            "0 0 0 1px rgba(0,255,100,0.08), 0 24px 64px rgba(0,0,0,0.55)",
          padding: "22px 22px 18px",
        }}
      >
        {/* Progress pips + skip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === stepIndex ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i === stepIndex
                      ? "#00ff64"
                      : i < stepIndex
                        ? "rgba(0,255,100,0.35)"
                        : "rgba(255,255,255,0.12)",
                  transition: "width 0.3s ease, background 0.3s ease",
                }}
              />
            ))}
          </div>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#475569",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            Skip tour
          </button>
        </div>

        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#f1f5f9",
            marginBottom: 7,
            letterSpacing: "-0.2px",
          }}
        >
          {step.title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "#94a3b8",
            lineHeight: 1.65,
            marginBottom: 18,
          }}
        >
          {step.body}
        </div>

        <button
          onClick={onNext}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(90deg, #00c853, #00ff64)",
            color: "#000",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "-0.1px",
          }}
        >
          {stepIndex < total - 1 ? "Next →" : "See Pro Benefits"}
        </button>
      </motion.div>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function OnboardingTour() {
  const [active,       setActive]       = useState(false);
  const [stepIndex,    setStepIndex]    = useState(0);
  const [showProModal, setShowProModal] = useState(false);
  const [targetRect,   setTargetRect]   = useState<SpotRect | null>(null);
  const completeOnboarding = useCompleteOnboarding();

  // Read the current user's DB profile so the trigger check is user-scoped.
  // The localStorage flag stores the user's numeric DB id as its value, so it
  // can never accidentally fire for a different account on the same device.
  const { data: profile } = useMyProfile();

  // Fire up when the freshly-loaded profile matches the stored tour flag
  useEffect(() => {
    if (!profile?.id) return;
    const flagValue = localStorage.getItem(TOUR_LS_KEY);
    if (flagValue !== String(profile.id)) return;
    const timer = setTimeout(() => setActive(true), 900);
    return () => clearTimeout(timer);
  }, [profile?.id]);

  // Re-measure the spotlight target whenever the active step changes
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step?.navKey) { setTargetRect(null); return; }

    function measure() {
      const navKey = STEPS[stepIndex]?.navKey;
      if (!navKey) return;
      const el =
        document.getElementById(`tour-desktop-${navKey}`) ??
        document.getElementById(`tour-mobile-${navKey}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, stepIndex]);

  const markDone = useCallback(async () => {
    localStorage.removeItem(TOUR_LS_KEY);
    try { await completeOnboarding.mutateAsync(); } catch { /* best-effort */ }
  }, [completeOnboarding]);

  const handleSkip = useCallback(async () => {
    setActive(false);
    setShowProModal(false);
    await markDone();
  }, [markDone]);

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setActive(false);
      setShowProModal(true);
    }
  }, [stepIndex]);

  const handleProClose = useCallback(async () => {
    setShowProModal(false);
    await markDone();
  }, [markDone]);

  return (
    <AnimatePresence>
      {active && (
        <TourSpotlight
          key="tour-spotlight"
          rect={targetRect}
          step={STEPS[stepIndex]!}
          stepIndex={stepIndex}
          total={STEPS.length}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
      {showProModal && (
        <ProUpgradeModal key="pro-modal" onClose={handleProClose} />
      )}
    </AnimatePresence>
  );
}
