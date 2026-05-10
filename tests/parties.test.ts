import { describe, expect, it } from "vitest";
import { formatPersonName } from "@/lib/names";
import { getPartyOptions, normalizePartyKey, partyDisplayLabel, slugify } from "@/lib/parties";

describe("party normalization", () => {
  it("maps Romanian parliamentary group labels to game party keys", () => {
    expect(normalizePartyKey("Grupul parlamentar al Partidului Social Democrat")).toBe("PSD");
    expect(normalizePartyKey("Partidul Social Democrat")).toBe("PSD");
    expect(normalizePartyKey("Grupul parlamentar al Partidului Naţional Liberal")).toBe("PNL");
    expect(normalizePartyKey("Partidul Naţional Liberal")).toBe("PNL");
    expect(normalizePartyKey("Grupul parlamentar al Uniunii Salvați România")).toBe("USR");
    expect(normalizePartyKey("Uniunea Salvați România")).toBe("USR");
    expect(normalizePartyKey("Grupul parlamentar Alianța pentru Unirea Românilor")).toBe("AUR");
    expect(normalizePartyKey("Grupul parlamentar al Uniunii Democrate Maghiare din România")).toBe("UDMR");
    expect(normalizePartyKey("Uniunea Democrată Maghiară din România")).toBe("UDMR");
    expect(normalizePartyKey("Grupul parlamentar POTVicelider")).toBe("POT");
    expect(normalizePartyKey("Grupul parlamentar PACE – Întâi România")).toBe("PACE");
    expect(normalizePartyKey("Partidul Mișcarea Populară")).toBe("PMP");
    expect(normalizePartyKey("Partidul Umanist Social Liberal")).toBe("PUSL");
    expect(normalizePartyKey("Partidul Acțiunea Conservatoare")).toBe("PAC");
    expect(normalizePartyKey("Partidului Național Conservator Român (PNCR)")).toBe("PNCR");
    expect(normalizePartyKey("Dreptate și Frăție")).toBe("DREPTATE_FRATIE");
    expect(normalizePartyKey("Senatori neafiliați")).toBe("NEAFILIATI");
  });

  it("creates stable ascii slugs", () => {
    expect(slugify("CSEKE Attila-Zoltan")).toBe("cseke-attila-zoltan");
    expect(slugify("DÎRLĂU Andrei-Emil")).toBe("dirlau-andrei-emil");
  });

  it("creates deterministic fallback colors for extra party keys", () => {
    const first = getPartyOptions(["EXTRA_GROUP"]).find((party) => party.key === "EXTRA_GROUP")!;
    const second = getPartyOptions(["EXTRA_GROUP"]).find((party) => party.key === "EXTRA_GROUP")!;

    expect(first.color).toBe(second.color);
    expect(first.textColor).toBe("#ffffff");
  });

  it("localizes Romanian-only party labels for display", () => {
    expect(partyDisplayLabel("MINORITATI", "en")).toBe("Minorities");
    expect(partyDisplayLabel("NEAFILIATI", "en")).toBe("Unaffiliated");
    expect(partyDisplayLabel("MINORITATI", "ro")).toBe("Minorități");
    expect(partyDisplayLabel("NEAFILIATI", "ro")).toBe("Neafiliați");
    expect(partyDisplayLabel("PSD", "en")).toBe("PSD");
  });

  it("normalizes all-caps official surname tokens for display", () => {
    expect(formatPersonName("ABRUDEAN Mircea")).toBe("Abrudean Mircea");
    expect(formatPersonName("ALEXANDRU Victoria-Violeta")).toBe("Alexandru Victoria-Violeta");
    expect(formatPersonName("ANTAL István-Loránt")).toBe("Antal István-Loránt");
    expect(formatPersonName("Adrian-Felician Cozma")).toBe("Adrian-Felician Cozma");
  });
});
