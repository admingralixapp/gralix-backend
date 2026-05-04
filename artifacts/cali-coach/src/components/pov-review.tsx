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
 *  │  Coach speaking... [Save Clip]  [Continue →]         │
 *  └──────────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useState } from "react";
import {
  Download,
  SkipForward,
  Play,
  Pause,
  Ghost,
  ChevronRight,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawGhostSkeleton } from "@/lib/ghost-poses";
import { speak as voiceSpeak } from "@/lib/voice-service";
import type { BestRepData, RepReviewPayload } from "@/lib/rep-recorder";
import type { Landmark } from "@/lib/exercise-registry";

// ─── Joint name map (MediaPipe 33-point model) ────────────────────────────────

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
  index: number;
  name: string;
  dist: number;
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

// ─── Narration text ───────────────────────────────────────────────────────────

const JOINT_ADVICE: Record<string, string> = {
  "left elbow":      "focus on full elbow extension",
  "right elbow":     "focus on full elbow extension",
  "left hip":        "squeeze your glutes to keep your hips aligned",
  "right hip":       "squeeze your glutes to keep your hips aligned",
  "left shoulder":   "keep your shoulder packed and stable",
  "right shoulder":  "keep your shoulder packed and stable",
  "left knee":       "drive that knee outward to stay in line",
  "right knee":      "drive that knee outward to stay in line",
  "left wrist":      "maintain neutral wrists throughout the rep",
  "right wrist":     "maintain neutral wrists throughout the rep",
  "left ankle":      "plant your foot firmly for a stable base",
  "right ankle":     "plant your foot firmly for a stable base",
};

function buildNarration(
  exerciseName: string,
  repNumber: number,
  syncPct: number,
  deviations: JointDelta[],
): string {
  const repLabel   = repNumber > 0 ? `rep number ${repNumber}` : "your best hold";
  const quality    = syncPct >= 90 ? "excellent" : syncPct >= 75 ? "solid" : "developing";
  const significant = deviations.filter(d => d.severity !== "low");

  if (significant.length === 0) {
    return (
      `Take a look at ${repLabel} on the ${exerciseName}. Your ghost sync reached ` +
      `${syncPct} percent — ${quality} execution. You matched the ideal form almost ` +
      `perfectly. Keep this consistency every set and you'll lock in mastery quickly.`
    );
  }

  const top = significant.slice(0, 2);
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

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

/** Draws the ghost skeleton on the right-panel canvas (full cyan, pulsing alpha). */
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

/** Draws red glow circles on the overlay canvas at deviant joint positions. */
function drawDeviationCircles(
  canvas: HTMLCanvasElement,
  userLandmarks: Landmark[],
  deviations: JointDelta[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const dev of deviations) {
    if (dev.severity === "low") continue;
    const lm = userLandmarks[dev.index];
    if (!lm) continue;

    // Recording is already horizontally mirrored → display X as (1 - lm.x)
    const x      = (1 - lm.x) * canvas.width;
    const y      = lm.y * canvas.height;
    const r      = dev.severity === "high" ? 28 : 20;
    const alpha  = dev.severity === "high" ? 0.85 : 0.6;

    ctx.save();

    // Outer soft glow
    ctx.globalAlpha = alpha * 0.28;
    ctx.strokeStyle  = "#ef4444";
    ctx.lineWidth    = 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 12, 0, Math.PI * 2);
    ctx.stroke();

    // Main ring
    ctx.globalAlpha = alpha;
    ctx.strokeStyle  = "#ef4444";
    ctx.lineWidth    = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Translucent fill
    ctx.globalAlpha  = alpha * 0.18;
    ctx.fillStyle    = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PovReviewProps extends RepReviewPayload {
  onComplete: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

type NarrationState = "idle" | "speaking" | "done";

export function PovReview({
  blob,
  bestRepTime,
  bestRepData,
  exerciseName,
  onComplete,
}: PovReviewProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ghostRef   = useRef<HTMLCanvasElement>(null);
  const ghostRafId = useRef(0);
  const blobUrl    = useRef("");

  const [blobReady,      setBlobReady]      = useState(false);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [narration,      setNarration]      = useState<NarrationState>("idle");
  const [videoError,     setVideoError]     = useState(false);

  const deviations    = computeDeviations(bestRepData.userLandmarks, bestRepData.ghostLandmarks);
  const narrationText = buildNarration(exerciseName, bestRepData.repNumber, bestRepData.syncPct, deviations);
  const significant   = deviations.filter(d => d.severity !== "low");

  // ── Create blob URL ─────────────────────────────────────────────────────────
  useEffect(() => {
    const url    = URL.createObjectURL(blob);
    blobUrl.current = url;
    setBlobReady(true);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // ── Video setup & auto-seek ─────────────────────────────────────────────────
  useEffect(() => {
    if (!blobReady) return;
    const video = videoRef.current;
    if (!video) return;

    const handleMeta = () => {
      // Seek to 5 s before the best rep (if the recording is long enough)
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

  // ── Deviation overlay on left panel ─────────────────────────────────────────
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
    // Draw immediately with default dimensions
    overlay.width  = 1280;
    overlay.height = 720;
    drawDeviationCircles(overlay, bestRepData.userLandmarks, deviations);

    return () => video.removeEventListener("loadedmetadata", resize);
  }, [bestRepData.userLandmarks, deviations]);

  // ── Ghost animation on right panel ──────────────────────────────────────────
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

  // ── Auto-narrate on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setNarration("speaking");
      voiceSpeak(narrationText);
      // Mark done after estimated speech duration (≈ 140 wpm)
      const words    = narrationText.split(" ").length;
      const durationMs = Math.max(4000, (words / 140) * 60_000);
      const doneTimer = setTimeout(() => setNarration("done"), durationMs);
      return () => clearTimeout(doneTimer);
    }, 900);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  };

  const handleSave = () => {
    const a   = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href     = url;
    a.download = `calicoach-${exerciseName.toLowerCase().replace(/\s+/g, "-")}-review.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // ── Colour helpers ──────────────────────────────────────────────────────────
  const syncColor =
    bestRepData.syncPct >= 90 ? "#86efac" :
    bestRepData.syncPct >= 75 ? "#fde047" : "#fca5a5";

  const severityColor = (s: JointDelta["severity"]) =>
    s === "high" ? "#ef4444" : "#f97316";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Ghost className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">POV Performance Review</span>
          </div>
          <div className="h-4 w-px bg-white/15" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/40">Best Rep</span>
            <span
              className="text-sm font-black tabular-nums"
              style={{ color: syncColor }}
            >
              #{bestRepData.repNumber}
            </span>
            <span className="text-xs text-white/40">·</span>
            <span
              className="text-sm font-black tabular-nums"
              style={{ color: syncColor }}
            >
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

      {/* ── Main panels ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-white/[0.06] min-h-0">

        {/* Left — User form video */}
        <div className="relative bg-black flex flex-col min-h-0">
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

          <div className="flex-1 relative overflow-hidden">
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
                {/* Deviation circles overlay */}
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                {/* Play / pause button */}
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

        {/* Right — Pro Ghost */}
        <div className="relative bg-[#03090f] flex flex-col min-h-0">
          <div className="px-4 py-2 flex items-center gap-2 shrink-0">
            <Ghost className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/50">
              Pro Ghost — Ideal Form
            </span>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {/* Mirror the canvas to match the "mirror mode" of the video panel */}
            <canvas
              ref={ghostRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Overlay label */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-300">Perfect sync target</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deviation breakdown ─────────────────────────────────────────────── */}
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

      {/* ── Bottom action bar ───────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-4 shrink-0">

        {/* Narration status */}
        <div className="flex items-center gap-2">
          <Mic
            className={`w-3.5 h-3.5 transition-colors ${
              narration === "speaking" ? "text-cyan-400" :
              narration === "done"     ? "text-emerald-400" :
                                         "text-white/20"
            }`}
          />
          <span className="text-xs text-white/40">
            {narration === "idle"     && "Preparing coach…"}
            {narration === "speaking" && "Coach narrating…"}
            {narration === "done"     && "Narration complete"}
          </span>
          {narration === "speaking" && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-3 rounded-full bg-cyan-400"
                  style={{
                    animation:      `pulse 0.9s ease-in-out ${i * 0.15}s infinite`,
                    animationName:  "bounceBar",
                    display:        "inline-block",
                  }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="border-white/20 text-white hover:bg-white/10 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Save Clip
          </Button>

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
    </div>
  );
}
