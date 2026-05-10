import type { PartyKey, PartyOption } from "@/lib/types";
import type { Language } from "@/lib/i18n";

export const BASE_PARTIES: PartyOption[] = [
  { key: "PSD", label: "PSD", color: "#e53b4a", textColor: "#ffffff" },
  { key: "PNL", label: "PNL", color: "#0f3f8f", textColor: "#ffffff" },
  { key: "USR", label: "USR", color: "#39b8f2", textColor: "#ffffff" },
  { key: "AUR", label: "AUR", color: "#d9a61c", textColor: "#ffffff" },
  { key: "UDMR", label: "UDMR", color: "#22a968", textColor: "#ffffff" },
  { key: "SOS", label: "S.O.S.", color: "#222831", textColor: "#ffffff" },
  { key: "POT", label: "POT", color: "#7c4dff", textColor: "#ffffff" },
  { key: "PACE", label: "PACE", color: "#0f766e", textColor: "#ffffff" },
  { key: "MINORITATI", label: "Minoritati", color: "#7f8da3", textColor: "#ffffff" },
  { key: "NEAFILIATI", label: "Neafiliati", color: "#56657a", textColor: "#ffffff" }
];

const LOCALIZED_PARTY_LABELS: Partial<Record<PartyKey, Record<Language, string>>> = {
  MINORITATI: { en: "Minorities", ro: "Minorități" },
  NEAFILIATI: { en: "Unaffiliated", ro: "Neafiliați" }
};

const PARTY_ORDER = new Map(BASE_PARTIES.map((party, index) => [party.key, index]));

const ALIASES: Array<[RegExp, PartyKey]> = [
  [/partidului social democrat|^psd$/i, "PSD"],
  [/partidului national liberal|partidului naţional liberal|^pnl$/i, "PNL"],
  [/uniunii salvati romania|uniunii salvați românia|^usr$/i, "USR"],
  [/alianta pentru unirea romanilor|alianța pentru unirea românilor|grupul parlamentar aur|^aur$/i, "AUR"],
  [/uniunii democrate maghiare|^udmr|^rmdsz/i, "UDMR"],
  [/s\.?o\.?s\.?|^sos/i, "SOS"],
  [/partidul oamenilor tineri|grupul parlamentar pot|^pot$/i, "POT"],
  [/grupul parlamentar pace|intai romania|întâi românia|^pace$/i, "PACE"],
  [/minorit/i, "MINORITATI"],
  [/neafiliat/i, "NEAFILIATI"]
];

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePartyKey(rawGroup: string): PartyKey {
  const normalized = stripDiacritics(rawGroup).trim();
  for (const [pattern, key] of ALIASES) {
    if (pattern.test(rawGroup) || pattern.test(normalized)) {
      return key;
    }
  }

  return slugify(rawGroup).toUpperCase().replace(/-/g, "_");
}

export function partyLabelFor(key: PartyKey, rawLabel?: string): string {
  return BASE_PARTIES.find((party) => party.key === key)?.label ?? rawLabel ?? key;
}

export function partyDisplayLabel(party: Pick<PartyOption, "key" | "label"> | PartyKey, language: Language): string {
  const key = typeof party === "string" ? party : party.key;
  const fallback = typeof party === "string" ? partyLabelFor(party) : party.label;
  return LOCALIZED_PARTY_LABELS[key]?.[language] ?? fallback;
}

function fallbackColor(key: PartyKey): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 64% 42%)`;
}

export function getPartyOptions(keys: PartyKey[]): PartyOption[] {
  const uniqueKeys = Array.from(new Set([...BASE_PARTIES.map((party) => party.key), ...keys]));

  return uniqueKeys
    .map((key) => {
      const base = BASE_PARTIES.find((party) => party.key === key);
      return base ?? { key, label: key.replace(/_/g, " "), color: fallbackColor(key), textColor: "#ffffff" };
    })
    .sort((a, b) => (PARTY_ORDER.get(a.key) ?? 100) - (PARTY_ORDER.get(b.key) ?? 100) || a.label.localeCompare(b.label));
}
