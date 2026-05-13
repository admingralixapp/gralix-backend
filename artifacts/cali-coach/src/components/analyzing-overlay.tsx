import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Cpu } from "lucide-react";

const STEPS = [
  "Extracting Skeletal Landmarks...",
  "Calculating Biomechanical Torque...",
  "Generating Form Deviation Score...",
  "Finalising Session Data...",
] as const;

const STEP_INTERVAL_MS = 650;

interface AnalyzingOverlayProps {
  visible: boolean;
  apiDone: boolean;
  onComplete: () => void;
}

export function AnalyzingOverlay({ visible, apiDone, onComplete }: AnalyzingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      setDoneSteps(new Set());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < STEPS.length - 1; i++) {
      timers.push(
        setTimeout(() => {
          setDoneSteps(prev => new Set([...prev, i]));
          setCurrentStep(i + 1);
        }, (i + 1) * STEP_INTERVAL_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  useEffect(() => {
    if (!apiDone || !visible) return;
    const stepsBeforeLastComplete = Math.max(0, (STEPS.length - 1 - currentStep));
    const extraDelay = stepsBeforeLastComplete * STEP_INTERVAL_MS + 200;
    const t = setTimeout(() => {
      setDoneSteps(prev => new Set([...prev, STEPS.length - 1]));
      setTimeout(() => onCompleteRef.current(), 500);
    }, extraDelay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiDone, visible]);

  const progressPct = (doneSteps.size / STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="analyzing-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[150] flex flex-col items-center justify-center px-8"
          style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(24px)" }}
        >
          {/* Pulsing circuit icon */}
          <motion.div
            animate={{ scale: [1, 1.07, 1], opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              boxShadow: "0 0 32px rgba(34,197,94,0.18)",
            }}
          >
            <Cpu className="w-8 h-8 text-primary" />
          </motion.div>

          {/* Title */}
          <h2
            className="text-lg font-black uppercase text-white mb-1"
            style={{ letterSpacing: "0.15em" }}
          >
            Analyzing Performance
          </h2>
          <p className="text-xs mb-6 tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            AI Biomechanical Engine
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-xs mb-6">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                  background: "linear-gradient(90deg, #16a34a, #22c55e, #4ade80)",
                  boxShadow: "0 0 8px rgba(34,197,94,0.5)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                {Math.round(progressPct)}%
              </span>
              <span className="text-[10px] font-mono" style={{ color: "rgba(34,197,94,0.5)" }}>
                CALICOACH·AI
              </span>
            </div>
          </div>

          {/* Checklist */}
          <div className="w-full max-w-xs space-y-3">
            {STEPS.map((label, i) => {
              const isDone   = doneSteps.has(i);
              const isActive = currentStep === i && !isDone;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: isDone ? 1 : isActive ? 1 : 0.25,
                    x: 0,
                  }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="flex items-center gap-3"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                  ) : isActive ? (
                    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.85, repeat: Infinity }}>
                      <Circle className="w-4 h-4 shrink-0" style={{ color: "rgba(34,197,94,0.6)" }} />
                    </motion.div>
                  ) : (
                    <Circle className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.12)" }} />
                  )}

                  <span
                    className="text-[13px] font-mono flex-1"
                    style={{
                      color: isDone
                        ? "#22c55e"
                        : isActive
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {label}
                  </span>

                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.65, repeat: Infinity }}
                      className="text-[10px]"
                      style={{ color: "#22c55e" }}
                    >
                      ●
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
