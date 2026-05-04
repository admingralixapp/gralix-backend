import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Bell, Shield, LogOut, User, CheckCircle2, BellOff } from "lucide-react";
import { useMyProfile, useUpdatePrivacy, useUpsertProfile } from "@/lib/social";
import { useToast } from "@/hooks/use-toast";
import {
  useMobilityStatus,
  useUpdateMobilitySettings,
  requestNotificationPermission,
} from "@/lib/use-mobility";
import { GOAL_OPTIONS, type MobilityGoal } from "@/lib/mobility-service";

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

export function Settings() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updatePrivacy = useUpdatePrivacy();
  const upsertProfile = useUpsertProfile();
  const { toast } = useToast();

  const { data: mobilityStatus } = useMobilityStatus();
  const updateMobilitySettings = useUpdateMobilitySettings();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);

  // Notification settings local state
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState("08:00");
  const [notifGoal, setNotifGoal] = useState<MobilityGoal>("general");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [savingNotif, setSavingNotif] = useState(false);

  // Sync local state from server data
  useEffect(() => {
    if (!mobilityStatus?.settings) return;
    setNotifEnabled(mobilityStatus.settings.enabled);
    setNotifTime(mobilityStatus.settings.notificationTime);
    setNotifGoal((mobilityStatus.settings.mobilityGoal as MobilityGoal) ?? "general");
  }, [mobilityStatus?.settings]);

  // Check notification permission on mount
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

  function startEditing() {
    setDisplayName(profile?.displayName ?? user?.fullName ?? "");
    setUsername(profile?.username ?? user?.username ?? "");
    setEditing(true);
  }

  function saveProfile() {
    upsertProfile.mutate(
      {
        username,
        displayName,
        avatarUrl: user?.imageUrl ?? undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Profile saved" });
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
          description:
            "Please allow notifications in your browser settings, then try again.",
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Account */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <User className="w-4 h-4" />
          Account
        </h2>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Avatar + email */}
          <div className="flex items-center gap-4">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="avatar"
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                {(profile?.displayName ?? user.firstName ?? "U")[0].toUpperCase()}
              </div>
            )}
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
            </div>
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Display Name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. john_doe"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Letters, numbers and underscores only.
                </p>
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
            <button
              onClick={startEditing}
              className="text-sm text-primary hover:underline"
            >
              Edit profile
            </button>
          )}
        </div>
      </section>

      {/* Daily Mobility Notifications */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Daily Mobility Reminders
        </h2>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Toggle */}
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

          {/* Permission warning */}
          {notifEnabled && notifPermission === "denied" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <BellOff className="w-4 h-4 shrink-0" />
              Notifications are blocked in your browser. Please allow them in your
              browser/OS settings and reload the page.
            </div>
          )}

          {/* Reminder time */}
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
                    <option key={value} value={value}>
                      {label}
                    </option>
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

      {/* Privacy */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Profile Privacy
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {PRIVACY_OPTIONS.map(({ value, label, desc }, i) => {
            const active = currentPrivacy === value;
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

      {/* Sign out */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          Session
        </h2>
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
