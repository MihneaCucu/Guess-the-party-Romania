"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LanguageToggle, useLanguage } from "@/components/LanguageToggle";
import { SocialFooter } from "@/components/SocialFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { chamberLabel, TRANSLATIONS } from "@/lib/i18n";
import { partyDisplayLabel } from "@/lib/parties";
import { photoSrc, preloadPhoto, thumbnailSrc } from "@/lib/photos";
import { voteStanceLabel } from "@/lib/votes";
import type { LegislativePartyPosition, PartyOption, Politician, PoliticianScope, PublicPolitician, PublicVoteQuestion, VoteStance } from "@/lib/types";

type RecentGuess = {
  id: string;
  name: string;
  guessedPartyKey?: string;
  guessedParty: string;
  actualPartyKey?: string;
  actualParty: string;
  correct: boolean;
  photoUrl: string;
};

type RandomResponse = {
  politician: PublicPolitician;
  parties: PartyOption[];
  totalLoaded: number;
  remainingInCycle: number;
  scope: PoliticianScope;
};

type DailyChallengeResponse = {
  date: string;
  politicians: PublicPolitician[];
  parties: PartyOption[];
  totalLoaded: number;
  length: number;
};

type VoteQuestionResponse = {
  question: PublicVoteQuestion;
  parties: PartyOption[];
  totalLoaded: number;
};

type DailyProgress = {
  date: string;
  index: number;
  correct: number;
  total: number;
  streak: number;
  complete: boolean;
  recent: RecentGuess[];
};

type GuessResponse = {
  correct: boolean;
  politician: Politician;
};

type VoteGuessResponse = {
  correct: boolean;
  question: PublicVoteQuestion & {
    target_party: string;
    target_stance: VoteStance;
    target_party_label: string;
    target_majority_share: number;
  };
  positions: LegislativePartyPosition[];
};

type VoteRecentGuess = {
  id: string;
  prompt: string;
  guessedPartyKey: string;
  guessedParty: string;
  actualPartyKey: string;
  actualParty: string;
  correct: boolean;
  sourceUrl: string;
};

type GameMode = "practice" | "votes" | "daily";

const BEST_KEY = "gtp-ro-best";
const VOTE_BEST_KEY = "gtp-ro-vote-best";
const RECENT_KEY = "gtp-ro-recent";
const VOTE_RECENT_KEY = "gtp-ro-vote-recent";
const DAILY_PROGRESS_KEY = "gtp-ro-daily-progress";
const RESULT_REVEAL_MS = 2800;

const SCOPE_OPTIONS: Array<{ key: string; labelKey: "all" | "senat" | "camera" | "guvern" | "meps"; apiValue: string; scope: PoliticianScope; loadedLabelKey: "candidatesLoaded" | "senatorsLoaded" | "deputiesLoaded" | "governmentMembersLoaded" | "europeanParliamentMembersLoaded" }> = [
  { key: "all", labelKey: "all", apiValue: "all", scope: "all", loadedLabelKey: "candidatesLoaded" },
  { key: "senat", labelKey: "senat", apiValue: "senat", scope: "Senat", loadedLabelKey: "senatorsLoaded" },
  { key: "camera", labelKey: "camera", apiValue: "camera", scope: "Camera Deputatilor", loadedLabelKey: "deputiesLoaded" },
  { key: "guvern", labelKey: "guvern", apiValue: "guvern", scope: "Guvern", loadedLabelKey: "governmentMembersLoaded" },
  { key: "meps", labelKey: "meps", apiValue: "meps", scope: "Parlamentul European", loadedLabelKey: "europeanParliamentMembersLoaded" }
];

function isRecentGuess(value: unknown): value is RecentGuess {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.guessedParty === "string" &&
    typeof item.actualParty === "string" &&
    typeof item.correct === "boolean" &&
    typeof item.photoUrl === "string"
  );
}

function readRecentGuesses(): RecentGuess[] {
  try {
    const stored = window.localStorage.getItem(RECENT_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecentGuess).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeRecentGuesses(items: RecentGuess[]) {
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 10)));
}

function isVoteRecentGuess(value: unknown): value is VoteRecentGuess {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.prompt === "string" &&
    typeof item.guessedPartyKey === "string" &&
    typeof item.guessedParty === "string" &&
    typeof item.actualPartyKey === "string" &&
    typeof item.actualParty === "string" &&
    typeof item.correct === "boolean" &&
    typeof item.sourceUrl === "string"
  );
}

function readVoteRecentGuesses(): VoteRecentGuess[] {
  try {
    const stored = window.localStorage.getItem(VOTE_RECENT_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isVoteRecentGuess).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeVoteRecentGuesses(items: VoteRecentGuess[]) {
  window.localStorage.setItem(VOTE_RECENT_KEY, JSON.stringify(items.slice(0, 10)));
}

function isDailyProgress(value: unknown): value is DailyProgress {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.date === "string" &&
    typeof item.index === "number" &&
    typeof item.correct === "number" &&
    typeof item.total === "number" &&
    typeof item.streak === "number" &&
    typeof item.complete === "boolean" &&
    Array.isArray(item.recent) &&
    item.recent.every(isRecentGuess)
  );
}

function readDailyProgress(date: string, length: number): DailyProgress | null {
  try {
    const stored = window.localStorage.getItem(DAILY_PROGRESS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    if (!isDailyProgress(parsed) || parsed.date !== date) return null;
    const index = Math.min(Math.max(0, parsed.index), length);
    const total = Math.min(Math.max(0, parsed.total), length);
    const correct = Math.min(Math.max(0, parsed.correct), total);
    return {
      date,
      index,
      correct,
      total,
      streak: Math.max(0, parsed.streak),
      complete: parsed.complete || index >= length,
      recent: parsed.recent.slice(0, 10)
    };
  } catch {
    return null;
  }
}

function writeDailyProgress(progress: DailyProgress) {
  window.localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify({ ...progress, recent: progress.recent.slice(0, 10) }));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function votePrompt(question: PublicVoteQuestion | null, language: "en" | "ro"): string {
  if (!question) return "";
  return language === "ro" ? question.prompt_ro : question.prompt_en || question.prompt_ro;
}

function legislativeSourceLabel(source: string): string {
  if (source === "senate") return "Senat";
  return "Camera Deputaților";
}

export function Game() {
  const language = useLanguage();
  const t = TRANSLATIONS[language];
  const [politician, setPolitician] = useState<PublicPolitician | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "loaded" | "failed">("idle");
  const [answer, setAnswer] = useState<GuessResponse | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [recent, setRecent] = useState<RecentGuess[]>([]);
  const [voteRecent, setVoteRecent] = useState<VoteRecentGuess[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [scopeKey, setScopeKey] = useState("all");
  const [gameMode, setGameMode] = useState<GameMode>("practice");
  const [voteQuestion, setVoteQuestion] = useState<PublicVoteQuestion | null>(null);
  const [voteAnswer, setVoteAnswer] = useState<VoteGuessResponse | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeResponse | null>(null);
  const [dailyIndex, setDailyIndex] = useState(0);
  const [dailyComplete, setDailyComplete] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareText, setShareText] = useState("");
  const [lastGuess, setLastGuess] = useState<PartyOption | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const nextPayloadRef = useRef<Promise<RandomResponse> | null>(null);
  const nextVotePayloadRef = useRef<Promise<VoteQuestionResponse> | null>(null);

  const localizedParties = useMemo(() => parties.map((party) => ({ ...party, label: partyDisplayLabel(party, language) })), [language, parties]);
  const partyByKey = useMemo(() => new Map(localizedParties.map((party) => [party.key, party])), [localizedParties]);
  const visibleParties = localizedParties;
  const actualPartyKey = answer?.politician.party_key ?? "";
  const actualPartyLabel = answer ? partyByKey.get(actualPartyKey)?.label ?? answer.politician.party_label : "";
  const activeScope = SCOPE_OPTIONS.find((option) => option.key === scopeKey) ?? SCOPE_OPTIONS[0];
  const portraitSrc = politician ? photoSrc(politician.photo_url) : null;
  const isDailyMode = gameMode === "daily";
  const isVoteMode = gameMode === "votes";
  const dailyTotal = dailyChallenge?.length ?? 10;
  const dailyAnswered = Math.min(score.total, dailyTotal);
  const showDailyComplete = isDailyMode && dailyComplete;
  const visibleRecent = isVoteMode ? voteRecent : recent;

  const clearRevealTimers = useCallback(() => {
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
  }, []);

  const fetchRandomPayload = useCallback(async (scope = activeScope) => {
    const response = await fetch(`/api/politicians/random?scope=${scope.apiValue}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load a politician.");
    const payload = (await response.json()) as RandomResponse;
    await preloadPhoto(photoSrc(payload.politician.photo_url));
    await preloadPhoto(thumbnailSrc(payload.politician.photo_url), 1200);
    return payload;
  }, [activeScope]);

  const fetchDailyPayload = useCallback(async () => {
    const response = await fetch("/api/challenge/daily", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the daily challenge.");
    const payload = (await response.json()) as DailyChallengeResponse;
    const firstPolitician = payload.politicians[0];
    if (firstPolitician) {
      await preloadPhoto(photoSrc(firstPolitician.photo_url));
      await preloadPhoto(thumbnailSrc(firstPolitician.photo_url), 1200);
    }
    return payload;
  }, []);

  const fetchVotePayload = useCallback(async () => {
    const response = await fetch("/api/vote-questions/random", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load a vote question.");
    return (await response.json()) as VoteQuestionResponse;
  }, []);

  const showPayload = useCallback((payload: RandomResponse) => {
    setParties(payload.parties);
    setTotalLoaded(payload.totalLoaded);
    setPolitician(payload.politician);
  }, []);

  const showDailyPayload = useCallback((payload: DailyChallengeResponse, index: number) => {
    const progress = readDailyProgress(payload.date, payload.length);
    const restoredIndex = progress?.index ?? index;
    const nextPolitician = payload.politicians[restoredIndex];
    setDailyChallenge(payload);
    setDailyIndex(restoredIndex);
    setDailyComplete(Boolean(progress?.complete) || !nextPolitician);
    setScore({ correct: progress?.correct ?? 0, total: progress?.total ?? 0 });
    setStreak(progress?.streak ?? 0);
    setRecent(progress?.recent ?? []);
    setParties(payload.parties);
    setTotalLoaded(payload.totalLoaded);
    setShareStatus("idle");
    setShareText("");
    setPolitician(nextPolitician ?? null);
    if (nextPolitician) {
      void preloadPhoto(thumbnailSrc(nextPolitician.photo_url), 1200);
    }
  }, []);

  const showVotePayload = useCallback((payload: VoteQuestionResponse) => {
    setVoteQuestion(payload.question);
    setVoteAnswer(null);
    setParties(payload.parties);
    setTotalLoaded(payload.totalLoaded);
    setPolitician(null);
    setPhotoStatus("loaded");
  }, []);

  const prepareRound = useCallback(() => {
    clearRevealTimers();
    setLoading(true);
    setAnswer(null);
    setVoteAnswer(null);
    setLastGuess(null);
    setError(null);
    setPolitician(null);
    setVoteQuestion(null);
    setPhotoStatus("idle");
    setShareStatus("idle");
    setShareText("");
  }, [clearRevealTimers]);

  const loadPracticeRound = useCallback(async () => {
    prepareRound();
    try {
      const pendingPayload = nextPayloadRef.current;
      nextPayloadRef.current = null;
      const payload = pendingPayload ? await pendingPayload : await fetchRandomPayload(activeScope);
      showPayload(payload.scope === activeScope.scope ? payload : await fetchRandomPayload(activeScope));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [activeScope, fetchRandomPayload, prepareRound, showPayload]);

  const loadDailyRound = useCallback(async (index = 0, challenge?: DailyChallengeResponse | null) => {
    prepareRound();
    try {
      const payload = challenge ?? await fetchDailyPayload();
      showDailyPayload(payload, index);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [fetchDailyPayload, prepareRound, showDailyPayload]);

  const loadVoteRound = useCallback(async () => {
    prepareRound();
    try {
      const pendingPayload = nextVotePayloadRef.current;
      nextVotePayloadRef.current = null;
      showVotePayload(pendingPayload ? await pendingPayload : await fetchVotePayload());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [fetchVotePayload, prepareRound, showVotePayload]);

  const loadNext = useCallback(async () => {
    if (gameMode === "daily") {
      await loadDailyRound(dailyIndex, dailyChallenge);
      return;
    }
    if (gameMode === "votes") {
      await loadVoteRound();
      return;
    }

    await loadPracticeRound();
  }, [dailyChallenge, dailyIndex, gameMode, loadDailyRound, loadPracticeRound, loadVoteRound]);

  useEffect(() => {
    setBest(Number(window.localStorage.getItem(BEST_KEY) ?? "0"));
    setRecent(readRecentGuesses());
    setVoteRecent(readVoteRecentGuesses());
    if (gameMode === "daily") {
      void loadDailyRound(0);
    } else if (gameMode === "votes") {
      setBest(Number(window.localStorage.getItem(VOTE_BEST_KEY) ?? "0"));
      void loadVoteRound();
    } else {
      setBest(Number(window.localStorage.getItem(BEST_KEY) ?? "0"));
      void loadPracticeRound();
    }
    return clearRevealTimers;
  }, [activeScope, clearRevealTimers, gameMode, loadDailyRound, loadPracticeRound, loadVoteRound]);

  async function submitGuess(party: PartyOption) {
    if (!politician || answer || loading) return;

    const nextStreakIfCorrect = streak + 1;
    try {
      const response = await fetch("/api/guesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianId: politician.id,
          guessedParty: party.key,
          currentStreak: streak,
          bestStreak: best
        })
      });

      if (!response.ok) throw new Error("Could not record your guess.");
      const payload = (await response.json()) as GuessResponse;
      const nextStreak = payload.correct ? nextStreakIfCorrect : 0;
      const nextBest = Math.max(best, nextStreak);
      const nextScore = {
        correct: score.correct + (payload.correct ? 1 : 0),
        total: score.total + 1
      };
      const nextRecent = [
        {
          id: crypto.randomUUID(),
          name: payload.politician.name,
          guessedPartyKey: party.key,
          guessedParty: party.label,
          actualPartyKey: payload.politician.party_key,
          actualParty: partyByKey.get(payload.politician.party_key)?.label ?? payload.politician.party_label,
          correct: payload.correct,
          photoUrl: payload.politician.photo_url
        },
        ...recent
      ].slice(0, 10);

      setAnswer(payload);
      setLastGuess(party);
      setScore(nextScore);
      setStreak(nextStreak);
      setBest(nextBest);
      window.localStorage.setItem(BEST_KEY, String(nextBest));
      setRecent(nextRecent);
      writeRecentGuesses(nextRecent);
      clearRevealTimers();
      if (isDailyMode && dailyChallenge) {
        const nextIndex = dailyIndex + 1;
        const complete = nextIndex >= dailyChallenge.length;
        const nextDailyPolitician = dailyChallenge.politicians[nextIndex];
        writeDailyProgress({
          date: dailyChallenge.date,
          index: nextIndex,
          correct: nextScore.correct,
          total: nextScore.total,
          streak: nextStreak,
          complete,
          recent: nextRecent
        });
        if (nextDailyPolitician) {
          void preloadPhoto(photoSrc(nextDailyPolitician.photo_url));
          void preloadPhoto(thumbnailSrc(nextDailyPolitician.photo_url), 1200);
        }
        revealTimeoutRef.current = window.setTimeout(() => {
          if (complete) {
            setDailyIndex(nextIndex);
            setDailyComplete(true);
            setShareStatus("idle");
            setShareText("");
            return;
          }
          void loadDailyRound(nextIndex, dailyChallenge);
        }, RESULT_REVEAL_MS);
        return;
      }

      const preloadedPayload = fetchRandomPayload(activeScope);
      preloadedPayload.catch(() => undefined);
      nextPayloadRef.current = preloadedPayload;
      revealTimeoutRef.current = window.setTimeout(() => {
        void loadNext();
      }, RESULT_REVEAL_MS);
    } catch (guessError) {
      setError(guessError instanceof Error ? guessError.message : "Something went wrong.");
    }
  }

  async function submitVoteGuess(party: PartyOption) {
    if (!voteQuestion || voteAnswer || loading) return;

    const nextStreakIfCorrect = streak + 1;
    try {
      const response = await fetch("/api/vote-guesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: voteQuestion.id,
          guessedParty: party.key,
          currentStreak: streak,
          bestStreak: best
        })
      });

      if (!response.ok) throw new Error("Could not record your guess.");
      const payload = (await response.json()) as VoteGuessResponse;
      const nextStreak = payload.correct ? nextStreakIfCorrect : 0;
      const nextBest = Math.max(best, nextStreak);
      const nextScore = {
        correct: score.correct + (payload.correct ? 1 : 0),
        total: score.total + 1
      };
      const actualParty = partyByKey.get(payload.question.target_party)?.label ?? payload.question.target_party_label;
      const nextRecent = [
        {
          id: crypto.randomUUID(),
          prompt: votePrompt(payload.question, language),
          guessedPartyKey: party.key,
          guessedParty: party.label,
          actualPartyKey: payload.question.target_party,
          actualParty,
          correct: payload.correct,
          sourceUrl: payload.question.vote.source_url
        },
        ...voteRecent
      ].slice(0, 10);

      setVoteAnswer(payload);
      setLastGuess(party);
      setScore(nextScore);
      setStreak(nextStreak);
      setBest(nextBest);
      window.localStorage.setItem(VOTE_BEST_KEY, String(nextBest));
      setVoteRecent(nextRecent);
      writeVoteRecentGuesses(nextRecent);
      clearRevealTimers();
      const preloadedPayload = fetchVotePayload();
      preloadedPayload.catch(() => undefined);
      nextVotePayloadRef.current = preloadedPayload;
      revealTimeoutRef.current = window.setTimeout(() => {
        void loadNext();
      }, RESULT_REVEAL_MS);
    } catch (guessError) {
      setError(guessError instanceof Error ? guessError.message : "Something went wrong.");
    }
  }

  function switchMode(nextMode: GameMode) {
    if (nextMode === gameMode) return;
    clearRevealTimers();
    nextPayloadRef.current = null;
    nextVotePayloadRef.current = null;
    setGameMode(nextMode);
    setScore({ correct: 0, total: 0 });
    setStreak(0);
    setAnswer(null);
    setVoteAnswer(null);
    setLastGuess(null);
    setVoteQuestion(null);
    setDailyChallenge(null);
    setDailyIndex(0);
    setDailyComplete(false);
    setBest(Number(window.localStorage.getItem(nextMode === "votes" ? VOTE_BEST_KEY : BEST_KEY) ?? "0"));
    setShareStatus("idle");
    setShareText("");
  }

  async function shareDailyResult() {
    if (!dailyChallenge) return;

    const text = `${t.dailyChallenge} ${dailyChallenge.date}: ${score.correct}/${dailyTotal} · ${t.streak} ${streak}`;
    const url = window.location.origin;
    const resultText = `${text}\n${url}`;
    setShareText(resultText);
    try {
      if (navigator.share) {
        await navigator.share({ title: t.dailyChallenge, text, url });
        setShareStatus("copied");
        return;
      }
    } catch {
      // Fall back to copying below; native share can fail or be cancelled.
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(resultText);
        setShareStatus("copied");
        return;
      }
    } catch {
      // Use the visible manual fallback below.
    }
    setShareStatus("failed");
  }

  function reset() {
    if (gameMode === "daily") return;

    clearRevealTimers();
    nextPayloadRef.current = null;
    nextVotePayloadRef.current = null;
    setScore({ correct: 0, total: 0 });
    setStreak(0);
    setAnswer(null);
    setVoteAnswer(null);
    setLastGuess(null);
    setVoteQuestion(null);
    setDailyChallenge(null);
    setDailyIndex(0);
    setDailyComplete(false);
    setShareStatus("idle");
    setShareText("");
    if (isVoteMode) {
      setVoteRecent([]);
      window.localStorage.removeItem(VOTE_RECENT_KEY);
      setBest(0);
      window.localStorage.setItem(VOTE_BEST_KEY, "0");
      void loadVoteRound();
      return;
    }
    setRecent([]);
    window.localStorage.removeItem(RECENT_KEY);
    setBest(0);
    window.localStorage.setItem(BEST_KEY, "0");
    void loadPracticeRound();
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f3f3f7] text-[#202431]">
      <header className="flex min-h-[47px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#e6e8ee] bg-white px-3 py-2 sm:flex-nowrap sm:py-0">
        <nav className="order-1 flex min-w-0 flex-1 items-center gap-[6px] overflow-x-auto text-[12px] font-bold leading-none text-slate-600">
          <h1 aria-label="Guess The Party RO" className="shrink-0 rounded-[6px] bg-black px-[10px] py-[8px] text-[12px] font-black text-white shadow-sm">
            <Link href="/stats">{t.guessTheParty} · <span className="text-[10px] font-bold">{t.stats.toLowerCase()} →</span></Link>
          </h1>
        </nav>

        <div className="order-2 flex w-full shrink-0 items-center justify-end gap-[12px] text-center sm:w-auto sm:gap-[17px]">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.score}</div>
            <div className="text-[19px] font-black leading-[0.9]">{score.correct} / {score.total}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.streak}</div>
            <div className="text-[19px] font-black leading-[0.9]">{streak}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.best}</div>
            <div className="text-[19px] font-black leading-[0.9]">{best}</div>
          </div>
          <button
            className={clsx(
              "focus-ring rounded-[6px] border border-slate-200 bg-white px-[10px] py-[7px] text-[11px] font-bold text-slate-500 shadow-sm",
              isDailyMode ? "cursor-not-allowed opacity-45" : ""
            )}
            disabled={isDailyMode}
            onClick={reset}
            type="button"
          >
            {t.reset}
          </button>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto mt-6 flex w-[390px] max-w-[calc(100vw-24px)] flex-col items-center">
        <div className="mb-[8px] grid w-full grid-cols-3 gap-[5px] rounded-[10px] border border-[#e4e6ee] bg-white p-[5px] shadow-sm">
          {(["practice", "votes", "daily"] as GameMode[]).map((mode) => (
            <button
              className={clsx(
                "focus-ring h-[28px] rounded-[7px] px-2 text-[10px] font-black transition",
                gameMode === mode ? "bg-black text-white shadow-sm" : "bg-[#f7f8fb] text-slate-500 hover:bg-slate-100"
              )}
              disabled={loading && gameMode === mode}
              key={mode}
              onClick={() => switchMode(mode)}
              type="button"
            >
              {mode === "practice" ? t.politicians : mode === "votes" ? t.votes : t.daily}
            </button>
          ))}
        </div>

        {isDailyMode ? (
          <div className="mb-[10px] flex h-[40px] w-full items-center justify-between rounded-[10px] border border-[#e4e6ee] bg-white px-[12px] text-[11px] font-black text-slate-600 shadow-sm">
            <span data-testid="daily-progress-label">{t.dailyChallenge} · {dailyAnswered} / {dailyTotal}</span>
          </div>
        ) : isVoteMode ? (
          <div className="mb-[10px] flex h-[40px] w-full items-center justify-between rounded-[10px] border border-[#e4e6ee] bg-white px-[12px] text-[11px] font-black text-slate-600 shadow-sm">
            <span data-testid="vote-progress-label">{t.voteQuestion}</span>
            <span>{totalLoaded > 0 ? `${totalLoaded} ${t.voteQuestionsLoaded}` : t.voteQuestionsLoaded}</span>
          </div>
        ) : (
          <div className="mb-[10px] grid w-full grid-cols-5 gap-[5px] rounded-[10px] border border-[#e4e6ee] bg-white p-[5px] shadow-sm">
            {SCOPE_OPTIONS.map((option) => (
              <button
                className={clsx(
                  "focus-ring h-[28px] rounded-[7px] px-1.5 text-[10px] font-black transition",
                  scopeKey === option.key ? "bg-black text-white shadow-sm" : "bg-[#f7f8fb] text-slate-500 hover:bg-slate-100"
                )}
                disabled={loading && scopeKey === option.key}
                key={option.key}
                onClick={() => setScopeKey(option.key)}
                type="button"
              >
                {t[option.labelKey]}
              </button>
            ))}
          </div>
        )}

        <div className="w-full overflow-hidden rounded-[12px] bg-white shadow-[0_16px_38px_rgba(34,39,52,0.15)]">
          {showDailyComplete ? (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[24px] font-black text-emerald-700">
                {score.correct}
              </div>
              <h2 className="text-[22px] font-black leading-tight text-slate-950">{t.dailyComplete}</h2>
              <p className="mt-2 text-[13px] font-bold leading-relaxed text-slate-500">{t.dailyResultSummary}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[8px] bg-slate-50 px-2 py-3">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">{t.score}</div>
                  <div className="mt-1 text-[18px] font-black text-slate-950" data-testid="daily-summary-score">{score.correct} / {dailyTotal}</div>
                </div>
                <div className="rounded-[8px] bg-slate-50 px-2 py-3">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">{t.streak}</div>
                  <div className="mt-1 text-[18px] font-black text-slate-950">{streak}</div>
                </div>
                <div className="rounded-[8px] bg-slate-50 px-2 py-3">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">{t.best}</div>
                  <div className="mt-1 text-[18px] font-black text-slate-950">{best}</div>
                </div>
              </div>
              <button className="focus-ring mt-5 h-[36px] rounded-[7px] bg-black px-4 text-[12px] font-black text-white" onClick={shareDailyResult} type="button">
                {shareStatus === "copied" ? t.copied : t.shareResult}
              </button>
              {shareStatus === "failed" && shareText ? (
                <div className="mt-4 text-left">
                  <p className="mb-2 text-[11px] font-bold text-slate-500">{t.shareUnavailable}</p>
                  <textarea
                    className="h-[74px] w-full resize-none rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold leading-relaxed text-slate-700"
                    readOnly
                    value={shareText}
                  />
                </div>
              ) : null}
            </div>
          ) : isVoteMode ? (
            <>
              <div className="min-h-[300px] bg-slate-100 px-5 py-6">
                {loading ? (
                  <div className="space-y-4">
                    <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
                    <div className="h-20 w-full animate-pulse rounded-[8px] bg-slate-200" />
                    <div className="h-12 w-2/3 animate-pulse rounded-[8px] bg-slate-200" />
                  </div>
                ) : null}
                {error ? <div className="flex min-h-[240px] items-center justify-center px-4 text-center text-sm font-bold text-red-700">{error}</div> : null}
                {!loading && !error && voteQuestion ? (
                  <article>
                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{t.voteQuestion}</div>
                    <h2 className="mt-3 text-[24px] font-black leading-[1.05] text-slate-950" data-testid="vote-question-prompt">
                      {votePrompt(voteQuestion, language)}
                    </h2>
                    <div className="mt-5 rounded-[9px] border border-slate-200 bg-white p-3">
                      <p className="text-[12px] font-black leading-snug text-slate-900">{voteQuestion.vote.title}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-500">
                        {legislativeSourceLabel(voteQuestion.vote.source_chamber)}
                        {voteQuestion.vote.bill_number ? ` · ${voteQuestion.vote.bill_number}` : ""}
                        {voteQuestion.vote.voted_at ? ` · ${voteQuestion.vote.voted_at}` : ""}
                        {voteQuestion.vote.vote_type ? ` · ${voteQuestion.vote.vote_type}` : ""}
                      </p>
                    </div>
                  </article>
                ) : null}
              </div>

              <div aria-label={t.partyChoices} className="flex flex-wrap justify-center gap-[7px] p-[10px]" role="group">
                {visibleParties.length === 0 ? (
                  <div className="h-[28px] w-24 animate-pulse rounded-[6px] bg-slate-200" />
                ) : (
                  visibleParties.map((party) => {
                    const isActual = voteAnswer ? voteAnswer.question.target_party === party.key : false;
                    const isDisabled = Boolean(voteAnswer) || loading || !voteQuestion;
                    return (
                      <button
                        className={clsx(
                          "focus-ring h-[30px] min-w-[48px] rounded-[6px] px-[10px] text-[11px] font-black text-white shadow-sm transition",
                          isDisabled ? "cursor-default opacity-75" : "hover:brightness-95",
                          voteAnswer && !isActual ? "grayscale" : ""
                        )}
                        key={party.key}
                        onClick={() => submitVoteGuess(party)}
                        disabled={isDisabled}
                        style={{ backgroundColor: party.color, color: party.textColor ?? "#ffffff" }}
                        type="button"
                      >
                        {party.label}
                      </button>
                    );
                  })
                )}
              </div>

              {voteAnswer && lastGuess ? (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-center">
                  <div className={clsx("mx-auto mb-2 inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.12em] text-white", voteAnswer.correct ? "bg-emerald-500" : "bg-red-500")}>
                    {voteAnswer.correct ? t.correct : t.wrong}
                  </div>
                  <div className="mx-auto mb-3 h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      key={`${voteAnswer.question.id}-${lastGuess.key}`}
                      className={clsx("reveal-progress h-full w-full rounded-full", voteAnswer.correct ? "bg-emerald-500" : "bg-red-500")}
                      style={{
                        animationDuration: `${RESULT_REVEAL_MS}ms`
                      }}
                    />
                  </div>
                  <p className="text-[16px] font-black leading-tight text-slate-950">
                    {partyByKey.get(voteAnswer.question.target_party)?.label ?? voteAnswer.question.target_party_label}
                  </p>
                  <p className="mt-2 text-[12px] font-bold text-slate-600">
                    {t.majority}: {formatPercent(voteAnswer.question.target_majority_share)} {voteStanceLabel(voteAnswer.question.target_stance, language)}
                    {" · "}
                    {t.youGuessed} {lastGuess.label}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {voteAnswer.question.vote.total_present} {t.totalPresent} · {voteAnswer.question.vote.total_for} pentru · {voteAnswer.question.vote.total_against} împotrivă · {voteAnswer.question.vote.total_abstain} abțineri
                  </p>
                  <a
                    className="mt-3 inline-flex h-[28px] items-center rounded-[6px] bg-black px-3 text-[10px] font-black text-white"
                    href={voteAnswer.question.vote.source_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t.voteSource}
                  </a>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="relative aspect-square w-full bg-slate-200">
                {loading || (!error && politician && photoStatus === "idle") ? (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" aria-label="Loading photo" />
                ) : null}
                {error ? <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm font-bold text-red-700">{error}</div> : null}
                {!loading && !error && politician && photoStatus !== "failed" && portraitSrc ? (
                  <img
                    alt="Romanian politician portrait"
                    className={clsx("h-full w-full object-cover transition-opacity duration-150", photoStatus === "loaded" ? "opacity-100" : "opacity-0")}
                    key={politician.id}
                    onError={() => setPhotoStatus("failed")}
                    onLoad={() => setPhotoStatus("loaded")}
                    src={portraitSrc}
                  />
                ) : null}
                {!loading && !error && politician && photoStatus === "failed" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-200 text-sm font-bold text-slate-500">
                    Photo unavailable
                  </div>
                ) : null}
              </div>

              <div aria-label={t.partyChoices} className="flex flex-wrap justify-center gap-[7px] p-[10px]" role="group">
                {visibleParties.length === 0 ? (
                  <div className="h-[28px] w-24 animate-pulse rounded-[6px] bg-slate-200" />
                ) : (
                  visibleParties.map((party) => {
                    const isActual = answer ? actualPartyKey === party.key : false;
                    const isDisabled = Boolean(answer) || loading || !politician || photoStatus !== "loaded";
                    return (
                      <button
                        className={clsx(
                          "focus-ring h-[30px] min-w-[48px] rounded-[6px] px-[10px] text-[11px] font-black text-white shadow-sm transition",
                          isDisabled ? "cursor-default opacity-75" : "hover:brightness-95",
                          answer && !isActual ? "grayscale" : ""
                        )}
                        key={party.key}
                        onClick={() => submitGuess(party)}
                        disabled={isDisabled}
                        style={{ backgroundColor: party.color, color: party.textColor ?? "#ffffff" }}
                        type="button"
                      >
                        {party.label}
                      </button>
                    );
                  })
                )}
              </div>

              {answer && lastGuess ? (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-center">
                  <div className={clsx("mx-auto mb-2 inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.12em] text-white", answer.correct ? "bg-emerald-500" : "bg-red-500")}>
                    {answer.correct ? t.correct : t.wrong}
                  </div>
                  <div className="mx-auto mb-3 h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      key={`${answer.politician.id}-${lastGuess.key}`}
                      className={clsx("reveal-progress h-full w-full rounded-full", answer.correct ? "bg-emerald-500" : "bg-red-500")}
                      style={{
                        animationDuration: `${RESULT_REVEAL_MS}ms`
                      }}
                    />
                  </div>
                  <p className="text-[16px] font-black leading-tight text-slate-950">{answer.politician.name}</p>
                  <p className="mt-1 text-[11px] font-bold leading-snug text-slate-500">
                    {chamberLabel(answer.politician.chamber, language)}
                    {answer.politician.constituency ? ` · ${answer.politician.constituency}` : ""}
                  </p>
                  <p className="mt-2 text-[12px] font-bold text-slate-600">
                    {actualPartyLabel} · {t.youGuessed} {lastGuess.label}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        <p className="mt-[15px] text-center text-[11px] font-semibold text-slate-500" data-testid={isDailyMode ? "daily-footer-label" : undefined}>
          {isDailyMode
            ? `${dailyComplete ? t.dailyComplete : t.dailyChallenge} · ${dailyAnswered} / ${dailyTotal}`
            : isVoteMode ? totalLoaded > 0 ? `${totalLoaded} ${t.voteQuestionsLoaded}` : t.voteQuestionsLoaded
            : totalLoaded > 0 ? `${totalLoaded} ${t[activeScope.loadedLabelKey]}` : t[activeScope.loadedLabelKey]}
        </p>
      </section>

      <section className="mx-auto mt-[32px] w-[390px] max-w-[calc(100vw-24px)] pb-8">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t.recentGuesses}</h2>
        {visibleRecent.length === 0 ? (
          <div className="mt-[10px] rounded-[9px] border border-slate-100 bg-white px-[12px] py-[14px] text-[11px] font-bold text-slate-500 shadow-sm">
            {t.noGuessesYet}
          </div>
        ) : isVoteMode ? (
          <ol className="mt-[10px] space-y-[7px]">
            {voteRecent.map((guess) => (
              <li className="flex min-h-[58px] items-center gap-[9px] rounded-[9px] border border-slate-100 bg-white px-[10px] py-2 shadow-sm" key={guess.id}>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] font-black leading-[1.2] text-slate-900">{guess.prompt}</p>
                  <p className="mt-1 truncate text-[10px] font-semibold leading-[1.4] text-slate-500">
                    {partyDisplayLabel({ key: guess.actualPartyKey, label: guess.actualParty }, language)} · {t.youGuessed}{" "}
                    {partyDisplayLabel({ key: guess.guessedPartyKey, label: guess.guessedParty }, language)}
                  </p>
                </div>
                <span className={clsx("flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[13px] font-black leading-none text-white", guess.correct ? "bg-emerald-500" : "bg-red-500")}>
                  {guess.correct ? "✓" : "×"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="mt-[10px] space-y-[7px]">
            {recent.map((guess) => (
              <li className="flex h-[52px] items-center gap-[9px] rounded-[9px] border border-slate-100 bg-white px-[9px] shadow-sm" key={guess.id}>
                <img alt="" className="h-[32px] w-[32px] rounded-[5px] bg-slate-200 object-cover" src={thumbnailSrc(guess.photoUrl)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black leading-[1.2] text-slate-900">{guess.name}</p>
                  <p className="truncate text-[10px] font-semibold leading-[1.4] text-slate-500">
                    {guess.actualPartyKey ? partyDisplayLabel({ key: guess.actualPartyKey, label: guess.actualParty }, language) : guess.actualParty} · {t.youGuessed}{" "}
                    {guess.guessedPartyKey ? partyDisplayLabel({ key: guess.guessedPartyKey, label: guess.guessedParty }, language) : guess.guessedParty}
                  </p>
                </div>
                <span className={clsx("flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[13px] font-black leading-none text-white", guess.correct ? "bg-emerald-500" : "bg-red-500")}>
                  {guess.correct ? "✓" : "×"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <SocialFooter className="mt-auto pt-12" />
    </main>
  );
}
