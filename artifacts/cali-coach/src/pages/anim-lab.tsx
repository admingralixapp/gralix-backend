import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Play, Square, Save, RotateCcw, X, Copy, Check, Minus, Plus } from "lucide-react";
import {
  getPoseSet,
  getMobilityEnv,
  getMobilityExerciseNames,
  type PoseData,
  type EnvAnchor,
} from "@/lib/exercise-poses";

// ── Types ───────────────────────────────────────────────────────────────────

type FrameIdx = 0 | 1 | 2;
type DragState = { isHead: boolean; indices: { lineIdx: number; pointIdx: number }[] };

const FRAME_LABELS = ["Start", "Mid", "End"] as const;
const FRAME_COLORS: [string, string, string] = ["#22c55e", "#facc15", "#fb923c"];
const PLAY_SEQ: FrameIdx[] = [0, 1, 2, 1];

// ── Utilities ───────────────────────────────────────────────────────────────

function cloneFrame(f: PoseData): PoseData {
  return JSON.parse(JSON.stringify(f));
}

function svgPoint(e: React.PointerEvent, svgEl: SVGSVGElement): [number, number] {
  const rect = svgEl.getBoundingClientRect();
  const rx = ((e.clientX - rect.left) / rect.width) * 100;
  const ry = ((e.clientY - rect.top) / rect.height) * 100;
  const x = Math.round(Math.max(0, Math.min(100, rx)) * 2) / 2;
  const y = Math.round(Math.max(0, Math.min(100, ry)) * 2) / 2;
  return [x, y];
}

function findMatching(pose: PoseData, tx: number, ty: number) {
  const out: { lineIdx: number; pointIdx: number }[] = [];
  pose.lines.forEach((line, li) =>
    line.forEach(([x, y], pi) => {
      if (x === tx && y === ty) out.push({ lineIdx: li, pointIdx: pi });
    })
  );
  return out;
}

function uniqueJoints(pose: PoseData): { x: number; y: number }[] {
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  pose.lines.forEach(line =>
    line.forEach(([x, y]) => {
      const k = `${x},${y}`;
      if (!seen.has(k)) { seen.add(k); out.push({ x, y }); }
    })
  );
  return out;
}

// ── Environment Renderer (matches mobility.tsx visual exactly) ───────────────

function EnvSVG({ env }: { env: EnvAnchor }) {
  if (env.type === "floor") {
    const ticks = 12;
    const step = (env.x2 - env.x1) / ticks;
    return (
      <g>
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 2 + i * step;
          return <line key={i} x1={x} y1={env.y1} x2={x - 4} y2={env.y1 + 6}
            stroke="#475569" strokeWidth={0.7} opacity={0.3} strokeLinecap="round" />;
        })}
        <line x1={env.x1} y1={env.y1 + 1.2} x2={env.x2} y2={env.y2 + 1.2}
          stroke="#0f172a" strokeWidth={2} opacity={0.25} strokeLinecap="round" />
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  }
  if (env.type === "bar") {
    const ticks = 9;
    const step = (env.x2 - env.x1 - 8) / (ticks - 1);
    return (
      <g>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#94a3b8" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
        {Array.from({ length: ticks }).map((_, i) => {
          const x = env.x1 + 4 + i * step;
          return <line key={i} x1={x} y1={env.y1 - 2.5} x2={x} y2={env.y1 + 2.5}
            stroke="#475569" strokeWidth={1} opacity={0.4} />;
        })}
        <line x1={env.x1} y1={env.y1 - 4} x2={env.x1} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
        <line x1={env.x2} y1={env.y1 - 4} x2={env.x2} y2={env.y1 + 4}
          stroke="#64748b" strokeWidth={2} opacity={0.45} />
      </g>
    );
  }
  if (env.type === "wall") {
    const ticks = 8;
    const step = (env.y2 - env.y1) / ticks;
    const onRight = env.x1 > 50;
    return (
      <g opacity={0.5}>
        <line x1={env.x1} y1={env.y1} x2={env.x2} y2={env.y2}
          stroke="#64748b" strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: ticks - 1 }).map((_, i) => {
          const y = env.y1 + (i + 1) * step;
          return <line key={i} x1={env.x1} y1={y} x2={env.x1 + (onRight ? -6 : 6)} y2={y}
            stroke="#64748b" strokeWidth={0.8} opacity={0.35} />;
        })}
      </g>
    );
  }
  return null;
}

// ── Ghost skeleton (other two frames shown faintly) ─────────────────────────

function GhostSkeleton({ pose, color }: { pose: PoseData; color: string }) {
  return (
    <>
      {pose.lines.map((pts, li) =>
        pts.slice(0, -1).map((_, pi) => (
          <line key={`${li}-${pi}`}
            x1={pts[pi][0]} y1={pts[pi][1]} x2={pts[pi + 1][0]} y2={pts[pi + 1][1]}
            stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.12} />
        ))
      )}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
        fill="none" stroke={color} strokeWidth={2} opacity={0.12} />
    </>
  );
}

// ── Active skeleton (neon, matches mobility look) ───────────────────────────

function LiveSkeleton({ pose, color }: { pose: PoseData; color: string }) {
  const pts = pose.lines.flatMap(l => l);
  return (
    <>
      {/* Limb segments */}
      {pose.lines.map((line, li) =>
        line.slice(0, -1).map((_, pi) => (
          <line key={`${li}-${pi}`}
            x1={line[pi][0]} y1={line[pi][1]} x2={line[pi + 1][0]} y2={line[pi + 1][1]}
            stroke={color} strokeWidth={6} strokeLinecap="round" />
        ))
      )}
      {/* Joint dots */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.8} fill={color} opacity={0.6} />
      ))}
      {/* Head halo */}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
        fill="rgba(34,197,94,0.07)" stroke={color} strokeWidth={2.5} />
      {/* Head core */}
      <circle cx={pose.head.cx} cy={pose.head.cy} r={2.5} fill={color} opacity={0.5} />
    </>
  );
}

// ── Mini thumbnail ──────────────────────────────────────────────────────────

function Thumbnail({
  pose, env, color, active, onClick,
  label,
}: {
  pose: PoseData; env?: EnvAnchor; color: string; active: boolean;
  onClick: () => void; label: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, aspectRatio: "1/1", background: "#0b1120", borderRadius: 8,
        cursor: "pointer", border: `2px solid ${active ? color : "#1e293b"}`,
        overflow: "hidden", position: "relative", transition: "border-color 0.15s",
        boxShadow: active ? `0 0 10px ${color}44` : "none",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible" }}>
        {env && <EnvSVG env={env} />}
        {pose.lines.map((line, li) =>
          line.slice(0, -1).map((_, pi) => (
            <line key={`${li}-${pi}`}
              x1={line[pi][0]} y1={line[pi][1]} x2={line[pi + 1][0]} y2={line[pi + 1][1]}
              stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
          ))
        )}
        <circle cx={pose.head.cx} cy={pose.head.cy} r={(pose.head.r ?? 7) + 2}
          fill="none" stroke={color} strokeWidth={2.5} opacity={0.9} />
      </svg>
      <div style={{
        position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center",
        fontSize: 9, color, opacity: 0.8, fontWeight: 600, letterSpacing: "0.06em",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Number Input row helper ─────────────────────────────────────────────────

function NumField({
  label, value, onChange, step = 0.5,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <button
          onClick={() => onChange(Math.round((value - step) * 10) / 10)}
          style={{ width: 22, height: 26, background: "#1e293b", border: "1px solid #334155", borderRight: "none", borderRadius: "4px 0 0 4px", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Minus size={10} />
        </button>
        <input
          type="number"
          value={value}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: 46, height: 26, textAlign: "center",
            background: "#1e293b", border: "1px solid #334155",
            color: "#f8fafc", fontSize: 12, fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={() => onChange(Math.round((value + step) * 10) / 10)}
          style={{ width: 22, height: 26, background: "#1e293b", border: "1px solid #334155", borderLeft: "none", borderRadius: "0 4px 4px 0", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Plus size={10} />
        </button>
      </div>
    </label>
  );
}

// ── Main AnimLab Page ────────────────────────────────────────────────────────

export function AnimLabPage() {
  const exerciseNames = getMobilityExerciseNames();

  const [exercise, setExercise] = useState<string>(
    exerciseNames[2] ?? exerciseNames[0] ?? "Wrist Extension Stretch"
  );

  const initFrames = (name: string): [PoseData, PoseData, PoseData] => {
    const ps = getPoseSet(name);
    return [cloneFrame(ps[0]), cloneFrame(ps[1]), cloneFrame(ps[2])];
  };

  const [frames, setFrames] = useState<[PoseData, PoseData, PoseData]>(() => initFrames(exercise));
  const [activeFrame, setActiveFrame] = useState<FrameIdx>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seqIdx, setSeqIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeFameRef = useRef<FrameIdx>(activeFrame);
  activeFameRef.current = activeFrame;

  const env = getMobilityEnv(exercise);

  // ── Exercise change ──────────────────────────────────────────────────────
  useEffect(() => {
    setFrames(initFrames(exercise));
    setActiveFrame(0);
    setIsPlaying(false);
    setSaveMsg(null);
    dragRef.current = null;
  }, [exercise]);

  // ── Play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setSeqIdx(i => (i + 1) % PLAY_SEQ.length), 1100);
    return () => clearInterval(id);
  }, [isPlaying]);

  const displayFrame: FrameIdx = isPlaying ? PLAY_SEQ[seqIdx] : activeFrame;
  const activePose = frames[displayFrame];

  // ── Global pointer-up (catches drag release anywhere) ───────────────────
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // ── Pointer handlers ─────────────────────────────────────────────────────

  const onJointDown = useCallback((
    e: React.PointerEvent<SVGCircleElement>,
    x: number, y: number,
  ) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      isHead: false,
      indices: findMatching(frames[activeFameRef.current], x, y),
    };
  }, [isPlaying, frames]);

  const onHeadDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { isHead: true, indices: [] };
  }, [isPlaying]);

  const onSvgMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current) return;
    const [nx, ny] = svgPoint(e, svgRef.current);
    const fi = activeFameRef.current;
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const frame = cloneFrame(prev[fi]);
      if (dragRef.current!.isHead) {
        frame.head.cx = nx;
        frame.head.cy = ny;
      } else {
        for (const { lineIdx, pointIdx } of dragRef.current!.indices) {
          frame.lines[lineIdx][pointIdx] = [nx, ny];
        }
      }
      next[fi] = frame;
      return next;
    });
  }, []);

  // ── Muscle glow helpers ──────────────────────────────────────────────────

  const updateGlowField = (field: "cx" | "cy" | "rx" | "ry", val: number) => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      next[activeFrame] = cloneFrame(prev[activeFrame]);
      next[activeFrame].muscleGlow![field] = val;
      return next;
    });
  };

  const toggleGlow = () => {
    setFrames(prev => {
      const next = [...prev] as [PoseData, PoseData, PoseData];
      const f = cloneFrame(prev[activeFrame]);
      if (f.muscleGlow) { delete f.muscleGlow; }
      else { f.muscleGlow = { cx: 50, cy: 50, rx: 15, ry: 10 }; }
      next[activeFrame] = f;
      return next;
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/poses/${encodeURIComponent(exercise)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSaveMsg({ ok: true, text: "Written to exercise-poses.ts — Vite HMR reloading skeleton." });
    } catch (err: unknown) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFrames(initFrames(exercise));
    setSaveMsg(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(frames, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Joints for handles ───────────────────────────────────────────────────

  const joints = uniqueJoints(activePose);

  // ── Render ───────────────────────────────────────────────────────────────

  const panelBg = "#111827";
  const borderCol = "#1e293b";
  const mutedText = "#64748b";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#0f172a", color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 18px", borderBottom: `1px solid ${borderCol}`,
        flexShrink: 0, background: panelBg,
      }}>
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
          🎯 Animation Lab
        </span>

        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          style={{
            background: "#1e293b", color: "#f8fafc",
            border: `1px solid #334155`, borderRadius: 6,
            padding: "5px 10px", fontSize: 13, cursor: "pointer", maxWidth: 300,
          }}
        >
          {exerciseNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <span style={{ fontSize: 11, color: mutedText, marginLeft: 4 }}>
          Drag joints • Tab = switch frame • Save = write to source • HMR reloads skeleton live
        </span>

        <Link
          href="/"
          style={{
            marginLeft: "auto", color: mutedText, display: "flex",
            alignItems: "center", gap: 4, textDecoration: "none", fontSize: 12,
          }}
        >
          <X size={13} /> Exit Lab
        </Link>
      </div>

      {/* ── Main columns ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: Canvas ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 14, padding: "20px 24px",
          flexShrink: 0, borderRight: `1px solid ${borderCol}`,
        }}>

          {/* Frame tabs */}
          <div style={{ display: "flex", gap: 6 }}>
            {FRAME_LABELS.map((name, idx) => {
              const active = !isPlaying && activeFrame === (idx as FrameIdx);
              return (
                <button
                  key={name}
                  onClick={() => { setActiveFrame(idx as FrameIdx); setIsPlaying(false); }}
                  style={{
                    padding: "5px 16px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${active ? FRAME_COLORS[idx] : "#334155"}`,
                    background: active ? `${FRAME_COLORS[idx]}18` : "transparent",
                    color: active ? FRAME_COLORS[idx] : mutedText,
                  }}
                >
                  {["▶", "◉", "◀"][idx]} {name}
                </button>
              );
            })}
          </div>

          {/* SVG Canvas */}
          <div style={{
            width: 460, height: 460,
            background: "#080e1a",
            borderRadius: 14,
            border: `1px solid ${borderCol}`,
            position: "relative",
            boxShadow: `inset 0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(34,197,94,0.04)`,
            flexShrink: 0,
          }}>
            {/* Status badge */}
            <div style={{
              position: "absolute", top: 8, right: 10, zIndex: 10,
              fontSize: 10, padding: "2px 9px", borderRadius: 20,
              background: "#0f172a",
              color: isPlaying ? "#22c55e" : FRAME_COLORS[activeFrame],
              border: `1px solid ${isPlaying ? "#22c55e33" : `${FRAME_COLORS[activeFrame]}33`}`,
            }}>
              {isPlaying ? `▶ ${FRAME_LABELS[displayFrame]}` : `✎ ${FRAME_LABELS[activeFrame]}`}
            </div>

            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              width="100%" height="100%"
              style={{
                display: "block", overflow: "visible",
                cursor: dragRef.current ? "grabbing" : "crosshair",
                filter: `drop-shadow(0 0 10px ${FRAME_COLORS[displayFrame]}66)`,
              }}
              onPointerMove={onSvgMove}
            >
              <defs>
                <filter id="jglow" x="-150%" y="-150%" width="400%" height="400%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Grid (faint) */}
              {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
                <g key={v} opacity={0.06}>
                  <line x1={v} y1={0} x2={v} y2={100} stroke="#94a3b8" strokeWidth={0.5} />
                  <line x1={0} y1={v} x2={100} y2={v} stroke="#94a3b8" strokeWidth={0.5} />
                </g>
              ))}

              {/* Environment anchor */}
              {env && <EnvSVG env={env} />}

              {/* Ghost frames */}
              {!isPlaying && ([0, 1, 2] as FrameIdx[])
                .filter(i => i !== activeFrame)
                .map(i => (
                  <GhostSkeleton key={i} pose={frames[i]} color={FRAME_COLORS[i]} />
                ))}

              {/* Active skeleton */}
              <LiveSkeleton pose={activePose} color={FRAME_COLORS[displayFrame]} />

              {/* Draggable joint handles */}
              {!isPlaying && joints.map(({ x, y }) => (
                <circle
                  key={`${x},${y}`}
                  cx={x} cy={y} r={4.2}
                  fill={FRAME_COLORS[activeFrame]}
                  stroke="#0b1120" strokeWidth={1.5}
                  filter="url(#jglow)"
                  style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
                  onPointerDown={e => onJointDown(e, x, y)}
                />
              ))}

              {/* Head drag handle */}
              {!isPlaying && (
                <circle
                  cx={activePose.head.cx} cy={activePose.head.cy}
                  r={(activePose.head.r ?? 7) + 5}
                  fill="transparent"
                  stroke={FRAME_COLORS[activeFrame]}
                  strokeWidth={1.5}
                  strokeDasharray="3 2.5"
                  style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
                  onPointerDown={onHeadDown}
                />
              )}

              {/* muscleGlow indicator */}
              {!isPlaying && activePose.muscleGlow && (
                <ellipse
                  cx={activePose.muscleGlow.cx} cy={activePose.muscleGlow.cy}
                  rx={activePose.muscleGlow.rx} ry={activePose.muscleGlow.ry}
                  fill="none"
                  stroke="#a855f7" strokeWidth={0.8}
                  strokeDasharray="2 2" opacity={0.5}
                />
              )}
            </svg>
          </div>

          {/* Play / Reset controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setIsPlaying(p => !p); setSeqIdx(0); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 22px", borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: "pointer", border: "none",
                background: isPlaying ? "#374151" : "#22c55e",
                color: isPlaying ? "#9ca3af" : "#000",
                transition: "all 0.15s",
              }}
            >
              {isPlaying ? <><Square size={12} /> Stop</> : <><Play size={12} /> Play Loop</>}
            </button>

            <button
              onClick={handleReset}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                background: "transparent", color: mutedText,
                border: `1px solid #334155`,
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* ── RIGHT: Controls Panel ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", gap: 0,
          overflowY: "auto", padding: 20, minWidth: 0, background: panelBg,
        }}>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
              background: saving ? "#374151" : "#22c55e",
              color: saving ? "#9ca3af" : "#000",
              fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              marginBottom: 6,
            }}
          >
            <Save size={14} />
            {saving ? "Writing to source…" : "Update Exercise Database"}
          </button>

          {saveMsg && (
            <p style={{
              fontSize: 12, marginBottom: 12,
              color: saveMsg.ok ? "#22c55e" : "#f87171",
              lineHeight: 1.5, padding: "6px 10px",
              background: saveMsg.ok ? "#052e1680" : "#450a0a80",
              borderRadius: 6,
            }}>
              {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.text}
            </p>
          )}

          {/* Frame thumbnails */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Frame Previews — click to edit
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {FRAME_LABELS.map((name, idx) => (
                <Thumbnail
                  key={name}
                  pose={frames[idx]}
                  env={env}
                  color={FRAME_COLORS[idx]}
                  active={!isPlaying && activeFrame === idx}
                  onClick={() => { setActiveFrame(idx as FrameIdx); setIsPlaying(false); }}
                  label={name}
                />
              ))}
            </div>
          </div>

          {/* Head controls */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: mutedText, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Head — {FRAME_LABELS[activeFrame]}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["cx", "cy", "r"] as const).map(field => (
                <NumField
                  key={field}
                  label={field}
                  value={frames[activeFrame].head[field] ?? 7}
                  onChange={val => {
                    setFrames(prev => {
                      const next = [...prev] as [PoseData, PoseData, PoseData];
                      next[activeFrame] = cloneFrame(prev[activeFrame]);
                      next[activeFrame].head[field] = val;
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Muscle glow */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <p style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                Muscle Glow — {FRAME_LABELS[activeFrame]}
              </p>
              <button
                onClick={toggleGlow}
                style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                  background: frames[activeFrame].muscleGlow ? "#7c1d1d" : "#14532d",
                  color: frames[activeFrame].muscleGlow ? "#fca5a5" : "#86efac",
                }}
              >
                {frames[activeFrame].muscleGlow ? "Remove" : "+ Add"}
              </button>
            </div>
            {frames[activeFrame].muscleGlow && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["cx", "cy", "rx", "ry"] as const).map(field => (
                  <NumField
                    key={field}
                    label={field}
                    value={frames[activeFrame].muscleGlow![field]}
                    onChange={val => updateGlowField(field, val)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Coordinate readout */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                All Frames — Raw Coordinates
              </p>
              <button
                onClick={handleCopyJson}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, padding: "2px 10px", borderRadius: 4, cursor: "pointer",
                  background: "transparent",
                  color: copied ? "#22c55e" : mutedText,
                  border: `1px solid ${copied ? "#22c55e" : "#334155"}`,
                }}
              >
                {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy JSON</>}
              </button>
            </div>
            <pre style={{
              flex: 1, overflow: "auto", background: "#080e1a", borderRadius: 8,
              padding: 12, fontSize: 10.5, color: "#94a3b8", lineHeight: 1.65,
              border: `1px solid ${borderCol}`, margin: 0, minHeight: 180,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}>
              {frames.map((f, i) => `/* ${FRAME_LABELS[i]} */\n${JSON.stringify(f, null, 2)}`).join("\n\n")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
