import * as cheerio from "cheerio";
import { normalizeVoteStance, type RawVoteRow } from "@/lib/votes";

export type ParsedCdepNominalVote = {
  rows: RawVoteRow[];
  title: string;
  billNumber: string;
  votedAt: string;
  totals: {
    for: number;
    against: number;
    abstain: number;
    present: number;
  };
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function numberAfter(text: string, label: RegExp): number {
  const match = text.match(label);
  return Number(match?.[1] ?? 0);
}

export function parseCdepVoteLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = $("a")
    .map((_, anchor) => $(anchor).attr("href") ?? "")
    .get()
    .filter((href) => /evot2015\.nominal/i.test(href) && /idv=/i.test(href))
    .map((href) => new URL(href.replaceAll("\\", "/"), baseUrl).toString());

  return Array.from(new Set(links));
}

export function parseCdepNominalVoteHtml(html: string): ParsedCdepNominalVote {
  const $ = cheerio.load(html);
  const bodyText = cleanText($("body").text());
  const heading = cleanText($("h1, h2, h3, caption, b").first().text());
  const billNumber = bodyText.match(/(?:PL-x|BP|L)\s*\d+\/\d{4}/i)?.[0] ?? "";
  const votedAt = bodyText.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/)?.[0] ?? "";

  const rows = $("tr")
    .map((_, row) => {
      const cells = $(row).find("td, th").map((__, cell) => cleanText($(cell).text())).get().filter(Boolean);
      const stanceCell = cells.find((cell) => normalizeVoteStance(cell));
      if (!stanceCell) return null;

      const partyCell = cells.find((cell) => /grup|partid|minoritat|neafiliat/i.test(cell))
        ?? cells.find((cell) => /^(psd|pnl|usr|aur|udmr|s\.?o\.?s\.?|pot)$/i.test(cell))
        ?? "";
      const nameCell = cells.find((cell) => cell !== stanceCell && cell !== partyCell && /[A-Za-zĂÂÎȘȚăâîșț]/.test(cell)) ?? "";
      const stance = normalizeVoteStance(stanceCell);
      if (!partyCell || !stance) return null;
      return { name: nameCell, partyLabel: partyCell, stance } satisfies RawVoteRow;
    })
    .get()
    .filter(Boolean) as RawVoteRow[];

  return {
    rows,
    title: heading || bodyText.slice(0, 140),
    billNumber,
    votedAt,
    totals: {
      present: numberAfter(bodyText, /Prezen(?:ț|t)i:\s*(\d+)/i),
      for: numberAfter(bodyText, /Pentru:\s*(\d+)/i),
      against: numberAfter(bodyText, /Contra:\s*(\d+)/i),
      abstain: numberAfter(bodyText, /Ab(?:ț|t)ineri:\s*(\d+)/i)
    }
  };
}
