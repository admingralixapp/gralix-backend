import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Bell, Shield, LogOut, User, CheckCircle2, BellOff, HardDrive, Trash2, Video, AlertTriangle, Timer, Camera } from "lucide-react";
import { useMyProfile, useUpdatePrivacy, useUpsertProfile } from "@/lib/social";
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
    desc: "Anyone can view your skill tree and form mastery score.",
  },
  {
    value: "friends",
    label: "Friends Only",
    desc: "Only people you've accepted as friends can see your profile.",
  },
  {
    value: "private",
    label: "Private",
    desc: "Your profile is hidden from everyone.",
  },
];

const RETENTION_LABELS: Record<RetentionDays, string> = {
  3:  "3 Days",
  7:  "7 Days",
  14: "14 Days",
};

export function Settings() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updatePrivacy = useUpdatePrivacy();
  const upsertProfile = useUpsertProfile();
  const { toast } = useToast();

  const { data: mobilityStatus } = useMobilityStatus();
  const updateMobilitySettings = useUpdateMobilitySettings();

  const [displayName,    setDisplayName]    = useState("");
  const [username,       setUsername]       = useState("");
  const [editing,        setEditing]        = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Resolved avatar URL: local upload preview → saved DB value → Clerk OAuth photo
  const displayAvatarUrl = localAvatarUrl ?? profile?.avatarUrl ?? user?.imageUrl ?? null;

  function startEditing() {
    setDisplayName(profile?.displayName ?? user?.fullName ?? "");
    setUsername(profile?.username ?? user?.username ?? "");
    setEditing(true);
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({ title: "Only JPG and PNG are supported", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }

    setAvatarUploading(true);
    try {
      // Step 1 — request presigned upload URL
      const { uploadURL, objectPath } = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      }).then(async (r) => {
        if (!r.ok) throw new Error("Could not get upload URL");
        return r.json() as Promise<{ uploadURL: string; objectPath: string }>;
      });

      // Step 2 — upload directly to GCS
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      const servingUrl = `/api/storage${objectPath}`;
      setLocalAvatarUrl(servingUrl);

      // Step 3 — auto-save avatar immediately
      upsertProfile.mutate(
        {
          username: profile?.username ?? "",
          displayName: profile?.displayName ?? user?.fullName ?? "",
          avatarUrl: servingUrl,
        },
        {
          onSuccess: () =>
            toast({ title: "Profile photo updated", description: "Your new photo has been saved." }),
          onError: () =>
            toast({ title: "Failed to save photo", variant: "destructive" }),
        },
      );
    } catch (err) {
      toast({ title: (err as Error).message || "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  function saveProfile() {
    upsertProfile.mutate(
      {
        username,
        displayName,
        avatarUrl: localAvatarUrl ?? profile?.avatarUrl ?? user?.imageUrl ?? undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Profile Updated", description: "Your profile changes have been saved." });
          setEditing(false);
        },
        onError: (err: Error) =>
          toast({ title: err.message, variant: "destructive" }),
      },
    );
  }

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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleAvatarSelect}
          />

          <div className="flex items-center gap-4">
            {/* Clickable avatar with glassmorphism camera overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading || upsertProfile.isPending}
              title="Change profile photo"
              className="relative w-14 h-14 rounded-full group shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-wait"
            >
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
              {/* Glassmorphism hover overlay */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-disabled:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
              >
                {avatarUploading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
              {/* Camera badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                <Camera className="w-2.5 h-2.5 text-black" />
              </div>
            </button>

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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading || upsertProfile.isPending}
                className="text-xs text-muted-foreground hover:text-primary mt-1 transition-colors disabled:opacity-50"
              >
                {avatarUploading ? "Uploading…" : "Edit photo"}
              </button>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Username</label>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. john_doe"
                />
                <p className="text-xs text-muted-foreground mt-1">Letters, numbers and underscores only.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={upsertProfile.isPending}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {upsertProfile.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startEditing} className="text-sm text-primary hover:underline">
              Edit profile
            </button>
          )}
        </div>
      </section>

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
