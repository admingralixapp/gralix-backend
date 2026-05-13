/**
 * PovReview — POV Performance Review screen shown after every workout set.
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────┐
 *  │  🎬 POV Performance Review   [Best Rep #N · XX%]     │
 *  ├────────────────────────┬─────────────────────────────┤
 *  │  YOUR FORM             │  PRO GHOST — IDEAL FORM      │
 *  │  [video + red circles] │  [ghost skeleton canvas]     │
 *  ├────────────────────────┴─────────────────────────────┤
 *  │  Joint deviations bar                                │
 *  │  Coach speaking… [Save to History] [Post to Feed]  [Continue →]│
 *  └──────────────────────────────────────────────────────┘
 *
 * "Save to History": uploads clip via BackgroundUploadManager (survives nav).
 * "Post to Feed":    opens ShareToFeedSheet for caption + community post.
 * Video loops by default so users can analyse form repeatedly.
 */

import { useEffect, useRef, useState } from "react";
import {
  SkipForward,
  Play,
  Pause,
  Ghost,
  ChevronRight,
  Mic,
  Share2,
  History,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawGhostSkeleton } from "@/lib/ghost-poses";
import { speak as voiceSpeak } from "@/lib/voice-service";
import { getGhostOpacity, setGhostOpacity } from "@/lib/shop-preferences";
import { ShareToFeedSheet } from "./share-to-feed-sheet";
import { useUploadManager } from "@/lib/upload-manager";
import type { BestRepData, RepReviewPayload } from "@/lib/rep-recorder";
import type { Landmark } from "@/lib/exercise-registry";

// ─── Joint name map ───────────────────────────────────────────────────────────

const JOINT_NAMES: Record<number, string> = {
  11: "left shoulder",
  12: "right shoulder",
  13: "left elbow",
  14: "right elbow",
  15: "left wrist",
  16: "right wrist",
  23: "left hip",
  24: "right hip",
  25: "left knee",
  26: "right knee",
  27: "left ankle",
  28: "right ankle",
};

// ─── Deviation analysis ───────────────────────────────────────────────────────

interface JointDelta {
  index:    number;
  name:     string;
  dist:     number;
  severity: "high" | "medium" | "low";
}

function computeDeviations(user: Landmark[], ghost: Landmark[]): JointDelta[] {
  return (
    Object.entries(JOINT_NAMES)
      .map(([idxStr, name]) => {
        const i = Number(idxStr);
        const u = user[i];
        const g = ghost[i];
        if (!u || !g || (u.visibility ?? 1) < 0.3) return null;
        const dist     = Math.hypot(u.x - g.x, u.y - g.y);
        const severity: JointDelta["severity"] =
          dist > 0.15 ? "high" : dist > 0.08 ? "medium" : "low";
        return { index: i, name, dist, severity };
      })
      .filter((d): d is JointDelta => d !== null)
      .sort((a, b) => b.dist - a.dist)
  );
}

// ─── Narration ────────────────────────────────────────────────────────────────

const JOINT_ADVICE: Record<string, string> = {
  "left elbow":     "focus on full elbow extension",
  "right elbow":    "focus on full elbow extension",
  "left hip":       "squeeze your glutes to keep your hips aligned",
  "right hip":      "squeeze your glutes to keep your hips aligned",
  "left shoulder":  "keep your shoulder packed and stable",
  "right shoulder": "keep your shoulder packed and stable",
  "left knee":      "drive that knee outward to stay in line",
  "right knee":     "drive that knee outward to stay in line",
  "left wrist":     "maintain neutral wrists throughout the rep",
  "right wrist":    "maintain neutral wrists throughout the rep",
  "left ankle":     "plant your foot firmly for a stable base",
  "right ankle":    "plant your foot firmly for a stable base",
};

function buildNarration(
  exerciseName: string,
  repNumber:    number,
  syncPct:      number,
  deviations:   JointDelta[],
): string {
  const repLabel  = repNumber > 0 ? `rep number ${repNumber}` : "your best hold";
  const quality   = syncPct >= 90 ? "excellent" : syncPct >= 75 ? "solid" : "developing";
  const significant = deviations.filter(d => d.severity !== "low");

  if (significant.length === 0) {
    return (
      `Take a look at ${repLabel} on the ${exerciseName}. Your ghost sync reached ` +
      `${syncPct} percent — ${quality} execution. You matched the ideal form almost ` +
      `perfectly. Keep this consistency every set and you'll lock in mastery quickly.`
    );
  }

  const top      = significant.slice(0, 2);
  const jointText =
    top.length === 1 ? top[0].name : `${top[0].name} and ${top[1].name}`;
  const adviceText = top
    .map(d => JOINT_ADVICE[d.name] ?? "match the ghost position more closely")
    .join(", and ");

  return (
    `Take a look at ${repLabel} on the ${exerciseName}. Your ghost sync was ` +
    `${syncPct} percent — ${quality} work. The main areas to refine are your ` +
    `${jointText}. Next set, ${adviceText}, to better match the Ghost.`
  );
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function drawProGhost(
  canvas: HTMLCanvasElement,
  landmarks: Landmark[],
  alpha: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = alpha;
  drawGhostSkeleton(ctx, landmarks, canvas.width, canvas.height, 100);
  ctx.globalAlpha = 1;
}

function drawDeviationCircles(
  canvas: HTMLCanvasElement,
  userLandmarks: Landmark[],
  deviations:    JointDelta[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const dev of deviations) {
    if (dev.severity === "low") continue;
    const lm = userLandmarks[dev.index];
    if (!lm) continue;

    const x     = (1 - lm.x) * canvas.width;
    const y     = lm.y * canvas.height;
    const r     = dev.severity === "high" ? 28 : 20;
    const alpha = dev.severity === "high" ? 0.85 : 0.6;

    ctx.save();
    ctx.globalAlpha  = alpha * 0.28;
    ctx.strokeStyle  = "#ef4444";
    ctx.lineWidth    = 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha  = alpha;
    ctx.strokeStyle  = "#ef4444";
    ctx.lineWidth    = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle   = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PovReviewProps extends RepReviewPayload {
  /** DB session id — needed for clip storage and community sharing. */
  sessionId?: number;
  onComplete: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

type NarrationState = "idle" | "speaking" | "done";
type SaveState      = "idle" | "saving" | "saved";

export function PovReview({
  blob,
  bestRepTime,
  bestRepData,
  exerciseName,
  sessionId,
  onComplete,
}: PovReviewProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ghostRef   = useRef<HTMLCanvasElement>(null);
  const ghostRafId = useRef(0);
  const blobUrl    = useRef("");

  const [blobReady,     setBlobReady]     = useState(false);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [narration,     setNarration]     = useState<NarrationState>("idle");
  const [videoError,    setVideoError]    = useState(false);
  const [showShare,     setShowShare]     = useState(false);
  const [saveState,     setSaveState]     = useState<SaveState>("idle");
  const [ghostOpacity,  setGhostOpacityState] = useState<number>(() => getGhostOpacity());

  const { enqueue } = useUploadManager();

  const deviations    = computeDeviations(bestRepData.userLandmarks, bestRepData.ghostLandmarks);
  const narrationText = buildNarration(exerciseName, bestRepData.repNumber, bestRepData.syncPct, deviations);
  const significant   = deviations.filter(d => d.severity !== "low");

  // ── Blob URL ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url       = URL.createObjectURL(blob);
    blobUrl.current = url;
    setBlobReady(true);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // ── Video setup + auto-seek ──────────────────────────────────────────────────
  useEffect(() => {
    if (!blobReady) return;
    const video = videoRef.current;
    if (!video) return;

    const handleMeta  = () => {
      if (bestRepTime > 1 && video.duration > bestRepTime) {
        video.currentTime = bestRepTime;
      }
      video.play().catch(() => setIsPlaying(false));
    };
    const handlePlay  = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setVideoError(true);

    video.src = blobUrl.current;
    video.load();
    video.addEventListener("loadedmetadata", handleMeta);
    video.addEventListener("play",  handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleMeta);
      video.removeEventListener("play",  handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [blobReady, bestRepTime]);

  // ── Deviation overlay ────────────────────────────────────────────────────────
  useEffect(() => {
    const video   = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    const resize = () => {
      overlay.width  = video.videoWidth  || 1280;
      overlay.height = video.videoHeight || 720;
      drawDeviationCircles(overlay, bestRepData.userLandmarks, deviations);
    };
    video.addEventListener("loadedmetadata", resize);
    overlay.width  = 1280;
    overlay.height = 720;
    drawDeviationCircles(overlay, bestRepData.userLandmarks, deviations);

    return () => video.removeEventListener("loadedmetadata", resize);
  }, [bestRepData.userLandmarks, deviations]);

  // ── Ghost animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = ghostRef.current;
    if (!canvas) return;
    canvas.width  = 1280;
    canvas.height = 720;

    let alpha = 0.85;
    let dir   = 1;

    const animate = () => {
      alpha += dir * 0.007;
      if (alpha > 1.0)  { alpha = 1.0;  dir = -1; }
      if (alpha < 0.60) { alpha = 0.60; dir =  1; }
      drawProGhost(canvas, bestRepData.ghostLandmarks, alpha);
      ghostRafId.current = requestAnimationFrame(animate);
    };
    ghostRafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ghostRafId.current);
  }, [bestRepData.ghostLandmarks]);

  // ── Auto-narrate ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setNarration("speaking");
      voiceSpeak(narrationText);
      const words      = narrationText.split(" ").length;
      const durationMs = Math.max(4000, (words / 140) * 60_000);
      const doneTimer  = setTimeout(() => setNarration("done"), durationMs);
      return () => clearTimeout(doneTimer);
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  };

  const handleSaveToHistory = () => {
    if (saveState !== "idle") return;
    setSaveState("saving");
    enqueue({
      blob,
      sessionId:    sessionId ?? 0,
      exerciseName,
      isAiVerified: true,
      mode:         "history",
      onDone: () => setSaveState("saved"),
    });
    // Show "saving" briefly then let the floating toast take over
    setTimeout(() => setSaveState("saved"), 1_200);
  };

  const syncColor =
    bestRepData.syncPct >= 90 ? "#86efac" :
    bestRepData.syncPct >= 75 ? "#fde047" : "#fca5a5";

  const severityColor = (s: JointDelta["severity"]) =>
    s === "high" ? "#ef4444" : "#f97316";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Ghost className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">POV Performance Review</span>
          </div>
          <div className="h-4 w-px bg-white/15" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/40">Best Rep</span>
            <span className="text-sm font-black tabular-nums" style={{ color: syncColor }}>
              #{bestRepData.repNumber}
            </span>
            <span className="text-xs text-white/40">·</span>
            <span className="text-sm font-black tabular-nums" style={{ color: syncColor }}>
              {bestRepData.syncPct}%
            </span>
            <span className="text-xs text-white/40">Ghost Sync</span>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors"
        >
          Skip Review
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main panels ─────────────────────────────────────────────────────── */}
      {/*
          Mobile  (< sm): single column, each panel full-width with 16:9 aspect
                          ratio; the wrapper scrolls so both panels are reachable.
          Desktop (≥ sm): side-by-side grid that fills the remaining height.
      */}
      <div className="flex-1 overflow-y-auto min-h-0 sm:overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-px sm:bg-white/[0.06] sm:h-full">

          {/* Top / Left — User form video */}
          <div className="relative bg-black flex flex-col">
            <div className="px-4 py-2 flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Your Form
              </span>
              {significant.length > 0 && (
                <span className="text-[10px] text-red-400/70 ml-auto">
                  {significant.length} deviation{significant.length > 1 ? "s" : ""} highlighted
                </span>
              )}
            </div>

            {/* Video area: 16:9 on mobile, fills remaining height on desktop */}
            <div className="relative aspect-video sm:aspect-auto sm:flex-1 overflow-hidden">
              {videoError ? (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
                  Clip unavailable
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-contain"
                    loop
                    playsInline
                  />
                  <canvas
                    ref={overlayRef}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                  <button
                    onClick={togglePlay}
                    className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-colors"
                  >
                    {isPlaying
                      ? <Pause className="w-3.5 h-3.5" />
                      : <Play  className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bottom / Right — Pro Ghost */}
          <div className="relative bg-[#03090f] flex flex-col border-t border-white/[0.06] sm:border-t-0">
            <div className="px-4 py-2 flex items-center gap-2 shrink-0">
              <Ghost className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/50">
                Pro Ghost — Ideal Form
              </span>
              {/* Overlay opacity slider */}
              <div className="ml-auto flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-white/25 shrink-0" />
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={ghostOpacity}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setGhostOpacityState(v);
                    setGhostOpacity(v);
                  }}
                  title={`Overlay opacity: ${Math.round(ghostOpacity * 100)}%`}
                  className="w-16 h-1 accent-cyan-400 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                />
              </div>
            </div>

            {/* Ghost canvas: 16:9 on mobile, fills remaining height on desktop */}
            <div className="relative aspect-video sm:aspect-auto sm:flex-1 overflow-hidden">
              <canvas
                ref={ghostRef}
                className="absolute inset-0 w-full h-full object-contain transition-opacity"
                style={{ transform: "scaleX(-1)", opacity: ghostOpacity }}
              />
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[10px] font-semibold text-cyan-300">Perfect sync target</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Deviation breakdown ──────────────────────────────────────────────── */}
      {significant.length > 0 && (
        <div className="px-5 py-2.5 border-t border-white/[0.07] bg-black/60 shrink-0">
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-semibold mb-2">
            Joint Deviation
          </p>
          <div className="flex gap-5 flex-wrap">
            {significant.slice(0, 5).map(d => (
              <div key={d.index} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: severityColor(d.severity) }}
                />
                <span className="text-xs text-white/55 capitalize">{d.name}</span>
                <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:           `${Math.min(100, Math.round(d.dist * 400))}%`,
                      backgroundColor: severityColor(d.severity),
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-white/25 w-7 text-right">
                  {Math.round(d.dist * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom action bar ────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">

        {/* Narration status */}
        <div className="flex items-center gap-2 shrink-0">
          <Mic
            className={`w-3.5 h-3.5 transition-colors ${
              narration === "speaking" ? "text-cyan-400" :
              narration === "done"     ? "text-emerald-400" :
                                         "text-white/20"
            }`}
          />
          <span className="text-xs text-white/40 hidden sm:inline">
            {narration === "idle"     && "Preparing coach…"}
            {narration === "speaking" && "Coach narrating…"}
            {narration === "done"     && "Narration complete"}
          </span>
          {narration === "speaking" && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-3 rounded-full bg-cyan-400 inline-block"
                  style={{ animation: `pulse 0.9s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save to History */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToHistory}
            disabled={saveState !== "idle"}
            className={`border-white/20 hover:bg-white/10 gap-1.5 transition-all ${
              saveState === "saved" ? "text-emerald-400 border-emerald-400/30" : "text-white"
            }`}
          >
            {saveState === "saved" ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </>
            ) : saveState === "saving" ? (
              <>
                <div className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <History className="w-3.5 h-3.5" />
                Save to History
              </>
            )}
          </Button>

          {/* Post to Feed */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShare(true)}
            className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            Post to Feed
          </Button>

          {/* Continue */}
          <Button
            size="sm"
            onClick={onComplete}
            className="font-bold gap-1"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Share sheet */}
      {showShare && (
        <ShareToFeedSheet
          blob={blob}
          exerciseName={exerciseName}
          isAiVerified={true}
          sessionId={sessionId}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
