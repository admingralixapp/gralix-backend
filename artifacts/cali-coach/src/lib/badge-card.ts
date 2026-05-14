/**
 * generateBadgeCard
 *
 * Renders a 1080×1920 (9:16) shareable JPEG image on an offscreen canvas
 * celebrating a milestone badge achievement.
 */

import type { MilestoneBadgeDef, MilestoneTier } from "./milestone-badges";

const W = 1080;
const H = 1920;

const SLATE   = "#0a0f1a";
const WHITE   = "#ffffff";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const CAT_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  orange: { primary: "#f97316", secondary: "#fcd34d", glow: "#fb923c" },
  blue:   { primary: "#3b82f6", secondary: "#93c5fd", glow: "#60a5fa" },
  purple: { primary: "#8b5cf6", secondary: "#c4b5fd", glow: "#a78bfa" },
  green:  { primary: "#22c55e", secondary: "#86efac", glow: "#4ade80"  },
};

const TIER_METAL: Record<MilestoneTier, { ring: string; shine: string }> = {
  Starter:  { ring: "#9ca3af", shine: "#d1d5db" },
  Bronze:   { ring: "#b45309", shine: "#d97706" },
  Silver:   { ring: "#94a3b8", shine: "#e2e8f0" },
  Gold:     { ring: "#ca8a04", shine: "#fde047" },
  Platinum: { ring: "#06b6d4", shine: "#a5f3fc" },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function generateBadgeCard(badge: MilestoneBadgeDef): string {
  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const cat   = CAT_COLORS[badge.color] ?? CAT_COLORS.green!;
  const metal = TIER_METAL[badge.tier];

  // ── Background ─────────────────────────────────────────────────────────────

  ctx.fillStyle = SLATE;
  ctx.fillRect(0, 0, W, H);

  // Radial category glow at upper-centre
  const radial = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.35, 680);
  radial.addColorStop(0, rgba(cat.glow, 0.35));
  radial.addColorStop(1, rgba(cat.glow, 0));
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // Diagonal shimmer overlay
  const shimmer = ctx.createLinearGradient(0, 0, W, H);
  shimmer.addColorStop(0,    rgba(WHITE, 0.03));
  shimmer.addColorStop(0.45, rgba(WHITE, 0.07));
  shimmer.addColorStop(0.55, rgba(WHITE, 0.03));
  shimmer.addColorStop(1,    rgba(WHITE, 0.01));
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, W, H);

  // ── Top accent bar ─────────────────────────────────────────────────────────

  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, cat.primary);
  barGrad.addColorStop(1, cat.secondary);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, 14);

  // ── "CALICOACH" wordmark ───────────────────────────────────────────────────

  ctx.fillStyle    = rgba(WHITE, 0.55);
  ctx.font         = "700 52px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("CALICOACH", W / 2, 68);

  // ── "NEW RANK UNLOCKED" label ──────────────────────────────────────────────

  ctx.fillStyle    = cat.primary;
  ctx.font         = "800 64px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("NEW RANK UNLOCKED", W / 2, 200);

  // ── Badge circle ───────────────────────────────────────────────────────────

  const CX  = W / 2;
  const CY  = H * 0.42;
  const RAD = 280;

  // Outer glow rings
  for (let i = 4; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(CX, CY, RAD + i * 22, 0, Math.PI * 2);
    ctx.fillStyle = rgba(cat.glow, 0.06 * i);
    ctx.fill();
  }

  // Metal ring
  const ringGrad = ctx.createLinearGradient(CX - RAD, CY - RAD, CX + RAD, CY + RAD);
  ringGrad.addColorStop(0, metal.shine);
  ringGrad.addColorStop(0.5, metal.ring);
  ringGrad.addColorStop(1, metal.shine);
  ctx.beginPath();
  ctx.arc(CX, CY, RAD, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth   = 18;
  ctx.stroke();

  // Badge fill
  const circleFill = ctx.createRadialGradient(CX - 60, CY - 60, 20, CX, CY, RAD);
  circleFill.addColorStop(0, rgba(cat.primary, 0.40));
  circleFill.addColorStop(1, rgba(cat.primary, 0.10));
  ctx.beginPath();
  ctx.arc(CX, CY, RAD - 10, 0, Math.PI * 2);
  ctx.fillStyle = circleFill;
  ctx.fill();

  // ── Badge emoji ────────────────────────────────────────────────────────────

  ctx.font         = "320px serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge.icon, CX, CY);

  // ── Tier chip ──────────────────────────────────────────────────────────────

  const chipY = CY + RAD + 55;
  const chipW = 320;
  const chipH = 80;
  const chipX = CX - chipW / 2;

  roundRect(ctx, chipX, chipY, chipW, chipH, 40);
  const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY);
  chipGrad.addColorStop(0, metal.ring);
  chipGrad.addColorStop(1, metal.shine);
  ctx.fillStyle = chipGrad;
  ctx.fill();

  ctx.fillStyle    = "#0a0f1a";
  ctx.font         = "700 44px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge.tier.toUpperCase(), CX, chipY + chipH / 2);

  // ── Badge name ─────────────────────────────────────────────────────────────

  ctx.fillStyle    = WHITE;
  ctx.font         = "800 96px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(badge.name, W / 2, chipY + chipH + 70);

  // ── Description ────────────────────────────────────────────────────────────

  ctx.fillStyle    = rgba(WHITE, 0.60);
  ctx.font         = "400 52px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(badge.description, W / 2, chipY + chipH + 200);

  // ── Separator line ─────────────────────────────────────────────────────────

  const sepY = chipY + chipH + 310;
  const sepGrad = ctx.createLinearGradient(160, sepY, W - 160, sepY);
  sepGrad.addColorStop(0,   rgba(cat.primary, 0));
  sepGrad.addColorStop(0.5, rgba(cat.primary, 0.7));
  sepGrad.addColorStop(1,   rgba(cat.primary, 0));
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(160, sepY);
  ctx.lineTo(W - 160, sepY);
  ctx.stroke();

  // ── Motivational text ──────────────────────────────────────────────────────

  const MOTIVATIONAL: Record<string, string> = {
    Starter:  "THE JOURNEY BEGINS.",
    Bronze:   "CONSISTENCY IS KEY.",
    Silver:   "HALFWAY TO GREATNESS.",
    Gold:     "ELITE TERRITORY.",
    Platinum: "LEGENDARY STATUS.",
  };
  ctx.fillStyle    = rgba(cat.primary, 0.85);
  ctx.font         = "700 56px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(MOTIVATIONAL[badge.tier] ?? "KEEP GRINDING.", W / 2, sepY + 50);

  // ── Bottom branding ────────────────────────────────────────────────────────

  ctx.fillStyle    = rgba(WHITE, 0.20);
  ctx.font         = "500 38px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("calicoach.app · Train smarter. Move better.", W / 2, H - 80);

  // Green bottom glow bar
  const bottomGlow = ctx.createLinearGradient(0, H - 8, 0, H);
  bottomGlow.addColorStop(0, cat.primary);
  bottomGlow.addColorStop(1, rgba(cat.primary, 0.3));
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, H - 8, W, 8);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function shareBadgeCard(badge: MilestoneBadgeDef) {
  const dataUrl  = generateBadgeCard(badge);
  const filename = `calicoach-${badge.id}.jpg`;

  if (navigator.share && navigator.canShare) {
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `I just hit ${badge.name} on CaliCoach!`,
          text:  `NEW RANK UNLOCKED: ${badge.name} — ${badge.description}`,
          files: [file],
        });
        return;
      }
    } catch {
      // fallthrough to download
    }
  }

  // Desktop fallback: download
  const a    = document.createElement("a");
  a.href     = dataUrl;
  a.download = filename;
  a.click();
}
