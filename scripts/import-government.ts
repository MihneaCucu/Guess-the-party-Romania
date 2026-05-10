import * as cheerio from "cheerio";
import { normalizePartyKey, partyLabelFor, slugify } from "../lib/parties";

const SOURCE_URL = "https://gov.ro/ro/guvernul/cabinetul-de-ministri";

const PARTY_OVERRIDES: Record<string, string> = {
  "ilie-bolojan": "PNL",
  "tanczos-barna": "UDMR",
  "marian-catalin-predoiu": "PNL",
  "radu-dinel-miruta": "USR",
  "alexandru-nazare": "PNL",
  "dragos-nicolae-pislaru": "USR",
  "mihai-dimian": "USR",
  "oana-silvia-toiu": "USR",
  "diana-anda-buzoianu": "USR",
  "ambrozie-irineu-darau": "USR",
  "cseke-attila-zoltan": "UDMR",
  "demeter-andras-istvan": "UDMR",
  "oana-clara-gheorghiu": "NEAFILIATI"
};

type ImportedPolitician = {
  id: string;
  name: string;
  slug: string;
  party_key: string;
  party_label: string;
  chamber: "Guvern";
  constituency: string;
  photo_url: string;
  source_url: string;
  active: true;
  review_status: "needs_review";
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

function ministerFromElement($: cheerio.CheerioAPI, element: Parameters<cheerio.CheerioAPI>[0]): ImportedPolitician | null {
  const container = $(element);
  const image = container.find("img").first();
  const photoUrl = image.attr("src") ?? "";
  const name = image.attr("alt")?.replace(/\s+/g, " ").trim() || container.find("h3 a").first().text().replace(/\s+/g, " ").trim();
  const sourceUrl = container.find("h3 a").first().attr("href") || image.parent("a").attr("href") || SOURCE_URL;
  const role = container.find(".ministriiDescriere p").first().text().replace(/\s+/g, " ").trim();
  if (!name || !photoUrl || !/\/fisiere\/ministri\//i.test(photoUrl)) return null;

  const slug = slugify(name);
  const partyKey = normalizePartyKey(PARTY_OVERRIDES[slug] ?? "NEAFILIATI");

  return {
    id: `gov-${slug}`,
    name,
    slug,
    party_key: partyKey,
    party_label: partyLabelFor(partyKey),
    chamber: "Guvern",
    constituency: role,
    photo_url: new URL(photoUrl, SOURCE_URL).toString(),
    source_url: new URL(sourceUrl, SOURCE_URL).toString(),
    active: true,
    review_status: "needs_review"
  };
}

async function main() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const rows = [$(".ministrii").first(), ...$(".ministriiBox").toArray()]
    .map((element) => ministerFromElement($, element))
    .filter((row): row is ImportedPolitician => Boolean(row));

  process.stdout.write(toCsv(rows));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
