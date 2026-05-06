const REST_DURATION_KEY = "calicoach_rest_duration_v1";
const DEFAULT_REST_SECS = 90;

export type RestDuration = 30 | 60 | 90 | 120 | 180;
export const REST_DURATION_OPTIONS: RestDuration[] = [30, 60, 90, 120, 180];

export function getRestDuration(): RestDuration {
  try {
    const raw = localStorage.getItem(REST_DURATION_KEY);
    const n   = raw ? parseInt(raw, 10) : DEFAULT_REST_SECS;
    return (REST_DURATION_OPTIONS as number[]).includes(n)
      ? (n as RestDuration)
      : DEFAULT_REST_SECS;
  } catch {
    return DEFAULT_REST_SECS;
  }
}

export function setRestDuration(d: RestDuration): void {
  try { localStorage.setItem(REST_DURATION_KEY, String(d)); } catch {}
}
