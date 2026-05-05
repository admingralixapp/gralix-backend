/**
 * clip-store.ts — localStorage-backed clip registry.
 *
 * Each AI-verified session can have one clip stored here after upload.
 * Clips expire based on the user's retention preference (3 / 7 / 14 days).
 * purgeExpiredClips() should be called on app startup and whenever the
 * retention preference changes.
 *
 * Expiry is evaluated dynamically against uploadedAt + current preference,
 * so changing the preference immediately affects existing clips.
 */

const STORE_KEY     = "calicoach_clips_v1";
const RETENTION_KEY = "calicoach_retention_pref";

export type RetentionDays = 3 | 7 | 14;
export const RETENTION_OPTIONS: RetentionDays[] = [3, 7, 14];
const DEFAULT_RETENTION: RetentionDays = 7;

export interface ClipRecord {
  sessionId:    number;
  exerciseName: string;
  objectPath:   string;
  isAiVerified: boolean;
  uploadedAt:   number;
  /** Stored for reference only — effective expiry is uploadedAt + getRetentionDays() */
  expiresAt:    number;
}

// ─── Retention preference ─────────────────────────────────────────────────────

export function getRetentionDays(): RetentionDays {
  try {
    const raw = localStorage.getItem(RETENTION_KEY);
    const parsed = raw ? (Number(raw) as RetentionDays) : DEFAULT_RETENTION;
    return RETENTION_OPTIONS.includes(parsed) ? parsed : DEFAULT_RETENTION;
  } catch {
    return DEFAULT_RETENTION;
  }
}

export function setRetentionDays(days: RetentionDays): void {
  try {
    localStorage.setItem(RETENTION_KEY, String(days));
  } catch { /* quota */ }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ttlMs(): number {
  return getRetentionDays() * 24 * 60 * 60 * 1000;
}

function effectiveExpiry(rec: ClipRecord): number {
  return rec.uploadedAt + ttlMs();
}

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
 * TTL is set from the current retention preference.
 */
export function storeClip(
  clip: Omit<ClipRecord, "uploadedAt" | "expiresAt">,
): void {
  const store = loadAll();
  const now   = Date.now();
  const expiry = now + ttlMs();
  store[clip.sessionId] = {
    ...clip,
    uploadedAt: now,
    expiresAt:  expiry,
  };
  saveAll(store);
}

/**
 * Retrieve a clip record for a session.
 * Expiry is evaluated against the current retention preference.
 * Returns null (and removes the entry) if expired.
 */
export function getClip(sessionId: number): ClipRecord | null {
  const store = loadAll();
  const rec   = store[sessionId];
  if (!rec) return null;

  const expiry = effectiveExpiry(rec);
  if (Date.now() > expiry) {
    delete store[sessionId];
    saveAll(store);
    return null;
  }

  // Return with updated expiresAt so callers see the live value
  return { ...rec, expiresAt: expiry };
}

/** Remove a clip record manually. */
export function removeClip(sessionId: number): void {
  const store = loadAll();
  delete store[sessionId];
  saveAll(store);
}

/**
 * Purge all clips whose uploadedAt + current retention preference is in the past.
 * Call on app startup and whenever the retention preference changes.
 */
export function purgeExpiredClips(): void {
  const store   = loadAll();
  const now     = Date.now();
  let   changed = false;
  for (const key of Object.keys(store)) {
    if (now > effectiveExpiry(store[key])) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) saveAll(store);
}

/**
 * Delete every stored clip. Workout stats are preserved in the cloud.
 * Returns the number of clips that were removed.
 */
export function clearAllClips(): number {
  const store = loadAll();
  const count = Object.keys(store).length;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch { /* ignore */ }
  return count;
}

/**
 * Number of clips currently stored on this device (non-expired).
 */
export function getClipCount(): number {
  const store = loadAll();
  const now   = Date.now();
  return Object.values(store).filter(r => now <= effectiveExpiry(r)).length;
}

/**
 * How many days until a specific clip expires (under current preference).
 * Returns null if no clip or already expired.
 */
export function daysUntilExpiry(sessionId: number): number | null {
  const rec = getClip(sessionId);
  if (!rec) return null;
  return Math.max(0, Math.ceil((rec.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}
