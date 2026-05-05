/**
 * ShareToFeedSheet — bottom sheet that appears after POV Review,
 * letting the user add a caption and share the video clip to the Community Feed.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X, Loader2, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadVideoBlob, useCreatePost } from "@/lib/community-feed";
import { useUser } from "@clerk/react";

interface ShareToFeedSheetProps {
  blob: Blob;
  exerciseName: string;
  isAiVerified: boolean;
  sessionId?: number;
  onClose: () => void;
}

export function ShareToFeedSheet({
  blob,
  exerciseName,
  isAiVerified,
  sessionId,
  onClose,
}: ShareToFeedSheetProps) {
  const { user } = useUser();
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<"idle" | "uploading" | "posting" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const createPost = useCreatePost();

  const handleShare = async () => {
    if (!user) return;
    setStage("uploading");

    // Simulate upload progress ticks while the real upload runs
    const ticker = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 8, 88));
    }, 250);

    try {
      const objectPath = await uploadVideoBlob(blob, exerciseName);
      clearInterval(ticker);
      setUploadProgress(100);
      setStage("posting");

      await createPost.mutateAsync({
        exerciseName,
        caption: caption.trim(),
        videoObjectPath: objectPath,
        isAiVerified,
        sessionId,
      });

      setStage("done");
      setTimeout(onClose, 1800);
    } catch {
      clearInterval(ticker);
      setStage("idle");
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
            background: "linear-gradient(160deg, rgba(12,18,36,0.98) 0%, rgba(8,12,24,0.99) 100%)",
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
            {/* Exercise tag */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-full">
                {exerciseName}
              </span>
              {isAiVerified && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  AI Verified
                </span>
              )}
            </div>

            {/* Caption input */}
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

            {/* Upload progress bar */}
            {(stage === "uploading" || stage === "posting") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    {stage === "uploading" ? (
                      <>
                        <Upload className="w-3 h-3 animate-bounce" />
                        Uploading clip…
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Publishing post…
                      </>
                    )}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${uploadProgress}%` }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            )}

            {/* Done state */}
            {stage === "done" && (
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
                  Share Clip
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
