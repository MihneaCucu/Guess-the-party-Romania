import * as cheerio from "cheerio";
import { normalizePartyKey, partyLabelFor, slugify, stripDiacritics } from "../lib/parties";

const SOURCE_URL = "https://www.senat.ro/FisaSenatori.aspx";

type ImportedPolitician = {
  id: string;
  name: string;
  slug: string;
  party_key: string;
  party_label: string;
  chamber: "Senat";
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
  const timeout = setTimeout(() => controller.abort(), 8000);
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

async function photoFromDetail(url: string): Promise<string> {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const image = $("img")
    .map((_, img) => $(img).attr("src") ?? "")
    .get()
    .find((src) => /poze|senatori|foto|image/i.test(src));

  return image ? absolutize(image) : "";
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

function textAfter(lines: string[], index: number, pattern: RegExp): string {
  for (let cursor = index + 1; cursor < Math.min(index + 10, lines.length); cursor += 1) {
    if (pattern.test(lines[cursor])) return lines[cursor];
  }
  return "";
}

async function main() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const bodyLines = $("body")
    .text()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const links = $("a")
    .map((_, anchor) => ({
      name: $(anchor).text().replace(/\s+/g, " ").trim(),
      href: $(anchor).attr("href") ?? ""
    }))
    .get()
    .filter((link) => /FisaSenator\.aspx\?ParlamentarID=/i.test(link.href))
    .filter((link) => /^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚĂÂÎȘȚ\s-]+ [A-ZĂÂÎȘȚA-Za-zăâîșț.-]+/.test(link.name));

  const uniqueLinks = Array.from(new Map(links.map((link) => [link.href, link])).values());

  const rows = await mapWithConcurrency(uniqueLinks, 8, async (link) => {
    const lineIndex = bodyLines.findIndex((line) => line === link.name);
    const constituency = textAfter(bodyLines, lineIndex, /Circumscrip/i);
    const group = textAfter(bodyLines, lineIndex, /Grupul parlamentar|neafilia/i);
    const detailUrl = link.href ? absolutize(link.href) : SOURCE_URL;
    const photoUrl = detailUrl === SOURCE_URL ? "" : await photoFromDetail(detailUrl).catch(() => "");
    const partyKey = normalizePartyKey(group);
    const slug = slugify(link.name);

    return {
      id: `sen-${slug}`,
      name: link.name,
      slug,
      party_key: partyKey,
      party_label: partyLabelFor(partyKey, stripDiacritics(group)),
      chamber: "Senat",
      constituency,
      photo_url: photoUrl,
      source_url: detailUrl,
      active: true,
      review_status: "needs_review"
    } satisfies ImportedPolitician;
  });

  process.stdout.write(toCsv(rows.filter((row) => row.photo_url)));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
