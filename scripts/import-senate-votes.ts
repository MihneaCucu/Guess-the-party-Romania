import { parseSenateNominalVoteHtml, parseSenateVoteLinks } from "../lib/senate-votes";
import { slugify } from "../lib/parties";
import { computePartyPositions, eligibleQuestionTargets } from "../lib/votes";
import type { LegislativePartyPosition, LegislativeVote } from "../lib/types";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DEFAULT_INDEX_URL = "https://www.senat.ro/voturiplen.aspx";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GuessThePartyRO/0.1 Senate vote import"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sourceVoteId(url: string): string {
  const parsed = new URL(url);
  return parsed.searchParams.get("AppID") ?? slugify(url);
}

function voteFromParsed(url: string, parsed: ReturnType<typeof parseSenateNominalVoteHtml>): LegislativeVote {
  const id = `senate-${sourceVoteId(url).toLowerCase()}`;
  const totalFor = parsed.rows.filter((row) => row.stance === "for").length;
  const totalAgainst = parsed.rows.filter((row) => row.stance === "against").length;
  const totalAbstain = parsed.rows.filter((row) => row.stance === "abstain").length;
  return {
    id,
    source_chamber: "senate",
    source_vote_id: sourceVoteId(url),
    voted_at: parsed.votedAt || new Date().toISOString().slice(0, 10),
    bill_number: parsed.billNumber,
    title: parsed.title || parsed.billNumber || `Senate vote ${sourceVoteId(url)}`,
    vote_type: "vot electronic",
    source_url: url,
    total_for: parsed.totals.for || totalFor,
    total_against: parsed.totals.against || totalAgainst,
    total_abstain: parsed.totals.abstain || totalAbstain,
    total_present: parsed.totals.present || totalFor + totalAgainst + totalAbstain,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function main() {
  const indexUrl = process.argv[2] ?? DEFAULT_INDEX_URL;
  const html = await fetchText(indexUrl);
  const links = parseSenateVoteLinks(html, indexUrl);
  const votes: LegislativeVote[] = [];
  const positions: LegislativePartyPosition[] = [];
  const questionCandidates: Record<string, unknown>[] = [];

  for (const link of links) {
    const parsed = parseSenateNominalVoteHtml(await fetchText(link));
    const vote = voteFromParsed(link, parsed);
    const votePositions = computePartyPositions(vote.id, parsed.rows);
    const targets = eligibleQuestionTargets(votePositions);
    if (targets.length === 0) continue;
    votes.push(vote);
    positions.push(...votePositions);
    questionCandidates.push(...targets.map((target) => ({
      id: `q-${vote.id}-${target.party_key.toLowerCase()}-${target.stance}`,
      vote_id: vote.id,
      target_party: target.party_key,
      target_stance: target.stance,
      prompt_ro: "",
      prompt_en: "",
      active: false,
      review_status: "needs_review",
      interesting: false
    })));
  }

  process.stdout.write("# legislative_votes\n");
  process.stdout.write(toCsv([
    "id",
    "source_chamber",
    "source_vote_id",
    "voted_at",
    "bill_number",
    "title",
    "vote_type",
    "source_url",
    "total_for",
    "total_against",
    "total_abstain",
    "total_present"
  ], votes));
  process.stdout.write("\n\n# legislative_party_positions\n");
  process.stdout.write(toCsv([
    "id",
    "vote_id",
    "party_key",
    "party_label",
    "stance",
    "vote_count",
    "party_present_count",
    "majority_share"
  ], positions));
  process.stdout.write("\n\n# legislative_questions_candidates\n");
  process.stdout.write(toCsv([
    "id",
    "vote_id",
    "target_party",
    "target_stance",
    "prompt_ro",
    "prompt_en",
    "active",
    "review_status",
    "interesting"
  ], questionCandidates));
  process.stdout.write("\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
