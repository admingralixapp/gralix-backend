import { useState } from "react";
import { useLocation } from "wouter";
import { useMyProfile, useActivatePro, useRedeemCode } from "@/lib/social";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, ArrowLeft, ExternalLink, Tag, X, Loader2 } from "lucide-react";

// ─── Promo Code Modal ────────────────────────────────────────────────────────

function PromoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [promoInput, setPromoInput] = useState("");
  const redeemCode = useRedeemCode();
  const { toast } = useToast();

  function handleRedeem() {
    const code = promoInput.trim();
    if (!code) return;
    redeemCode.mutate(code, {
      onSuccess: (data) => {
        toast({ title: "Code redeemed!", description: data.message });
        setPromoInput("");
        onClose();
      },
      onError: (err) =>
        toast({ title: "Invalid code", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-black/10 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: "#197750" }} />
            <span className="font-black text-base text-foreground">Promo Code</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Enter your promo code below to unlock Pro access or free packs.
        </p>

        <div className="flex gap-2">
          <input
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="e.g. TESTER2026"
            className="flex-1 px-3 py-2.5 rounded-lg border border-border text-sm bg-white text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#197750]/30 transition-shadow"
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          />
          <button
            onClick={handleRedeem}
            disabled={!promoInput.trim() || redeemCode.isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 transition-all flex items-center gap-1.5"
            style={{ background: "#197750", color: "#fff" }}
          >
            {redeemCode.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ManageSubscription Page ────────────────────────────────────────────

const FEATURES = [
  "Real-time AI Camera Coaching",
  "Advanced Progress Analytics",
  "1x Free Aura Pack Signing Bonus",
  "Glowing Purple Verified Badge",
];

export function ManageSubscription() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPromoModal, setShowPromoModal] = useState(false);
  const { data: profile } = useMyProfile();
  const activatePro = useActivatePro();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isPro = profile?.isPro ?? false;

  function handleStartTrial() {
    activatePro.mutate(undefined, {
      onSuccess: () =>
        toast({
          title: "Trial started!",
          description: "Enjoy your 3-day free trial of CaliCoach Pro.",
        }),
      onError: () =>
        toast({ title: "Something went wrong", variant: "destructive" }),
    });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top nav bar ── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-black/8 px-4 py-3">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </button>
      </div>

      <div className="p-6 max-w-lg mx-auto space-y-8 pb-16">

        {/* ── Hero ── */}
        <div className="text-center space-y-4 pt-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border"
            style={{ backgroundColor: "rgba(25,119,80,0.10)", borderColor: "rgba(25,119,80,0.20)" }}
          >
            <Crown className="w-8 h-8" style={{ color: "#197750" }} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-foreground leading-tight">
              Unlock Your Full Potential with CaliCoach Pro
            </h1>
            {!isPro && (
              <p className="text-sm text-muted-foreground">
                Everything you need to train smarter, track deeper, and level up faster.
              </p>
            )}
          </div>
        </div>

        {/* ── Feature list ── */}
        <div className="rounded-2xl border border-black/8 bg-white p-5 space-y-3 shadow-sm">
          {FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#197750" }}
              >
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-foreground">{feature}</span>
            </div>
          ))}
        </div>

        {isPro ? (
          /* ── Already Pro state ── */
          <div className="space-y-4">
            <div
              className="rounded-xl border p-4 text-center"
              style={{
                background: "rgba(25,119,80,0.06)",
                borderColor: "rgba(25,119,80,0.25)",
              }}
            >
              <div className="font-black text-base mb-0.5" style={{ color: "#197750" }}>
                You're a Pro member
              </div>
              <div className="text-sm text-muted-foreground">
                Your CaliCoach Pro subscription is active.
              </div>
            </div>

            <a
              href="itms-apps://apps.apple.com/account/subscriptions"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold border border-black/12 hover:bg-black/5 transition-colors text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Subscription in App Store
            </a>
          </div>
        ) : (
          /* ── Non-Pro state ── */
          <div className="space-y-4">
            {/* Plan toggle */}
            <div className="flex rounded-xl overflow-hidden border border-border p-0.5 gap-0.5 bg-secondary">
              {(["monthly", "yearly"] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={[
                    "flex-1 py-2.5 rounded-[9px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                    billingCycle === cycle
                      ? "text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  style={billingCycle === cycle ? { background: "#197750" } : {}}
                >
                  {cycle === "monthly" ? "Monthly (£14.99)" : "Yearly (£143.90)"}
                  {cycle === "yearly" && (
                    <span
                      className={[
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        billingCycle === "yearly"
                          ? "bg-white/20 text-white"
                          : "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      ].join(" ")}
                      style={
                        billingCycle !== "yearly"
                          ? { background: "rgba(25,119,80,0.12)", color: "#197750" }
                          : {}
                      }
                    >
                      Save 20%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Legal disclaimer */}
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Start your 3-day free trial today. Cancel anytime via App Store settings.
              No commitment.
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
          </div>
        )}

        {/* ── Promo code link ── */}
        <div className="text-center pt-2">
          <button
            onClick={() => setShowPromoModal(true)}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Have a promo code?
          </button>
        </div>
      </div>

      {/* ── Promo modal ── */}
      {showPromoModal && (
        <PromoModal onClose={() => setShowPromoModal(false)} />
      )}
    </div>
  );
}
