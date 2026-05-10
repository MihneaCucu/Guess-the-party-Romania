import { randomInt } from "node:crypto";
import type { Politician, PoliticianScope } from "@/lib/types";

export function playablePoliticians(politicians: Politician[]): Politician[] {
  return politicians.filter((politician) => politician.active && politician.review_status === "approved" && Boolean(politician.photo_url));
}

export function filterPoliticiansByScope(politicians: Politician[], scope: PoliticianScope): Politician[] {
  if (scope === "all") return politicians;
  return politicians.filter((politician) => politician.chamber === scope);
}

export function selectUnseenPolitician(candidates: Politician[], seenIds: Set<string>): {
  politician: Politician;
  resetCycle: boolean;
  remainingAfterPick: number;
} {
  if (candidates.length === 0) {
    throw new Error("No approved politicians with photos are available.");
  }

  const unseen = candidates.filter((politician) => !seenIds.has(politician.id));
  const pool = unseen.length > 0 ? unseen : candidates;
  const resetCycle = unseen.length === 0;
  const politician = pool[randomInt(pool.length)];
  const remainingAfterPick = Math.max(0, pool.length - 1);

  return { politician, resetCycle, remainingAfterPick };
}
