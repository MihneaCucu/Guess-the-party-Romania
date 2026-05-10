const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  buckets.set(key, recent);

  return recent.length > MAX_REQUESTS;
}
