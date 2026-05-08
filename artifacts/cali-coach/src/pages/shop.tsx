import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalizedPrices } from "@/lib/locale";
import {
  ShoppingBag,
  Crown,
  Sparkles,
  Check,
  Gift,
  Tag,
  X,
  Zap,
  LogIn,
  Play,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMyProfile,
  useShopPurchase,
  useClaimFreeAura,
  useRedeemCode,
  useActivatePro,
} from "@/lib/social";
import { AURA_PACKS } from "@/lib/aura-packs";
import { useToast } from "@/hooks/use-toast";
import { VOICE_PROFILE_LIST } from "@/lib/voice-profiles";
import { testCoachVoice } from "@/lib/voice-service";
import { getVoiceProfile, setVoiceProfile } from "@/lib/workout-preferences";

// ─── Claim Free Voice Modal (Pro signing bonus) ───────────────────────────────

const CLAIMABLE_VOICES = VOICE_PROFILE_LIST.filter((p) => !p.isFree);

function ClaimModal({
  onClaim,
  onClose,
  isPending,
}: {
  onClaim: (packId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const chosenVoice = CLAIMABLE_VOICES.find((v) => v.id === chosen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-yellow-500/30 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0f00 0%, #0f0a00 100%)",
          boxShadow: "0 0 80px rgba(234,179,8,0.2)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5" style={{ color: "#eab308" }} />
              <span className="font-black text-lg" style={{ color: "#fef08a" }}>Claim Your Free Voice</span>
            </div>
            <p className="text-xs text-white/50">Welcome to Pro! Pick any AI voice — yours free.</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors ml-3 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voice list */}
        <div className="px-6 pb-4 grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto">
          {CLAIMABLE_VOICES.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setChosen(voice.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                chosen === voice.id
                  ? "border-yellow-500/50 bg-yellow-500/10"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02]",
              )}
            >
              <span className="text-2xl leading-none shrink-0">{voice.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{voice.label}</div>
                <div className="text-[10px] text-white/50 leading-tight">{voice.description}</div>
              </div>
              {chosen === voice.id && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-yellow-500">
                  <Check className="w-3 h-3 text-black" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <div className="px-6 pb-6">
          <button
            onClick={() => chosen && onClaim(chosen)}
            disabled={!chosen || isPending}
            className="w-full py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
            style={{
              background: chosen ? "linear-gradient(135deg, #eab308, #ca8a04)" : "rgba(255,255,255,0.06)",
              color: chosen ? "#000" : "#666",
            }}
          >
            {isPending ? "Claiming…" : chosenVoice ? `Claim ${chosenVoice.label}` : "Select a voice to continue"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Shop Page ──────────────────────────────────────────────────────────

export function ShopPage() {
  const { isSignedIn } = useUser();
  const { data: profile } = useMyProfile();
  const purchase = useShopPurchase();
  const claimFree = useClaimFreeAura();
  const redeemCode = useRedeemCode();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const prices = useLocalizedPrices();
  void i18n; // language change triggers re-render, prices update reactively

  const activatePro = useActivatePro();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string>(() => getVoiceProfile());
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  function handleActivateTrial() {
    activatePro.mutate(undefined, {
      onSuccess: () =>
        toast({
          title: "3-Day Free Trial started! 🎉",
          description: "You now have full access to CaliCoach Pro.",
        }),
      onError: () =>
        toast({ title: "Something went wrong", variant: "destructive" }),
    });
  }

  const inventory: string[] = profile?.inventory ?? ["classic"];
  const canClaimBonus = !!profile?.isPro && !profile?.hasClaimedSigningBonus;

  function handleBuyVoice(profileId: string, label: string) {
    if (!isSignedIn) {
      toast({ title: "Sign in to purchase", description: "Create an account to buy AI voices." });
      return;
    }
    purchase.mutate(profileId, {
      onSuccess: () => {
        toast({
          title: `${label} unlocked! 🎉`,
          description: "Select it from the list to make it your active coach.",
        });
      },
      onError: (err) => toast({ title: "Purchase failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleClaim(packId: string) {
    claimFree.mutate(packId, {
      onSuccess: () => {
        setShowClaimModal(false);
        const pack = AURA_PACKS.find((p) => p.id === packId);
        toast({
          title: `${pack?.name ?? "Aura Pack"} claimed! 🎁`,
          description: "Your Pro signing bonus has been applied.",
        });
      },
      onError: (err) => toast({ title: "Claim failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleRedeem() {
    const code = redeemInput.trim();
    if (!code) return;
    if (!isSignedIn) {
      toast({ title: "Sign in to redeem codes" });
      return;
    }
    redeemCode.mutate(code, {
      onSuccess: (data) => {
        toast({ title: "Code redeemed! 🎉", description: data.message });
        setRedeemInput("");
      },
      onError: (err) => toast({ title: "Invalid code", description: err.message, variant: "destructive" }),
    });
  }

  if (!isSignedIn) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShoppingBag className="w-12 h-12 text-muted-foreground/40" />
        <div className="text-center">
          <h2 className="text-lg font-bold mb-1">{t("shop.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("shop.signInPrompt")}</p>
        </div>
        <a
          href="/sign-in"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          <LogIn className="w-4 h-4" />
          {t("common.signIn")}
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black">{t("shop.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("shop.subtitle")}</p>
        </div>
      </div>

      {/* ── Pro Subscription Card ── */}
      <section>
        <div
          className="rounded-3xl border p-5 space-y-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.14) 0%, rgba(109,40,217,0.07) 50%, rgba(168,85,247,0.04) 100%)",
            borderColor: "rgba(168,85,247,0.35)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 0 50px rgba(168,85,247,0.18), inset 0 1px 0 rgba(168,85,247,0.2)",
          }}
        >
          {/* Ambient glow orb */}
          <div
            className="absolute -top-8 -right-8 w-36 h-36 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
          />

          {/* Header row */}
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(168,85,247,0.22)", border: "1px solid rgba(168,85,247,0.45)" }}
              >
                <Crown className="w-5 h-5" style={{ color: "#c084fc" }} />
              </div>
              <div>
                <div className="font-black text-base" style={{ color: "#e9d5ff" }}>
                  CaliCoach Pro
                </div>
                {profile?.isPro ? (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(168,85,247,0.22)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.4)" }}
                  >
                    {t("shop.proActive")}
                  </span>
                ) : (
                  <div className="text-[11px] text-white/50">{t("shop.proSubtitle")}</div>
                )}
              </div>
            </div>
          </div>

          {/* Why go Pro list */}
          <div className="space-y-2.5 relative">
            {[
              { icon: "🎥", label: "Real-time AI Camera Coaching", description: "Get live feedback on your form and posture on every workout." },
              { icon: "💜", label: "Glowing Purple Verified Badge", description: "Stand out in the community and on the leaderboards with an exclusive Pro-only badge." },
              { icon: "🎁", label: "1x Free Aura Pack Signing Bonus", description: "Kickstart your training with any Premium Aura of your choice, unlocked forever." },
              {
                icon: "📊",
                label: "Advanced Progress Analytics",
                description: "Deep-dive into your form trends, strength gains, and performance metrics.",
              },
            ].map(({ icon, label, description }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm mt-0.5"
                  style={{ background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.25)" }}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white/80">{label}</span>
                  {description && (
                    <p className="text-[10px] text-white/35 mt-0.5 leading-snug">{description}</p>
                  )}
                </div>
                <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#c084fc" }} />
              </div>
            ))}
          </div>

          {!profile?.isPro && (
            <>
              {/* Billing toggle */}
              <div
                className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5 relative"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={[
                      "flex-1 py-2 rounded-[9px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                      billingCycle === cycle
                        ? "text-white shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                    ].join(" ")}
                    style={billingCycle === cycle ? { background: "#7c3aed" } : {}}
                  >
                    {cycle === "monthly" ? "Monthly" : "Yearly"}
                    {cycle === "yearly" && (
                      <span
                        className={[
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          billingCycle === "yearly"
                            ? "bg-white/20 text-white"
                            : "bg-green-500/20 text-green-400",
                        ].join(" ")}
                      >
                        Save 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Price */}
              <div className="text-center py-1 relative">
                <span className="text-4xl font-black" style={{ color: "#e9d5ff" }}>
                  {billingCycle === "monthly" ? prices.monthly : prices.yearly}
                </span>
                <span className="text-sm text-white/40 ml-1">
                  {billingCycle === "monthly" ? "/ month" : "/ year"}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={handleActivateTrial}
                disabled={activatePro.isPending}
                className="w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-60 relative"
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 24px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {activatePro.isPending ? t("common.loading") : t("shop.startTrial")}
              </button>
              <p className="text-[10px] text-white/30 text-center">
                {t("shop.trialNote")}
              </p>
            </>
          )}

          {profile?.isPro && (
            <div className="flex items-center justify-center gap-2 py-1.5 text-sm relative" style={{ color: "#c084fc" }}>
              <Zap className="w-4 h-4" />
              <span>Pro active —</span>
              <a
                href="/settings"
                className="font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: "#c084fc" }}
              >
                Manage Subscription
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Pro Signing Bonus Banner ── */}
      <AnimatePresence>
        {canClaimBonus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border p-4 flex items-center gap-4 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(234,179,8,0.04) 100%)",
              borderColor: "rgba(234,179,8,0.4)",
              boxShadow: "0 0 30px rgba(234,179,8,0.12)",
            }}
            onClick={() => setShowClaimModal(true)}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
              style={{ background: "rgba(234,179,8,0.2)", border: "1px solid rgba(234,179,8,0.4)" }}
            >
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm" style={{ color: "#fef08a" }}>
                Claim Your Free Aura Pack
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">
                Welcome to Pro! Choose any paid pack for free.
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-black shrink-0"
              style={{ background: "#eab308", color: "#000" }}
            >
              Claim
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Coach Voices ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">AI Coach Voices</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Choose your coach's personality. Free voices use your device's speech engine. Pro voices use ElevenLabs AI + GPT-4o character injection.
        </p>

        {/* Free tier */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-0.5">
            Starter Voices
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_PROFILE_LIST.filter((p) => p.isFree).map((p) => {
              const active = activeVoiceProfileId === p.id;
              return (
                <div
                  key={p.id}
                  className={[
                    "rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all",
                    active ? "border-primary/50 ring-1 ring-primary/20" : "border-white/10",
                  ].join(" ")}
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(132,204,22,0.10) 0%, rgba(132,204,22,0.04) 100%)"
                      : "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl leading-none">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{p.description}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      disabled={testingVoiceId === p.id}
                      onClick={async () => {
                        setTestingVoiceId(p.id);
                        try {
                          await testCoachVoice(p.id, p.label);
                        } catch {
                          toast({ title: "ElevenLabs Connection Error", description: `Could not fetch audio for ${p.label}. Check connection.`, variant: "destructive" });
                        } finally {
                          setTestingVoiceId(null);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all disabled:opacity-60"
                    >
                      {testingVoiceId === p.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      {testingVoiceId === p.id ? "…" : "Test"}
                    </button>
                    <button
                      onClick={() => {
                        setVoiceProfile(p.id);
                        setActiveVoiceProfileId(p.id);
                      }}
                      disabled={active}
                      className={[
                        "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40",
                        active
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-white/[0.06] text-foreground hover:bg-white/10 border border-white/10",
                      ].join(" ")}
                    >
                      {active ? "✓ Active" : "Select"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider between free and pro */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Custom Auras</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Paid tier — à la carte */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-0.5">
            Premium Voice &amp; Ghost Skins
          </div>
          <div className="space-y-2">
            {VOICE_PROFILE_LIST.filter((p) => !p.isFree).map((p) => {
              const active = activeVoiceProfileId === p.id;
              const owned  = inventory.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={[
                    "rounded-2xl border p-3.5 flex items-center gap-3 transition-all",
                    active
                      ? "border-violet-500/50 ring-1 ring-violet-500/20"
                      : owned
                      ? "border-white/15"
                      : "border-white/[0.08]",
                  ].join(" ")}
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.04) 100%)"
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <span className="text-2xl leading-none shrink-0">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-bold text-foreground">{p.label}</span>
                      {owned && (
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: "rgba(132,204,22,0.15)", color: "#84cc16" }}
                        >
                          Owned
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{p.description}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      disabled={testingVoiceId === p.id}
                      onClick={async () => {
                        console.log(`[CaliCoach Voice] 🎙️ Fetching ElevenLabs Audio for ${p.label}...`);
                        setTestingVoiceId(p.id);
                        try {
                          await testCoachVoice(p.id, p.label);
                        } catch {
                          toast({ title: "ElevenLabs Connection Error", description: `Could not fetch audio for ${p.label}. Check connection.`, variant: "destructive" });
                        } finally {
                          setTestingVoiceId(null);
                        }
                      }}
                      title="Preview this voice"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all disabled:opacity-60"
                    >
                      {testingVoiceId === p.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      {testingVoiceId === p.id ? "…" : "Test"}
                    </button>
                    {owned ? (
                      <button
                        onClick={() => {
                          setVoiceProfile(p.id);
                          setActiveVoiceProfileId(p.id);
                        }}
                        disabled={active}
                        className={[
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40",
                          active
                            ? "bg-violet-500/15 text-violet-400 border border-violet-500/30"
                            : "bg-white/[0.06] text-foreground hover:bg-white/10 border border-white/10",
                        ].join(" ")}
                      >
                        {active ? "✓ Active" : "Equip"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyVoice(p.id, p.label)}
                        disabled={purchase.isPending}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                          color: "#fff",
                          boxShadow: "0 2px 10px rgba(124,58,237,0.35)",
                        }}
                      >
                        {purchase.isPending ? "…" : "Buy for £4.99"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Promo Code ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Redeem Code</span>
        </div>
        <div
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              placeholder="ENTER CODE"
              maxLength={24}
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors uppercase tracking-widest"
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemInput.trim() || redeemCode.isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            >
              {redeemCode.isPending ? "…" : "Redeem"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Codes unlock packs, Pro access, or limited-time bonuses.
          </p>
        </div>
      </section>

      {/* Claim Free Aura Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <ClaimModal
            onClaim={handleClaim}
            onClose={() => setShowClaimModal(false)}
            isPending={claimFree.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
