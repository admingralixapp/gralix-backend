/**
 * RepRecorder — canvas-based session recorder for POV Performance Review.
 *
 * Strategy:
 *  - Composites the camera feed (video element) + skeleton overlay (canvas element)
 *    onto a hidden recording canvas at 25 fps using requestAnimationFrame.
 *  - Feeds the composited stream into a MediaRecorder (WebM/VP9 or VP8 fallback).
 *  - Keeps ALL chunks for the entire session.
 *  - When logBestRep() is called, marks the timestamp so the review can seek there.
 *  - stopAsync() assembles the final blob and returns a RepReviewPayload.
 *
 * Horizontal flip:
 *  The live workout view uses CSS -scale-x-100 (mirror mode).
 *  The compositing loop applies ctx.scale(-1, 1) so the recording matches
 *  what the user actually saw on screen.
 */

import type { Landmark } from "./exercise-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BestRepData {
  repNumber: number;
  syncPct: number;
  formScore: number;
  userLandmarks: Landmark[];
  ghostLandmarks: Landmark[];
}

export interface RepReviewPayload {
  blob: Blob;
  /** Seconds from recording start to seek to (5 s before best rep, clamped ≥ 0). */
  bestRepTime: number;
  bestRepData: BestRepData;
  exerciseName: string;
  mimeType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CapturableCanvas = HTMLCanvasElement & {
  captureStream(fps?: number): MediaStream;
};

function bestMimeType(): string {
  for (const t of [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      break;
    }
  }
  return "";
}

// ─── RepRecorder ─────────────────────────────────────────────────────────────

export class RepRecorder {
  private videoEl: HTMLVideoElement | null = null;
  private skeletonCanvas: HTMLCanvasElement | null = null;

  private compositeCanvas: CapturableCanvas;
  private compositeCtx: CanvasRenderingContext2D;

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId = 0;

  private recordingStartMs = 0;
  private bestRepMs = 0;
  private _bestRepData: BestRepData | null = null;
  private _mimeType = "";
  private _active = false;

  /** True when MediaRecorder and captureStream are available in this browser. */
  readonly isSupported: boolean;

  constructor() {
    const el = document.createElement("canvas") as CapturableCanvas;
    el.width  = 1280;
    el.height = 720;
    this.compositeCanvas = el;

    const ctx = el.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    this.compositeCtx = ctx;

    this.isSupported =
      typeof MediaRecorder !== "undefined" &&
      typeof (el as unknown as { captureStream?: unknown }).captureStream === "function";

    if (this.isSupported) {
      this._mimeType = bestMimeType();
    }
  }

  /** Call once with the live camera video and skeleton canvas before start(). */
  attach(videoEl: HTMLVideoElement, skeletonCanvas: HTMLCanvasElement): void {
    this.videoEl      = videoEl;
    this.skeletonCanvas = skeletonCanvas;
  }

  /** Begin compositing and recording. Safe to call multiple times (idempotent). */
  start(): void {
    if (!this.isSupported || !this.videoEl || !this.skeletonCanvas || this._active) return;

    this.chunks           = [];
    this.recordingStartMs = Date.now();
    this.bestRepMs        = 0;
    this._bestRepData     = null;
    this._active          = true;

    const stream = this.compositeCanvas.captureStream(25);
    try {
      this.mediaRecorder = new MediaRecorder(
        stream,
        this._mimeType ? { mimeType: this._mimeType } : {},
      );
    } catch {
      this._active = false;
      return;
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start(500); // 500 ms timeslice for low-latency chunks
    this._drawLoop();
  }

  /** Mark the current moment as the best-rep timestamp and snapshot landmarks. */
  logBestRep(data: BestRepData): void {
    this.bestRepMs    = Date.now() - this.recordingStartMs;
    this._bestRepData = {
      ...data,
      userLandmarks:  data.userLandmarks.map(l => ({ ...l })),
      ghostLandmarks: data.ghostLandmarks.map(l => ({ ...l })),
    };
  }

  /**
   * Stop recording and assemble the final payload.
   * Returns null if the recorder was never started or no best rep was logged.
   */
  async stopAsync(exerciseName: string): Promise<RepReviewPayload | null> {
    this._active = false;
    cancelAnimationFrame(this.rafId);

    if (!this.mediaRecorder || !this._bestRepData) return null;

    await new Promise<void>((resolve) => {
      const mr = this.mediaRecorder!;
      const onStop = () => { mr.removeEventListener("stop", onStop); resolve(); };
      mr.addEventListener("stop", onStop);
      if (mr.state !== "inactive") mr.stop(); else resolve();
    });

    if (this.chunks.length === 0) return null;

    const blob        = new Blob(this.chunks, { type: this._mimeType || "video/webm" });
    const bestRepTime = Math.max(0, this.bestRepMs / 1000 - 5); // 5 s before best rep

    return {
      blob,
      bestRepTime,
      bestRepData: this._bestRepData,
      exerciseName,
      mimeType: this._mimeType,
    };
  }

  /** Release resources without waiting for final chunks. */
  destroy(): void {
    this._active = false;
    cancelAnimationFrame(this.rafId);
    try { if (this.mediaRecorder?.state !== "inactive") this.mediaRecorder?.stop(); }
    catch { /* already stopped */ }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _drawLoop(): void {
    const cc  = this.compositeCanvas;
    const ctx = this.compositeCtx;

    const draw = () => {
      if (!this._active) return;

      const v = this.videoEl;
      const s = this.skeletonCanvas;

      ctx.save();
      // Mirror horizontally to match the CSS -scale-x-100 applied in the workout UI.
      ctx.scale(-1, 1);
      ctx.translate(-cc.width, 0);

      if (v && v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        ctx.drawImage(v, 0, 0, cc.width, cc.height);
      } else {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(-cc.width, 0, cc.width, cc.height);
      }

      if (s) ctx.drawImage(s, 0, 0, cc.width, cc.height);

      ctx.restore();

      this.rafId = requestAnimationFrame(draw);
    };

    this.rafId = requestAnimationFrame(draw);
  }
}
