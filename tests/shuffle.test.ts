import { describe, expect, it } from "vitest";
import { MOCK_POLITICIANS } from "@/lib/mock-data";
import { filterPoliticiansByScope, playablePoliticians, selectUnseenPolitician } from "@/lib/shuffle";

describe("shuffle", () => {
  it("selects only unseen politicians before a cycle resets", () => {
    const candidates = playablePoliticians(MOCK_POLITICIANS).slice(0, 3);
    const seen = new Set(candidates.slice(0, 2).map((politician) => politician.id));
    const result = selectUnseenPolitician(candidates, seen);

    expect(result.resetCycle).toBe(false);
    expect(result.politician.id).toBe(candidates[2].id);
    expect(result.remainingAfterPick).toBe(0);
  });

  it("starts a new cycle when every politician has been seen", () => {
    const candidates = playablePoliticians(MOCK_POLITICIANS).slice(0, 3);
    const seen = new Set(candidates.map((politician) => politician.id));
    const result = selectUnseenPolitician(candidates, seen);

    expect(result.resetCycle).toBe(true);
    expect(candidates.map((politician) => politician.id)).toContain(result.politician.id);
    expect(result.remainingAfterPick).toBe(2);
  });

  it("counts only active approved politicians with photos as playable", () => {
    const [first] = MOCK_POLITICIANS;
    const playable = playablePoliticians([
      first,
      { ...first, id: "inactive", active: false },
      { ...first, id: "review", review_status: "needs_review" },
      { ...first, id: "photo", photo_url: "" }
    ]);

    expect(playable).toHaveLength(1);
    expect(playable[0].id).toBe(first.id);
  });

  it("filters playable politicians by selected source", () => {
    const playable = playablePoliticians(MOCK_POLITICIANS);

    expect(filterPoliticiansByScope(playable, "Senat").every((politician) => politician.chamber === "Senat")).toBe(true);
    expect(filterPoliticiansByScope(playable, "Camera Deputatilor").every((politician) => politician.chamber === "Camera Deputatilor")).toBe(true);
    expect(filterPoliticiansByScope(playable, "Guvern").every((politician) => politician.chamber === "Guvern")).toBe(true);
    expect(filterPoliticiansByScope(playable, "Parlamentul European").every((politician) => politician.chamber === "Parlamentul European")).toBe(true);
    expect(filterPoliticiansByScope(playable, "all")).toHaveLength(playable.length);
  });
});
