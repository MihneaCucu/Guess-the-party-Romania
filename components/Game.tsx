"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LanguageToggle, useLanguage } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { chamberLabel, TRANSLATIONS } from "@/lib/i18n";
import type { PartyOption, Politician, PoliticianScope, PublicPolitician } from "@/lib/types";

type RecentGuess = {
  id: string;
  name: string;
  guessedParty: string;
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

type GuessResponse = {
  correct: boolean;
  politician: Politician;
};

const BEST_KEY = "gtp-ro-best";
const RECENT_KEY = "gtp-ro-recent";
const PRIMARY_PHOTO_TIMEOUT_MS = 4500;
const FALLBACK_PHOTO_TIMEOUT_MS = 4500;
const RESULT_REVEAL_MS = 2800;

const SCOPE_OPTIONS: Array<{ key: string; labelKey: "all" | "senat" | "camera" | "guvern"; apiValue: string; scope: PoliticianScope; loadedLabelKey: "candidatesLoaded" | "senatorsLoaded" | "deputiesLoaded" | "governmentMembersLoaded" }> = [
  { key: "all", labelKey: "all", apiValue: "all", scope: "all", loadedLabelKey: "candidatesLoaded" },
  { key: "senat", labelKey: "senat", apiValue: "senat", scope: "Senat", loadedLabelKey: "senatorsLoaded" },
  { key: "camera", labelKey: "camera", apiValue: "camera", scope: "Camera Deputatilor", loadedLabelKey: "deputiesLoaded" },
  { key: "guvern", labelKey: "guvern", apiValue: "guvern", scope: "Guvern", loadedLabelKey: "governmentMembersLoaded" }
];

function photoSrc(url: string): string {
  if (url.startsWith("/")) return url;
  return `/api/photo?url=${encodeURIComponent(url)}`;
}

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

export function Game() {
  const language = useLanguage();
  const t = TRANSLATIONS[language];
  const [politician, setPolitician] = useState<PublicPolitician | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "loaded" | "failed">("idle");
  const [photoMode, setPhotoMode] = useState<"proxy" | "direct">("proxy");
  const [answer, setAnswer] = useState<GuessResponse | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [recent, setRecent] = useState<RecentGuess[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [scopeKey, setScopeKey] = useState("all");
  const [lastGuess, setLastGuess] = useState<PartyOption | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);

  const partyByKey = useMemo(() => new Map(parties.map((party) => [party.key, party])), [parties]);
  const visibleParties = parties;
  const actualPartyLabel = answer ? partyByKey.get(answer.politician.party_key)?.label ?? answer.politician.party_label : "";
  const activeScope = SCOPE_OPTIONS.find((option) => option.key === scopeKey) ?? SCOPE_OPTIONS[0];
  const portraitSrc = politician
    ? photoMode === "proxy"
      ? photoSrc(politician.photo_url)
      : politician.photo_url
    : null;

  const clearRevealTimers = useCallback(() => {
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
  }, []);

  const loadNext = useCallback(async () => {
    clearRevealTimers();
    setLoading(true);
    setAnswer(null);
    setLastGuess(null);
    setError(null);
    setPolitician(null);
    setPhotoStatus("idle");
    setPhotoMode("proxy");

    try {
      const response = await fetch(`/api/politicians/random?scope=${activeScope.apiValue}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load a politician.");
      const payload = (await response.json()) as RandomResponse;
      setParties(payload.parties);
      setTotalLoaded(payload.totalLoaded);
      setPolitician(payload.politician);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [activeScope.apiValue, clearRevealTimers]);

  useEffect(() => {
    if (!politician || photoStatus !== "idle") return undefined;

    const timeout = window.setTimeout(() => {
      if (photoMode === "proxy") {
        setPhotoMode("direct");
      } else {
        setPhotoStatus("failed");
      }
    }, photoMode === "proxy" ? PRIMARY_PHOTO_TIMEOUT_MS : FALLBACK_PHOTO_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [photoMode, photoStatus, politician]);

  useEffect(() => {
    setBest(Number(window.localStorage.getItem(BEST_KEY) ?? "0"));
    setRecent(readRecentGuesses());
    void loadNext();
    return clearRevealTimers;
  }, [clearRevealTimers, loadNext]);

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

      setAnswer(payload);
      setLastGuess(party);
      setScore((current) => ({
        correct: current.correct + (payload.correct ? 1 : 0),
        total: current.total + 1
      }));
      setStreak(nextStreak);
      setBest(nextBest);
      window.localStorage.setItem(BEST_KEY, String(nextBest));
      setRecent((items) => {
        const nextItems = [
          {
            id: crypto.randomUUID(),
            name: payload.politician.name,
            guessedParty: party.label,
            actualParty: partyByKey.get(payload.politician.party_key)?.label ?? payload.politician.party_label,
            correct: payload.correct,
            photoUrl: payload.politician.photo_url
          },
          ...items
        ].slice(0, 10);
        writeRecentGuesses(nextItems);
        return nextItems;
      });
      clearRevealTimers();
      revealTimeoutRef.current = window.setTimeout(() => {
        void loadNext();
      }, RESULT_REVEAL_MS);
    } catch (guessError) {
      setError(guessError instanceof Error ? guessError.message : "Something went wrong.");
    }
  }

  function reset() {
    clearRevealTimers();
    setScore({ correct: 0, total: 0 });
    setStreak(0);
    setBest(0);
    setRecent([]);
    setAnswer(null);
    setLastGuess(null);
    window.localStorage.setItem(BEST_KEY, "0");
    window.localStorage.removeItem(RECENT_KEY);
    void loadNext();
  }

  return (
    <main className="min-h-screen bg-[#f3f3f7] text-[#202431]">
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
          <button className="focus-ring rounded-[6px] border border-slate-200 bg-white px-[10px] py-[7px] text-[11px] font-bold text-slate-500 shadow-sm" onClick={reset} type="button">
            {t.reset}
          </button>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto mt-6 flex w-[390px] max-w-[calc(100vw-24px)] flex-col items-center">
        <div className="mb-[10px] grid w-full grid-cols-4 gap-[5px] rounded-[10px] border border-[#e4e6ee] bg-white p-[5px] shadow-sm">
          {SCOPE_OPTIONS.map((option) => (
            <button
              className={clsx(
                "focus-ring h-[28px] rounded-[7px] px-2 text-[10px] font-black transition",
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

        <div className="w-full overflow-hidden rounded-[12px] bg-white shadow-[0_16px_38px_rgba(34,39,52,0.15)]">
          <div className="relative aspect-square w-full bg-slate-200">
            {loading || (!error && politician && photoStatus === "idle") ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" aria-label="Loading photo" />
            ) : null}
            {error ? <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm font-bold text-red-700">{error}</div> : null}
            {!loading && !error && politician && photoStatus !== "failed" && portraitSrc ? (
              <img
                alt="Romanian politician portrait"
                className={clsx("h-full w-full object-cover transition-opacity duration-150", photoStatus === "loaded" ? "opacity-100" : "opacity-0")}
                key={`${politician.id}-${photoMode}`}
                onError={() => {
                  if (photoMode === "proxy") {
                    setPhotoMode("direct");
                  } else {
                    setPhotoStatus("failed");
                  }
                }}
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

          <div className="flex flex-wrap justify-center gap-[7px] p-[10px]">
            {visibleParties.length === 0 ? (
              <div className="h-[28px] w-24 animate-pulse rounded-[6px] bg-slate-200" />
            ) : (
              visibleParties.map((party) => {
                const isActual = answer?.politician.party_key === party.key;
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
        </div>

        <p className="mt-[15px] text-center text-[11px] font-semibold text-slate-500">
          {totalLoaded > 0 ? `${totalLoaded} ${t[activeScope.loadedLabelKey]}` : t[activeScope.loadedLabelKey]}
        </p>
      </section>

      <section className="mx-auto mt-[32px] w-[390px] max-w-[calc(100vw-24px)] pb-8">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t.recentGuesses}</h2>
        {recent.length === 0 ? (
          <div className="mt-[10px] rounded-[9px] border border-slate-100 bg-white px-[12px] py-[14px] text-[11px] font-bold text-slate-500 shadow-sm">
            {t.noGuessesYet}
          </div>
        ) : (
          <ol className="mt-[10px] space-y-[7px]">
            {recent.map((guess) => (
              <li className="flex h-[52px] items-center gap-[9px] rounded-[9px] border border-slate-100 bg-white px-[9px] shadow-sm" key={guess.id}>
                <img alt="" className="h-[32px] w-[32px] rounded-[5px] bg-slate-200 object-cover" src={photoSrc(guess.photoUrl)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black leading-[1.2] text-slate-900">{guess.name}</p>
                  <p className="truncate text-[10px] font-semibold leading-[1.4] text-slate-500">
                    {guess.actualParty} · {t.youGuessed} {guess.guessedParty}
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
    </main>
  );
}
