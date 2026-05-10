import type { Politician } from "@/lib/types";

export const DAILY_CHALLENGE_SIZE = 10;
export const DAILY_CHALLENGE_TIME_ZONE = "Europe/Bucharest";

function dateParts(now: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: DAILY_CHALLENGE_TIME_ZONE,
      year: "numeric"
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
}

export function dailyChallengeDateKey(now = new Date()): string {
  const parts = dateParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: T[], seedText: string): T[] {
  const random = randomFromSeed(hashString(seedText));
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function selectDailyPoliticians<T extends Pick<Politician, "id" | "party_key">>(
  politicians: T[],
  dateKey: string,
  size = DAILY_CHALLENGE_SIZE
): T[] {
  const buckets = new Map<string, T[]>();
  for (const politician of [...politicians].sort((a, b) => a.id.localeCompare(b.id))) {
    buckets.set(politician.party_key, [...(buckets.get(politician.party_key) ?? []), politician]);
  }

  const partyKeys = deterministicShuffle(Array.from(buckets.keys()).sort(), `${dateKey}:parties`);
  const shuffledBuckets = new Map(
    partyKeys.map((partyKey) => [partyKey, deterministicShuffle(buckets.get(partyKey) ?? [], `${dateKey}:${partyKey}`)])
  );
  const selected: T[] = [];

  while (selected.length < size && partyKeys.some((partyKey) => (shuffledBuckets.get(partyKey)?.length ?? 0) > 0)) {
    for (const partyKey of partyKeys) {
      const bucket = shuffledBuckets.get(partyKey);
      const next = bucket?.shift();
      if (next) selected.push(next);
      if (selected.length >= size) break;
    }
  }

  return selected;
}
