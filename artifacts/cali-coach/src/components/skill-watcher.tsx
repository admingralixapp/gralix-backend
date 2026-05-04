import { useEffect, useRef, useState } from "react";
import { useMasteredSkills, useCreateShoutout, useMyProfile, type MasteredSkillInfo } from "@/lib/social";
import { CelebrationOverlay } from "./celebration";

/**
 * SkillWatcher
 *
 * Mounted globally inside Layout. Polls /api/skills/mastered and compares to
 * the set of skills already celebrated (stored in localStorage per user).
 *
 * On FIRST data load → marks everything as "seen" (no celebration), so existing
 * masteries don't fire spuriously on page load.
 *
 * On SUBSEQUENT polls → any new elite (level 5) skills trigger the gold
 * confetti celebration, queue up the display, and POST a shoutout to the feed.
 */
export function SkillWatcher() {
  const { data: profile } = useMyProfile();
  const userId = profile?.id;

  const { data } = useMasteredSkills(!!userId);
  const createShoutout = useCreateShoutout();

  const [celebrating, setCelebrating] = useState<MasteredSkillInfo | null>(null);
  const queueRef = useRef<MasteredSkillInfo[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!userId || !data?.mastered) return;

    const storageKey = `celebrated:${userId}`;
    const celebrated = new Set<string>(
      JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[],
    );

    const mastered = data.mastered;

    // ── First load in this session: mark all mastered as seen, don't celebrate
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const allIds = mastered.map((s) => s.id);
      const updated = new Set([...celebrated, ...allIds]);
      localStorage.setItem(storageKey, JSON.stringify([...updated]));
      return;
    }

    // ── Subsequent polls: find new elite masteries
    const newElite = mastered.filter((s) => s.level === 5 && !celebrated.has(s.id));
    if (newElite.length === 0) return;

    // Persist immediately so rapid re-renders don't re-queue
    const updated = new Set([...celebrated, ...mastered.map((s) => s.id)]);
    localStorage.setItem(storageKey, JSON.stringify([...updated]));

    // Enqueue celebrations
    queueRef.current = [...queueRef.current, ...newElite];

    // Start showing if nothing is currently displayed
    setCelebrating((prev) => {
      if (prev) return prev;
      return queueRef.current.shift() ?? null;
    });
  }, [userId, data]);

  function handleClose() {
    // Post shoutout for the skill we just finished celebrating
    if (celebrating) {
      createShoutout.mutate({
        skillId: celebrating.id,
        skillTitle: celebrating.title,
        branch: celebrating.branch,
      });
    }
    // Advance queue or clear
    setCelebrating(queueRef.current.shift() ?? null);
  }

  if (!celebrating) return null;

  return (
    <CelebrationOverlay
      skillTitle={celebrating.title}
      branch={celebrating.branch}
      onClose={handleClose}
    />
  );
}
