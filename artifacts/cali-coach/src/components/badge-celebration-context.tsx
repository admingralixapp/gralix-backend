/**
 * BadgeCelebrationContext
 *
 * Global provider that:
 *  1. Exposes `triggerBadgeCelebrations(badges)` — call it directly after a
 *     session completes to queue a celebration immediately.
 *  2. Monitors the user profile's `earnedMilestoneBadges` via useMyProfile —
 *     on first mount it silently marks everything as seen (no popup), and on
 *     subsequent changes it queues any newly appeared badge IDs.
 *  3. Uses localStorage (key `badge-celebrated:<userId>`) as a durable gate so
 *     the same badge never triggers twice across page refreshes.
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
import { MILESTONE_BADGE_MAP, type MilestoneBadgeDef } from "@/lib/milestone-badges";
import { BadgeCelebrationModal } from "./badge-celebration";

// ── Context ────────────────────────────────────────────────────────────────────

interface BadgeCelebrationCtx {
  triggerBadgeCelebrations: (badges: MilestoneBadgeDef[]) => void;
}

const BadgeCelebrationContext = createContext<BadgeCelebrationCtx>({
  triggerBadgeCelebrations: () => {},
});

export function useBadgeCelebrationTrigger() {
  return useContext(BadgeCelebrationContext);
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function BadgeCelebrationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent]     = useState<MilestoneBadgeDef | null>(null);
  const queueRef                  = useRef<MilestoneBadgeDef[]>([]);

  const { data: profile } = useMyProfile();
  const userId            = profile?.id as number | undefined;
  const hasInitialized    = useRef(false);

  // ── Profile watcher ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !profile?.earnedMilestoneBadges) return;

    const storageKey  = `badge-celebrated:${userId}`;
    const celebrated  = new Set<string>(
      JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[],
    );
    const earned      = profile.earnedMilestoneBadges as string[];

    // First load in this session: silently mark all as seen.
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const merged = new Set([...celebrated, ...earned]);
      localStorage.setItem(storageKey, JSON.stringify([...merged]));
      return;
    }

    // Subsequent loads: detect newly appeared badge IDs.
    const newIds = earned.filter((id) => !celebrated.has(id));
    if (newIds.length === 0) return;

    // Persist immediately to avoid duplicate triggers.
    const merged = new Set([...celebrated, ...earned]);
    localStorage.setItem(storageKey, JSON.stringify([...merged]));

    const newBadges = newIds
      .map((id) => MILESTONE_BADGE_MAP.get(id))
      .filter((b): b is MilestoneBadgeDef => b !== undefined);

    enqueue(newBadges);
  }, [userId, profile?.earnedMilestoneBadges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal queue management ───────────────────────────────────────────────

  function enqueue(badges: MilestoneBadgeDef[]) {
    if (badges.length === 0) return;
    queueRef.current = [...queueRef.current, ...badges];
    setCurrent((prev) => {
      if (prev) return prev;
      return queueRef.current.shift() ?? null;
    });
  }

  function advance() {
    setCurrent(queueRef.current.shift() ?? null);
  }

  // ── Public trigger (called from workout.tsx after session PATCH) ────────────

  const triggerBadgeCelebrations = useCallback(
    (badges: MilestoneBadgeDef[]) => {
      if (!badges.length) return;

      // Also stamp localStorage so the profile watcher won't double-fire.
      if (userId) {
        const storageKey = `badge-celebrated:${userId}`;
        const celebrated = new Set<string>(
          JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[],
        );
        badges.forEach((b) => celebrated.add(b.id));
        localStorage.setItem(storageKey, JSON.stringify([...celebrated]));
      }

      enqueue(badges);
    },
    [userId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <BadgeCelebrationContext.Provider value={{ triggerBadgeCelebrations }}>
      {children}
      {current && (
        <BadgeCelebrationModal badge={current} onClose={advance} />
      )}
    </BadgeCelebrationContext.Provider>
  );
}
