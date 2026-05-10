import * as cheerio from "cheerio";
import { normalizePartyKey, partyLabelFor, slugify, stripDiacritics } from "../lib/parties";

const SOURCE_URL = "https://www.europarl.europa.eu/meps/en/search/advanced?countryCode=RO";

type ImportedPolitician = {
  id: string;
  name: string;
  slug: string;
  party_key: string;
  party_label: string;
  chamber: "Parlamentul European";
  constituency: string;
  photo_url: string;
  source_url: string;
  active: true;
  review_status: "approved";
};

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ImportedPolitician[]): string {
  const headers = [
    "id",
    "name",
    "slug",
    "party_key",
    "party_label",
    "chamber",
    "constituency",
    "photo_url",
    "source_url",
    "active",
    "review_status"
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof ImportedPolitician])).join(","))
  ].join("\n");
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GuessThePartyRO/0.1 data import"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function profileId(url: string): string {
  const [, id] = new URL(url).pathname.match(/\/meps\/[a-z]{2}\/(\d+)/) ?? [];
  if (!id) throw new Error(`Could not parse MEP id from ${url}`);
  return id;
}

function normalizeName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ro-RO")
    .replace(/(^|[\s-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("ro-RO")}`);
}

function importMep($: cheerio.CheerioAPI, element: Parameters<cheerio.CheerioAPI>[0]): ImportedPolitician | null {
  const item = $(element);
  const sourceUrl = item.find("a.es_member-list-item-content").first().attr("href") ?? "";
  const id = sourceUrl ? profileId(sourceUrl) : item.attr("id")?.replace("member-block-", "") ?? "";
  const image = item.find(`img[src*="/mepphoto/${id}.jpg"]`).first();
  const rawName = image.attr("alt") || item.find(".es_title-h4").first().text();
  const name = normalizeName(rawName);
  const info = item.find(".sln-additional-info").map((_, node) => $(node).text().replace(/\s+/g, " ").trim()).get();
  const nationalParty = info[2] ?? "";
  if (!name || !nationalParty) return null;

  const slug = slugify(name);
  const partyKey = normalizePartyKey(nationalParty);

  return {
    id: `mep-${id}-${slug}`,
    name,
    slug,
    party_key: partyKey,
    party_label: partyLabelFor(partyKey, stripDiacritics(nationalParty)),
    chamber: "Parlamentul European",
    constituency: "Romania",
    photo_url: `https://www.europarl.europa.eu/mepphoto/${id}.jpg`,
    source_url: sourceUrl || `https://www.europarl.europa.eu/meps/en/${id}`,
    active: true,
    review_status: "approved"
  };
}

async function main() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const rows = $(".es_member-list-item")
    .map((_, element) => importMep($, element))
    .get()
    .filter((row): row is ImportedPolitician => Boolean(row));

  process.stdout.write(toCsv(rows));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
