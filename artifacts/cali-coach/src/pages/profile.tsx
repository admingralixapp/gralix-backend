import { useParams, Link } from "wouter";
import { Show } from "@clerk/react";
import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Camera,
  MoreHorizontal,
  Video,
  X,
  CheckCircle2,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  useFriendProfile,
  useMyProfile,
  useUpsertProfile,
  useSendFriendRequest,
  useRespondToRequest,
} from "@/lib/social";
import { useMyPosts, useDeletePost, useUpdatePost } from "@/lib/community-feed";
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

  const qc = useQueryClient();
  const { data: myProfile } = useMyProfile();
  const { data: profile, isLoading, error } = useFriendProfile(username);
  const sendRequest    = useSendFriendRequest();
  const respondRequest = useRespondToRequest();
  const upsertProfile  = useUpsertProfile();
  const deletePost     = useDeletePost();
  const updatePost     = useUpdatePost();
  const { data: myPosts } = useMyPosts();

  // Edit-profile modal state
  const [editOpen,     setEditOpen]     = useState(false);
  const [editName,     setEditName]     = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUrl,  setLocalAvatarUrl]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post management state
  const [menuPostId,  setMenuPostId]  = useState<number | null>(null);
  const [editPostId,  setEditPostId]  = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState("");

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
      const { uploadURL, objectPath } = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      }).then(async (r) => {
        if (!r.ok) throw new Error("Could not get upload URL");
        return r.json() as Promise<{ uploadURL: string; objectPath: string }>;
      });
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");
      const servingUrl = `/api/storage${objectPath}`;
      setLocalAvatarUrl(servingUrl);
      upsertProfile.mutate(
        {
          username: profile?.user.username ?? "",
          displayName: profile?.user.displayName ?? "",
          avatarUrl: servingUrl,
        },
        {
          onSuccess: () => toast({ title: "Profile photo updated" }),
          onError: () => toast({ title: "Failed to save photo", variant: "destructive" }),
        },
      );
    } catch (err) {
      toast({ title: (err as Error).message || "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  function openEditModal() {
    setEditName(profile?.user.displayName ?? "");
    setEditUsername(profile?.user.username ?? "");
    setEditOpen(true);
  }

  function handleSaveProfile() {
    if (!editName.trim() || !editUsername.trim()) return;
    upsertProfile.mutate(
      { displayName: editName.trim(), username: editUsername.trim() },
      {
        onSuccess: () => {
          toast({ title: "Profile updated" });
          setEditOpen(false);
          // Invalidate all profile queries so leaderboard/community reflect new username
          void qc.invalidateQueries();
          // Navigate to new profile URL if username changed
          if (editUsername.trim() !== username) {
            setLocation(`/profile/${editUsername.trim()}`);
          }
        },
        onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
      },
    );
  }

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
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Change Name or Username
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

          {/* ── My Posts ─────────────────────────────────────────────────── */}
          {isOwnProfile && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                My Posts
              </h2>

              {(!myPosts || myPosts.length === 0) ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <Video className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No posts yet</p>
                  <p className="text-xs text-muted-foreground">
                    You haven't shared any workouts yet. Master a skill and share it with the community!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {myPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                      {/* Post header */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{post.exerciseName}</span>
                          {post.isAiVerified && (
                            <span className="flex items-center gap-0.5 text-xs text-primary font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              AI Verified
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                            className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuPostId === post.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border bg-card shadow-xl z-10 overflow-hidden">
                              <button
                                onClick={() => {
                                  setEditCaption(post.caption ?? "");
                                  setEditPostId(post.id);
                                  setMenuPostId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/60 transition-colors"
                              >
                                Edit Caption
                              </button>
                              <button
                                onClick={() => {
                                  if (!window.confirm("Delete this post? This cannot be undone.")) return;
                                  deletePost.mutate(post.id, {
                                    onSuccess: () => toast({ title: "Post deleted" }),
                                    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
                                  });
                                  setMenuPostId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Video */}
                      {post.videoUrl && (
                        <div className="aspect-video bg-black">
                          <video
                            src={post.videoUrl}
                            className="w-full h-full object-cover"
                            controls
                            muted
                            playsInline
                            crossOrigin="anonymous"
                            preload="metadata"
                            onError={(e) => {
                              const v = e.currentTarget;
                              console.error("[MyPosts] video error", {
                                src: v.src,
                                networkState: v.networkState,
                                readyState: v.readyState,
                                errorCode: v.error?.code,
                                errorMsg: v.error?.message,
                              });
                            }}
                          />
                        </div>
                      )}

                      {/* Caption + meta */}
                      <div className="px-4 py-3">
                        {post.caption && (
                          <p className="text-sm mb-2">{post.caption}</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>🔥 {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span>
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ── Edit profile modal ────────────────────────────────────────────── */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar section */}
            <div className="flex flex-col items-center mb-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative w-20 h-20 rounded-full group focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(localAvatarUrl ?? profile?.user.avatarUrl) ? (
                  <img
                    src={localAvatarUrl ?? profile?.user.avatarUrl ?? ""}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                    {(profile?.user.displayName ?? "U")[0].toUpperCase()}
                  </div>
                )}
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-disabled:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
                >
                  {avatarUploading
                    ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Camera className="w-6 h-6 text-white" />
                  }
                </div>
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {avatarUploading ? "Uploading…" : "Tap to change photo"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Display Name
                </label>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={128}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <input
                    value={editUsername}
                    onChange={(e) =>
                      setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    maxLength={32}
                    placeholder="e.g. john_doe"
                    className="w-full pl-7 pr-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Letters, numbers and underscores only.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={upsertProfile.isPending || !editName.trim() || !editUsername.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {upsertProfile.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => setEditOpen(false)}
                disabled={upsertProfile.isPending}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit caption modal ────────────────────────────────────────────── */}
      {editPostId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditPostId(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Caption</h2>
              <button onClick={() => setEditPostId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="What was this workout like?"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  updatePost.mutate(
                    { postId: editPostId, caption: editCaption },
                    {
                      onSuccess: () => { toast({ title: "Caption updated" }); setEditPostId(null); },
                      onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
                    },
                  );
                }}
                disabled={updatePost.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updatePost.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditPostId(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
