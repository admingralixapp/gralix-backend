import { useState } from "react";
import { EmojiIcon } from "@/components/emoji-icon";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalizedPrices } from "@/lib/locale";
import {
  ShoppingBag,
  Sparkles,
  Check,
  Gift,
  Tag,
  X,
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
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(null);
  const chosenVoice = CLAIMABLE_VOICES.find((v) => v.id === chosen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-black/10 overflow-hidden bg-white"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-primary" />
              <span className="font-black text-lg text-foreground">{t("shop.claimVoiceTitle")}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("shop.claimVoiceSubtitle")}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-3 mt-0.5">
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
                  ? "border-primary/50 bg-primary/8"
                  : "border-border hover:border-border/60 bg-secondary/30",
              )}
            >
              <span className="text-2xl leading-none shrink-0">{voice.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{voice.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{t(`shop.voiceDesc.${voice.id}`)}</div>
              </div>
              {chosen === voice.id && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-primary">
                  <Check className="w-3 h-3 text-white" />
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
              background: chosen ? "#177548" : "rgba(0,0,0,0.06)",
              color: chosen ? "#fff" : "#9ca3af",
            }}
          >
            {isPending ? t("shop.claiming") : chosenVoice ? t("shop.claimVoice", { name: chosenVoice.label }) : t("shop.selectVoice")}
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

  const [, setLocation] = useLocation();
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string>(() => getVoiceProfile());
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  const inventory: string[] = profile?.inventory ?? ["classic"];
  const canClaimBonus = !!profile?.isPro && !profile?.hasClaimedSigningBonus;

  function handleBuyVoice(profileId: string, label: string) {
    if (!isSignedIn) {
      toast({ title: t("shop.signInToPurchase"), description: t("shop.signInToPurchaseDesc") });
      return;
    }
    purchase.mutate(profileId, {
      onSuccess: () => {
        toast({
          title: t("shop.unlocked", { name: label }),
          description: t("shop.unlockedDesc"),
        });
      },
      onError: (err) => toast({ title: t("shop.purchaseFailed"), description: err.message, variant: "destructive" }),
    });
  }

  function handleClaim(packId: string) {
    claimFree.mutate(packId, {
      onSuccess: () => {
        setShowClaimModal(false);
        const pack = AURA_PACKS.find((p) => p.id === packId);
        toast({
          title: t("shop.packClaimed", { name: pack?.name ?? t("shop.auraPacks") }),
          description: t("shop.packClaimedDesc"),
        });
      },
      onError: (err) => toast({ title: t("shop.claimFailed"), description: err.message, variant: "destructive" }),
    });
  }

  function handleRedeem() {
    const code = redeemInput.trim();
    if (!code) return;
    if (!isSignedIn) {
      toast({ title: t("shop.signInToClaim") });
      return;
    }
    redeemCode.mutate(code, {
      onSuccess: (data) => {
        toast({ title: t("shop.codeRedeemed"), description: data.message });
        setRedeemInput("");
      },
      onError: (err) => toast({ title: t("shop.invalidCode"), description: err.message, variant: "destructive" }),
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
    <div className="p-6 max-w-2xl mx-auto space-y-6">

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

      {/* ── Pro Signing Bonus Banner ── */}
      <AnimatePresence>
        {canClaimBonus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4 cursor-pointer"
            onClick={() => setShowClaimModal(true)}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/25">
              <EmojiIcon emoji="🎁" className="w-6 h-6 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm text-foreground">
                {t("shop.claimBonusTitle")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("shop.claimBonusDesc")}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-black shrink-0 bg-primary text-white">
              {t("shop.claim")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Coach Voices ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("shop.voicesTitle")}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          {t("shop.voicesDesc")}
        </p>

        {/* Free tier */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-0.5">
            {t("shop.starterVoices")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_PROFILE_LIST.filter((p) => p.isFree).map((p) => {
              const active = activeVoiceProfileId === p.id;
              return (
                <div
                  key={p.id}
                  className={[
                    "rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all",
                    active ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl leading-none">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{t(`shop.voiceDesc.${p.id}`)}</div>
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
                          toast({ title: t("shop.elevenLabsError"), description: t("shop.elevenLabsErrorDesc", { name: p.label }), variant: "destructive" });
                        } finally {
                          setTestingVoiceId(null);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-black/20 transition-all disabled:opacity-60"
                    >
                      {testingVoiceId === p.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      {testingVoiceId === p.id ? "…" : t("shop.test")}
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
                          : "bg-secondary text-foreground hover:bg-secondary/80 border border-border",
                      ].join(" ")}
                    >
                      {active ? t("shop.activeLabel") : t("shop.select")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider between free and pro */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("shop.customAuras")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Paid tier — à la carte */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-0.5">
            {t("shop.premiumVoices")}
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
                      ? "border-primary/50 bg-primary/5"
                      : owned
                      ? "border-border bg-card"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <span className="text-2xl leading-none shrink-0">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-bold text-foreground">{p.label}</span>
                      {owned && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                          {t("shop.owned")}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{t(`shop.voiceDesc.${p.id}`)}</div>
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
                          toast({ title: t("shop.elevenLabsError"), description: t("shop.elevenLabsErrorDesc", { name: p.label }), variant: "destructive" });
                        } finally {
                          setTestingVoiceId(null);
                        }
                      }}
                      title="Preview this voice"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-black/20 transition-all disabled:opacity-60"
                    >
                      {testingVoiceId === p.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      {testingVoiceId === p.id ? "…" : t("shop.test")}
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
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-secondary text-foreground hover:bg-secondary/80 border border-border",
                        ].join(" ")}
                      >
                        {active ? t("shop.activeLabel") : t("shop.equip")}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyVoice(p.id, p.label)}
                        disabled={purchase.isPending}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{ background: "#177548", color: "#fff" }}
                      >
                        {purchase.isPending ? "…" : t("shop.buyFor", { price: prices.pack })}
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
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("shop.redeemCodeSection")}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              placeholder={t("shop.promoPlaceholder").toUpperCase()}
              maxLength={24}
              className="flex-1 bg-white border border-black/15 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-foreground placeholder:text-black/25 focus:outline-none focus:border-primary/60 transition-colors uppercase tracking-widest"
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemInput.trim() || redeemCode.isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            >
              {redeemCode.isPending ? "…" : t("shop.redeem")}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {t("shop.redeemCodeDesc")}
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
