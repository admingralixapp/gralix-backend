/**
 * generateSkillMasteryCard
 *
 * Renders a 1080×1920 (9:16) shareable JPEG celebrating a skill mastery.
 */

import type { EvaluatedSkill, SkillBranch } from "./skill-tree";

const W = 1080;
const H = 1920;

const SLATE = "#060912";
const WHITE = "#ffffff";

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const BRANCH_COLORS: Record<SkillBranch, { primary: string; glow: string; label: string }> = {
  PUSH: { primary: "#f97316", glow: "#fb923c", label: "PUSH"  },
  PULL: { primary: "#3b82f6", glow: "#60a5fa", label: "PULL"  },
  CORE: { primary: "#a855f7", glow: "#c084fc", label: "CORE"  },
  LEGS: { primary: "#10b981", glow: "#34d399", label: "LEGS"  },
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineH: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lineH; }
  return cy;
}

export function generateSkillMasteryCard(
  masteredNode:       EvaluatedSkill,
  newlyUnlockedNodes: EvaluatedSkill[],
): string {
  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bc = BRANCH_COLORS[masteredNode.branch];

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = SLATE;
  ctx.fillRect(0, 0, W, H);

  // Radial glow
  const radial = ctx.createRadialGradient(W / 2, H * 0.38, 100, W / 2, H * 0.38, 820);
  radial.addColorStop(0, rgba(bc.glow, 0.28));
  radial.addColorStop(1, rgba(bc.glow, 0));
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // Diagonal shimmer
  const shimmer = ctx.createLinearGradient(0, 0, W, H);
  shimmer.addColorStop(0,    rgba(WHITE, 0.02));
  shimmer.addColorStop(0.5,  rgba(WHITE, 0.055));
  shimmer.addColorStop(1,    rgba(WHITE, 0.01));
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, W, H);

  // Scan lines
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = rgba("#000000", 0.06);
    ctx.fillRect(0, y, W, 1);
  }

  // ── Top accent bar ──────────────────────────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, "transparent");
  barGrad.addColorStop(0.5, bc.primary);
  barGrad.addColorStop(1, "transparent");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, 12);

  // ── CALICOACH wordmark ──────────────────────────────────────────────────────
  ctx.fillStyle    = rgba(WHITE, 0.50);
  ctx.font         = "700 52px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("CALICOACH", W / 2, 60);

  // ── Branch chip ─────────────────────────────────────────────────────────────
  const chipW = 220; const chipH = 64; const chipR = 32;
  const chipX = W / 2 - chipW / 2; const chipY = 160;
  roundRect(ctx, chipX, chipY, chipW, chipH, chipR);
  ctx.fillStyle = rgba(bc.primary, 0.18);
  ctx.fill();
  roundRect(ctx, chipX, chipY, chipW, chipH, chipR);
  ctx.strokeStyle = rgba(bc.primary, 0.6);
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.fillStyle    = bc.primary;
  ctx.font         = "800 36px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bc.label, W / 2, chipY + chipH / 2);

  // ── "SKILL MASTERED" header ─────────────────────────────────────────────────
  ctx.fillStyle    = rgba(WHITE, 0.42);
  ctx.font         = "700 52px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("SKILL MASTERED", W / 2, 274);

  // ── Glow circle ─────────────────────────────────────────────────────────────
  const CX = W / 2;
  const CY = H * 0.40;
  const RAD = 240;

  for (let i = 5; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(CX, CY, RAD + i * 26, 0, Math.PI * 2);
    ctx.fillStyle = rgba(bc.glow, 0.045 * i);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(CX, CY, RAD, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(bc.primary, 0.6);
  ctx.lineWidth   = 6;
  ctx.stroke();

  const circleFill = ctx.createRadialGradient(CX - 50, CY - 50, 20, CX, CY, RAD);
  circleFill.addColorStop(0, rgba(bc.primary, 0.28));
  circleFill.addColorStop(1, rgba(bc.primary, 0.06));
  ctx.beginPath();
  ctx.arc(CX, CY, RAD - 4, 0, Math.PI * 2);
  ctx.fillStyle = circleFill;
  ctx.fill();

  // Level badge inside circle
  ctx.fillStyle    = bc.primary;
  ctx.font         = `900 52px -apple-system, Arial, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor  = bc.glow;
  ctx.shadowBlur   = 30;
  ctx.fillText(`LEVEL ${masteredNode.level}`, CX, CY - 38);
  ctx.shadowBlur   = 0;

  ctx.fillStyle    = rgba(WHITE, 0.85);
  ctx.font         = `800 64px -apple-system, Arial, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor  = bc.glow;
  ctx.shadowBlur   = 20;
  const title = masteredNode.title;
  if (ctx.measureText(title).width > RAD * 1.7) {
    ctx.font = `800 52px -apple-system, Arial, sans-serif`;
  }
  ctx.fillText(title, CX, CY + 28);
  ctx.shadowBlur = 0;

  ctx.fillStyle    = rgba(bc.primary, 0.75);
  ctx.font         = `600 38px -apple-system, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(masteredNode.levelName.toUpperCase(), CX, CY + 96);

  // ── Biomechanical text ──────────────────────────────────────────────────────
  const bioY = CY + RAD + 80;
  ctx.fillStyle    = rgba(WHITE, 0.85);
  ctx.font         = `700 52px -apple-system, Arial, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor  = bc.glow;
  ctx.shadowBlur   = 12;
  const bioLine1 = "Neural pathways adapted.";
  ctx.fillText(bioLine1, W / 2, bioY);
  ctx.shadowBlur = 0;

  ctx.fillStyle    = rgba(WHITE, 0.45);
  ctx.font         = `400 40px -apple-system, Arial, sans-serif`;
  const bioLine2 = `Mechanical efficiency for ${masteredNode.title} achieved.`;
  wrapText(ctx, bioLine2, W / 2, bioY + 72, W - 180, 52);

  // ── New paths unlocked ──────────────────────────────────────────────────────
  if (newlyUnlockedNodes.length > 0) {
    const unlockY = bioY + 200;

    // Separator
    const sep = ctx.createLinearGradient(100, unlockY, W - 100, unlockY);
    sep.addColorStop(0,    rgba(bc.primary, 0));
    sep.addColorStop(0.5,  rgba(bc.primary, 0.5));
    sep.addColorStop(1,    rgba(bc.primary, 0));
    ctx.strokeStyle = sep;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(100, unlockY);
    ctx.lineTo(W - 100, unlockY);
    ctx.stroke();

    ctx.fillStyle    = rgba(bc.primary, 0.7);
    ctx.font         = `700 40px -apple-system, Arial, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText("NEW PATHS UNLOCKED", W / 2, unlockY + 36);

    const names = newlyUnlockedNodes.map((n) => n.title).join("  ·  ");
    ctx.fillStyle    = rgba(WHITE, 0.55);
    ctx.font         = `500 36px -apple-system, Arial, sans-serif`;
    wrapText(ctx, names, W / 2, unlockY + 96, W - 160, 48);
  }

  // ── Bottom branding ─────────────────────────────────────────────────────────
  ctx.fillStyle    = rgba(WHITE, 0.18);
  ctx.font         = "500 36px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("calicoach.app · Train smarter. Move better.", W / 2, H - 72);

  const bottomBar = ctx.createLinearGradient(0, H - 10, 0, H);
  bottomBar.addColorStop(0, bc.primary);
  bottomBar.addColorStop(1, rgba(bc.primary, 0.3));
  ctx.fillStyle = bottomBar;
  ctx.fillRect(0, H - 10, W, 10);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function shareSkillMasteryCard(
  masteredNode:       EvaluatedSkill,
  newlyUnlockedNodes: EvaluatedSkill[],
) {
  const dataUrl  = generateSkillMasteryCard(masteredNode, newlyUnlockedNodes);
  const filename = `calicoach-skill-${masteredNode.id}.jpg`;

  if (navigator.share && navigator.canShare) {
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `SKILL MASTERED: ${masteredNode.title}`,
          text:  `I just mastered ${masteredNode.title} on CaliCoach! Neural pathways adapted. 💪`,
          files: [file],
        });
        return;
      }
    } catch {
      // fallthrough to download
    }
  }

  const a    = document.createElement("a");
  a.href     = dataUrl;
  a.download = filename;
  a.click();
}
