"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LanguageToggle, useLanguage } from "@/components/LanguageToggle";
import { SocialFooter } from "@/components/SocialFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TRANSLATIONS } from "@/lib/i18n";
import { BASE_PARTIES, partyDisplayLabel } from "@/lib/parties";
import { thumbnailSrc } from "@/lib/photos";
import type { PartyOption, PoliticianDifficulty, StatsSummary } from "@/lib/types";

const PRIMARY_PARTIES = ["PSD", "PNL", "USR", "AUR", "UDMR"];
const SAMPLE_NAMES = ["Andrei Popescu", "Elena Dumitrescu", "Mihai Ionescu", "Ioana Marin", "Vlad Georgescu"];
const SAMPLE_ACCURACY: Record<string, number> = { PSD: 0.71, PNL: 0.64, USR: 0.58, AUR: 0.69, UDMR: 0.62 };
const SAMPLE_MATRIX: Record<string, Record<string, number>> = {
  PSD: { PSD: 71, PNL: 9, USR: 7, AUR: 10, UDMR: 3 },
  PNL: { PSD: 12, PNL: 64, USR: 9, AUR: 11, UDMR: 4 },
  USR: { PSD: 10, PNL: 14, USR: 58, AUR: 12, UDMR: 6 },
  AUR: { PSD: 13, PNL: 7, USR: 8, AUR: 69, UDMR: 3 },
  UDMR: { PSD: 6, PNL: 11, USR: 12, AUR: 9, UDMR: 62 }
};

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function wholePct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function numberFormat(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function partyFor(key: string): PartyOption {
  return BASE_PARTIES.find((party) => party.key === key) ?? { key, label: key, color: "#64748b", textColor: "#ffffff" };
}

function localizeParty(party: PartyOption, language: ReturnType<typeof useLanguage>): PartyOption {
  return { ...party, label: partyDisplayLabel(party, language) };
}

function partyPill(party: PartyOption, compact = false) {
  return (
    <span
      className={clsx("inline-flex items-center rounded-[5px] font-black text-white", compact ? "px-2 py-[3px] text-[9px]" : "px-2.5 py-1 text-[10px]")}
      style={{ backgroundColor: party.color, color: party.textColor ?? "#ffffff" }}
    >
      {party.label}
    </span>
  );
}

function Avatar({ item, index }: { item?: Pick<PoliticianDifficulty, "photoUrl" | "name">; index: number }) {
  if (item?.photoUrl) {
    return (
      <img
        alt=""
        className="h-[34px] w-[34px] rounded-[6px] object-cover"
        src={thumbnailSrc(item.photoUrl)}
      />
    );
  }

  return (
    <span
      className={clsx(
        "h-[34px] w-[34px] rounded-[6px]",
        index % 5 === 0 && "bg-gradient-to-br from-slate-500 to-slate-200",
        index % 5 === 1 && "bg-gradient-to-br from-rose-400 to-slate-200",
        index % 5 === 2 && "bg-gradient-to-br from-sky-500 to-slate-200",
        index % 5 === 3 && "bg-gradient-to-br from-amber-400 to-slate-200",
        index % 5 === 4 && "bg-gradient-to-br from-emerald-500 to-slate-200"
      )}
    />
  );
}

function sampleDifficulty(partyKey: string, index: number): PoliticianDifficulty {
  const party = partyFor(partyKey);
  return {
    politicianId: `${partyKey}-${index}`,
    name: SAMPLE_NAMES[(index + PRIMARY_PARTIES.indexOf(partyKey)) % SAMPLE_NAMES.length],
    party: party.key,
    partyLabel: party.label,
    photoUrl: "",
    attempts: 24 + index * 7,
    correct: 0,
    accuracy: Math.max(0.35, (SAMPLE_ACCURACY[partyKey] ?? 0.6) - index * 0.035),
    topWrongParty: PRIMARY_PARTIES[(index + 2) % PRIMARY_PARTIES.length],
    topWrongCount: 8 + index
  };
}

function withSampleMetrics(item: PoliticianDifficulty, partyKey: string, index: number): PoliticianDifficulty {
  if (item.attempts > 0) return item;

  return {
    ...item,
    attempts: 24 + index * 7,
    accuracy: Math.max(0.35, (SAMPLE_ACCURACY[partyKey] ?? 0.6) - index * 0.035),
    topWrongParty: PRIMARY_PARTIES[(index + 2) % PRIMARY_PARTIES.length],
    topWrongCount: 8 + index
  };
}

function memberFallbacks(stats: StatsSummary | null, partyKey: string, count: number, offset = 0): PoliticianDifficulty[] {
  const members = (stats?.members ?? []).filter((item) => item.party === partyKey);
  if (members.length === 0) {
    return Array.from({ length: count }, (_, index) => sampleDifficulty(partyKey, index + offset));
  }

  return Array.from({ length: Math.min(count, members.length) }, (_, index) => {
    const member = members[(index + offset) % members.length];
    return withSampleMetrics(member, partyKey, index + offset);
  });
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-2">
      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">{title}</h2>
      <p className="text-[11px] font-semibold text-slate-400">{subtitle}</p>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[9px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-[27px] font-black leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

function CandidateRow({ item, index, right, subline }: { item: PoliticianDifficulty; index: number; right: string; subline?: string }) {
  return (
    <li className="flex h-[50px] items-center gap-3 border-t border-slate-100 first:border-t-0">
      <Avatar item={item} index={index} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-slate-900">{item.name}</p>
        <p className="truncate text-[10px] font-semibold text-slate-500">{subline ?? `n = ${numberFormat(item.attempts)}`}</p>
      </div>
      <div className="shrink-0 text-[13px] font-black text-slate-900">{right}</div>
    </li>
  );
}

export function StatsView() {
  const language = useLanguage();
  const t = TRANSLATIONS[language];
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load stats.");
        const payload = (await response.json()) as StatsSummary;
        if (active) {
          setStats(payload);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
      }
    }

    void load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const parties = useMemo(() => PRIMARY_PARTIES.map((key) => localizeParty(partyFor(key), language)), [language]);
  const partyMap = useMemo(() => new Map(BASE_PARTIES.map((party) => [party.key, localizeParty(party, language)])), [language]);
  const accuracyRows = useMemo(() => {
    const live = new Map((stats?.partyAccuracy ?? []).map((party) => [party.party, party]));
    return parties.map((party) => {
      const item = live.get(party.key);
      const value = item && item.attempts > 0 ? item.accuracy : SAMPLE_ACCURACY[party.key] ?? 0;
      return { ...party, attempts: item?.attempts ?? 0, accuracy: value };
    });
  }, [parties, stats]);

  const matrixRows = useMemo(() => {
    const live = new Map((stats?.confusionMatrix ?? []).map((row) => [row.actualParty, row]));
    return parties.map((actual) => {
      const liveRow = live.get(actual.key);
      const total = parties.reduce((sum, party) => sum + (liveRow?.guesses[party.key] ?? 0), 0);
      return {
        actual,
        cells: parties.map((guessed) => {
          const raw = liveRow?.guesses[guessed.key] ?? 0;
          const value = total > 0 ? Math.round((raw / total) * 100) : SAMPLE_MATRIX[actual.key]?.[guessed.key] ?? 0;
          return { guessed, value };
        })
      };
    });
  }, [parties, stats]);

  const easiestGroups = useMemo(() => {
    return parties.map((party) => {
      const live = stats?.easiest[party.key] ?? [];
      const items = live.length > 0 ? live : memberFallbacks(stats, party.key, 5);
      return { party, items: items.slice(0, 5) };
    });
  }, [parties, stats]);

  const hardestRows = useMemo(() => {
    const live = parties.flatMap((party) => stats?.hardest[party.key] ?? []);
    return (live.length > 0 ? live : parties.flatMap((party, partyIndex) => memberFallbacks(stats, party.key, 2, partyIndex + 1))).slice(0, 8);
  }, [parties, stats]);

  const mistakenGroups = useMemo(() => {
    return parties.map((party, partyIndex) => {
      const live = stats?.mostMistakenAs[party.key] ?? [];
      const items = live.length > 0
        ? live
        : Array.from({ length: 5 }, (_, index) => {
            const actualPartyKey = PRIMARY_PARTIES[(partyIndex + index + 1) % PRIMARY_PARTIES.length];
            return memberFallbacks(stats, actualPartyKey, 1, index)[0] ?? sampleDifficulty(actualPartyKey, index);
          });
      return { party, items: items.slice(0, 5) };
    });
  }, [parties, stats]);

  const searchableMembers = stats?.members?.length ? stats.members : hardestRows;
  const selectedCandidate = searchableMembers.find((item) => item.name.toLowerCase().includes(query.toLowerCase())) ?? searchableMembers[0] ?? hardestRows[0] ?? sampleDifficulty("USR", 0);
  const resolveParty = (key: string) => partyMap.get(key) ?? localizeParty(partyFor(key), language);
  const selectedParty = resolveParty(selectedCandidate.party);
  const topWrongParty = selectedCandidate.topWrongParty ? resolveParty(selectedCandidate.topWrongParty) : resolveParty("PNL");
  const totalGuesses = stats?.totalGuesses ?? 0;
  const totalSessions = stats?.totalSessions ?? 0;
  const averageAccuracy = accuracyRows.reduce((sum, party) => sum + party.accuracy, 0) / Math.max(1, accuracyRows.length);

  return (
    <main className="min-h-screen bg-[#f3f3f7] text-[#202431]">
      <header className="flex min-h-[47px] items-center justify-between gap-3 border-b border-[#e6e8ee] bg-white px-3">
        <nav className="flex min-w-0 flex-1 items-center gap-[6px] overflow-x-auto text-[12px] font-bold leading-none text-slate-600">
          <Link className="shrink-0 rounded-[6px] border border-slate-200 bg-white px-[10px] py-[8px] shadow-sm" href="/">
            {t.guessTheParty}
          </Link>
          <h1 aria-label="Stats" className="shrink-0 rounded-[6px] bg-black px-[10px] py-[8px] text-[12px] font-black text-white shadow-sm">
            {t.stats}
          </h1>
        </nav>

        <div className="flex shrink-0 items-center gap-[17px] text-center">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.score}</div>
            <div className="text-[19px] font-black leading-[0.9]">0 / 0</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.streak}</div>
            <div className="text-[19px] font-black leading-[0.9]">0</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.best}</div>
            <div className="text-[19px] font-black leading-[0.9]">0</div>
          </div>
          <button className="focus-ring rounded-[6px] border border-slate-200 bg-white px-[10px] py-[7px] text-[11px] font-bold text-slate-500 shadow-sm" type="button">
            {t.reset}
          </button>
          <LanguageToggle />
          <ThemeToggle />
          <button aria-label="Close" className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black text-[15px] font-bold leading-none text-white" type="button">
            ×
          </button>
        </div>
      </header>

      <div className="mx-auto w-[860px] max-w-[calc(100vw-28px)] py-16">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"><span className="text-emerald-500">●</span> {t.liveLabel}</div>
        <h2 className="mt-3 text-[34px] font-black leading-none tracking-[-0.02em] text-slate-950">{t.stats}</h2>
        <p className="mt-2 text-[13px] font-semibold text-slate-500">
          {pct(averageAccuracy)} {t.overallAccuracy} · {t.randomWouldBe} {wholePct(1 / Math.max(1, parties.length))} · {numberFormat(totalSessions)} {t.sessions.toLowerCase()}
        </p>

        {error ? <p className="mt-6 rounded-[9px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard color="#20a96b" label={t.votes} value={numberFormat(totalGuesses)} />
          <MetricCard color="#2f8fea" label={t.sessions} value={numberFormat(totalSessions)} />
          <MetricCard color="#f6a829" label={t.averageSession} value={(stats?.averagePerSession ?? 0).toFixed(1)} />
          <MetricCard color="#e53b4a" label={t.longestSession} value={numberFormat(stats?.longestSession ?? 0)} />
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.overallAccuracySubtitle} title={t.overallAccuracyByParty} />
          <div className="rounded-[10px] border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <div className="space-y-3">
              {accuracyRows.map((party) => (
                <div className="grid grid-cols-[88px_1fr_48px] items-center gap-3" key={party.key}>
                  <div className="flex items-center gap-2 text-[13px] font-black text-slate-800">
                    <span className="h-[8px] w-[8px] rounded-[2px]" style={{ backgroundColor: party.color }} />
                    {party.label}
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, party.accuracy * 100)}%`, backgroundColor: party.color }} />
                  </div>
                  <div className="text-right text-[13px] font-black text-slate-900">{pct(party.accuracy)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.confusionSubtitle} title={t.howVotersRead} />
          <div className="overflow-x-auto rounded-[10px] border border-slate-100 bg-white p-5 shadow-sm">
            <table className="w-full min-w-[650px] border-separate border-spacing-[4px] text-center text-[12px] font-black">
              <thead>
                <tr>
                  <th className="w-[96px]" />
                  {parties.map((party) => <th className="pb-1" key={party.key} style={{ color: party.color }}>{party.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.actual.key}>
                    <th className="pr-2 text-right" style={{ color: row.actual.color }}>{row.actual.label}</th>
                    {row.cells.map((cell) => {
                      const diagonal = row.actual.key === cell.guessed.key;
                      return (
                        <td
                          className={clsx("rounded-[6px] px-2 py-3", diagonal ? "border border-emerald-300 bg-emerald-100 text-slate-900" : "bg-rose-50 text-slate-800")}
                          key={cell.guessed.key}
                        >
                          {cell.value}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.easiestSubtitle} title={t.easiestTitle} />
          <div className="grid gap-4 md:grid-cols-2">
            {easiestGroups.map(({ party, items }) => (
              <div className="rounded-[10px] border border-slate-100 bg-white p-4 shadow-sm" key={party.key}>
                <div className="mb-2">{partyPill(party)}</div>
                <ol>{items.map((item, index) => <CandidateRow index={index} item={item} key={`${party.key}-${item.politicianId}`} right={pct(item.accuracy)} />)}</ol>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.hardestSubtitle} title={t.hardestTitle} />
          <div className="rounded-[10px] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="hidden grid-cols-[1fr_72px_110px_70px] gap-3 border-b border-slate-100 pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 md:grid">
              <div>{t.candidate}</div><div>{t.actual}</div><div>{t.wrongGuess}</div><div className="text-right">{t.correct}</div>
            </div>
            <ol>
              {hardestRows.map((item, index) => {
                const actual = partyMap.get(item.party) ?? partyFor(item.party);
                const wrong = item.topWrongParty ? partyMap.get(item.topWrongParty) ?? partyFor(item.topWrongParty) : topWrongParty;
                return (
                  <li className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-100 py-3 first:border-t-0 md:grid-cols-[1fr_72px_110px_70px]" key={`${item.politicianId}-${index}`}>
                    <div className="flex min-w-0 items-center gap-3"><Avatar item={item} index={index} /><span className="truncate text-[13px] font-black text-slate-900">{item.name}</span></div>
                    <div>{partyPill(actual, true)}</div>
                    <div>{partyPill(wrong, true)}</div>
                    <div className="text-right text-[13px] font-black text-slate-900">{pct(item.accuracy)}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.seemsElsewhereSubtitle} title={t.seemsElsewhere} />
          <div className="grid gap-4 md:grid-cols-2">
            {mistakenGroups.map(({ party, items }) => (
              <div className="rounded-[10px] border border-slate-100 bg-white p-4 shadow-sm" key={party.key}>
                <div className="mb-2">{partyPill(party)}</div>
                <ol>{items.map((item, index) => {
                  const actual = partyMap.get(item.party) ?? partyFor(item.party);
                  const share = item.topWrongCount && item.attempts ? item.topWrongCount / item.attempts : 0.28 + index * 0.04;
                  return <CandidateRow index={index} item={item} key={`${party.key}-${item.politicianId}-${index}`} right={pct(share)} subline={`${t.actual} ${actual.label}`} />;
                })}</ol>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionHeader subtitle={t.findCandidateSubtitle} title={t.findCandidate} />
          <div className="rounded-[10px] border border-slate-100 bg-white p-4 shadow-sm">
            <input
              className="h-[38px] w-full rounded-[7px] border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              value={query}
            />
            <div className="mt-4 flex items-start gap-3 rounded-[9px] bg-slate-50 p-3">
              <Avatar item={selectedCandidate} index={2} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-slate-950">{selectedCandidate.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                  {partyPill(selectedParty, true)}<span>{numberFormat(selectedCandidate.attempts)} {t.totalGuesses}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {[selectedParty, topWrongParty, resolveParty(selectedParty.key === "PSD" ? "PNL" : "PSD")].map((party, index) => {
                    const value = index === 0 ? selectedCandidate.accuracy : index === 1 ? Math.min(0.55, 1 - selectedCandidate.accuracy) : 0.12;
                    return (
                      <div className="grid grid-cols-[72px_1fr_42px] items-center gap-2" key={`${party.key}-${index}`}>
                        <span className="text-[10px] font-black text-slate-600">{party.label}</span>
                        <span className="h-[7px] overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, value * 100)}%`, backgroundColor: party.color }} /></span>
                        <span className="text-right text-[10px] font-black text-slate-700">{pct(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <SocialFooter />
      </div>
    </main>
  );
}
