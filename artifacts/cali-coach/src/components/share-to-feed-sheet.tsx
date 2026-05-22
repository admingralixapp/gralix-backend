/**
 * ShareToFeedSheet — bottom sheet for sharing a workout clip to the Community Feed.
 *
 * Supports two modes:
 *  1. blob mode   — user has a fresh Blob; uses BackgroundUploadManager for
 *                   non-blocking upload that survives tab navigation.
 *  2. repost mode — clip already uploaded (objectPath provided); skips the
 *                   upload step and posts directly.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreatePost } from "@/lib/community-feed";
import { useUploadManager } from "@/lib/upload-manager";
import { useUser } from "@clerk/react";

interface ShareToFeedSheetProps {
  exerciseName:       string;
  isAiVerified:       boolean;
  sessionId?:         number;
  onClose:            () => void;
  /** Fresh recording blob — triggers upload via BackgroundUploadManager. */
  blob?:              Blob;
  /** Existing storage path — skips re-upload, posts immediately. */
  existingObjectPath?: string;
}

export function ShareToFeedSheet({
  exerciseName,
  isAiVerified,
  sessionId,
  onClose,
  blob,
  existingObjectPath,
}: ShareToFeedSheetProps) {
  const { user }         = useUser();
  const [caption, setCaption] = useState("");
  const [stage, setStage]     = useState<"idle" | "posting" | "done">("idle");
  const { enqueue }      = useUploadManager();
  const createPost       = useCreatePost();

  const handleShare = async () => {
    if (!user) return;

    if (existingObjectPath) {
      // ── Repost mode: clip already in storage, just create the post ──────────
      setStage("posting");
      try {
        await createPost.mutateAsync({
          exerciseName,
          caption:         caption.trim(),
          videoObjectPath: existingObjectPath,
          isAiVerified,
          sessionId,
        });
        setStage("done");
        setTimeout(onClose, 1_800);
      } catch {
        setStage("idle");
      }
    } else if (blob) {
      // ── Upload mode: hand off to BackgroundUploadManager and close ───────────
      enqueue({
        blob,
        sessionId:    sessionId ?? 0,
        exerciseName,
        isAiVerified,
        mode:         "feed",
        caption:      caption.trim(),
      });
      setStage("done");
      setTimeout(onClose, 900);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="w-full max-w-lg rounded-t-3xl border border-white/[0.08] overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, rgba(12,18,36,0.98) 0%, rgba(8,12,24,0.99) 100%)",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              <span className="font-bold text-white">Share to Community</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pb-6 space-y-4">
            {/* Tags */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-full">
                {exerciseName}
              </span>
              {isAiVerified && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                  style={{ color: "#177548", borderColor: "#177548", background: "rgba(23,117,72,0.07)" }}>
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Form Verified
                </span>
              )}
              {existingObjectPath && (
                <span className="text-[10px] text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  Saved clip
                </span>
              )}
            </div>

            {/* Caption */}
            <div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption… (optional)"
                rows={3}
                maxLength={280}
                disabled={stage !== "idle"}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 transition-colors resize-none"
              />
              <div className="text-right text-[10px] text-white/25 mt-0.5">
                {caption.length}/280
              </div>
            </div>

            {/* Upload starting info for blob mode */}
            {blob && stage === "done" && (
              <div className="flex items-center gap-2 text-emerald-400 py-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">Upload started — you can browse freely!</span>
              </div>
            )}

            {/* Posting state */}
            {stage === "posting" && (
              <div className="flex items-center gap-2 text-white/50 py-1">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                <span className="text-sm">Publishing post…</span>
              </div>
            )}

            {/* Done state (repost mode) */}
            {stage === "done" && existingObjectPath && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 py-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Posted to Community!</span>
              </div>
            )}

            {/* Action buttons */}
            {stage === "idle" && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/15 text-white/60 hover:bg-white/5"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 font-bold gap-2"
                  onClick={() => void handleShare()}
                  disabled={!user}
                >
                  <Share2 className="w-4 h-4" />
                  {existingObjectPath ? "Post Clip" : "Share Clip"}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
