/**
 * workout-preferences — localStorage helpers for user workout preferences.
 *
 * Persisted across sessions. All reads are safe (try/catch for private browsing).
 */

// ─── Keys ─────────────────────────────────────────────────────────────────────

const VOICE_CUES_KEY    = "calicoach_voice_cues_v1";
const CAMERA_FACING_KEY = "calicoach_camera_facing_v1";
const MIRROR_VIDEO_KEY  = "calicoach_mirror_video_v1";
const VOICE_PROFILE_KEY = "calicoach_voice_profile_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CameraFacing = "user" | "environment";

// ─── Voice Cues ───────────────────────────────────────────────────────────────

/** Whether AI voice coaching cues play during workouts. Default: true */
export function getVoiceCues(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_CUES_KEY);
    return raw === null ? true : raw !== "false";
  } catch {
    return true;
  }
}

export function setVoiceCues(enabled: boolean): void {
  try { localStorage.setItem(VOICE_CUES_KEY, String(enabled)); } catch {}
}

// ─── Camera Facing ────────────────────────────────────────────────────────────

/** Which camera to use by default. Default: "user" (front-facing) */
export function getCameraFacing(): CameraFacing {
  try {
    const raw = localStorage.getItem(CAMERA_FACING_KEY);
    return raw === "environment" ? "environment" : "user";
  } catch {
    return "user";
  }
}

export function setCameraFacing(facing: CameraFacing): void {
  try { localStorage.setItem(CAMERA_FACING_KEY, facing); } catch {}
}

// ─── Mirror Video ─────────────────────────────────────────────────────────────

/** Whether the camera preview is horizontally mirrored. Default: true */
export function getMirrorVideo(): boolean {
  try {
    const raw = localStorage.getItem(MIRROR_VIDEO_KEY);
    return raw === null ? true : raw !== "false";
  } catch {
    return true;
  }
}

export function setMirrorVideo(mirrored: boolean): void {
  try { localStorage.setItem(MIRROR_VIDEO_KEY, String(mirrored)); } catch {}
}

// ─── Voice Profile ────────────────────────────────────────────────────────────

/**
 * Renamed/retired profile IDs — auto-migrate stale localStorage values so
 * workouts never silently fall through to the browser TTS fallback.
 */
const PROFILE_MIGRATIONS: Record<string, string> = {
  tokyo_tech: "rio_flair",
  powerlifter: "ogre",
};

/** Which AI coaching personality to use. Default: "classic" */
export function getVoiceProfile(): string {
  try {
    const raw = localStorage.getItem(VOICE_PROFILE_KEY) ?? "classic";
    const migrated = PROFILE_MIGRATIONS[raw];
    if (migrated) {
      // Rewrite the stale key so future reads are already correct.
      localStorage.setItem(VOICE_PROFILE_KEY, migrated);
      return migrated;
    }
    return raw;
  } catch {
    return "classic";
  }
}

export function setVoiceProfile(profileId: string): void {
  try { localStorage.setItem(VOICE_PROFILE_KEY, profileId); } catch {}
}
