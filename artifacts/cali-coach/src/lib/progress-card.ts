/**
 * generateProgressCard
 *
 * Renders a 1080×1920 (9:16) shareable JPEG image entirely on an offscreen
 * canvas using the Canvas 2D API — no external libraries required.
 *
 * Palette: dark-slate #0a0f1a background, neon-green #22c55e primary,
 * white/grey typography — the CaliCoach "laboratory" finish.
 */

export interface ProgressCardInput {
  exerciseName: string;
  totalReps: number;
  avgFormScore: number | null;
  /** Optional free-form badge label e.g. "Lever Initiate" */
  mechanicalBadge?: string;
  /** Whether the session was AI-verified */
  isVerified?: boolean;
}

const W = 1080;
const H = 1920;

const GREEN  = "#22c55e";
const SLATE  = "#0a0f1a";
const SLATE2 = "#111827";
const WHITE  = "#ffffff";
const GREY   = "#6b7280";
const AMBER  = "#f59e0b";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbaFrom(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

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

/** Draw the neon form-score ring centred at (cx, cy) with given radius. */
function drawScoreRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  score: number,
  label: string,
) {
  const strokeW = 28;
  const full    = 2 * Math.PI;
  const start   = -Math.PI / 2;
  const end     = start + (score / 100) * full;

  // Track (dim)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, full);
  ctx.strokeStyle = rgbaFrom(GREEN, 0.15);
  ctx.lineWidth   = strokeW;
  ctx.stroke();

  // Glow shadow
  ctx.save();
  ctx.shadowColor = GREEN;
  ctx.shadowBlur  = 48;

  // Arc fill
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth   = strokeW;
  ctx.lineCap     = "round";
  ctx.stroke();
  ctx.restore();

  // Score text
  ctx.fillStyle  = WHITE;
  ctx.font       = `900 180px -apple-system, 'SF Pro Display', Arial, sans-serif`;
  ctx.textAlign  = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${score}`, cx, cy - 20);

  ctx.fillStyle = GREEN;
  ctx.font      = `700 56px -apple-system, Arial, sans-serif`;
  ctx.fillText(label, cx, cy + 90);
}

/** Horizontal divider line */
function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(W - 80, y);
  ctx.strokeStyle = rgbaFrom(WHITE, 0.07);
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

export async function generateProgressCard(
  input: ProgressCardInput,
): Promise<string> {
  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx     = canvas.getContext("2d")!;

  // ── Background ──────────────────────────────────────────────────────────

  ctx.fillStyle = SLATE;
  ctx.fillRect(0, 0, W, H);

  // Subtle gradient wash — top green tint, bottom purple tint
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0,    rgbaFrom(GREEN, 0.06));
  bgGrad.addColorStop(0.45, "rgba(0,0,0,0)");
  bgGrad.addColorStop(1,    "rgba(88,28,135,0.10)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines for "laboratory" feel
  ctx.strokeStyle = rgbaFrom(WHITE, 0.025);
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 90) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ── Top logo bar ─────────────────────────────────────────────────────────

  // Logo pill background
  roundRect(ctx, 80, 90, 260, 74, 20);
  ctx.fillStyle = rgbaFrom(GREEN, 0.12);
  ctx.fill();
  roundRect(ctx, 80, 90, 260, 74, 20);
  ctx.strokeStyle = rgbaFrom(GREEN, 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Logo text
  ctx.fillStyle    = GREEN;
  ctx.font         = "800 42px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("CaliCoach", 100, 127);

  // "Scanned by AI" chip — top right
  roundRect(ctx, W - 340, 90, 260, 74, 20);
  ctx.fillStyle = rgbaFrom(WHITE, 0.06);
  ctx.fill();
  roundRect(ctx, W - 340, 90, 260, 74, 20);
  ctx.strokeStyle = rgbaFrom(WHITE, 0.12);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle    = GREY;
  ctx.font         = "600 34px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "right";
  ctx.fillText("⚡ Scanned by AI", W - 100, 127);

  // ── Exercise name ─────────────────────────────────────────────────────────

  ctx.fillStyle    = WHITE;
  ctx.font         = "900 96px -apple-system, 'SF Pro Display', Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  // Truncate long exercise name
  const exerciseLabel = input.exerciseName.length > 18
    ? input.exerciseName.slice(0, 17) + "…"
    : input.exerciseName;
  ctx.fillText(exerciseLabel, W / 2, 230);

  ctx.fillStyle = GREY;
  ctx.font      = "500 44px -apple-system, Arial, sans-serif";
  ctx.fillText("Performance Analysis", W / 2, 350);

  divider(ctx, 440);

  // ── Form score ring ───────────────────────────────────────────────────────

  const score = input.avgFormScore !== null ? Math.round(input.avgFormScore) : 0;
  drawScoreRing(ctx, W / 2, 760, 280, score, "FORM SCORE");

  divider(ctx, 1050);

  // ── Stats row ─────────────────────────────────────────────────────────────

  const statY = 1100;
  const statCols = [W * 0.25, W * 0.5, W * 0.75];
  const statLabels = ["REPS", "FORM", "VERIFIED"];
  const statValues = [
    `${input.totalReps}`,
    `${score}%`,
    input.isVerified ? "✓ AI" : "Manual",
  ];
  const statColors = [WHITE, WHITE, input.isVerified ? GREEN : GREY];

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle    = statColors[i];
    ctx.font         = `900 100px -apple-system, Arial, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(statValues[i], statCols[i], statY);

    ctx.fillStyle = GREY;
    ctx.font      = "600 36px -apple-system, Arial, sans-serif";
    ctx.fillText(statLabels[i], statCols[i], statY + 110);
  }

  divider(ctx, 1310);

  // ── Mechanical Advantage badge ────────────────────────────────────────────

  if (input.mechanicalBadge) {
    const badgeY = 1360;
    const badgeW = 700;
    const badgeX = (W - badgeW) / 2;

    roundRect(ctx, badgeX, badgeY, badgeW, 110, 24);
    ctx.fillStyle = rgbaFrom(AMBER, 0.10);
    ctx.fill();
    roundRect(ctx, badgeX, badgeY, badgeW, 110, 24);
    ctx.strokeStyle = rgbaFrom(AMBER, 0.40);
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.fillStyle    = AMBER;
    ctx.font         = "700 44px -apple-system, Arial, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`★ ${input.mechanicalBadge}`, W / 2, badgeY + 55);
  }

  // ── Bottom CTA text ───────────────────────────────────────────────────────

  ctx.fillStyle    = rgbaFrom(WHITE, 0.20);
  ctx.font         = "500 38px -apple-system, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("calicoach.app · Train smarter. Move better.", W / 2, H - 80);

  // ── Green bottom glow bar ─────────────────────────────────────────────────

  const bottomGlow = ctx.createLinearGradient(0, H - 8, 0, H);
  bottomGlow.addColorStop(0, GREEN);
  bottomGlow.addColorStop(1, rgbaFrom(GREEN, 0.3));
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, H - 8, W, 8);

  // ── Return JPEG data URL ──────────────────────────────────────────────────

  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Trigger browser download of the data URL as a JPEG file. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a  = document.createElement("a");
  a.href   = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Share via Web Share API if available, otherwise fall back to download.
 * Returns true if share sheet was triggered.
 */
export async function shareOrDownload(
  dataUrl: string,
  filename: string,
  title: string,
  text: string,
): Promise<boolean> {
  if (typeof navigator.share === "function" && typeof File !== "undefined") {
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({ title, text, files: [file] });
      return true;
    } catch {
      // User cancelled or share failed — fall through to download
    }
  }
  downloadDataUrl(dataUrl, filename);
  return false;
}
