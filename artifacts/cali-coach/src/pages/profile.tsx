import { useParams, Link } from "wouter";
import { Show } from "@clerk/react";
import React from "react";
import {
  ArrowLeft,
  Lock,
  Globe,
  Users,
  UserPlus,
  UserCheck,
  Trophy,
  Dumbbell,
  Medal,
  Pencil,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  useFriendProfile,
  useMyProfile,
  useSendFriendRequest,
  useRespondToRequest,
} from "@/lib/social";
import { evaluateSkillTree, type SessionSummary } from "@/lib/skill-tree";
import { getBadge } from "@/lib/badge-status";
import { BadgeGallery } from "@/components/badge-gallery";
import { MasteryGallery } from "@/components/mastery-gallery";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type ExerciseStatsMap } from "@/lib/exercise-mastery";

// ─── Error boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; message: string }

class ProfileErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    return { hasError: true, message: err instanceof Error ? err.message : "Unknown error" };
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-2">Could not load this profile.</p>
          <p className="text-xs text-destructive mb-4">{this.state.message}</p>
          <Link href="/friends" className="text-primary text-sm hover:underline">
            ← Back to Friends
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRANCH_COLORS: Record<string, string> = {
  PUSH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PULL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CORE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  LEGS: "bg-green-500/20 text-green-400 border-green-500/30",
};

function PrivacyBadge({ level }: { level: string }) {
  if (level === "public")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <Globe className="w-3 h-3" /> Public
      </span>
    );
  if (level === "friends")
    return (
      <span className="flex items-center gap-1 text-xs text-blue-400">
        <Users className="w-3 h-3" /> Friends Only
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="w-3 h-3" /> Private
    </span>
  );
}

function FormMasteryRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        strokeDashoffset={circ / 4}
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="44" textAnchor="middle" className="fill-foreground" fontSize="18" fontWeight="bold">
        {score}%
      </text>
      <text x="48" y="60" textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        Mastery
      </text>
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

function ProfileContent() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: myProfile } = useMyProfile();
  const { data: profile, isLoading, error } = useFriendProfile(username);
  const sendRequest = useSendFriendRequest();
  const respondRequest = useRespondToRequest();

  function handleSendRequest() {
    sendRequest.mutate(username, {
      onSuccess: () => toast({ title: "Friend request sent!" }),
      onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
    });
  }

  function handleAccept(id: number) {
    respondRequest.mutate(
      { id, action: "accept" },
      { onSuccess: () => toast({ title: "Friend added!" }) },
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">User not found.</p>
        <Link href="/friends" className="text-primary text-sm mt-2 inline-block hover:underline">
          ← Back to Friends
        </Link>
      </div>
    );
  }

  // Safe destructure — all optional fields default to safe values
  const {
    user,
    hidden = false,
    sessions = null,
    formMastery = null,
    totalSessions = 0,
    totalReps = 0,
    lifetimeReps,
    earnedMilestoneBadges,
    exerciseStats,
  } = profile;

  const safeLifetimeReps = lifetimeReps ?? { push: 0, pull: 0, core: 0, legs: 0 };
  const safeBadgeIds = Array.isArray(earnedMilestoneBadges) ? earnedMilestoneBadges : [];
  const safeExerciseStats: ExerciseStatsMap = (
    exerciseStats && typeof exerciseStats === "object" && !Array.isArray(exerciseStats)
      ? exerciseStats
      : {}
  ) as ExerciseStatsMap;

  // Compute skill tree safely
  let skillTree = null;
  try {
    skillTree = sessions && !hidden ? evaluateSkillTree(sessions as SessionSummary[]) : null;
  } catch {
    skillTree = null;
  }

  const masteredSkills = skillTree?.filter((s) => s.status === "mastered") ?? [];
  const eliteBadges    = skillTree?.filter((s) => s.level === 5 && s.status === "mastered") ?? [];
  const inProgressSkills = skillTree?.filter(
    (s) => s.status === "unlocked" && s.progress.qualifyingSessions > 0,
  ) ?? [];

  const { friendRequestStatus, friendRequestId, friendRequestFromMe } = profile as any;

  const isOwnProfile = !!myProfile && myProfile.id === user.id;
  const displayName = user.displayName || user.username || "Athlete";

  return (
    <div className="p-6 max-w-2xl">
      {/* Back */}
      <Link
        href="/friends"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Friends
      </Link>

      {/* User header */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4 flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
            {displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{displayName}</h1>
            {(() => {
              const badge = getBadge(masteredSkills.length);
              return badge ? (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border",
                  badge.bgColor, badge.textColor, badge.borderColor,
                )}>
                  <span>{badge.icon}</span>
                  {badge.label}
                </span>
              ) : null;
            })()}
          </div>
          <div className="text-sm text-muted-foreground">@{user.username}</div>
          <div className="mt-1">
            <PrivacyBadge level={user.privacyLevel} />
          </div>
        </div>

        {/* Own profile → Edit button; other user → friend request controls */}
        <Show when="signed-in">
          {isOwnProfile ? (
            <button
              onClick={() => setLocation("/settings")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <>
              {!friendRequestStatus && (
                <button
                  onClick={handleSendRequest}
                  disabled={sendRequest.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </button>
              )}
              {friendRequestStatus === "pending" && friendRequestFromMe && (
                <span className="text-xs text-muted-foreground px-3 py-2 rounded-lg border border-border">
                  Request Sent
                </span>
              )}
              {friendRequestStatus === "pending" && !friendRequestFromMe && (
                <button
                  onClick={() => handleAccept(friendRequestId)}
                  disabled={respondRequest.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  Accept Request
                </button>
              )}
              {friendRequestStatus === "accepted" && (
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Friends
                </span>
              )}
            </>
          )}
        </Show>
      </div>

      {/* Hidden profile */}
      {hidden && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Profile is private</h3>
          <p className="text-sm text-muted-foreground">
            {user.privacyLevel === "private"
              ? "This user has set their profile to private."
              : "You need to be friends to view this profile."}
          </p>
        </div>
      )}

      {/* Stats */}
      {!hidden && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-primary">{totalSessions}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sessions</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold">{totalReps}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Reps</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{masteredSkills.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Skills Mastered</div>
            </div>
          </div>

          {/* Form mastery ring */}
          {formMastery !== null && (
            <div className="rounded-xl border border-border bg-card p-5 mb-4 flex items-center gap-6">
              <FormMasteryRing score={formMastery} />
              <div>
                <h2 className="font-semibold mb-1">Overall Form Mastery</h2>
                <p className="text-sm text-muted-foreground">
                  {formMastery >= 90
                    ? "Outstanding form across all exercises."
                    : formMastery >= 75
                      ? "Strong, consistent form quality."
                      : formMastery >= 60
                        ? "Good form with room to improve."
                        : "Still developing form consistency."}
                </p>
              </div>
            </div>
          )}

          {/* ── Mastery Gallery ───────────────────────────────────── */}
          <section className="mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Mastery Gallery
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <MasteryGallery exerciseStats={safeExerciseStats} />
            </div>
          </section>

          {/* ── Volume Badges ─────────────────────────────────────── */}
          {(safeBadgeIds.length > 0 ||
            safeLifetimeReps.push + safeLifetimeReps.pull +
            safeLifetimeReps.core + safeLifetimeReps.legs > 0) && (
            <section className="mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Medal className="w-4 h-4 text-primary" />
                Volume Badges
              </h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <BadgeGallery
                  earnedBadgeIds={safeBadgeIds}
                  lifetimeReps={safeLifetimeReps}
                />
              </div>
            </section>
          )}

          {/* ── Elite Mastery Badges ──────────────────────────────── */}
          {eliteBadges.length > 0 && (
            <section className="mb-4">
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-4">
                <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  🏆 Elite Mastery Badges
                </h2>
                <div className="flex flex-wrap gap-2">
                  {eliteBadges.map((skill) => {
                    const pillClass =
                      skill.branch === "PUSH"
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-orange-500/20"
                        : skill.branch === "PULL"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/20"
                          : skill.branch === "CORE"
                            ? "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-violet-500/20"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20";
                    const emoji =
                      skill.branch === "PUSH" ? "💪"
                      : skill.branch === "PULL" ? "🔵"
                      : skill.branch === "CORE" ? "⚡"
                      : "🟢";
                    return (
                      <div
                        key={skill.id}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border shadow-md",
                          pillClass,
                        )}
                      >
                        <span>{emoji}</span>
                        {skill.title}
                        <span className="text-yellow-400">★</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Mastered skills */}
          {masteredSkills.length > 0 && (
            <section className="mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Mastered Skills ({masteredSkills.length})
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {masteredSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium flex items-center gap-2",
                      BRANCH_COLORS[skill.branch] ?? "",
                    )}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{skill.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* In-progress skills */}
          {inProgressSkills.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                In Progress ({inProgressSkills.length})
              </h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {inProgressSkills.map((skill, i) => {
                  const req    = skill.masteryRequirement.minQualifyingSessions;
                  const capped = Math.min(skill.progress.qualifyingSessions, req);
                  const pct    = Math.min(100, (capped / req) * 100);
                  return (
                    <div key={skill.id} className={cn("p-3", i !== 0 && "border-t border-border")}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{skill.title}</span>
                        <span className="text-xs text-muted-foreground">{capped}/{req}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {masteredSkills.length === 0 && inProgressSkills.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No workout data to display yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ProfilePage() {
  return (
    <ProfileErrorBoundary>
      <ProfileContent />
    </ProfileErrorBoundary>
  );
}
