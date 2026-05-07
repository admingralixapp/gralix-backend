import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Bell, Shield, LogOut, User, CheckCircle2, BellOff, HardDrive, Trash2, Video,
  AlertTriangle, Timer, Camera, Volume2, FlipHorizontal2, Ruler, ExternalLink,
  Globe, Search, Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, getLang } from "@/i18n/languages";
import { setVoiceLanguage } from "@/lib/voice-service";
import { setAuraLanguage } from "@/lib/aura-audio";
import {
  getVoiceCues, setVoiceCues,
  getCameraFacing, setCameraFacing, type CameraFacing,
  getMirrorVideo, setMirrorVideo,
} from "@/lib/workout-preferences";
import {
  useMyProfile, useUpdatePrivacy, useUpdateCommunityPostsPublic,
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
