import { describe, expect, it } from "vitest";
import { dailyChallengeDateKey, DAILY_CHALLENGE_SIZE, selectDailyPoliticians } from "@/lib/daily";
import { MOCK_POLITICIANS } from "@/lib/mock-data";
import { playablePoliticians } from "@/lib/shuffle";

describe("daily challenge", () => {
  it("uses the Europe/Bucharest calendar day", () => {
    expect(dailyChallengeDateKey(new Date("2026-05-10T20:59:00.000Z"))).toBe("2026-05-10");
    expect(dailyChallengeDateKey(new Date("2026-05-10T21:01:00.000Z"))).toBe("2026-05-11");
  });

  it("selects a stable daily set for a date", () => {
    const politicians = playablePoliticians(MOCK_POLITICIANS);
    const first = selectDailyPoliticians(politicians, "2026-05-11").map((politician) => politician.id);
    const second = selectDailyPoliticians(politicians, "2026-05-11").map((politician) => politician.id);

    expect(first).toEqual(second);
    expect(first).toHaveLength(Math.min(DAILY_CHALLENGE_SIZE, politicians.length));
    expect(new Set(first).size).toBe(first.length);
  });

  it("changes the challenge across dates", () => {
    const politicians = playablePoliticians(MOCK_POLITICIANS);
    const first = selectDailyPoliticians(politicians, "2026-05-11").map((politician) => politician.id);
    const next = selectDailyPoliticians(politicians, "2026-05-12").map((politician) => politician.id);

    expect(first).not.toEqual(next);
  });
});
