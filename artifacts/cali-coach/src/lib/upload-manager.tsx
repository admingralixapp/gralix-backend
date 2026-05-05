/**
 * BackgroundUploadManager — persists video uploads across tab navigation.
 *
 * Usage:
 *   1. Wrap the app in <UploadManagerProvider>.
 *   2. Call useUploadManager().enqueue({ ... }) to kick off an upload.
 *   3. A floating toast shows progress and survives navigation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadVideoBlob } from "./community-feed";
import { storeClip } from "./clip-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadMode = "history" | "feed";

export interface EnqueueOptions {
  blob:         Blob;
  sessionId:    number;
  exerciseName: string;
  isAiVerified: boolean;
  /** "history" → stores clip in localStorage; "feed" → creates community post */
  mode:         UploadMode;
  caption?:     string;
  onDone?:      (objectPath: string) => void;
}

interface UploadJob {
  id:           string;
  exerciseName: string;
  mode:         UploadMode;
  status:       "uploading" | "posting" | "done" | "error";
  progress:     number;
}

interface UploadManagerCtx {
  enqueue: (opts: EnqueueOptions) => void;
  isActive: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<UploadManagerCtx>({
  enqueue:  () => {},
  isActive: false,
});

export function useUploadManager() {
  return useContext(Ctx);
}

// ─── FloatingUploadBar ────────────────────────────────────────────────────────

function FloatingUploadBar({ jobs }: { jobs: UploadJob[] }) {
  const visible = jobs.filter(
    (j) => j.status !== "done" || jobs.some((jj) => jj.status !== "done"),
  );
  if (visible.length === 0) return null;

  const active = jobs[jobs.length - 1]; // Show the most recent job
  if (!active) return null;

  const isDone  = active.status === "done";
  const isError = active.status === "error";

  return (
    <AnimatePresence>
      <motion.div
        key={active.id}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-[88px] md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
      >
        <div
          className="rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{
            background:   "rgba(10, 15, 25, 0.96)",
            borderColor:  isDone ? "rgba(34,197,94,0.35)" : isError ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Icon */}
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : isError ? (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <Upload className="w-5 h-5 text-primary animate-bounce shrink-0" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">
                {isDone
                  ? active.mode === "feed"
                    ? "Posted to Community! 🎉"
                    : "Saved to History ✓"
                  : isError
                  ? "Upload failed — please retry"
                  : active.status === "posting"
                  ? "Publishing post…"
                  : `Uploading ${active.exerciseName} clip…`}
              </p>

              {!isDone && !isError && (
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${active.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>

            {/* Dismiss (done/error only) */}
            {(isDone || isError) && (
              <div className="w-4 h-4 shrink-0 text-white/30">
                <X className="w-full h-full" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const qc = useQueryClient();
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const updateJob = useCallback(
    (id: string, patch: Partial<UploadJob>) =>
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j))),
    [],
  );

  const removeJob = useCallback(
    (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id)),
    [],
  );

  const enqueue = useCallback(
    (opts: EnqueueOptions) => {
      const id: string = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const job: UploadJob = {
        id,
        exerciseName: opts.exerciseName,
        mode:         opts.mode,
        status:       "uploading",
        progress:     0,
      };
      setJobs((prev) => [...prev, job]);

      // ── Async upload in background ──
      void (async () => {
        // Simulated progress ticks while real upload runs
        const ticker = setInterval(() => {
          updateJob(id, {
            progress: Math.min(
              (jobsRef.current.find((j) => j.id === id)?.progress ?? 0) + 7,
              88,
            ),
          });
        }, 280);

        try {
          const objectPath = await uploadVideoBlob(opts.blob, opts.exerciseName);
          clearInterval(ticker);
          updateJob(id, { progress: 100 });

          if (opts.mode === "history") {
            storeClip({
              sessionId:    opts.sessionId,
              exerciseName: opts.exerciseName,
              objectPath,
              isAiVerified: opts.isAiVerified,
            });
            updateJob(id, { status: "done" });
          } else {
            // mode === "feed" — create community post
            updateJob(id, { status: "posting" });
            await fetch("/api/community-feed", {
              method:      "POST",
              credentials: "include",
              headers:     { "Content-Type": "application/json" },
              body: JSON.stringify({
                exerciseName: opts.exerciseName,
                caption:      opts.caption ?? "",
                videoObjectPath: objectPath,
                isAiVerified: opts.isAiVerified,
                sessionId:    opts.sessionId,
              }),
            });
            void qc.invalidateQueries({ queryKey: ["community-feed"] });
            updateJob(id, { status: "done" });
          }

          opts.onDone?.(objectPath);
        } catch {
          clearInterval(ticker);
          updateJob(id, { status: "error", progress: 0 });
        } finally {
          // Auto-dismiss after 4 s
          setTimeout(() => removeJob(id), 4_000);
        }
      })();
    },
    [qc, updateJob, removeJob],
  );

  const isActive = jobs.some(
    (j) => j.status === "uploading" || j.status === "posting",
  );

  return (
    <Ctx.Provider value={{ enqueue, isActive }}>
      {children}
      <FloatingUploadBar jobs={jobs} />
    </Ctx.Provider>
  );
}
