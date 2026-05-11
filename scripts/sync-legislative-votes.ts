import { createClient } from "@supabase/supabase-js";
import { parseCdepNominalVoteHtml, parseCdepVoteLinks } from "../lib/cdep-votes";
import { parseSenateCalendarPostbacks, parseSenateHiddenFields, parseSenateNominalVoteHtml, parseSenateVoteLinks } from "../lib/senate-votes";
import { slugify } from "../lib/parties";
import { computePartyPositions, eligibleQuestionTargets } from "../lib/votes";
import type { LegislativePartyPosition, LegislativeSourceChamber, LegislativeVote } from "../lib/types";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type QuestionCandidate = {
  id: string;
  vote_id: string;
  target_party: string;
  target_stance: string;
  prompt_ro: string;
  prompt_en: string;
  active: boolean;
  review_status: "needs_review";
  interesting: boolean;
};

type SyncBundle = {
  chamber: LegislativeSourceChamber;
  votes: LegislativeVote[];
  positions: LegislativePartyPosition[];
  questions: QuestionCandidate[];
};

const DEFAULT_CDEP_INDEX_URL = "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1";
const DEFAULT_SENATE_INDEX_URL = "https://www.senat.ro/voturiplen.aspx";
const DRY_RUN = process.argv.includes("--dry-run");
const MAX_LINKS = Number(process.env.LEGISLATIVE_SYNC_MAX_LINKS ?? 200);
const MAX_SENATE_DAYS = Number(process.env.LEGISLATIVE_SYNC_MAX_SENATE_DAYS ?? 10);

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GuessThePartyRO/0.1 legislative vote sync"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function postSenateCalendar(url: string, sourceHtml: string, target: string, argument: string): Promise<string> {
  const fields = parseSenateHiddenFields(sourceHtml);
  const body = new URLSearchParams({
    ...fields,
    __EVENTTARGET: target,
    __EVENTARGUMENT: argument
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "GuessThePartyRO/0.1 legislative vote sync"
      },
      body,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to post ${url}: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cdepSourceVoteId(url: string): string {
  return new URL(url).searchParams.get("idv") ?? slugify(url);
}

function senateSourceVoteId(url: string): string {
  return new URL(url).searchParams.get("AppID") ?? slugify(url);
}

function questionCandidates(vote: LegislativeVote, positions: LegislativePartyPosition[]): QuestionCandidate[] {
  return eligibleQuestionTargets(positions).map((target) => ({
    id: `q-${vote.id}-${target.party_key.toLowerCase()}-${target.stance}`,
    vote_id: vote.id,
    target_party: target.party_key,
    target_stance: target.stance,
    prompt_ro: "",
    prompt_en: "",
    active: false,
    review_status: "needs_review",
    interesting: false
  }));
}

async function syncCdep(): Promise<SyncBundle> {
  const indexUrl = process.env.CDEP_VOTE_INDEX_URL ?? DEFAULT_CDEP_INDEX_URL;
  const links = parseCdepVoteLinks(await fetchText(indexUrl), indexUrl).slice(0, MAX_LINKS);
  const votes: LegislativeVote[] = [];
  const positions: LegislativePartyPosition[] = [];
  const questions: QuestionCandidate[] = [];

  for (const link of links) {
    const parsed = parseCdepNominalVoteHtml(await fetchText(link));
    const sourceVoteId = cdepSourceVoteId(link);
    const totalFor = parsed.rows.filter((row) => row.stance === "for").length;
    const totalAgainst = parsed.rows.filter((row) => row.stance === "against").length;
    const totalAbstain = parsed.rows.filter((row) => row.stance === "abstain").length;
    const vote: LegislativeVote = {
      id: `cdep-${sourceVoteId}`,
      source_chamber: "cdep",
      source_vote_id: sourceVoteId,
      voted_at: parsed.votedAt || new Date().toISOString().slice(0, 10),
      bill_number: parsed.billNumber,
      title: parsed.title || parsed.billNumber || `CDEP vote ${sourceVoteId}`,
      vote_type: "vot electronic",
      source_url: link,
      total_for: parsed.totals.for || totalFor,
      total_against: parsed.totals.against || totalAgainst,
      total_abstain: parsed.totals.abstain || totalAbstain,
      total_present: parsed.totals.present || totalFor + totalAgainst + totalAbstain,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const votePositions = computePartyPositions(vote.id, parsed.rows);
    if (votePositions.length === 0) continue;
    votes.push(vote);
    positions.push(...votePositions);
    questions.push(...questionCandidates(vote, votePositions));
  }

  return { chamber: "cdep", votes, positions, questions };
}

async function syncSenate(): Promise<SyncBundle> {
  const indexUrl = process.env.SENATE_VOTE_INDEX_URL ?? DEFAULT_SENATE_INDEX_URL;
  const indexHtml = await fetchText(indexUrl);
  const directLinks = parseSenateVoteLinks(indexHtml, indexUrl);
  const calendarLinks = directLinks.length > 0 ? [] : (await Promise.all(
    parseSenateCalendarPostbacks(indexHtml).slice(0, MAX_SENATE_DAYS).map(async (postback) => (
      parseSenateVoteLinks(await postSenateCalendar(indexUrl, indexHtml, postback.target, postback.argument), indexUrl)
    ))
  )).flat();
  const links = Array.from(new Set([...directLinks, ...calendarLinks])).slice(0, MAX_LINKS);
  const votes: LegislativeVote[] = [];
  const positions: LegislativePartyPosition[] = [];
  const questions: QuestionCandidate[] = [];

  for (const link of links) {
    const parsed = parseSenateNominalVoteHtml(await fetchText(link));
    const sourceVoteId = senateSourceVoteId(link);
    const totalFor = parsed.rows.filter((row) => row.stance === "for").length;
    const totalAgainst = parsed.rows.filter((row) => row.stance === "against").length;
    const totalAbstain = parsed.rows.filter((row) => row.stance === "abstain").length;
    const vote: LegislativeVote = {
      id: `senate-${sourceVoteId.toLowerCase()}`,
      source_chamber: "senate",
      source_vote_id: sourceVoteId,
      voted_at: parsed.votedAt || new Date().toISOString().slice(0, 10),
      bill_number: parsed.billNumber,
      title: parsed.title || parsed.billNumber || `Senate vote ${sourceVoteId}`,
      vote_type: "vot electronic",
      source_url: link,
      total_for: parsed.totals.for || totalFor,
      total_against: parsed.totals.against || totalAgainst,
      total_abstain: parsed.totals.abstain || totalAbstain,
      total_present: parsed.totals.present || totalFor + totalAgainst + totalAbstain,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const votePositions = computePartyPositions(vote.id, parsed.rows);
    if (votePositions.length === 0) continue;
    votes.push(vote);
    positions.push(...votePositions);
    questions.push(...questionCandidates(vote, votePositions));
  }

  return { chamber: "senate", votes, positions, questions };
}

async function writeBundle(bundle: SyncBundle) {
  if (DRY_RUN) {
    process.stdout.write(`${bundle.chamber}: ${bundle.votes.length} votes, ${bundle.positions.length} positions, ${bundle.questions.length} question candidates\n`);
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run is used.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: run, error: runError } = await db
    .from("legislative_import_runs")
    .insert({ source_chamber: bundle.chamber })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    if (bundle.votes.length > 0) {
      const { error } = await db.from("legislative_votes").upsert(bundle.votes, { onConflict: "id" });
      if (error) throw error;
    }
    if (bundle.positions.length > 0) {
      const { error } = await db.from("legislative_party_positions").upsert(bundle.positions, { onConflict: "id" });
      if (error) throw error;
    }
    if (bundle.questions.length > 0) {
      const { error } = await db.from("legislative_questions").upsert(bundle.questions, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { error } = await db
      .from("legislative_import_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        votes_seen: bundle.votes.length,
        positions_seen: bundle.positions.length,
        questions_seen: bundle.questions.length
      })
      .eq("id", run.id);
    if (error) throw error;
  } catch (error) {
    await db
      .from("legislative_import_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      })
      .eq("id", run.id);
    throw error;
  }
}

async function main() {
  for (const bundle of [await syncCdep(), await syncSenate()]) {
    await writeBundle(bundle);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
