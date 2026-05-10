import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPartyOptions } from "@/lib/parties";
import { MOCK_POLITICIANS } from "@/lib/mock-data";
import { filterPoliticiansByScope, playablePoliticians, selectUnseenPolitician } from "@/lib/shuffle";
import { computeStats } from "@/lib/stats";
import type { GuessRecord, GuessResult, PartyOption, Politician, PoliticianScope, PublicPolitician, RandomPoliticianResult, SessionRecord, StatsSummary } from "@/lib/types";

let supabase: SupabaseClient | null | undefined;

type MemoryStore = {
  politicians: Politician[];
  guesses: GuessRecord[];
  sessions: SessionRecord[];
  seenBySession: Map<string, Set<string>>;
};

const globalForStore = globalThis as typeof globalThis & {
  __guessThePartyRoMemory?: MemoryStore;
};

const memory = globalForStore.__guessThePartyRoMemory ??= {
  politicians: [...MOCK_POLITICIANS],
  guesses: [] as GuessRecord[],
  sessions: [] as SessionRecord[],
  seenBySession: new Map<string, Set<string>>()
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
  return safe;
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

    return { correct, politician };
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
  return { correct, politician: typedPolitician };
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
