import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useMyProfile, useActivatePro, useRedeemCode } from "@/lib/social";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Volume2, Tag, X, Loader2,
  History, Sparkles, ExternalLink, TrendingUp,
  Crown, AlertTriangle, CheckCircle2,
} from "lucide-react";

// ─── Skeleton overlay (MediaPipe-style pose tracking) ─────────────────────────

const KP: Record<string, [number, number]> = {
  nose:      [80, 11],
  lShoulder: [54, 25],
  rShoulder: [106, 25],
  lElbow:    [34, 43],
  rElbow:    [126, 43],
  lWrist:    [22, 59],
  rWrist:    [138, 59],
  lHip:      [62, 46],
  rHip:      [98, 46],
  lKnee:     [62, 65],
  rKnee:     [98, 65],
  lAnkle:    [55, 79],
  rAnkle:    [105, 79],
};

const CONNS: [string, string][] = [
  ["nose", "lShoulder"], ["nose", "rShoulder"],
  ["lShoulder", "rShoulder"],
  ["lShoulder", "lElbow"], ["lElbow", "lWrist"],
  ["rShoulder", "rElbow"], ["rElbow", "rWrist"],
  ["lShoulder", "lHip"], ["rShoulder", "rHip"],
  ["lHip", "rHip"],
  ["lHip", "lKnee"], ["lKnee", "lAnkle"],
  ["rHip", "rKnee"], ["rKnee", "rAnkle"],
];

function SkeletonOverlay() {
  return (
    <svg
      viewBox="0 0 160 90"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ filter: "drop-shadow(0 0 4px rgba(0,255,180,0.35))" }}
    >
      {CONNS.map(([a, b]) => {
        const [x1, y1] = KP[a]!;
        const [x2, y2] = KP[b]!;
        return (
          <line
            key={`${a}-${b}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(0,255,180,0.70)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        );
      })}
      {Object.entries(KP).map(([name, [cx, cy]]) => (
        <circle
          key={name}
          cx={cx} cy={cy} r="2.4"
          fill="white"
          stroke="rgba(0,255,180,0.9)"
          strokeWidth="0.9"
        />
      ))}
    </svg>
  );
}

// ─── Analytics preview cards (Slide 2) ────────────────────────────────────────

const ANALYTICS_CARDS = [
  {
    label: "Weekly Volume",
    value: "+12%",
    sub: "vs last week",
    detail: "Push-ups · Pull-ups · Dips",
    progress: 0.72,
    color: "#197750",
    positive: true,
  },
  {
    label: "Consistent Form Score",
    value: "85%",
    sub: "avg across all exercises",
    detail: "Up from 78% last month",
    progress: 0.85,
    color: "#197750",
    positive: true,
  },
  {
    label: "Skill Tree Progress",
    value: "60%",
    sub: "of Push branch unlocked",
    detail: "12 / 20 nodes mastered",
    progress: 0.60,
    color: "#0ea5e9",
    positive: true,
  },
  {
    label: "Push-up Personal Best",
    value: "42 reps",
    sub: "recorded this week",
    detail: "+8 reps from last PR",
    progress: 0.84,
    color: "#197750",
    positive: true,
  },
];

function AnalyticsSlide() {
  return (
    <div className="min-w-full h-full bg-white flex flex-col p-4 select-none">
      <div className="mb-2.5">
        <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#197750" }}>
          Progress Analytics
        </div>
        <h2 className="font-black text-[17px] text-foreground leading-tight">Your Stats Preview</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Unlock full analytics with Pro
        </p>
      </div>

      {/* Scrollable preview cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ scrollbarWidth: "none" }}>
        {ANALYTICS_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-black/7 p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
            style={{ background: "rgba(255,255,255,0.95)" }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-muted-foreground leading-none mb-0.5">
                  {card.label}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-foreground">{card.value}</span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: card.positive ? "#197750" : "#ef4444" }}
                  >
                    {card.sub}
                  </span>
                </div>
              </div>
              {/* Lock icon — preview state indicator */}
              <div
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                style={{ backgroundColor: "rgba(25,119,80,0.09)", border: "1px solid rgba(25,119,80,0.18)" }}
              >
                <Crown className="w-3.5 h-3.5" style={{ color: "#197750" }} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-black/6 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${card.progress * 100}%`, background: card.color }}
              />
            </div>

            <div className="text-[9px] text-muted-foreground mt-1">{card.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pro manage view (replaces carousel when isPro) ───────────────────────────

const PRO_FEATURES = [
  "Real-time AI Camera Coaching",
  "Advanced Progress Analytics",
  "Unlimited Routine History",
  "Personalized Recommendations",
];

function ProManageView() {
  return (
    <motion.div
      key="pro-view"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-4"
    >
      {/* Status card */}
      <div
        className="rounded-2xl border p-5 text-center shadow-[0_2px_12px_rgba(25,119,80,0.10)]"
        style={{ background: "rgba(25,119,80,0.05)", borderColor: "rgba(25,119,80,0.22)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm"
          style={{ background: "rgba(25,119,80,0.12)", border: "1.5px solid rgba(25,119,80,0.3)" }}
        >
          <Crown className="w-7 h-7" style={{ color: "#197750" }} />
        </div>
        <div className="font-black text-xl mb-0.5" style={{ color: "#197750" }}>
          You're a Pro Member
        </div>
        <div className="text-sm text-muted-foreground">
          Your CaliCoach Pro subscription is active and renewing.
        </div>
        <div
          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(25,119,80,0.12)", color: "#197750" }}
        >
          <CheckCircle2 className="w-3 h-3" />
          All Pro features unlocked
        </div>
      </div>

      {/* Unlocked features list */}
      <div className="rounded-xl border border-black/7 divide-y divide-black/6 overflow-hidden">
        {PRO_FEATURES.map((f) => (
          <div key={f} className="flex items-center gap-3 px-4 py-2.5 bg-white">
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#197750" }} />
            <span className="text-sm text-foreground">{f}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Promo code modal ──────────────────────────────────────────────────────────

function PromoModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const redeemCode = useRedeemCode();
  const { toast } = useToast();

  function handleRedeem() {
    const trimmed = code.trim();
    if (!trimmed) return;
    redeemCode.mutate(trimmed, {
      onSuccess: (data) => {
        toast({ title: "Code redeemed!", description: data.message });
        setCode("");
        onClose();
      },
      onError: (err) =>
        toast({ title: "Invalid code", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-black/10 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: "#197750" }} />
            <span className="font-black text-base text-foreground">Promo Code</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter your promo code to unlock Pro access or a free pack.
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. TESTER2026"
            className="flex-1 px-3 py-2.5 rounded-lg border border-border text-sm bg-white text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-shadow"
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          />
          <button
            onClick={handleRedeem}
            disabled={!code.trim() || redeemCode.isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 transition-all flex items-center gap-1.5"
            style={{ background: "#197750", color: "#fff" }}
          >
            {redeemCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 3;

export function ManageSubscription() {
  const [slide, setSlide] = useState(0);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [showPromo, setShowPromo] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const { data: profile } = useMyProfile();
  const activatePro = useActivatePro();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isPro = profile?.isPro ?? false;

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -50 && slide < SLIDE_COUNT - 1) setSlide((s) => s + 1);
    else if (info.offset.x > 50 && slide > 0) setSlide((s) => s - 1);
  }

  function handleStartTrial() {
    activatePro.mutate(undefined, {
      onSuccess: () =>
        toast({ title: "Trial started!", description: "Enjoy your 3-day free trial of CaliCoach Pro." }),
      onError: () =>
        toast({ title: "Something went wrong", variant: "destructive" }),
    });
  }

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Top nav ── */}
      <div className="shrink-0 sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-black/8 px-4 py-3">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">

          {/* Page title */}
          <div className="text-center pt-1 space-y-0.5">
            <h1 className="text-xl font-black text-foreground leading-tight">
              {isPro ? "Your Subscription" : "Unlock Your Full Potential"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPro ? "CaliCoach Pro is active" : "CaliCoach Pro · 3-day free trial"}
            </p>
          </div>

          {/* ── Conditional: Pro view vs Carousel ── */}
          <AnimatePresence mode="wait">
            {isPro ? (
              <ProManageView key="pro" />
            ) : (
              <motion.div
                key="free"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-4"
              >
                {/* ── Carousel ── */}
                <div
                  className="relative rounded-2xl overflow-hidden shadow-md border border-black/6"
                  style={{ height: 290 }}
                >
                  <motion.div
                    className="flex h-full"
                    animate={{ x: `-${slide * 100}%` }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.12}
                    onDragEnd={handleDragEnd}
                  >

                    {/* ── Slide 1: AI Coach ── */}
                    <div className="min-w-full h-full relative bg-black select-none">
                      <video
                        src="https://videos.pexels.com/video-files/3297385/3297385-hd_1920_1080_30fps.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover opacity-70"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/35 pointer-events-none" />
                      <SkeletonOverlay />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-2.5 py-1 border border-[rgba(0,255,180,0.3)]">
                        <Volume2 className="w-3 h-3 text-[#00ffb4]" />
                        <span className="text-[10px] font-semibold text-white">Audio Active</span>
                      </div>
                      <div className="absolute top-3 left-3 bg-black/55 backdrop-blur-sm rounded-full px-2.5 py-1 border border-[rgba(0,255,180,0.3)]">
                        <span className="text-[10px] font-bold text-[#00ffb4]">Form 94%</span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
                        <div className="text-[9px] font-black uppercase tracking-widest text-[#00ffb4] mb-1">
                          AI Camera Coaching
                        </div>
                        <h2 className="text-white font-black text-[17px] leading-tight">
                          Real-time Form Feedback
                        </h2>
                        <p className="text-white/65 text-[11px] mt-0.5">
                          Instant corrections on every rep, powered by AI
                        </p>
                      </div>
                    </div>

                    {/* ── Slide 2: Analytics preview ── */}
                    <AnalyticsSlide />

                    {/* ── Slide 3: Value props ── */}
                    <div className="min-w-full h-full bg-white flex flex-col justify-center p-5 select-none">
                      <div className="text-center mb-4">
                        <div
                          className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                          style={{ color: "#197750" }}
                        >
                          Pro Benefits
                        </div>
                        <h2 className="font-black text-[17px] text-foreground leading-tight">
                          Everything You Need to Grow
                        </h2>
                      </div>

                      <div className="space-y-3">
                        {[
                          {
                            Icon: History,
                            title: "Unlimited Routine History",
                            desc: "Review every session, rep by rep — no limits, ever",
                          },
                          {
                            Icon: Sparkles,
                            title: "Personalized Recommendations",
                            desc: "AI-tailored workouts based on your progress & goals",
                          },
                          {
                            Icon: TrendingUp,
                            title: "Advanced Progress Analytics",
                            desc: "Deep insights into your strength and skill development",
                          },
                        ].map(({ Icon, title, desc }) => (
                          <div
                            key={title}
                            className="flex items-start gap-3 p-3 rounded-xl border border-black/6"
                            style={{ background: "rgba(25,119,80,0.03)" }}
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: "rgba(25,119,80,0.10)",
                                border: "1px solid rgba(25,119,80,0.20)",
                              }}
                            >
                              <Icon className="w-4 h-4" style={{ color: "#197750" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-bold text-foreground">{title}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                {desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </motion.div>
                </div>

                {/* ── Pagination dots ── */}
                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      aria-label={`Slide ${i + 1}`}
                      style={{
                        width: i === slide ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        background: i === slide ? "#197750" : "rgba(0,0,0,0.14)",
                        transition: "width 0.25s ease, background 0.25s ease",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="shrink-0 bg-white border-t border-black/8 px-4 pt-3 pb-4 space-y-2.5">
        <AnimatePresence mode="wait">
          {isPro ? (
            <motion.div
              key="pro-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* Manage in App Store */}
              <a
                href="itms-apps://apps.apple.com/account/subscriptions"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-colors text-white"
                style={{ background: "#197750" }}
              >
                <ExternalLink className="w-4 h-4" />
                Manage Subscription in App Store
              </a>

              {/* Cancel flow */}
              <AnimatePresence mode="wait">
                {!showCancelWarning ? (
                  <motion.div
                    key="cancel-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => setShowCancelWarning(true)}
                      className="w-full py-3 rounded-xl text-sm font-semibold border transition-colors text-red-500 hover:bg-red-50"
                      style={{ borderColor: "rgba(239,68,68,0.25)" }}
                    >
                      Cancel Subscription
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="cancel-warning"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-red-700 mb-0.5">
                          Are you sure you want to cancel?
                        </div>
                        <p className="text-[11px] text-red-600/80 leading-relaxed">
                          You'll be taken to App Store settings to complete cancellation. Your Pro access
                          continues until the end of your current billing period.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCancelWarning(false)}
                        className="flex-1 py-2 rounded-lg text-sm font-bold border border-black/10 bg-white text-foreground hover:bg-black/5 transition-colors"
                      >
                        Keep My Pro
                      </button>
                      <a
                        href="itms-apps://apps.apple.com/account/subscriptions"
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-center text-white transition-colors"
                        style={{ background: "#ef4444" }}
                      >
                        Go to App Store
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="free-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* Plan toggle */}
              <div className="flex rounded-xl overflow-hidden border border-black/10 p-0.5 gap-0.5 bg-gray-50">
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    className={[
                      "flex-1 py-2 rounded-[9px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                      billing === cycle ? "text-white shadow-sm" : "text-muted-foreground",
                    ].join(" ")}
                    style={billing === cycle ? { background: "#197750" } : {}}
                  >
                    {cycle === "monthly" ? "Monthly · £14.99" : "Yearly · £143.90"}
                    {cycle === "yearly" && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={
                          billing === "yearly"
                            ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                            : { background: "rgba(25,119,80,0.12)", color: "#197750" }
                        }
                      >
                        Save 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Legal */}
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Start your 3-day free trial today. Cancel anytime via App Store settings. No commitment.
              </p>

              {/* CTA */}
              <button
                onClick={handleStartTrial}
                disabled={activatePro.isPending}
                className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "#197750", color: "#fff" }}
              >
                {activatePro.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Start 3-Day Free Trial"
                )}
              </button>

              {/* Promo */}
              <div className="text-center">
                <button
                  onClick={() => setShowPromo(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Have a promo code?
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showPromo && <PromoModal onClose={() => setShowPromo(false)} />}
    </div>
  );
}
