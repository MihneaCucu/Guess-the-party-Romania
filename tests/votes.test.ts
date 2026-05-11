import { describe, expect, it } from "vitest";
import { parseCdepNominalVoteHtml, parseCdepVoteLinks } from "@/lib/cdep-votes";
import { computePartyPositions, eligibleQuestionTargets, isUniquePartyForStance, normalizeVoteStance } from "@/lib/votes";

describe("legislative votes", () => {
  it("normalizes Romanian vote stances", () => {
    expect(normalizeVoteStance("Pentru")).toBe("for");
    expect(normalizeVoteStance("Contra")).toBe("against");
    expect(normalizeVoteStance("Abținere")).toBe("abstain");
    expect(normalizeVoteStance("Absent")).toBeNull();
  });

  it("computes only party positions with a strict majority", () => {
    const positions = computePartyPositions("vote-1", [
      { name: "A", partyLabel: "PSD", stance: "for" },
      { name: "B", partyLabel: "PSD", stance: "for" },
      { name: "C", partyLabel: "PSD", stance: "against" },
      { name: "D", partyLabel: "USR", stance: "against" },
      { name: "E", partyLabel: "USR", stance: "for" }
    ]);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      party_key: "PSD",
      stance: "for",
      vote_count: 2,
      party_present_count: 3,
      majority_share: 0.6667
    });
  });

  it("filters ambiguous question targets", () => {
    const positions = computePartyPositions("vote-1", [
      { name: "A", partyLabel: "PSD", stance: "for" },
      { name: "B", partyLabel: "PSD", stance: "for" },
      { name: "C", partyLabel: "PNL", stance: "for" },
      { name: "D", partyLabel: "PNL", stance: "for" },
      { name: "E", partyLabel: "USR", stance: "against" },
      { name: "F", partyLabel: "USR", stance: "against" }
    ]);

    expect(isUniquePartyForStance(positions, "PSD", "for")).toBe(false);
    expect(isUniquePartyForStance(positions, "USR", "against")).toBe(true);
    expect(eligibleQuestionTargets(positions).map((position) => position.party_key)).toEqual(["USR"]);
  });

  it("parses CDEP nominal vote links and simple nominal rows", () => {
    const links = parseCdepVoteLinks(
      '<a href="/pls/steno/evot2015.nominal?idv=22170&ord=2">vot nominal</a>',
      "https://www.cdep.ro/pls/steno/evot2015.lista?cam=2&leg=2024&idl=1"
    );
    expect(links).toEqual(["https://www.cdep.ro/pls/steno/evot2015.nominal?idv=22170&ord=2"]);

    const parsed = parseCdepNominalVoteHtml(`
      <html>
        <body>
          <h2>Vot final PL-x 47/2025 din 26.02.2025</h2>
          <table>
            <tr><th>Nume</th><th>Grup</th><th>Vot</th></tr>
            <tr><td>Deputat PSD</td><td>Grupul parlamentar al Partidului Social Democrat</td><td>Pentru</td></tr>
            <tr><td>Deputat USR</td><td>Grupul parlamentar al Uniunii Salvați România</td><td>Contra</td></tr>
          </table>
        </body>
      </html>
    `);

    expect(parsed.billNumber).toBe("PL-x 47/2025");
    expect(parsed.votedAt).toBe("26.02.2025");
    expect(parsed.rows).toEqual([
      { name: "Deputat PSD", partyLabel: "Grupul parlamentar al Partidului Social Democrat", stance: "for" },
      { name: "Deputat USR", partyLabel: "Grupul parlamentar al Uniunii Salvați România", stance: "against" }
    ]);
  });
});
