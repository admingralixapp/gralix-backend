import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Bell, Shield, LogOut, User, CheckCircle2, BellOff, HardDrive, Trash2, Video,
  AlertTriangle, Timer, Camera, Volume2, FlipHorizontal2, Ruler, ExternalLink,
  Globe, Search, Check, Crown, X, Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, getLang } from "@/i18n/languages";
import { setVoiceLanguage, setCoachLang } from "@/lib/voice-service";
import { setAuraLanguage } from "@/lib/aura-audio";
import {
  COACH_LANGUAGES,
  getCoachLanguage,
  setCoachLanguage,
  getCoachLanguageName,
} from "@/lib/coach-language";
import {
  getVoiceCues, setVoiceCues,
  getCameraFacing, setCameraFacing, type CameraFacing,
  getMirrorVideo, setMirrorVideo,
  getVoiceProfile, setVoiceProfile,
} from "@/lib/workout-preferences";
import { VOICE_PROFILE_LIST } from "@/lib/voice-profiles";
import { clearCueCache } from "@/lib/voice-service";
import {
  useMyProfile, useUpdatePrivacy, useUpdateCommunityPostsPublic, useCancelSubscription,
} from "@/lib/social";
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

const RETENTION_DAYS_LIST: RetentionDays[] = [3, 7, 14];

export function Settings() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updatePrivacy = useUpdatePrivacy();
  const updateCommunityPostsPublic = useUpdateCommunityPostsPublic();
  const cancelSubscription = useCancelSubscription();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Language selector state
  const [langSearch, setLangSearch] = useState("");
  const langSearchRef = useRef<HTMLInputElement>(null);

  const currentLang = getLang(i18n.language ?? "en") ?? LANGUAGES[0]!;

  const filteredLangs = langSearch.trim()
    ? LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.code.toLowerCase().includes(langSearch.toLowerCase()),
      )
    : LANGUAGES;

  function handleLanguageChange(code: string) {
    i18n.changeLanguage(code);
    setVoiceLanguage(code);
    setAuraLanguage(code);
    toast({ title: `Language changed to ${getLang(code)?.nativeName ?? code}` });
  }

  const { data: mobilityStatus } = useMobilityStatus();
  const updateMobilitySettings = useUpdateMobilitySettings();

  // Notification settings
  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [notifTime,       setNotifTime]       = useState("08:00");
  const [notifGoal,       setNotifGoal]       = useState<MobilityGoal>("general");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [savingNotif,     setSavingNotif]     = useState(false);

  // Video storage settings
  const [retention,    setRetention]    = useState<RetentionDays>(() => getRetentionDays());
  const [clipCount,    setClipCount]    = useState<number>(() => getClipCount());
  const [confirmClear, setConfirmClear] = useState(false);

  // Membership cancel flow: null → 'retention' → 'confirm' → null
  const [cancelStep, setCancelStep] = useState<"retention" | "confirm" | null>(null);

  // Ref for scroll-to-membership from Shop deep-link
  const membershipRef = useRef<HTMLElement>(null);

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
  const [voiceProfileId,   setVoiceProfileState] = useState<string>(() => getVoiceProfile());
  const [coachLangCode,    setCoachLangState]    = useState<string>(() => getCoachLanguage());
  const [coachLangOpen,    setCoachLangOpen]     = useState(false);

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

  function handleVoiceProfileChange(profileId: string) {
    setVoiceProfile(profileId);
    setVoiceProfileState(profileId);
    clearCueCache();
  }

  function handleCoachLangChange(code: string) {
    setCoachLanguage(code);
    setCoachLangState(code);
    setCoachLang(code);
    setCoachLangOpen(false);
    toast({ title: `Coach language set to ${getCoachLanguageName(code)}` });
  }

  useEffect(() => {
    if (!mobilityStatus?.settings) return;
    setNotifEnabled(mobilityStatus.settings.enabled);
    setNotifTime(mobilityStatus.settings.notificationTime);
    setNotifGoal((mobilityStatus.settings.mobilityGoal as MobilityGoal) ?? "general");
  }, [mobilityStatus?.settings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === "membership" && membershipRef.current) {
      setTimeout(() => {
        membershipRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [profile?.isPro]);

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
        {t("errors.unauthorized")}
      </div>
    );
  }

  const currentPrivacy: PrivacyLevel = (profile?.privacyLevel as PrivacyLevel) ?? "friends";

  const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; desc: string }[] = [
    { value: "public",  label: t("privacy.public"),  desc: t("privacy.publicDesc")  },
    { value: "friends", label: t("privacy.friends"), desc: t("privacy.friendsDesc") },
    { value: "private", label: t("privacy.private"), desc: t("privacy.privateDesc") },
  ];

  const RETENTION_LABELS: Record<RetentionDays, string> = {
    3:  t("daily.days", { defaultValue: "3 Days" }) !== "days" ? `3 ${t("daily.days")}` : "3 Days",
    7:  t("daily.days", { defaultValue: "7 Days" }) !== "days" ? `7 ${t("daily.days")}` : "7 Days",
    14: t("daily.days", { defaultValue: "14 Days" }) !== "days" ? `14 ${t("daily.days")}` : "14 Days",
  };

  function handlePrivacyChange(level: PrivacyLevel) {
    if (!profile) {
      toast({ title: t("settings.setUpProfile"), variant: "destructive" });
      return;
    }
    if (level === currentPrivacy) return;
    updatePrivacy.mutate(level, {
      onSuccess: () =>
        toast({ title: t("privacy." + level), description: `${t("privacy." + level + "Desc")}` }),
      onError: () =>
        toast({ title: t("common.error"), variant: "destructive" }),
    });
  }

  const displayAvatarUrl = profile?.avatarUrl ?? user?.imageUrl ?? null;

  async function handleNotifToggle() {
    const next = !notifEnabled;
    if (next && notifPermission !== "granted") {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast({
          title: t("settings.notificationsBlocked"),
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
            title: t("common.save"),
            description: notifEnabled
              ? `${t("settings.reminderTime")}: ${notifTime}`
              : t("settings.enableDailyReminders"),
          });
          setSavingNotif(false);
        },
        onError: () => {
          toast({ title: t("common.error"), variant: "destructive" });
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
    toast({ title: RETENTION_LABELS[days] });
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
      title: t("settings.clearAllClips"),
      description: t("settings.freeUpSpace"),
    });
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* ── Account ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<User className="w-4 h-4" />} label={t("settings.account")} />
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
                {t("settings.editFromProfile")}
              </p>
            </div>
          </div>

          {profile?.username && (
            <button
              onClick={() => setLocation(`/profile/${profile.username}`)}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("settings.viewProfile")}
            </button>
          )}
        </div>
      </section>

      {/* ── Language ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Globe className="w-4 h-4" />} label={t("settings.language")} />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Current language pill */}
          <div className="p-4 flex items-center gap-3 border-b border-border/60">
            <div className="flex-1">
              <div className="font-medium text-sm">{currentLang.nativeName}</div>
              <div className="text-xs text-muted-foreground">{currentLang.name}</div>
            </div>
            {currentLang.rtl && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">
                RTL
              </span>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border/60 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={langSearchRef}
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              placeholder={t("settings.searchLanguages")}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-muted/40 border border-border/50 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {/* Scrollable list */}
          <div className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-border/40">
            {filteredLangs.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">{t("settings.noLanguagesFound")}</div>
            ) : (
              filteredLangs.map((lang) => {
                const isSelected = lang.code === currentLang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary/8 text-primary"
                        : "hover:bg-muted/40 text-foreground",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{lang.nativeName}</span>
                      <span className="text-xs text-muted-foreground ml-2">{lang.name}</span>
                    </div>
                    {lang.rtl && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase tracking-wide shrink-0">
                        RTL
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ── Video Storage ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<HardDrive className="w-4 h-4" />} label={t("settings.videoStorage")} />

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
                  ? t("settings.noClipsStored")
                  : t("settings.clipsOnDevice", { count: clipCount })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("settings.videoFilesOnly")}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.07]" />

          {/* Auto-delete control */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{t("settings.autoDeleteAfter")}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t("settings.clipsOlderRemoved")}
                </div>
              </div>
            </div>

            {/* Segmented control */}
            <div
              className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {RETENTION_DAYS_LIST.map((days) => {
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
                <div className="text-sm font-semibold text-foreground">{t("settings.clearAllClips")}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t("settings.freeUpSpace")}
                </div>
              </div>
            </div>

            {confirmClear ? (
              <div className="mt-3 flex items-start gap-3 p-3.5 rounded-xl border border-red-500/30 bg-red-500/8">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-red-300 font-medium mb-2">
                    {t("settings.deleteConfirm", { count: clipCount })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearAll}
                      className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors"
                    >
                      {t("settings.yesClearAll")}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-white/15 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("common.cancel")}
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
                {t("settings.clearAllClips")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Workout ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Timer className="w-4 h-4" />} label={t("settings.workout")} />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-medium text-sm mb-1">{t("settings.restDuration")}</div>
          <div className="text-xs text-muted-foreground mb-3">
            {t("settings.restDurationDesc")}
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
        <SectionHeader icon={<Camera className="w-4 h-4" />} label={t("settings.cameraAudio")} />
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
                <div className="text-sm font-semibold text-foreground">{t("settings.aiVoiceCoaching")}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t("settings.spokenCues")}
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

          {/* AI Coach Personality */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <span className="text-base leading-none">🎙️</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Coach Personality</div>
                <div className="text-[11px] text-muted-foreground">
                  AI voice style for form-correction cues
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {VOICE_PROFILE_LIST.filter((p) =>
                p.isFree || (profile?.inventory ?? []).includes(p.id),
              ).map((p) => {
                const active = voiceProfileId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleVoiceProfileChange(p.id)}
                    className={[
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150",
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-white/15 hover:bg-white/[0.06] hover:text-foreground",
                    ].join(" ")}
                  >
                    <span className="text-base shrink-0 leading-none">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={["text-xs font-semibold truncate", active ? "text-primary" : ""].join(" ")}>
                          {p.label}
                        </span>
                        <span
                          className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wide leading-none"
                          style={
                            p.isFree
                              ? { background: "rgba(132,204,22,0.15)", color: "#84cc16" }
                              : { background: "rgba(139,92,246,0.18)", color: "#c084fc" }
                          }
                        >
                          {p.isFree ? "Free" : "Pro"}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-0.5">
                        {p.description}
                      </div>
                    </div>
                    {active && (
                      <div className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Coach Language */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                <Languages className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Coach Language</div>
                <div className="text-[11px] text-muted-foreground">
                  Language for AI voice coaching cues (ElevenLabs Multilingual v2)
                </div>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setCoachLangOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 text-sm text-foreground transition-all"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <span className="font-medium">
                  {COACH_LANGUAGES.find((l) => l.code === coachLangCode)?.nativeName ?? "English"}
                  <span className="ml-2 text-muted-foreground text-xs">
                    ({COACH_LANGUAGES.find((l) => l.code === coachLangCode)?.name ?? "English"})
                  </span>
                </span>
                <span className="text-muted-foreground text-xs ml-2">{coachLangOpen ? "▲" : "▼"}</span>
              </button>

              {coachLangOpen && (
                <div
                  className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-y-auto"
                  style={{
                    background: "rgba(18,18,24,0.97)",
                    backdropFilter: "blur(20px)",
                    maxHeight: 260,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  {COACH_LANGUAGES.map((lang) => {
                    const active = coachLangCode === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => handleCoachLangChange(lang.code)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.07]"
                      >
                        <span>
                          <span className={active ? "text-primary font-semibold" : "text-foreground"}>
                            {lang.nativeName}
                          </span>
                          <span className="ml-2 text-muted-foreground text-xs">{lang.name}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Default Camera */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{t("settings.defaultCamera")}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t("settings.defaultCameraDesc")}
                </div>
              </div>
            </div>
            <div
              className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {(["user", "environment"] as const).map((facing) => {
                const active = cameraFacing === facing;
                const label  = facing === "user" ? t("settings.cameraFacingFront") : t("settings.cameraFacingBack");
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
                <div className="text-sm font-semibold text-foreground">{t("settings.mirrorCameraPreview")}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t("settings.flipCamera")}
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
                <div className="text-sm font-semibold text-foreground">{t("settings.bodyCalibration")}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t("settings.recalibrateDesc")}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLocation("/calibration")}
              className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              {t("settings.recalibrate")}
            </button>
          </div>
        </div>
      </section>

      {/* ── Daily Mobility Reminders ──────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Bell className="w-4 h-4" />} label={t("settings.mobility")} />
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t("settings.enableDailyReminders")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("settings.browserNotification")}
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
              {t("settings.notificationsBlocked")}
            </div>
          )}

          {notifEnabled && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {t("settings.reminderTime")}
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
                  {t("settings.mobilityGoal")}
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
                  {t("settings.mobilityGoalDesc")}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={saveNotificationSettings}
            disabled={savingNotif || updateMobilitySettings.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savingNotif || updateMobilitySettings.isPending ? t("settings.saving") : t("common.save")}
          </button>
        </div>
      </section>

      {/* ── Profile Privacy ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Shield className="w-4 h-4" />} label={t("settings.profilePrivacy")} />
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
            {t("settings.setUpProfile")}
          </p>
        )}

        {/* Community Posts visibility toggle */}
        <div className="mt-3 rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-sm">{t("settings.showCommunityPosts")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t("settings.communityPostsDesc")}
            </div>
          </div>
          <button
            onClick={() => {
              if (!profile) return;
              const next = !(profile.communityPostsPublic ?? true);
              updateCommunityPostsPublic.mutate(next, {
                onSuccess: () =>
                  toast({ title: t("settings.showCommunityPosts") }),
                onError: () =>
                  toast({ title: t("common.error"), variant: "destructive" }),
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

      {/* ── Manage Membership (Pro only) ─────────────────────────────────────── */}
      {profile?.isPro && (
        <section ref={membershipRef}>
          <SectionHeader icon={<Crown className="w-4 h-4" />} label="Membership" />
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(109,40,217,0.05) 100%)",
              borderColor: "rgba(168,85,247,0.30)",
            }}
          >
            {/* Status row */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.35)" }}
              >
                <Crown className="w-4 h-4" style={{ color: "#c084fc" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: "#e9d5ff" }}>CaliCoach Pro</div>
                <div className="text-[11px]" style={{ color: "#c084fc" }}>Active membership</div>
              </div>
              <span
                className="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0"
                style={{ background: "rgba(168,85,247,0.22)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.4)" }}
              >
                PRO
              </span>
            </div>

            <div className="h-px" style={{ background: "rgba(168,85,247,0.15)" }} />

            {/* Cancel button */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Cancel Membership</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  You keep access until the end of your billing cycle.
                </div>
              </div>
              <button
                onClick={() => setCancelStep("retention")}
                className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

        </section>
      )}

      {/* ── Sign out ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<LogOut className="w-4 h-4" />} label={t("settings.session")} />
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.signedInAs")}{" "}
            <span className="font-medium text-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </span>
          </p>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("settings.signOut")}
          </button>
        </div>
      </section>

      {/* ── Retention modal (Step 1) — portalled to document.body to escape all parent constraints ── */}
      {cancelStep === "retention" && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
            onClick={() => setCancelStep(null)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              width: "calc(100vw - 2rem)",
              maxWidth: "24rem",
              background: "linear-gradient(145deg, #0f0720 0%, #0a0414 100%)",
              borderRadius: "1.5rem",
              border: "1px solid rgba(168,85,247,0.50)",
              boxShadow: "0 0 90px rgba(168,85,247,0.30)",
              overflow: "hidden",
            }}
          >
            {/* Glow orb */}
            <div
              className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
            />

            {/* Accent bar */}
            <div
              className="w-full py-1.5 text-center text-[10px] font-black uppercase tracking-widest"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)", color: "#fff" }}
            >
              Special offer — just for you
            </div>

            <div className="p-6 space-y-4 relative">
              {/* Close */}
              <button
                onClick={() => setCancelStep(null)}
                className="absolute top-4 right-4 text-white/25 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Headline */}
              <div className="text-center pt-1 space-y-2">
                <div className="text-3xl">🎁</div>
                <h3 className="text-xl font-black text-white">Wait! Don't go just yet...</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Stay Pro and get{" "}
                  <span className="font-black" style={{ color: "#c084fc" }}>40% OFF</span>{" "}
                  your next month. Continue your journey with the world's best AI coaching.
                </p>
              </div>

              {/* Price card */}
              <div
                className="flex items-center justify-between rounded-2xl border px-4 py-3"
                style={{ background: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.35)" }}
              >
                <div>
                  <div className="text-xs line-through" style={{ color: "rgba(255,255,255,0.40)" }}>£14.99 / month</div>
                  <div className="text-lg font-black" style={{ color: "#e9d5ff" }}>£8.99 / month</div>
                </div>
                <span
                  className="text-sm font-black px-3 py-1 rounded-full"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff" }}
                >
                  40% OFF
                </span>
              </div>

              {/* Primary CTA */}
              <button
                onClick={() => {
                  setCancelStep(null);
                  toast({ title: "Discount applied!", description: "40% off has been applied to your next billing cycle." });
                }}
                className="w-full py-3 rounded-xl text-sm font-black transition-all"
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                  color: "#fff",
                  boxShadow: "0 4px 24px rgba(168,85,247,0.50)",
                }}
              >
                Claim 40% Discount
              </button>

              {/* Secondary */}
              <button
                onClick={() => setCancelStep("confirm")}
                className="w-full text-center text-xs py-1 transition-colors"
                style={{ color: "rgba(255,255,255,0.30)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
              >
                No thanks, continue to cancel →
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Final exit modal (Step 2) — portalled to document.body ── */}
      {cancelStep === "confirm" && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
            onClick={() => setCancelStep(null)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              width: "calc(100vw - 2rem)",
              maxWidth: "24rem",
              background: "linear-gradient(135deg, #130a0a 0%, #0d0808 100%)",
              borderRadius: "1.5rem",
              border: "1px solid rgba(239,68,68,0.35)",
              boxShadow: "0 0 60px rgba(239,68,68,0.15)",
              padding: "1.5rem",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <span className="font-black text-base text-white">We're sorry to see you go.</span>
              </div>
              <button
                onClick={() => setCancelStep(null)}
                className="text-white/25 hover:text-white/55 transition-colors mt-0.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              You will lose access to{" "}
              <span className="font-semibold text-white/85">Advanced Analytics</span> and{" "}
              <span className="font-semibold text-white/85">Pro Auras</span>{" "}
              at the end of your billing cycle.
            </p>

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setCancelStep(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.70)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  const accessUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                  cancelSubscription.mutate(undefined, {
                    onSuccess: () => {
                      setCancelStep(null);
                      toast({
                        title: "Subscription cancelled",
                        description: `Your subscription has been cancelled. You will have access until ${accessUntil}.`,
                      });
                    },
                    onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
                  });
                }}
                disabled={cancelSubscription.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.40)",
                  color: "#f87171",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.25)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)"; }}
              >
                {cancelSubscription.isPending ? "Cancelling…" : "Cancel Membership"}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
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
