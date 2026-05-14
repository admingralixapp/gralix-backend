/**
 * SkillMasteryCelebrationContext
 *
 * Global provider that queues full-screen skill mastery celebrations.
 * Call `triggerSkillMasteryCelebrations(celebrations)` right after
 * `evaluateSkillTree` detects newly mastered nodes.
 *
 * localStorage gate (`skill-mastered:<userId>`) prevents duplicate popups
 * across page refreshes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMyProfile } from "@/lib/social";
import { SkillMasteryCelebrationModal } from "./skill-mastery-celebration";
import type { EvaluatedSkill } from "@/lib/skill-tree";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillMasteryCelebration {
  masteredNode:       EvaluatedSkill;
  newlyUnlockedNodes: EvaluatedSkill[];
}

interface SkillMasteryCtx {
  triggerSkillMasteryCelebrations: (celebrations: SkillMasteryCelebration[]) => void;
}

const SkillMasteryContext = createContext<SkillMasteryCtx>({
  triggerSkillMasteryCelebrations: () => {},
});

export function useSkillMasteryCelebrationTrigger() {
  return useContext(SkillMasteryContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SkillMasteryCelebrationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent]   = useState<SkillMasteryCelebration | null>(null);
  const queueRef                = useRef<SkillMasteryCelebration[]>([]);

  const { data: profile } = useMyProfile();
  const userId            = profile?.id as number | undefined;

  // ── Profile watcher — gate on localStorage to avoid duplicate pops ─────────
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const storageKey = `skill-mastered:${userId}`;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Prime the set on first load so old masteries never trigger a popup.
      const existing = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
      localStorage.setItem(storageKey, JSON.stringify(existing));
    }
  }, [userId]);

  // ── Internal queue management ─────────────────────────────────────────────

  function enqueue(celebrations: SkillMasteryCelebration[]) {
    if (celebrations.length === 0) return;
    queueRef.current = [...queueRef.current, ...celebrations];
    setCurrent((prev) => {
      if (prev) return prev;
      return queueRef.current.shift() ?? null;
    });
  }

  function advance() {
    setCurrent(queueRef.current.shift() ?? null);
  }

  // ── Public trigger ────────────────────────────────────────────────────────

  const triggerSkillMasteryCelebrations = useCallback(
    (celebrations: SkillMasteryCelebration[]) => {
      if (!celebrations.length) return;

      // Stamp localStorage so the watcher never double-fires.
      if (userId) {
        const storageKey = `skill-mastered:${userId}`;
        const celebrated = new Set<string>(
          JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[],
        );
        celebrations.forEach((c) => celebrated.add(c.masteredNode.id));
        localStorage.setItem(storageKey, JSON.stringify([...celebrated]));
      }

      enqueue(celebrations);
    },
    [userId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <SkillMasteryContext.Provider value={{ triggerSkillMasteryCelebrations }}>
      {children}
      {current && (
        <SkillMasteryCelebrationModal celebration={current} onClose={advance} />
      )}
    </SkillMasteryContext.Provider>
  );
}
