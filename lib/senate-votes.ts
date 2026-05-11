import * as cheerio from "cheerio";
import { normalizeVoteStance, type RawVoteRow } from "@/lib/votes";

export type ParsedSenateNominalVote = {
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

export type SenateCalendarPostback = {
  target: string;
  argument: string;
  title: string;
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanPartyLabel(value: string): string {
  return cleanText(value.replace(/^Image/i, ""));
}

function numberAfter(text: string, label: RegExp): number {
  const match = text.match(label);
  return Number(match?.[1] ?? 0);
}

export function parseSenateVoteLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = $("a")
    .map((_, anchor) => $(anchor).attr("href") ?? "")
    .get()
    .filter((href) => /VoturiPlenDetaliu\.aspx/i.test(href) && /AppID=/i.test(href))
    .map((href) => new URL(href.replaceAll("\\", "/"), baseUrl).toString());

  return Array.from(new Set(links));
}

export function parseSenateHiddenFields(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  $("input[type='hidden']").each((_, input) => {
    const name = $(input).attr("name") ?? "";
    if (name) fields[name] = $(input).attr("value") ?? "";
  });
  return fields;
}

export function parseSenateCalendarPostbacks(html: string): SenateCalendarPostback[] {
  const $ = cheerio.load(html);
  const postbacks = $("a[href*='__doPostBack']")
    .map((_, anchor) => {
      const href = $(anchor).attr("href") ?? "";
      const match = href.match(/__doPostBack\('([^']+)','([^']*)'\)/);
      if (!match || !/calVOT/.test(match[1])) return null;
      return {
        target: match[1],
        argument: match[2],
        title: $(anchor).attr("title") ?? cleanText($(anchor).text())
      } satisfies SenateCalendarPostback;
    })
    .get()
    .filter(Boolean) as SenateCalendarPostback[];

  return Array.from(new Map(postbacks.map((postback) => [`${postback.target}:${postback.argument}`, postback])).values());
}

export function parseSenateNominalVoteHtml(html: string): ParsedSenateNominalVote {
  const $ = cheerio.load(html);
  const bodyText = cleanText($("body").text());
  const title = cleanText($("h5, h4, h3").filter((_, item) => /Proiect|Propunere|Lege/i.test($(item).text())).first().text())
    || cleanText($("h5, h4, h3").first().text())
    || bodyText.slice(0, 140);
  const billNumber = bodyText.match(/\bL\d+\/\d{4}\b/i)?.[0] ?? "";
  const votedAt = bodyText.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0]
    ?? bodyText.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/)?.[0]
    ?? "";

  const rows = $("tr")
    .map((_, row) => {
      const cells = $(row).find("td, th").map((__, cell) => cleanText($(cell).text())).get();
      if (cells.length < 6) return null;
      const [lastName, firstName, rawParty, forMark, againstMark, abstainMark] = cells;
      if (/^nume$/i.test(lastName) || /^prenume$/i.test(firstName)) return null;
      const partyLabel = cleanPartyLabel(rawParty);
      const voteCell = forMark ? "Pentru" : againstMark ? "Contra" : abstainMark ? "Abțineri" : "";
      const stance = normalizeVoteStance(voteCell);
      if (!partyLabel || !stance || /Grup/i.test(lastName)) return null;
      return {
        name: cleanText(`${lastName} ${firstName}`),
        partyLabel,
        stance
      } satisfies RawVoteRow;
    })
    .get()
    .filter(Boolean) as RawVoteRow[];

  return {
    rows,
    title,
    billNumber,
    votedAt,
    totals: {
      present: numberAfter(bodyText, /Prezenţi:\s*(\d+)/i),
      for: numberAfter(bodyText, /Pentru:\s*(\d+)/i),
      against: numberAfter(bodyText, /Contra:\s*(\d+)/i),
      abstain: numberAfter(bodyText, /Abţineri:\s*(\d+)/i)
    }
  };
}
