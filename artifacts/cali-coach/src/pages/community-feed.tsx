/**
 * Community Feed — scrollable video card feed with exercise filter,
 * fire (like) + comment interactions, glassmorphism/neon styling.
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  MessageCircle,
  CheckCircle2,
  Shield,
  ChevronDown,
  X,
  Send,
  Video,
  Loader2,
  Users,
} from "lucide-react";
import { useUser } from "@clerk/react";
import {
  useCommunityFeed,
  useToggleLike,
  usePostComments,
  useAddComment,
  type FeedPost,
  type FeedComment,
} from "@/lib/community-feed";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Exercise filter options ──────────────────────────────────────────────────

const EXERCISE_FILTERS = [
  { value: "all",       label: "All" },
  { value: "push-up",  label: "Push-Up" },
  { value: "pull-up",  label: "Pull-Up" },
  { value: "dip",      label: "Dips" },
  { value: "squat",    label: "Squats" },
  { value: "planche",  label: "Planche" },
  { value: "muscle-up",label: "Muscle-Up" },
  { value: "l-sit",    label: "L-Sit" },
  { value: "handstand",label: "Handstand" },
];

// ─── Branch colours ───────────────────────────────────────────────────────────

const BRANCH_NEON: Record<string, string> = {
  push: "#f97316",
  pull: "#3b82f6",
  core: "#a855f7",
  legs: "#10b981",
};

function exerciseToColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("push") || n.includes("dip") || n.includes("planche")) return BRANCH_NEON.push;
  if (n.includes("pull") || n.includes("muscle") || n.includes("row"))   return BRANCH_NEON.pull;
  if (n.includes("sit") || n.includes("plank") || n.includes("core"))    return BRANCH_NEON.core;
  if (n.includes("squat") || n.includes("lunge") || n.includes("pistol"))return BRANCH_NEON.legs;
  return "#22c55e";
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 8 }: { url: string | null; name: string; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn(sz, "rounded-full object-cover shrink-0 ring-1 ring-white/10")}
      />
    );
  }
  return (
    <div
      className={cn(sz, "rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-xs")}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ post }: { post: FeedPost }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying]       = useState(false);
  const [showComments, setShowComments] = useState(false);

  const toggleLike    = useToggleLike(post.id);
  const accentColor   = exerciseToColor(post.exerciseName);

  const handleTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const handleLike = () => {
    toggleLike.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-white/[0.08] backdrop-blur-sm"
      style={{
        background: "linear-gradient(145deg, rgba(15,23,42,0.92) 0%, rgba(10,15,30,0.95) 100%)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <Avatar url={post.avatarUrl} name={post.displayName} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white truncate">{post.displayName}</span>
            {post.isAiVerified ? (
              <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">
                <CheckCircle2 className="w-2.5 h-2.5" />
                AI Verified
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-400/10 px-1.5 py-0.5 rounded-full border border-slate-400/20">
                <Shield className="w-2.5 h-2.5" />
                Self-Reported
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}18`,
                border: `1px solid ${accentColor}30`,
              }}
            >
              {post.exerciseName}
            </span>
            <span className="text-[10px] text-white/30">{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ── Video panel ────────────────────────────────────────────────────── */}
      {post.videoUrl ? (
        <div
          className="relative bg-black cursor-pointer"
          style={{ aspectRatio: "16/9" }}
          onClick={handleTogglePlay}
        >
          <video
            ref={videoRef}
            src={post.videoUrl}
            className="w-full h-full object-contain"
            loop
            playsInline
            muted
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            data-no-swipe
          />
          {/* Play overlay */}
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[16px] border-l-white ml-1" />
              </div>
            </div>
          )}
          {/* Neon accent line at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center bg-slate-900/60 text-white/20"
          style={{ aspectRatio: "16/9" }}
        >
          <div className="flex flex-col items-center gap-2">
            <Video className="w-8 h-8 opacity-30" />
            <span className="text-xs opacity-40">No clip attached</span>
          </div>
        </div>
      )}

      {/* ── Caption ────────────────────────────────────────────────────────── */}
      {post.caption && (
        <div className="px-4 pt-3">
          <p className="text-sm text-white/70 leading-relaxed">{post.caption}</p>
        </div>
      )}

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Fire button */}
        <button
          onClick={handleLike}
          disabled={toggleLike.isPending}
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold transition-all active:scale-110",
            post.likedByMe ? "text-orange-400" : "text-white/40 hover:text-orange-400",
          )}
        >
          <Flame
            className={cn(
              "w-5 h-5 transition-all",
              post.likedByMe && "fill-orange-400",
            )}
          />
          <span className="tabular-nums">{post.likeCount}</span>
        </button>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold transition-colors",
            showComments ? "text-cyan-400" : "text-white/40 hover:text-cyan-400",
          )}
        >
          <MessageCircle className={cn("w-5 h-5", showComments && "fill-cyan-400/20")} />
          <span>Comment</span>
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform", showComments && "rotate-180")}
          />
        </button>
      </div>

      {/* ── Comments section ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <CommentsPanel postId={post.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Comments panel ───────────────────────────────────────────────────────────

function CommentsPanel({ postId }: { postId: number }) {
  const { user } = useUser();
  const { data: comments, isLoading } = usePostComments(postId);
  const addComment = useAddComment(postId);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment.mutate(text.trim(), { onSuccess: () => setText("") });
  };

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Comment list */}
      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-white/30" />
          </div>
        )}
        {!isLoading && (!comments || comments.length === 0) && (
          <p className="text-xs text-white/25 text-center py-2">No comments yet. Be first!</p>
        )}
        {comments?.map((c: FeedComment) => (
          <div key={c.id} className="flex gap-2.5 items-start">
            <Avatar url={c.avatarUrl} name={c.displayName} size={6} />
            <div className="flex-1 bg-white/[0.04] rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-white/80">{c.displayName} </span>
              <span className="text-xs text-white/55">{c.content}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-400/40 transition-colors"
            maxLength={280}
          />
          <button
            type="submit"
            disabled={!text.trim() || addComment.isPending}
            className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-400/20 disabled:opacity-40 transition-colors shrink-0"
          >
            {addComment.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      ) : (
        <p className="text-xs text-white/30 text-center">Sign in to comment</p>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFeed({ filter }: { filter: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-24 gap-4 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
      >
        <Users className="w-7 h-7 text-primary/60" />
      </div>
      <div>
        <p className="font-semibold text-white/60">
          {filter === "all" ? "No posts yet" : `No ${filter} posts yet`}
        </p>
        <p className="text-sm text-white/30 mt-1">
          Share a clip after your next workout to be the first!
        </p>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CommunityFeedPage() {
  const [filter, setFilter] = useState("all");
  const { data: posts, isLoading, error } = useCommunityFeed(filter);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Community
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Workouts from athletes around the world</p>
        </div>
        {/* Neon accent dot */}
        <div
          className="w-2 h-2 rounded-full mt-3 shrink-0"
          style={{ backgroundColor: "#22c55e", boxShadow: "0 0 8px 3px rgba(34,197,94,0.5)" }}
        />
      </div>

      {/* ── Exercise filter chips ───────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" data-no-swipe>
        {EXERCISE_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-white/[0.04] text-white/40 border-white/10 hover:border-white/20 hover:text-white/60",
              )}
              style={
                active
                  ? { boxShadow: "0 0 10px rgba(34,197,94,0.25)" }
                  : undefined
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── Feed ───────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse"
              style={{ background: "rgba(15,23,42,0.6)" }}
            >
              <div className="p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-1/3" />
                  <div className="h-2.5 bg-white/[0.07] rounded w-1/4" />
                </div>
              </div>
              <div className="bg-white/[0.04]" style={{ aspectRatio: "16/9" }} />
              <div className="p-4 h-10" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-400/70 text-sm">
          Failed to load feed. Please try again.
        </div>
      )}

      {!isLoading && !error && posts && posts.length === 0 && (
        <EmptyFeed filter={filter} />
      )}

      {!isLoading && !error && posts && posts.length > 0 && (
        <div className="space-y-4 pb-8">
          {posts.map((post) => (
            <VideoCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
