/**
 * clip-store.ts — localStorage-backed clip registry.
 *
 * Each AI-verified session can have one clip stored here after upload.
 * Clips expire automatically after 7 days to save device space.
 * purgeExpiredClips() should be called on app startup.
 */

const STORE_KEY = "calicoach_clips_v1";
const TTL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ClipRecord {
  sessionId:    number;
  exerciseName: string;
  objectPath:   string;
  isAiVerified: boolean;
  uploadedAt:   number;
  expiresAt:    number;
}

// ─── Internal I/O ─────────────────────────────────────────────────────────────

function loadAll(): Record<string, ClipRecord> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ClipRecord>) : {};
  } catch {
    return {};
  }
}

function saveAll(store: Record<string, ClipRecord>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a clip reference after a successful upload.
 * Overwrites any existing record for the same sessionId.
 */
export function storeClip(
  clip: Omit<ClipRecord, "uploadedAt" | "expiresAt">,
): void {
  const store = loadAll();
  const now   = Date.now();
  store[clip.sessionId] = {
    ...clip,
    uploadedAt: now,
    expiresAt:  now + TTL_MS,
  };
  saveAll(store);
}

/**
 * Retrieve a clip record for a session.
 * Returns null if not found or already expired (and removes it).
 */
export function getClip(sessionId: number): ClipRecord | null {
  const store = loadAll();
  const rec   = store[sessionId];
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) {
    delete store[sessionId];
    saveAll(store);
    return null;
  }
  return rec;
}

/** Remove a clip record manually. */
export function removeClip(sessionId: number): void {
  const store = loadAll();
  delete store[sessionId];
  saveAll(store);
}

/**
 * Purge all expired clips. Call once on app startup.
 */
export function purgeExpiredClips(): void {
  const store   = loadAll();
  const now     = Date.now();
  let   changed = false;
  for (const key of Object.keys(store)) {
    if (now > store[key].expiresAt) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) saveAll(store);
}

/**
 * How many days until this clip expires.
 * Returns null if no clip or already expired.
 */
export function daysUntilExpiry(sessionId: number): number | null {
  const rec = getClip(sessionId);
  if (!rec) return null;
  return Math.max(0, Math.ceil((rec.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}
