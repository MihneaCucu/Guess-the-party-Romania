import { describe, expect, it } from "vitest";
import { parseCdepNominalVoteHtml, parseCdepVoteLinks } from "@/lib/cdep-votes";
import { parseSenateCalendarPostbacks, parseSenateHiddenFields, parseSenateNominalVoteHtml, parseSenateVoteLinks } from "@/lib/senate-votes";
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

  it("parses Senate vote links and simple nominal rows", () => {
    const links = parseSenateVoteLinks(
      '<a href="/VoturiPlenDetaliu.aspx?AppID=a4024245-ab3a-4f14-af32-ed323d820c52">detalii</a>',
      "https://www.senat.ro/voturiplen.aspx"
    );
    expect(links).toEqual(["https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=a4024245-ab3a-4f14-af32-ed323d820c52"]);

    const parsed = parseSenateNominalVoteHtml(`
      <html>
        <body>
          <h3>VOTUL ELECTRONIC din 29/09/2025</h3>
          <h4>L214/2025</h4>
          <h5>Proiect de lege privind plata pensiilor private</h5>
          <ul>
            <li>Prezenţi: 119</li>
            <li>Pentru: 82</li>
            <li>Contra: 34</li>
            <li>Abţineri: 2</li>
          </ul>
          <table>
            <tr><th>Nume</th><th>Prenume</th><th>Grup</th><th>Pentru</th><th>Contra</th><th>Abţineri</th><th>Prezent - Nu au votat</th></tr>
            <tr><td>BICĂ</td><td>Andra</td><td>ImagePSD</td><td>X</td><td></td><td></td><td></td></tr>
            <tr><td>VÂNTU</td><td>Cristian</td><td>ImageAUR</td><td></td><td>X</td><td></td><td></td></tr>
          </table>
        </body>
      </html>
    `);

    expect(parsed.billNumber).toBe("L214/2025");
    expect(parsed.votedAt).toBe("29/09/2025");
    expect(parsed.totals).toMatchObject({ present: 119, for: 82, against: 34, abstain: 2 });
    expect(parsed.rows).toEqual([
      { name: "BICĂ Andra", partyLabel: "PSD", stance: "for" },
      { name: "VÂNTU Cristian", partyLabel: "AUR", stance: "against" }
    ]);
  });

  it("parses Senate calendar postback fields for vote discovery", () => {
    const html = `
      <input type="hidden" name="__VIEWSTATE" value="state" />
      <input type="hidden" name="__VIEWSTATEGENERATOR" value="generator" />
      <a href="javascript:__doPostBack('ctl00$B_Center$VoturiPlen1$calVOT','9620')" title="4 mai">4</a>
    `;

    expect(parseSenateHiddenFields(html)).toEqual({
      __VIEWSTATE: "state",
      __VIEWSTATEGENERATOR: "generator"
    });
    expect(parseSenateCalendarPostbacks(html)).toEqual([
      {
        target: "ctl00$B_Center$VoturiPlen1$calVOT",
        argument: "9620",
        title: "4 mai"
      }
    ]);
  });
});
