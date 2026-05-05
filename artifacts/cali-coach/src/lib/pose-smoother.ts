import type { Landmark } from "./exercise-registry";

/**
 * Exponential Moving Average smoother for MediaPipe pose landmarks.
 *
 * Uses alpha = 2 / (N + 1) where N = 5 (5-frame EMA window).
 * alpha ≈ 0.333 — each new frame contributes ~33 % and the
 * accumulated history contributes ~67 %, damping jitter while
 * staying responsive to genuine movement.
 */
const EMA_ALPHA = 2 / (5 + 1); // ≈ 0.333

export class PoseSmoother {
  private prev: Landmark[] | null = null;

  smooth(raw: Landmark[]): Landmark[] {
    if (!this.prev || this.prev.length !== raw.length) {
      this.prev = raw.map(lm => ({ ...lm }));
      return this.prev;
    }

    const out: Landmark[] = raw.map((lm, i) => {
      const p = this.prev![i];
      return {
        x:          EMA_ALPHA * lm.x + (1 - EMA_ALPHA) * p.x,
        y:          EMA_ALPHA * lm.y + (1 - EMA_ALPHA) * p.y,
        z:          EMA_ALPHA * lm.z + (1 - EMA_ALPHA) * p.z,
        visibility: lm.visibility,
      };
    });

    this.prev = out;
    return out;
  }

  reset(): void {
    this.prev = null;
  }
}
