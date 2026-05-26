import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useMyProfile, useActivatePro, useRedeemCode } from "@/lib/social";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Volume2, Tag, X, Loader2,
  History, Sparkles, ExternalLink, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

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

// ─── Analytics dummy data ──────────────────────────────────────────────────────

const CHART_DATA = [
  { week: "Wk1", pushups: 10, pullups: 3 },
  { week: "Wk2", pushups: 14, pullups: 4 },
  { week: "Wk3", pushups: 19, pullups: 6 },
  { week: "Wk4", pushups: 23, pullups: 7 },
  { week: "Wk5", pushups: 28, pullups: 9 },
  { week: "Wk6", pushups: 33, pullups: 11 },
  { week: "Wk7", pushups: 38, pullups: 13 },
  { week: "Wk8", pushups: 44, pullups: 16 },
];

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
            style={{ "--tw-ring-color": "rgba(25,119,80,0.30)" } as React.CSSProperties}
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
              Unlock Your Full Potential
            </h1>
            <p className="text-sm text-muted-foreground">CaliCoach Pro · 3-day free trial</p>
          </div>

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
                {/* Video */}
                <video
                  src="https://videos.pexels.com/video-files/3297385/3297385-hd_1920_1080_30fps.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/35 pointer-events-none" />
                {/* Skeleton tracking overlay */}
                <SkeletonOverlay />
                {/* Audio badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-2.5 py-1 border border-[rgba(0,255,180,0.3)]">
                  <Volume2 className="w-3 h-3 text-[#00ffb4]" />
                  <span className="text-[10px] font-semibold text-white">Audio Active</span>
                </div>
                {/* Form score */}
                <div className="absolute top-3 left-3 bg-black/55 backdrop-blur-sm rounded-full px-2.5 py-1 border border-[rgba(0,255,180,0.3)]">
                  <span className="text-[10px] font-bold text-[#00ffb4]">Form 94%</span>
                </div>
                {/* Text */}
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

              {/* ── Slide 2: Analytics ── */}
              <div className="min-w-full h-full bg-white flex flex-col p-4 select-none">
                <div className="mb-2">
                  <div
                    className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                    style={{ color: "#197750" }}
                  >
                    Progress Analytics
                  </div>
                  <h2 className="font-black text-[17px] text-foreground leading-tight">Track Your Gains</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">8-week strength overview</p>
                </div>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mgPushGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#197750" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#197750" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="mgPullGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 9, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.08)",
                          fontSize: 11,
                          padding: "4px 10px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                        labelStyle={{ fontWeight: 700, color: "#111", marginBottom: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pushups"
                        stroke="#197750"
                        strokeWidth={2}
                        fill="url(#mgPushGrad)"
                        name="Push-ups"
                        dot={false}
                        activeDot={{ r: 4, fill: "#197750" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pullups"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill="url(#mgPullGrad)"
                        name="Pull-ups"
                        dot={false}
                        activeDot={{ r: 4, fill: "#0ea5e9" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-5 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#197750" }} />
                    <span className="text-[10px] text-muted-foreground font-medium">Push-ups</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-[10px] text-muted-foreground font-medium">Pull-ups</span>
                  </div>
                </div>
              </div>

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
                        <Icon className="w-4.5 h-4.5" style={{ color: "#197750" }} />
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

          {/* Pro active badge */}
          {isPro && (
            <div
              className="rounded-xl border p-4 text-center"
              style={{ background: "rgba(25,119,80,0.06)", borderColor: "rgba(25,119,80,0.25)" }}
            >
              <div className="font-black text-base mb-0.5" style={{ color: "#197750" }}>
                You're a Pro member
              </div>
              <div className="text-sm text-muted-foreground">
                Your CaliCoach Pro subscription is active.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="shrink-0 bg-white border-t border-black/8 px-4 pt-3 pb-4 space-y-2.5">
        {isPro ? (
          <a
            href="itms-apps://apps.apple.com/account/subscriptions"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold border border-black/12 hover:bg-black/5 transition-colors text-foreground"
          >
            <ExternalLink className="w-4 h-4" />
            Manage Subscription in App Store
          </a>
        ) : (
          <>
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
          </>
        )}
      </div>

      {showPromo && <PromoModal onClose={() => setShowPromo(false)} />}
    </div>
  );
}
