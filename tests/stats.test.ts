import { describe, expect, it } from "vitest";
import { MOCK_POLITICIANS } from "@/lib/mock-data";
import { computeStats } from "@/lib/stats";
import type { GuessRecord, SessionRecord } from "@/lib/types";

const baseTime = "2026-05-10T12:00:00.000Z";

function guess(input: Partial<GuessRecord> & Pick<GuessRecord, "politician_id" | "actual_party" | "guessed_party" | "correct">): GuessRecord {
  return {
    id: crypto.randomUUID(),
    session_id: input.session_id ?? "00000000-0000-0000-0000-000000000001",
    created_at: baseTime,
    ...input
  };
}

describe("stats", () => {
  it("computes party accuracy and confusion matrix", () => {
    const politician = MOCK_POLITICIANS.find((item) => item.party_key === "PSD")!;
    const guesses = [
      guess({ politician_id: politician.id, actual_party: "PSD", guessed_party: "PSD", correct: true }),
      guess({ politician_id: politician.id, actual_party: "PSD", guessed_party: "PNL", correct: false })
    ];
    const sessions: SessionRecord[] = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        started_at: baseTime,
        last_seen_at: baseTime,
        guess_count: 2,
        best_streak: 1
      }
    ];

    const stats = computeStats(MOCK_POLITICIANS, guesses, sessions, 1);
    const psd = stats.partyAccuracy.find((item) => item.party === "PSD")!;
    const psdRow = stats.confusionMatrix.find((row) => row.actualParty === "PSD")!;

    expect(stats.totalGuesses).toBe(2);
    expect(stats.totalSessions).toBe(1);
    expect(stats.averagePerSession).toBe(2);
    expect(psd.correct).toBe(1);
    expect(psd.attempts).toBe(2);
    expect(psd.accuracy).toBe(0.5);
    expect(psdRow.guesses.PSD).toBe(1);
    expect(psdRow.guesses.PNL).toBe(1);
  });

  it("ranks easiest and hardest politicians by accuracy", () => {
    const psdPoliticians = MOCK_POLITICIANS.filter((item) => item.party_key === "PSD");
    const guesses = [
      guess({ politician_id: psdPoliticians[0].id, actual_party: "PSD", guessed_party: "PSD", correct: true }),
      guess({ politician_id: psdPoliticians[1].id, actual_party: "PSD", guessed_party: "PNL", correct: false })
    ];

    const stats = computeStats(MOCK_POLITICIANS, guesses, [], 1);

    expect(stats.easiest.PSD[0].politicianId).toBe(psdPoliticians[0].id);
    expect(stats.hardest.PSD[0].politicianId).toBe(psdPoliticians[1].id);
    expect(stats.mostMistakenAs.PNL[0].politicianId).toBe(psdPoliticians[1].id);
  });
});
