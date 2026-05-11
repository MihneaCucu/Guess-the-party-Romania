import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dailyChallengeDateKey, selectDailyPoliticians } from "@/lib/daily";
import { getPartyOptions } from "@/lib/parties";
import { MOCK_POLITICIANS } from "@/lib/mock-data";
import { MOCK_LEGISLATIVE_PARTY_POSITIONS, MOCK_LEGISLATIVE_QUESTIONS, MOCK_LEGISLATIVE_VOTES, MOCK_VOTE_GUESSES } from "@/lib/mock-votes";
import { formatPersonName } from "@/lib/names";
import { filterPoliticiansByScope, playablePoliticians, selectUnseenPolitician } from "@/lib/shuffle";
import { computeStats } from "@/lib/stats";
import { isUniquePartyForStance } from "@/lib/votes";
import type { DailyChallengeResult, GuessRecord, GuessResult, LegislativePartyPosition, LegislativeQuestion, LegislativeVote, PartyOption, Politician, PoliticianScope, PublicLegislativeVote, PublicPolitician, PublicVoteQuestion, RandomPoliticianResult, SessionRecord, StatsSummary, VoteGuessRecord, VoteGuessResult, VoteQuestionResult } from "@/lib/types";

let supabase: SupabaseClient | null | undefined;

type MemoryStore = {
  politicians: Politician[];
  guesses: GuessRecord[];
  legislativeVotes: LegislativeVote[];
  legislativePartyPositions: LegislativePartyPosition[];
  legislativeQuestions: LegislativeQuestion[];
  voteGuesses: VoteGuessRecord[];
  sessions: SessionRecord[];
  seenBySession: Map<string, Set<string>>;
  seenVoteQuestionsBySession: Map<string, Set<string>>;
};

const globalForStore = globalThis as typeof globalThis & {
  __guessThePartyRoMemory?: MemoryStore;
};

const memory = globalForStore.__guessThePartyRoMemory ??= {
  politicians: [...MOCK_POLITICIANS],
  guesses: [] as GuessRecord[],
  legislativeVotes: [...MOCK_LEGISLATIVE_VOTES],
  legislativePartyPositions: [...MOCK_LEGISLATIVE_PARTY_POSITIONS],
  legislativeQuestions: [...MOCK_LEGISLATIVE_QUESTIONS],
  voteGuesses: [...MOCK_VOTE_GUESSES],
  sessions: [] as SessionRecord[],
  seenBySession: new Map<string, Set<string>>(),
  seenVoteQuestionsBySession: new Map<string, Set<string>>()
};

function getSupabase(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return supabase;
}

function publicPolitician(politician: Politician): PublicPolitician {
  const { party_key, party_label, active, review_status, created_at, updated_at, ...safe } = politician;
  void party_key;
  void party_label;
  void active;
  void review_status;
  void created_at;
  void updated_at;
  return { ...safe, name: formatPersonName(safe.name) };
}

function displayPolitician(politician: Politician): Politician {
  return { ...politician, name: formatPersonName(politician.name) };
}

function publicLegislativeVote(vote: LegislativeVote): PublicLegislativeVote {
  const { created_at, updated_at, ...safe } = vote;
  void created_at;
  void updated_at;
  return safe;
}

function publicVoteQuestion(question: LegislativeQuestion, vote: LegislativeVote): PublicVoteQuestion {
  return {
    id: question.id,
    prompt_ro: question.prompt_ro,
    prompt_en: question.prompt_en ?? null,
    vote: publicLegislativeVote(vote)
  };
}

function activeInterestingQuestions(questions: LegislativeQuestion[], positions: LegislativePartyPosition[]): LegislativeQuestion[] {
  return questions.filter((question) => (
    question.active &&
    question.interesting &&
    question.review_status === "approved" &&
    isUniquePartyForStance(
      positions.filter((position) => position.vote_id === question.vote_id),
      question.target_party,
      question.target_stance
    )
  ));
}

function selectQuestionForSession(questions: LegislativeQuestion[], sessionId: string): LegislativeQuestion {
  const seen = memory.seenVoteQuestionsBySession.get(sessionId) ?? new Set<string>();
  const unseen = questions.filter((question) => !seen.has(question.id));
  const pool = unseen.length > 0 ? unseen : questions;
  if (unseen.length === 0) seen.clear();
  const selected = pool[Math.floor(Math.random() * pool.length)];
  seen.add(selected.id);
  memory.seenVoteQuestionsBySession.set(sessionId, seen);
  return selected;
}

function memorySession(sessionId: string): SessionRecord {
  const now = new Date().toISOString();
  let session = memory.sessions.find((item) => item.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      started_at: now,
      last_seen_at: now,
      guess_count: 0,
      best_streak: 0
    };
    memory.sessions.push(session);
  } else {
    session.last_seen_at = now;
  }
  return session;
}

export async function getParties(): Promise<PartyOption[]> {
  const db = getSupabase();
  if (!db) {
    return getPartyOptions(playablePoliticians(memory.politicians).map((politician) => politician.party_key));
  }

  const { data, error } = await db
    .from("politicians")
    .select("party_key")
    .eq("active", true)
    .eq("review_status", "approved")
    .not("photo_url", "is", null);

  if (error) throw error;
  return getPartyOptions((data ?? []).map((row) => row.party_key));
}

function seenScopeKey(sessionId: string, scope: PoliticianScope): string {
  return `${sessionId}:${scope}`;
}

function scopedPlayablePoliticians(politicians: Politician[], scope: PoliticianScope): Politician[] {
  return filterPoliticiansByScope(playablePoliticians(politicians), scope);
}

export async function getRandomPublicPolitician(sessionId: string, scope: PoliticianScope = "all"): Promise<RandomPoliticianResult> {
  const db = getSupabase();
  if (!db) {
    memorySession(sessionId);
    const candidates = scopedPlayablePoliticians(memory.politicians, scope);
    const seenKey = seenScopeKey(sessionId, scope);
    const seen = memory.seenBySession.get(seenKey) ?? new Set<string>();
    const selected = selectUnseenPolitician(candidates, seen);
    const nextSeen = selected.resetCycle ? new Set<string>() : seen;
    nextSeen.add(selected.politician.id);
    memory.seenBySession.set(seenKey, nextSeen);

    return {
      politician: publicPolitician(selected.politician),
      parties: getPartyOptions(candidates.map((politician) => politician.party_key)),
      totalLoaded: candidates.length,
      remainingInCycle: selected.remainingAfterPick,
      scope
    };
  }

  let politicianQuery = db
    .from("politicians")
    .select("*")
    .eq("active", true)
    .eq("review_status", "approved")
    .not("photo_url", "is", null);
  if (scope !== "all") {
    politicianQuery = politicianQuery.eq("chamber", scope);
  }

  const { data, error } = await politicianQuery;

  if (error) throw error;
  const candidates = scopedPlayablePoliticians((data ?? []) as Politician[], scope);
  const now = new Date().toISOString();
  const { data: existingSession, error: sessionReadError } = await db
    .from("sessions")
    .select("id, started_at, last_seen_at, guess_count, best_streak")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionReadError) throw sessionReadError;

  const { error: sessionWriteError } = await db.from("sessions").upsert({
    id: sessionId,
    started_at: existingSession?.started_at ?? now,
    last_seen_at: now,
    guess_count: existingSession?.guess_count ?? 0,
    best_streak: existingSession?.best_streak ?? 0
  });
  if (sessionWriteError) throw sessionWriteError;

  const { data: seenRows, error: seenError } = await db
    .from("session_seen_politicians")
    .select("politician_id")
    .eq("session_id", sessionId)
    .eq("scope", scope);

  if (seenError) throw seenError;
  const seen = new Set((seenRows ?? []).map((row) => String(row.politician_id)));
  const selected = selectUnseenPolitician(candidates, seen);

  if (selected.resetCycle) {
    const { error: clearError } = await db.from("session_seen_politicians").delete().eq("session_id", sessionId).eq("scope", scope);
    if (clearError) throw clearError;
  }

  const { error: seenWriteError } = await db.from("session_seen_politicians").upsert({
    session_id: sessionId,
    politician_id: selected.politician.id,
    scope,
    seen_at: new Date().toISOString()
  });
  if (seenWriteError) throw seenWriteError;

  return {
    politician: publicPolitician(selected.politician),
    parties: getPartyOptions(candidates.map((politician) => politician.party_key)),
    totalLoaded: candidates.length,
    remainingInCycle: selected.remainingAfterPick,
    scope
  };
}

export async function getDailyChallenge(date = dailyChallengeDateKey()): Promise<DailyChallengeResult> {
  const db = getSupabase();

  if (!db) {
    const candidates = playablePoliticians(memory.politicians);
    const politicians = selectDailyPoliticians(candidates, date).map(publicPolitician);
    return {
      date,
      politicians,
      parties: getPartyOptions(candidates.map((politician) => politician.party_key)),
      totalLoaded: candidates.length,
      length: politicians.length
    };
  }

  const { data, error } = await db
    .from("politicians")
    .select("*")
    .eq("active", true)
    .eq("review_status", "approved")
    .not("photo_url", "is", null);

  if (error) throw error;
  const candidates = playablePoliticians((data ?? []) as Politician[]);
  const politicians = selectDailyPoliticians(candidates, date).map(publicPolitician);

  return {
    date,
    politicians,
    parties: getPartyOptions(candidates.map((politician) => politician.party_key)),
    totalLoaded: candidates.length,
    length: politicians.length
  };
}

export async function getRandomVoteQuestion(sessionId: string): Promise<VoteQuestionResult> {
  const db = getSupabase();

  if (!db) {
    memorySession(sessionId);
    const questions = activeInterestingQuestions(memory.legislativeQuestions, memory.legislativePartyPositions);
    if (questions.length === 0) throw new Error("No vote questions are available.");
    const selected = selectQuestionForSession(questions, sessionId);
    const vote = memory.legislativeVotes.find((item) => item.id === selected.vote_id);
    if (!vote) throw new Error("Vote not found.");
    const partyKeys = new Set(memory.legislativePartyPositions.map((position) => position.party_key));
    return {
      question: publicVoteQuestion(selected, vote),
      parties: getPartyOptions(Array.from(partyKeys)),
      totalLoaded: questions.length
    };
  }

  const [questionsResult, positionsResult, votesResult] = await Promise.all([
    db.from("legislative_questions").select("*").eq("active", true).eq("interesting", true).eq("review_status", "approved"),
    db.from("legislative_party_positions").select("*"),
    db.from("legislative_votes").select("*")
  ]);
  if (questionsResult.error) throw questionsResult.error;
  if (positionsResult.error) throw positionsResult.error;
  if (votesResult.error) throw votesResult.error;

  const positions = (positionsResult.data ?? []) as LegislativePartyPosition[];
  const questions = activeInterestingQuestions((questionsResult.data ?? []) as LegislativeQuestion[], positions);
  if (questions.length === 0) throw new Error("No vote questions are available.");
  const selected = questions[Math.floor(Math.random() * questions.length)];
  const vote = ((votesResult.data ?? []) as LegislativeVote[]).find((item) => item.id === selected.vote_id);
  if (!vote) throw new Error("Vote not found.");

  return {
    question: publicVoteQuestion(selected, vote),
    parties: getPartyOptions(positions.map((position) => position.party_key)),
    totalLoaded: questions.length
  };
}

export async function recordGuess(
  sessionId: string,
  politicianId: string,
  guessedParty: string,
  bestStreak: number,
  currentStreak = 0
): Promise<GuessResult> {
  const db = getSupabase();
  const now = new Date().toISOString();

  if (!db) {
    const politician = memory.politicians.find((item) => item.id === politicianId);
    if (!politician || !politician.active || politician.review_status !== "approved") {
      throw new Error("Politician not found.");
    }

    const correct = politician.party_key === guessedParty;
    const nextBestStreak = Math.max(bestStreak, correct ? currentStreak + 1 : 0);
    const session = memory.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.last_seen_at = now;
      session.guess_count += 1;
      session.best_streak = Math.max(session.best_streak, nextBestStreak);
    } else {
      memory.sessions.push({
        id: sessionId,
        started_at: now,
        last_seen_at: now,
        guess_count: 1,
        best_streak: nextBestStreak
      });
    }

    memory.guesses.push({
      id: crypto.randomUUID(),
      session_id: sessionId,
      politician_id: politicianId,
      actual_party: politician.party_key,
      guessed_party: guessedParty,
      correct,
      created_at: now
    });

    return { correct, politician: displayPolitician(politician) };
  }

  const { data: politician, error: politicianError } = await db
    .from("politicians")
    .select("*")
    .eq("id", politicianId)
    .eq("active", true)
    .eq("review_status", "approved")
    .single();

  if (politicianError) throw politicianError;

  const { data: existingSession, error: sessionReadError } = await db
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionReadError) throw sessionReadError;

  const typedPolitician = politician as Politician;
  const correct = typedPolitician.party_key === guessedParty;
  const nextBestStreak = Math.max(bestStreak, correct ? currentStreak + 1 : 0);
  const nextSession = existingSession
    ? {
        id: sessionId,
        started_at: existingSession.started_at,
        last_seen_at: now,
        guess_count: existingSession.guess_count + 1,
        best_streak: Math.max(existingSession.best_streak, nextBestStreak)
      }
    : {
        id: sessionId,
        started_at: now,
        last_seen_at: now,
        guess_count: 1,
        best_streak: nextBestStreak
      };

  const { error: sessionWriteError } = await db.from("sessions").upsert(nextSession);
  if (sessionWriteError) throw sessionWriteError;

  const { error: guessError } = await db.from("guesses").insert({
    id: crypto.randomUUID(),
    session_id: sessionId,
    politician_id: politicianId,
    actual_party: typedPolitician.party_key,
    guessed_party: guessedParty,
    correct,
    created_at: now
  });

  if (guessError) throw guessError;
  return { correct, politician: displayPolitician(typedPolitician) };
}

export async function recordVoteGuess(
  sessionId: string,
  questionId: string,
  guessedParty: string,
  bestStreak: number,
  currentStreak = 0
): Promise<VoteGuessResult> {
  const db = getSupabase();
  const now = new Date().toISOString();

  if (!db) {
    const question = memory.legislativeQuestions.find((item) => item.id === questionId);
    if (!question || !question.active || !question.interesting || question.review_status !== "approved") {
      throw new Error("Vote question not found.");
    }
    const vote = memory.legislativeVotes.find((item) => item.id === question.vote_id);
    if (!vote) throw new Error("Vote not found.");
    const positions = memory.legislativePartyPositions.filter((position) => position.vote_id === question.vote_id);
    if (!isUniquePartyForStance(positions, question.target_party, question.target_stance)) {
      throw new Error("Vote question is ambiguous.");
    }
    const targetPosition = positions.find((position) => position.party_key === question.target_party);
    if (!targetPosition) throw new Error("Vote position not found.");

    const correct = question.target_party === guessedParty;
    const nextBestStreak = Math.max(bestStreak, correct ? currentStreak + 1 : 0);
    const session = memorySession(sessionId);
    session.last_seen_at = now;
    session.guess_count += 1;
    session.best_streak = Math.max(session.best_streak, nextBestStreak);
    memory.voteGuesses.push({
      id: crypto.randomUUID(),
      session_id: sessionId,
      question_id: questionId,
      actual_party: question.target_party,
      guessed_party: guessedParty,
      correct,
      created_at: now
    });

    return {
      correct,
      question: {
        ...publicVoteQuestion(question, vote),
        target_party: question.target_party,
        target_stance: question.target_stance,
        target_party_label: targetPosition.party_label,
        target_majority_share: targetPosition.majority_share
      },
      positions
    };
  }

  const { data: question, error: questionError } = await db
    .from("legislative_questions")
    .select("*")
    .eq("id", questionId)
    .eq("active", true)
    .eq("interesting", true)
    .eq("review_status", "approved")
    .maybeSingle();
  if (questionError) throw questionError;
  if (!question) throw new Error("Vote question not found.");

  const typedQuestion = question as LegislativeQuestion;
  const [voteResult, positionsResult] = await Promise.all([
    db.from("legislative_votes").select("*").eq("id", typedQuestion.vote_id).maybeSingle(),
    db.from("legislative_party_positions").select("*").eq("vote_id", typedQuestion.vote_id)
  ]);
  if (voteResult.error) throw voteResult.error;
  if (positionsResult.error) throw positionsResult.error;
  if (!voteResult.data) throw new Error("Vote not found.");

  const positions = (positionsResult.data ?? []) as LegislativePartyPosition[];
  if (!isUniquePartyForStance(positions, typedQuestion.target_party, typedQuestion.target_stance)) {
    throw new Error("Vote question is ambiguous.");
  }
  const targetPosition = positions.find((position) => position.party_key === typedQuestion.target_party);
  if (!targetPosition) throw new Error("Vote position not found.");

  const correct = typedQuestion.target_party === guessedParty;
  const nextBestStreak = Math.max(bestStreak, correct ? currentStreak + 1 : 0);
  const { data: existingSession, error: sessionReadError } = await db
    .from("sessions")
    .select("id, started_at, last_seen_at, guess_count, best_streak")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionReadError) throw sessionReadError;

  const { error: sessionWriteError } = await db.from("sessions").upsert({
    id: sessionId,
    started_at: existingSession?.started_at ?? now,
    last_seen_at: now,
    guess_count: (existingSession?.guess_count ?? 0) + 1,
    best_streak: Math.max(existingSession?.best_streak ?? 0, nextBestStreak)
  });
  if (sessionWriteError) throw sessionWriteError;

  const { error: guessError } = await db.from("vote_guesses").insert({
    session_id: sessionId,
    question_id: questionId,
    actual_party: typedQuestion.target_party,
    guessed_party: guessedParty,
    correct
  });
  if (guessError) throw guessError;

  return {
    correct,
    question: {
      ...publicVoteQuestion(typedQuestion, voteResult.data as LegislativeVote),
      target_party: typedQuestion.target_party,
      target_stance: typedQuestion.target_stance,
      target_party_label: targetPosition.party_label,
      target_majority_share: targetPosition.majority_share
    },
    positions
  };
}

export async function getStats(): Promise<StatsSummary> {
  const db = getSupabase();
  const minAttempts = Number(process.env.STATS_MIN_ATTEMPTS ?? "15");

  if (!db) {
    return computeStats(memory.politicians, memory.guesses, memory.sessions, Math.max(1, minAttempts));
  }

  const [politiciansResult, guessesResult, sessionsResult] = await Promise.all([
    db.from("politicians").select("*"),
    db.from("guesses").select("*"),
    db.from("sessions").select("*")
  ]);

  if (politiciansResult.error) throw politiciansResult.error;
  if (guessesResult.error) throw guessesResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  return computeStats(
    (politiciansResult.data ?? []) as Politician[],
    (guessesResult.data ?? []) as GuessRecord[],
    (sessionsResult.data ?? []) as SessionRecord[],
    minAttempts
  );
}
