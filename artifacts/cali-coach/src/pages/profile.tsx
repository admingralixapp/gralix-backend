import { useParams, Link } from "wouter";
import { EmojiIcon } from "@/components/emoji-icon";
import { Show } from "@clerk/react";
import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
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
  X,
  CheckCircle2,
  ShieldCheck,
  Ruler,
  RefreshCw,
  Target,
  Save,
  Search,
  Info,
  Microscope,
  ChevronDown,
  Zap,
} from "lucide-react";
import { getApeInsight, getTorsoLegInsight, getMechanicalEdge } from "@/lib/bio-insights";
import { useLocation } from "wouter";
import {
  useFriendProfile,
  useMyProfile,
  useUpsertProfile,
  useSendFriendRequest,
  useRespondToRequest,
  useUpdatePhysicalStats,
} from "@/lib/social";
import { evaluateSkillTree, ALL_SKILL_NODES, type SessionSummary } from "@/lib/skill-tree";
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
  // Edit-profile modal state
  const [editOpen,     setEditOpen]     = useState(false);
  const [editName,     setEditName]     = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUrl,  setLocalAvatarUrl]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bio edit modal state
  const [bioEditOpen,       setBioEditOpen]       = useState(false);
  const [bioHeight,         setBioHeight]         = useState("");
  const [bioWeight,         setBioWeight]         = useState("");
  const [bioGoal,           setBioGoal]           = useState<"mobility" | "strength" | "skill" | "">("");
  const [bioTargetSkillId,  setBioTargetSkillId]  = useState<string>("");
  const [skillSearch,       setSkillSearch]       = useState("");
  const updatePhysical = useUpdatePhysicalStats();

  // Bio insight toggle state
  const [apeInsightOpen,    setApeInsightOpen]    = useState(false);
  const [torsoInsightOpen,  setTorsoInsightOpen]  = useState(false);

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

  // ── Biomechanical computations (own profile only) ──────────────────────────
  const calData = myProfile?.calibrationData ?? null;
  const apeIndex = calData
    ? parseFloat((calData.wingspan / calData.height).toFixed(2))
    : null;
  const scaleFactor = calData && myProfile?.heightCm
    ? myProfile.heightCm / calData.height
    : null;
  const torsoLengthCm = scaleFactor && calData
    ? Math.round(calData.torsoLength * scaleFactor)
    : null;
  const legLengthCm = scaleFactor && calData
    ? Math.round(calData.legLength * scaleFactor)
    : null;

  // ── Bio insight computations ────────────────────────────────────────────────
  const targetNode = myProfile?.targetSkillId
    ? (ALL_SKILL_NODES.find(n => n.id === myProfile.targetSkillId) ?? null)
    : null;
  const apeInsight = apeIndex !== null ? getApeInsight(apeIndex) : null;
  const torsoLegInsight = (torsoLengthCm !== null && legLengthCm !== null)
    ? getTorsoLegInsight(torsoLengthCm, legLengthCm)
    : null;
  const mechanicalEdge = getMechanicalEdge({
    heightCm:      myProfile?.heightCm ?? null,
    weightKg:      myProfile?.weightKg ?? null,
    apeIndex,
    torsoLengthCm,
    legLengthCm,
    targetNode,
  });

  const GOAL_LABELS: Record<string, string> = {
    mobility: "Mobility & Flexibility",
    strength: "Strength & Power",
    skill:    "Skill & Technique",
  };

  function openBioEdit() {
    setBioHeight(myProfile?.heightCm ? String(Math.round(myProfile.heightCm)) : "");
    setBioWeight(myProfile?.weightKg ? String(Math.round(myProfile.weightKg * 10) / 10) : "");
    setBioGoal((myProfile?.primaryGoal as "mobility" | "strength" | "skill" | "") ?? "");
    setBioTargetSkillId(myProfile?.targetSkillId ?? "");
    setSkillSearch("");
    setBioEditOpen(true);
  }

  async function handleSaveSpecs() {
    const h = parseFloat(bioHeight);
    const w = parseFloat(bioWeight);
    const payload: { heightCm?: number; weightKg?: number; primaryGoal?: string; targetSkillId?: string | null } = {};
    if (!isNaN(h) && h > 0) payload.heightCm = h;
    if (!isNaN(w) && w > 0) payload.weightKg = w;
    if (bioGoal) payload.primaryGoal = bioGoal;
    payload.targetSkillId = bioGoal === "skill" && bioTargetSkillId ? bioTargetSkillId : null;
    try {
      await updatePhysical.mutateAsync(payload);
      toast({ title: "Specs updated!" });
      setBioEditOpen(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }

  // Skill search — filter ALL_SKILL_NODES (non-equipment-specialty) by query
  const filteredSkills = ALL_SKILL_NODES.filter((n) => {
    if (n.equipmentSpecialty) return false;
    if (!skillSearch.trim()) return true;
    return n.title.toLowerCase().includes(skillSearch.toLowerCase());
  });

  const BRANCH_PILL: Record<string, string> = {
    PUSH: "bg-orange-500/20 text-orange-400",
    PULL: "bg-blue-500/20 text-blue-400",
    CORE: "bg-violet-500/20 text-violet-400",
    LEGS: "bg-emerald-500/20 text-emerald-400",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

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
            {(profile as any)?.showVerifiedBadge && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                style={{
                  background: "rgba(168,85,247,0.12)",
                  color: "#a855f7",
                  border: "1px solid rgba(168,85,247,0.35)",
                  filter: "drop-shadow(0 0 6px rgba(168,85,247,0.6))",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Pro
              </span>
            )}
            {(() => {
              const badge = getBadge(masteredSkills.length);
              return badge ? (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border",
                  badge.bgColor, badge.textColor, badge.borderColor,
                )}>
                  <EmojiIcon emoji={badge.icon} className="w-3.5 h-3.5 object-contain shrink-0" />
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

          {/* ── Biomechanical Section (own profile only) ─────────── */}
          {isOwnProfile && (
            <section className="mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary" />
                Biomechanical
              </h2>
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">

                {/* ── Stats grid ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Height */}
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Height</div>
                    <div className="text-base font-bold">
                      {myProfile?.heightCm ? `${Math.round(myProfile.heightCm)} cm` : <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                  </div>
                  {/* Weight */}
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Weight</div>
                    <div className="text-base font-bold">
                      {myProfile?.weightKg ? `${Math.round(myProfile.weightKg * 10) / 10} kg` : <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                  </div>
                  {/* Primary Goal */}
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Primary Goal</div>
                    <div className="text-sm font-semibold">
                      {myProfile?.primaryGoal === "skill" && myProfile?.targetSkillId
                        ? ALL_SKILL_NODES.find(n => n.id === myProfile.targetSkillId)?.title ?? myProfile.targetSkillId
                        : myProfile?.primaryGoal
                          ? GOAL_LABELS[myProfile.primaryGoal] ?? myProfile.primaryGoal
                          : <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                  {/* Ape Index — with insight toggle */}
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ape Index</div>
                      {apeInsight && (
                        <button
                          type="button"
                          onClick={() => setApeInsightOpen(v => !v)}
                          className="flex items-center gap-0.5 text-[9px] font-semibold transition-colors"
                          style={{ color: apeInsightOpen ? "#22c55e" : "rgba(255,255,255,0.3)" }}
                        >
                          <Info className="w-3 h-3" />
                          <ChevronDown className={`w-3 h-3 transition-transform ${apeInsightOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    <div className="text-base font-bold">
                      {apeIndex !== null
                        ? <span className={apeIndex > 1.02 ? "text-primary" : apeIndex < 0.98 ? "text-amber-400" : ""}>
                            {apeIndex > 1 ? `+${((apeIndex - 1) * 100).toFixed(0)}` : apeIndex < 1 ? `${((apeIndex - 1) * 100).toFixed(0)}` : "0"}
                          </span>
                        : <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                    {apeIndex !== null && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {apeIndex > 1.02 ? "Gorilla reach" : apeIndex < 0.98 ? "Compact levers" : "Balanced"}
                      </div>
                    )}
                    {/* Expandable insight */}
                    {apeInsight && apeInsightOpen && (
                      <div
                        className="mt-2 rounded-lg p-2.5 text-[11px] leading-relaxed"
                        style={{
                          background: "rgba(34,197,94,0.07)",
                          border: "1px solid rgba(34,197,94,0.2)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        <span className="font-bold text-primary block mb-0.5">{apeInsight.headline}</span>
                        {apeInsight.detail}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Calibration Ratios — with insight toggle ────────── */}
                {torsoLengthCm !== null && legLengthCm !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Calibration Ratios</div>
                      {torsoLegInsight && (
                        <button
                          type="button"
                          onClick={() => setTorsoInsightOpen(v => !v)}
                          className="flex items-center gap-0.5 text-[9px] font-semibold transition-colors"
                          style={{ color: torsoInsightOpen ? "#22c55e" : "rgba(255,255,255,0.3)" }}
                        >
                          <Info className="w-3 h-3" />
                          <span className="ml-0.5">View Insight</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${torsoInsightOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-20 text-muted-foreground text-xs">Torso</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, (torsoLengthCm / (torsoLengthCm + legLengthCm)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono w-12 text-right">{torsoLengthCm} cm</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-20 text-muted-foreground text-xs">Legs</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (legLengthCm / (torsoLengthCm + legLengthCm)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono w-12 text-right">{legLengthCm} cm</span>
                      </div>
                    </div>
                    {/* Expandable torso/leg insight */}
                    {torsoLegInsight && torsoInsightOpen && (
                      <div
                        className="mt-2 rounded-lg p-2.5 text-[11px] leading-relaxed"
                        style={{
                          background: "rgba(34,197,94,0.07)",
                          border: "1px solid rgba(34,197,94,0.2)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        <span className="font-bold text-primary block mb-0.5">{torsoLegInsight.headline}</span>
                        {torsoLegInsight.detail}
                      </div>
                    )}
                    {calData?.capturedAt && (
                      <div className="text-[10px] text-muted-foreground mt-2">
                        Calibrated {new Date(calData.capturedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Your Mechanical Edge ────────────────────────────── */}
                {(apeIndex !== null || torsoLengthCm !== null) && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "linear-gradient(145deg, rgba(34,197,94,0.08) 0%, rgba(10,15,26,0.6) 100%)",
                      border: "1px solid rgba(34,197,94,0.25)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 0 20px rgba(34,197,94,0.06), inset 0 1px 0 rgba(34,197,94,0.08)",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
                      >
                        <Microscope className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span
                        className="text-[10px] font-black uppercase tracking-[0.15em]"
                        style={{ color: "#22c55e" }}
                      >
                        Your Mechanical Edge
                      </span>
                    </div>

                    {/* Archetype badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: `${mechanicalEdge.accentColor}18`,
                          border: `1px solid ${mechanicalEdge.accentColor}40`,
                          color: mechanicalEdge.accentColor,
                          boxShadow: `0 0 8px ${mechanicalEdge.accentColor}30`,
                        }}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {mechanicalEdge.archetype}
                      </span>
                      {targetNode && (
                        <span className="text-[10px] text-white/30">→ {targetNode.title}</span>
                      )}
                    </div>

                    {/* Biomech fact */}
                    <p className="text-[12px] text-white/75 leading-relaxed mb-2">
                      {mechanicalEdge.biomechFact}
                    </p>

                    {/* Recommendation */}
                    <div
                      className="rounded-lg px-3 py-2 text-[11px] leading-relaxed"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderLeft: `2px solid ${mechanicalEdge.accentColor}60`,
                      }}
                    >
                      <span
                        className="text-[9px] font-black uppercase tracking-wider block mb-1"
                        style={{ color: mechanicalEdge.accentColor }}
                      >
                        Recommendation
                      </span>
                      <span className="text-white/60">{mechanicalEdge.recommendation}</span>
                    </div>
                  </div>
                )}

                {/* ── Action buttons ──────────────────────────────────── */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={openBioEdit}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Specs
                  </button>
                  <button
                    onClick={() => setLocation("/calibration")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Body Recalibration
                  </button>
                </div>
              </div>
            </section>
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
                    const branchEmoji =
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
                        <EmojiIcon emoji={branchEmoji} className="w-4 h-4 object-contain shrink-0" />
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

      {/* ── Edit Specs modal ─────────────────────────────────────────────── */}
      {bioEditOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
            onClick={() => setBioEditOpen(false)}
          />

          {/* Modal — perfectly centred via transform */}
          <div
            className="fixed z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-card shadow-2xl"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              maxHeight: "90dvh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — never scrolls */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Ruler className="w-5 h-5 text-primary" />
                Edit Engine Specs
              </h2>
              <button
                onClick={() => setBioEditOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              {/* Height */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  step="1"
                  value={bioHeight}
                  onChange={(e) => setBioHeight(e.target.value)}
                  placeholder="e.g. 175"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  step="0.1"
                  value={bioWeight}
                  onChange={(e) => setBioWeight(e.target.value)}
                  placeholder="e.g. 75.0"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Primary Goal */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Primary Goal
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(["mobility", "strength", "skill"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setBioGoal(g); if (g !== "skill") setBioTargetSkillId(""); setSkillSearch(""); }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left",
                        bioGoal === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <Target className="w-4 h-4 shrink-0" />
                      <span>{GOAL_LABELS[g]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill picker — visible only when "skill" goal is selected */}
              {bioGoal === "skill" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Target Skill
                  </label>

                  {/* Selected skill banner — always visible at the top */}
                  {bioTargetSkillId ? (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-primary truncate">
                        {ALL_SKILL_NODES.find(n => n.id === bioTargetSkillId)?.title ?? bioTargetSkillId}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBioTargetSkillId("")}
                        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Clear selection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-secondary/40 border border-dashed border-border text-xs text-muted-foreground">
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      Tap a skill below to set your target
                    </div>
                  )}

                  {/* Search bar */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      placeholder="Search skills… e.g. Planche, Muscle-up"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>

                  {/* Skill list */}
                  <div className="rounded-xl border border-border divide-y divide-border/50 max-h-44 overflow-y-auto">
                    {filteredSkills.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">No skills match your search</div>
                    ) : (
                      filteredSkills.map((skill) => {
                        const selected = bioTargetSkillId === skill.id;
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => setBioTargetSkillId(selected ? "" : skill.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors",
                              selected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-secondary/50 text-foreground",
                            )}
                          >
                            <CheckCircle2 className={cn(
                              "w-4 h-4 shrink-0 transition-opacity",
                              selected ? "opacity-100 text-primary" : "opacity-0",
                            )} />
                            <span className="flex-1 truncate">{skill.title}</span>
                            <span className={cn(
                              "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                              BRANCH_PILL[skill.branch] ?? "",
                            )}>
                              {skill.branch}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — never scrolls */}
            <div className="flex gap-2 px-6 py-4 shrink-0 border-t border-border/50">
              <button
                onClick={handleSaveSpecs}
                disabled={updatePhysical.isPending || (bioGoal === "skill" && !bioTargetSkillId)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updatePhysical.isPending ? "Saving…" : "Save Specs"}
              </button>
              <button
                onClick={() => setBioEditOpen(false)}
                disabled={updatePhysical.isPending}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>,
        document.body,
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
