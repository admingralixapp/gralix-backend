import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Bell, Shield, LogOut, User, CheckCircle2, BellOff, HardDrive, Trash2, Video,
  AlertTriangle, Timer, Camera, Volume2, FlipHorizontal2, Ruler, ExternalLink,
  Crown, Sparkles, ShieldCheck, Zap, Check,
} from "lucide-react";
import {
  getVoiceCues, setVoiceCues,
  getCameraFacing, setCameraFacing, type CameraFacing,
  getMirrorVideo, setMirrorVideo,
} from "@/lib/workout-preferences";
import {
  useMyProfile, useUpdatePrivacy, useUpdateCommunityPostsPublic,
  useActivatePro, useUpdateShowVerifiedBadge,
} from "@/lib/social";
import {
  VOICE_TONES, GHOST_SKINS, getShopData, purchaseItem,
  setSelectedVoice as saveSelectedVoice,
  setSelectedSkin as saveSelectedSkin,
  isPurchased,
} from "@/lib/shop-preferences";
import { useToast } from "@/hooks/use-toast";
import {
  useMobilityStatus,
  useUpdateMobilitySettings,
  requestNotificationPermission,
} from "@/lib/use-mobility";
import { GOAL_OPTIONS, type MobilityGoal } from "@/lib/mobility-service";
import {
  getRetentionDays,
  setRetentionDays,
  purgeExpiredClips,
  clearAllClips,
  getClipCount,
  type RetentionDays,
} from "@/lib/clip-store";
import {
  getRestDuration,
  setRestDuration,
  REST_DURATION_OPTIONS,
  type RestDuration,
} from "@/lib/workout-settings";

type PrivacyLevel = "public" | "friends" | "private";

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; desc: string }[] = [
  {
    value: "public",
    label: "Public",
    desc: "Anyone can view your profile, skill tree, and mastery badges.",
  },
  {
    value: "friends",
    label: "Friends Only",
    desc: "Only accepted friends can view your profile. Your badge is always visible to friends.",
  },
  {
    value: "private",
    label: "Private",
    desc: "Your profile is hidden — even from friends. Badges still appear on the leaderboard.",
  },
];

const RETENTION_LABELS: Record<RetentionDays, string> = {
  3:  "3 Days",
  7:  "7 Days",
  14: "14 Days",
};

export function Settings() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updatePrivacy = useUpdatePrivacy();
  const updateCommunityPostsPublic = useUpdateCommunityPostsPublic();
  const activatePro = useActivatePro();
  const updateShowVerifiedBadge = useUpdateShowVerifiedBadge();
  const { toast } = useToast();

  const { data: mobilityStatus } = useMobilityStatus();
  const updateMobilitySettings = useUpdateMobilitySettings();

  // Notification settings
  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [notifTime,       setNotifTime]       = useState("08:00");
  const [notifGoal,       setNotifGoal]       = useState<MobilityGoal>("general");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [savingNotif,     setSavingNotif]     = useState(false);

  // Video storage settings
  const [retention,   setRetention]   = useState<RetentionDays>(() => getRetentionDays());
  const [clipCount,   setClipCount]   = useState<number>(() => getClipCount());
  const [confirmClear, setConfirmClear] = useState(false);

  // Workout settings
  const [restDuration, setRestDurationState] = useState<RestDuration>(() => getRestDuration());

  function handleRestDurationChange(d: RestDuration) {
    setRestDuration(d);
    setRestDurationState(d);
  }

  // Workout camera & audio preferences
  const [voiceCuesEnabled, setVoiceCuesState]   = useState<boolean>(() => getVoiceCues());
  const [cameraFacing,     setCameraFacingState] = useState<CameraFacing>(() => getCameraFacing());
  const [mirrorVideoOn,    setMirrorVideoState]  = useState<boolean>(() => getMirrorVideo());

  // Subscription billing toggle
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Shop preferences (localStorage)
  const [selectedVoice, setSelectedVoiceState] = useState<string>(
    () => getShopData().selectedVoice,
  );
  const [selectedSkin, setSelectedSkinState] = useState<string>(
    () => getShopData().selectedSkin,
  );
  const [purchases, setPurchases] = useState<string[]>(
    () => getShopData().purchasedItems,
  );

  function handlePurchase(itemId: string, label: string) {
    purchaseItem(itemId);
    setPurchases(getShopData().purchasedItems);
    toast({ title: `${label} unlocked!`, description: "Your purchase was successful." });
  }

  function handleSelectVoice(id: string) {
    if (!isPurchased(id)) return;
    saveSelectedVoice(id);
    setSelectedVoiceState(id);
  }

  function handleSelectSkin(id: string) {
    if (!isPurchased(id)) return;
    saveSelectedSkin(id);
    setSelectedSkinState(id);
  }

  function handleVerifiedBadgeToggle() {
    if (!profile) return;
    const next = !profile.showVerifiedBadge;
    updateShowVerifiedBadge.mutate(next, {
      onSuccess: () =>
        toast({
          title: next ? "Verified badge visible" : "Verified badge hidden",
          description: next
            ? "Your Pro badge now appears next to your name."
            : "Your Pro badge is hidden.",
        }),
      onError: () =>
        toast({ title: "Failed to update badge visibility", variant: "destructive" }),
    });
  }

  function handleActivateTrial() {
    activatePro.mutate(undefined, {
      onSuccess: () =>
        toast({
          title: "3-Day Free Trial started!",
          description: "You now have full access to CaliCoach Pro.",
        }),
      onError: () =>
        toast({ title: "Something went wrong", variant: "destructive" }),
    });
  }

  function handleVoiceCuesToggle() {
    const next = !voiceCuesEnabled;
    setVoiceCues(next);
    setVoiceCuesState(next);
  }

  function handleCameraFacingChange(facing: CameraFacing) {
    setCameraFacing(facing);
    setCameraFacingState(facing);
  }

  function handleMirrorVideoToggle() {
    const next = !mirrorVideoOn;
    setMirrorVideo(next);
    setMirrorVideoState(next);
  }

  useEffect(() => {
    if (!mobilityStatus?.settings) return;
    setNotifEnabled(mobilityStatus.settings.enabled);
    setNotifTime(mobilityStatus.settings.notificationTime);
    setNotifGoal((mobilityStatus.settings.mobilityGoal as MobilityGoal) ?? "general");
  }, [mobilityStatus?.settings]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  if (!isLoaded || profileLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sign in to access settings.
      </div>
    );
  }

  const currentPrivacy: PrivacyLevel = (profile?.privacyLevel as PrivacyLevel) ?? "friends";

  function handlePrivacyChange(level: PrivacyLevel) {
    if (!profile) {
      toast({ title: "Complete your profile setup first", variant: "destructive" });
      return;
    }
    if (level === currentPrivacy) return;
    updatePrivacy.mutate(level, {
      onSuccess: () =>
        toast({ title: "Privacy updated", description: `Your profile is now ${level}.` }),
      onError: () =>
        toast({ title: "Failed to update privacy", variant: "destructive" }),
    });
  }

  const displayAvatarUrl = profile?.avatarUrl ?? user?.imageUrl ?? null;

  async function handleNotifToggle() {
    const next = !notifEnabled;
    if (next && notifPermission !== "granted") {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast({
          title: "Notifications blocked",
          description: "Please allow notifications in your browser settings, then try again.",
          variant: "destructive",
        });
        return;
      }
      setNotifPermission("granted");
    }
    setNotifEnabled(next);
  }

  async function saveNotificationSettings() {
    setSavingNotif(true);
    updateMobilitySettings.mutate(
      { enabled: notifEnabled, notificationTime: notifTime, mobilityGoal: notifGoal },
      {
        onSuccess: () => {
          toast({
            title: "Notification settings saved",
            description: notifEnabled
              ? `You'll be reminded at ${notifTime} each day.`
              : "Daily reminders disabled.",
          });
          setSavingNotif(false);
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
          setSavingNotif(false);
        },
      },
    );
  }

  function handleRetentionChange(days: RetentionDays) {
    setRetention(days);
    setRetentionDays(days);
    purgeExpiredClips();
    setClipCount(getClipCount());
    toast({
      title: "Auto-delete updated",
      description: `Clips will now be kept for ${RETENTION_LABELS[days]}.`,
    });
  }

  function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const removed = clearAllClips();
    setClipCount(0);
    setConfirmClear(false);
    toast({
      title: `${removed} clip${removed !== 1 ? "s" : ""} cleared`,
      description: "Video files removed. Your workout stats are safe.",
    });
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* ── Account ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<User className="w-4 h-4" />} label="Account" />
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full shrink-0">
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt="avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                  {(profile?.displayName ?? user.firstName ?? "U")[0].toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="font-semibold">
                {profile?.displayName ?? user.fullName ?? user.firstName}
              </div>
              <div className="text-sm text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress}
              </div>
              {profile?.username && (
                <div className="text-xs text-primary mt-0.5">@{profile.username}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Edit your photo and name from your Profile page.
              </p>
            </div>
          </div>

          {profile?.username && (
            <button
              onClick={() => setLocation(`/profile/${profile.username}`)}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Profile
            </button>
          )}
        </div>
      </section>

      {/* ── Subscription ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Crown className="w-4 h-4" />} label="Subscription" />
        <div
          className="rounded-2xl border p-5 space-y-5"
          style={{
            background: "linear-gradient(135deg, rgba(234,179,8,0.07) 0%, rgba(234,179,8,0.02) 100%)",
            borderColor: "rgba(234,179,8,0.22)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(234,179,8,0.12)",
          }}
        >
          {/* Pro status header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)" }}>
              <Crown className="w-5 h-5" style={{ color: "#eab308" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base" style={{ color: "#fef08a" }}>CaliCoach Pro</span>
                {profile?.isPro && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(234,179,8,0.2)", color: "#eab308", border: "1px solid rgba(234,179,8,0.4)" }}>
                    ✓ Active
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {profile?.isPro ? "Full access to all Pro features" : "Unlock the complete CaliCoach experience"}
              </div>
            </div>
          </div>

          {!profile?.isPro && (
            <>
              {/* Billing toggle */}
              <div
                className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={[
                      "flex-1 py-2 rounded-[9px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                      billingCycle === cycle
                        ? "text-black shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                    ].join(" ")}
                    style={billingCycle === cycle ? { background: "#eab308" } : {}}
                  >
                    {cycle === "monthly" ? "Monthly" : "Yearly"}
                    {cycle === "yearly" && (
                      <span className={[
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        billingCycle === "yearly"
                          ? "bg-black/20 text-black"
                          : "bg-green-500/20 text-green-400",
                      ].join(" ")}>
                        Save 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Price */}
              <div className="text-center py-1">
                <span className="text-3xl font-black" style={{ color: "#fef08a" }}>
                  {billingCycle === "monthly" ? "£14.99" : "£149.99"}
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  {billingCycle === "monthly" ? "/ month" : "/ year"}
                </span>
              </div>
            </>
          )}

          {/* Benefits */}
          <div className="space-y-2.5">
            {[
              { icon: "🎥", label: "Real-time AI Camera Coaching", desc: "Live form analysis with Ghost Skeleton guidance" },
              { icon: "🛡️", label: "Verified Status Badge", desc: "Show your Pro badge on the leaderboard and community" },
              { icon: "📊", label: "Advanced Form Analytics", desc: "Joint deviation breakdowns and session trends" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.2)" }}>
                  {icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{desc}</div>
                </div>
                <Check className="w-4 h-4 shrink-0 mt-0.5 ml-auto" style={{ color: "#eab308" }} />
              </div>
            ))}
          </div>

          {/* CTA */}
          {!profile?.isPro ? (
            <button
              onClick={handleActivateTrial}
              disabled={activatePro.isPending}
              className="w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
                color: "#000",
                boxShadow: "0 4px 20px rgba(234,179,8,0.35)",
              }}
            >
              {activatePro.isPending ? "Activating…" : "Start 3-Day Free Trial"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4" style={{ color: "#eab308" }} />
              Pro active — manage via your account portal
            </div>
          )}
        </div>
      </section>

      {/* ── Voice & Skin Shop ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Sparkles className="w-4 h-4" />} label="Customization" />
        <div className="space-y-3">

          {/* Voice Tones */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-3"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.02) 100%)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(168,85,247,0.1)",
            }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-violet-400/70">Voice Tone</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VOICE_TONES.map((tone) => {
                const owned = tone.free || purchases.includes(tone.id);
                const active = selectedVoice === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={[
                      "rounded-xl border p-3 flex flex-col gap-1.5 transition-all",
                      active
                        ? "border-violet-500/60 bg-violet-500/10"
                        : owned
                        ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
                        : "border-white/[0.06] bg-white/[0.02] opacity-75",
                    ].join(" ")}
                    onClick={() => owned ? handleSelectVoice(tone.id) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg leading-none">{tone.emoji}</span>
                      {active && <Check className="w-3.5 h-3.5 text-violet-400" />}
                    </div>
                    <div className="text-xs font-bold text-foreground">{tone.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{tone.description}</div>
                    {!owned && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePurchase(tone.id, tone.label); }}
                        className="mt-1 text-[11px] font-bold py-1.5 rounded-lg transition-all"
                        style={{
                          background: "rgba(168,85,247,0.15)",
                          color: "#a855f7",
                          border: "1px solid rgba(168,85,247,0.3)",
                        }}
                      >
                        Purchase for {tone.price}
                      </button>
                    )}
                    {owned && !tone.free && !active && (
                      <button
                        onClick={() => handleSelectVoice(tone.id)}
                        className="mt-1 text-[11px] font-bold py-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ghost Skins */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-3"
            style={{
              background: "linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(6,182,212,0.02) 100%)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(6,182,212,0.1)",
            }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-cyan-400/70">Ghost Skin</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {GHOST_SKINS.map((skin) => {
                const owned = skin.free || purchases.includes(skin.id);
                const active = selectedSkin === skin.id;
                return (
                  <div
                    key={skin.id}
                    className={[
                      "rounded-xl border p-3 flex flex-col gap-1.5 transition-all",
                      active
                        ? "border-cyan-500/60 bg-cyan-500/10"
                        : owned
                        ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
                        : "border-white/[0.06] bg-white/[0.02] opacity-75",
                    ].join(" ")}
                    onClick={() => owned ? handleSelectSkin(skin.id) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base leading-none">{skin.emoji}</span>
                      {active && <Check className="w-3 h-3 text-cyan-400" />}
                    </div>
                    <div className="text-[11px] font-bold text-foreground leading-tight">{skin.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{skin.description}</div>
                    {!owned && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePurchase(skin.id, skin.label); }}
                        className="mt-1 text-[10px] font-bold py-1 rounded-lg transition-all"
                        style={{
                          background: "rgba(6,182,212,0.12)",
                          color: "#22d3ee",
                          border: "1px solid rgba(6,182,212,0.25)",
                        }}
                      >
                        {skin.price}
                      </button>
                    )}
                    {owned && !skin.free && !active && (
                      <button
                        onClick={() => handleSelectSkin(skin.id)}
                        className="mt-1 text-[10px] font-bold py-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Verified Badge (Pro only) ──────────────────────────────────────────── */}
      {profile?.isPro && (
        <section>
          <SectionHeader icon={<ShieldCheck className="w-4 h-4" />} label="Verified Badge" />
          <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Show Verified Badge on Profile</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Displays a blue Pro badge next to your name in the Community and Leaderboard.
                </div>
              </div>
            </div>
            <button
              onClick={handleVerifiedBadgeToggle}
              disabled={updateShowVerifiedBadge.isPending}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50",
                (profile?.showVerifiedBadge ?? false) ? "bg-blue-500" : "bg-muted",
              ].join(" ")}
              role="switch"
              aria-checked={profile?.showVerifiedBadge ?? false}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                  (profile?.showVerifiedBadge ?? false) ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>
        </section>
      )}

      {/* ── Video Storage ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<HardDrive className="w-4 h-4" />} label="Video Storage" />

        {/* Glassmorphism card */}
        <div
          className="rounded-2xl border border-white/10 p-5 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Storage pill */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {clipCount === 0
                  ? "No clips stored"
                  : `${clipCount} clip${clipCount !== 1 ? "s" : ""} on this device`}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Video files only — workout stats are always kept
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.07]" />

          {/* Auto-delete control */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Auto-Delete Clips After</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Clips older than this are removed on app launch
                </div>
              </div>
            </div>

            {/* Segmented control */}
            <div
              className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {([3, 7, 14] as RetentionDays[]).map((days) => {
                const active = retention === days;
                return (
                  <button
                    key={days}
                    onClick={() => handleRetentionChange(days)}
                    className={[
                      "flex-1 text-sm font-semibold py-2 rounded-[9px] transition-all duration-200",
                      active
                        ? "bg-primary text-black shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {RETENTION_LABELS[days]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.07]" />

          {/* Clear All Clips */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Clear All Clips</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Free up space immediately. Reps, sets, and form scores are unaffected.
                </div>
              </div>
            </div>

            {confirmClear ? (
              <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl border border-red-500/30 bg-red-500/8">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-red-300 font-medium mb-2">
                    This will delete {clipCount} clip{clipCount !== 1 ? "s" : ""} from this device. Are you sure?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearAll}
                      className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-white/15 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleClearAll}
                disabled={clipCount === 0}
                className={[
                  "mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                  clipCount === 0
                    ? "border-white/8 text-white/20 cursor-not-allowed"
                    : "border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50",
                ].join(" ")}
              >
                <Trash2 className="w-4 h-4" />
                Clear All Clips
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Workout ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Timer className="w-4 h-4" />} label="Workout" />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-medium text-sm mb-1">Rest Duration</div>
          <div className="text-xs text-muted-foreground mb-3">
            Time between sets during a multi-set workout.
          </div>
          <div
            className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {REST_DURATION_OPTIONS.map((d) => {
              const active = restDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => handleRestDurationChange(d)}
                  className={[
                    "flex-1 text-sm font-semibold py-2 rounded-[9px] transition-all duration-200",
                    active
                      ? "bg-primary text-black shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {d}s
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Workout Camera & Audio ────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Camera className="w-4 h-4" />} label="Workout Camera & Audio" />
        <div
          className="rounded-2xl border border-white/10 p-5 space-y-5"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* AI Voice Coaching */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">AI Voice Coaching</div>
                <div className="text-[11px] text-muted-foreground">
                  Spoken coaching cues during workouts
                </div>
              </div>
            </div>
            <button
              onClick={handleVoiceCuesToggle}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                voiceCuesEnabled ? "bg-primary" : "bg-muted",
              ].join(" ")}
              role="switch"
              aria-checked={voiceCuesEnabled}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                  voiceCuesEnabled ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Default Camera */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Default Camera</div>
                <div className="text-[11px] text-muted-foreground">
                  Which camera opens when you start a workout
                </div>
              </div>
            </div>
            <div
              className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {(["user", "environment"] as const).map((facing) => {
                const active = cameraFacing === facing;
                const label  = facing === "user" ? "Front" : "Back";
                return (
                  <button
                    key={facing}
                    onClick={() => handleCameraFacingChange(facing)}
                    className={[
                      "flex-1 text-sm font-semibold py-2 rounded-[9px] transition-all duration-200",
                      active
                        ? "bg-primary text-black shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Mirror Video */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <FlipHorizontal2 className="w-4 h-4 text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Mirror Camera Preview</div>
                <div className="text-[11px] text-muted-foreground">
                  Flip the front-facing camera like a mirror
                </div>
              </div>
            </div>
            <button
              onClick={handleMirrorVideoToggle}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                mirrorVideoOn ? "bg-primary" : "bg-muted",
              ].join(" ")}
              role="switch"
              aria-checked={mirrorVideoOn}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                  mirrorVideoOn ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Body Calibration */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Ruler className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Body Calibration</div>
                <div className="text-[11px] text-muted-foreground">
                  Re-run the one-time T-Pose body scan
                </div>
              </div>
            </div>
            <button
              onClick={() => setLocation("/calibration")}
              className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              Recalibrate
            </button>
          </div>
        </div>
      </section>

      {/* ── Daily Mobility Reminders ──────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Bell className="w-4 h-4" />} label="Daily Mobility Reminders" />
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Enable daily reminders</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Get a browser notification at your chosen time each day.
              </div>
            </div>
            <button
              onClick={handleNotifToggle}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                notifEnabled ? "bg-primary" : "bg-muted",
              ].join(" ")}
              role="switch"
              aria-checked={notifEnabled}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                  notifEnabled ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {notifEnabled && notifPermission === "denied" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <BellOff className="w-4 h-4 shrink-0" />
              Notifications are blocked in your browser. Please allow them in your browser/OS settings and reload the page.
            </div>
          )}

          {notifEnabled && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Reminder time
                </label>
                <input
                  type="time"
                  value={notifTime}
                  onChange={(e) => setNotifTime(e.target.value)}
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Mobility goal
                </label>
                <select
                  value={notifGoal}
                  onChange={(e) => setNotifGoal(e.target.value as MobilityGoal)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {GOAL_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  The routine on your /mobility page will be tailored to this goal.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={saveNotificationSettings}
            disabled={savingNotif || updateMobilitySettings.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savingNotif || updateMobilitySettings.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* ── Profile Privacy ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Shield className="w-4 h-4" />} label="Profile Privacy" />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {PRIVACY_OPTIONS.map(({ value, label, desc }, i) => {
            const active   = currentPrivacy === value;
            const updating = updatePrivacy.isPending;
            return (
              <button
                key={value}
                onClick={() => handlePrivacyChange(value)}
                disabled={updating || !profile}
                className={[
                  "w-full flex items-start gap-4 p-4 text-left transition-colors",
                  i !== 0 ? "border-t border-border" : "",
                  active ? "bg-primary/5" : "hover:bg-secondary/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                <div
                  className={[
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    active ? "border-primary bg-primary" : "border-muted",
                  ].join(" ")}
                >
                  {active && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        {!profile && (
          <p className="text-xs text-muted-foreground mt-2">
            Set up your profile to enable privacy controls.
          </p>
        )}

        {/* Community Posts visibility toggle */}
        <div className="mt-3 rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-sm">Show Community Posts to Everyone</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              When off, only your friends can see your posts in the Community tab.
            </div>
          </div>
          <button
            onClick={() => {
              if (!profile) return;
              const next = !(profile.communityPostsPublic ?? true);
              updateCommunityPostsPublic.mutate(next, {
                onSuccess: () =>
                  toast({
                    title: next ? "Community posts are now public" : "Community posts hidden from non-friends",
                  }),
                onError: () =>
                  toast({ title: "Failed to update setting", variant: "destructive" }),
              });
            }}
            disabled={updateCommunityPostsPublic.isPending || !profile}
            className={[
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50",
              (profile?.communityPostsPublic ?? true) ? "bg-primary" : "bg-muted",
            ].join(" ")}
            role="switch"
            aria-checked={profile?.communityPostsPublic ?? true}
          >
            <span
              className={[
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200",
                (profile?.communityPostsPublic ?? true) ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>
      </section>

      {/* ── Sign out ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<LogOut className="w-4 h-4" />} label="Session" />
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </span>
          </p>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
      {icon}
      {label}
    </h2>
  );
}
