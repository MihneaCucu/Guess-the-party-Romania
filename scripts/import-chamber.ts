import * as cheerio from "cheerio";
import { normalizePartyKey, partyLabelFor, slugify, stripDiacritics } from "../lib/parties";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SOURCE_URL = "https://www.cdep.ro/pls/parlam/structura2015.de?leg=2024&cam=2&idl=1";

type ImportedPolitician = {
  id: string;
  name: string;
  slug: string;
  party_key: string;
  party_label: string;
  chamber: "Camera Deputatilor";
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

function absolutize(url: string): string {
  return new URL(url.replaceAll("\\", "/"), SOURCE_URL).toString();
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

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function fieldBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = text.match(start);
  if (!startMatch?.index) return "";
  const startIndex = startMatch.index + startMatch[0].length;
  const tail = text.slice(startIndex);
  const endMatch = tail.match(end);
  return (endMatch ? tail.slice(0, endMatch.index) : tail).replace(/\s+/g, " ").trim();
}

function profileId(url: string): string {
  return new URL(url).searchParams.get("idm") ?? slugify(url);
}

async function importDeputy(link: { href: string; name: string }): Promise<ImportedPolitician | null> {
  const detailUrl = absolutize(link.href);
  const html = await fetchText(detailUrl).catch(() => "");
  if (!html) return null;

  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const portrait = $("img")
    .map((_, image) => ({
      src: $(image).attr("src") ?? "",
      alt: $(image).attr("alt")?.replace(/\s+/g, " ").trim() ?? ""
    }))
    .get()
    .find((image) => /\/parlamentari\/l2024\//i.test(image.src));

  if (!portrait?.src) return null;

  const name = portrait.alt || link.name;
  const constituency = fieldBetween(
    bodyText,
    /(?:ales|aleasa)\s+deputat\s+în\s+/i,
    /data validării:/i
  );
  const formation = fieldBetween(bodyText, /Formaţiunea politică:\s*/i, /Grupul parlamentar:/i);
  const group = fieldBetween(bodyText, /Grupul parlamentar:\s*/i, /Comisii permanente|Grupuri de prietenie|Activitatea parlamentară/i);
  const partyKey = normalizePartyKey(group || formation);
  const slug = slugify(name);

  return {
    id: `dep-${profileId(detailUrl)}-${slug}`,
    name,
    slug,
    party_key: partyKey,
    party_label: partyLabelFor(partyKey, stripDiacritics(group || formation)),
    chamber: "Camera Deputatilor",
    constituency,
    photo_url: absolutize(portrait.src),
    source_url: detailUrl,
    active: true,
    review_status: "needs_review"
  };
}

async function main() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const links = $("a")
    .map((_, anchor) => ({
      name: $(anchor).text().replace(/\s+/g, " ").trim(),
      href: $(anchor).attr("href") ?? ""
    }))
    .get()
    .filter((link) => /structura2015\.mp/i.test(link.href))
    .filter((link) => /cam=2/i.test(link.href) && /leg=2024/i.test(link.href))
    .filter((link) => link.name.length > 0);

  const uniqueLinks = Array.from(new Map(links.map((link) => [link.href, link])).values());
  const rows = (await mapWithConcurrency(uniqueLinks, 8, importDeputy)).filter((row): row is ImportedPolitician => Boolean(row));

  process.stdout.write(toCsv(rows));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
