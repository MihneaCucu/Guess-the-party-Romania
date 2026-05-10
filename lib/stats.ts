import { getPartyOptions } from "@/lib/parties";
import type { GuessRecord, Politician, PoliticianDifficulty, SessionRecord, StatsSummary } from "@/lib/types";

type PoliticianAggregate = {
  politician: Politician;
  attempts: number;
  correct: number;
  wrongByParty: Record<string, number>;
};

export function computeStats(
  politicians: Politician[],
  guesses: GuessRecord[],
  sessions: SessionRecord[],
  minPoliticianAttempts = 15
): StatsSummary {
  const activePoliticians = politicians.filter((politician) => politician.active && politician.review_status === "approved");
  const parties = getPartyOptions(activePoliticians.map((politician) => politician.party_key));
  const partyLabels = new Map(parties.map((party) => [party.key, party.label]));
  const byPolitician = new Map(activePoliticians.map((politician) => [politician.id, politician]));

  const partyAccuracy = parties.map((party) => {
    const partyGuesses = guesses.filter((guess) => guess.actual_party === party.key);
    const correct = partyGuesses.filter((guess) => guess.correct).length;
    return {
      party: party.key,
      label: party.label,
      attempts: partyGuesses.length,
      correct,
      accuracy: partyGuesses.length === 0 ? 0 : correct / partyGuesses.length
    };
  });

  const confusionMatrix = parties.map((actual) => {
    const rowGuesses = guesses.filter((guess) => guess.actual_party === actual.key);
    const cells = Object.fromEntries(parties.map((guessed) => [guessed.key, 0]));
    for (const guess of rowGuesses) {
      cells[guess.guessed_party] = (cells[guess.guessed_party] ?? 0) + 1;
    }

    return {
      actualParty: actual.key,
      label: actual.label,
      guesses: cells
    };
  });

  const aggregates = new Map<string, PoliticianAggregate>();
  for (const guess of guesses) {
    const politician = byPolitician.get(guess.politician_id);
    if (!politician) continue;

    const aggregate = aggregates.get(guess.politician_id) ?? {
      politician,
      attempts: 0,
      correct: 0,
      wrongByParty: {}
    };

    aggregate.attempts += 1;
    if (guess.correct) {
      aggregate.correct += 1;
    } else {
      aggregate.wrongByParty[guess.guessed_party] = (aggregate.wrongByParty[guess.guessed_party] ?? 0) + 1;
    }
    aggregates.set(guess.politician_id, aggregate);
  }

  const difficulties = Array.from(aggregates.values())
    .filter((aggregate) => aggregate.attempts >= minPoliticianAttempts)
    .map((aggregate): PoliticianDifficulty => {
      const [topWrongParty, topWrongCount] =
        Object.entries(aggregate.wrongByParty).sort((a, b) => b[1] - a[1])[0] ?? [];

      return {
        politicianId: aggregate.politician.id,
        name: aggregate.politician.name,
        party: aggregate.politician.party_key,
        partyLabel: partyLabels.get(aggregate.politician.party_key) ?? aggregate.politician.party_label,
        photoUrl: aggregate.politician.photo_url,
        attempts: aggregate.attempts,
        correct: aggregate.correct,
        accuracy: aggregate.correct / aggregate.attempts,
        topWrongParty,
        topWrongCount
      };
    });

  const members = activePoliticians
    .filter((politician) => Boolean(politician.photo_url))
    .map((politician): PoliticianDifficulty => ({
      politicianId: politician.id,
      name: politician.name,
      party: politician.party_key,
      partyLabel: partyLabels.get(politician.party_key) ?? politician.party_label,
      photoUrl: politician.photo_url,
      attempts: aggregates.get(politician.id)?.attempts ?? 0,
      correct: aggregates.get(politician.id)?.correct ?? 0,
      accuracy: aggregates.get(politician.id)?.attempts ? (aggregates.get(politician.id)?.correct ?? 0) / (aggregates.get(politician.id)?.attempts ?? 1) : 0,
      topWrongParty: Object.entries(aggregates.get(politician.id)?.wrongByParty ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0],
      topWrongCount: Object.entries(aggregates.get(politician.id)?.wrongByParty ?? {}).sort((a, b) => b[1] - a[1])[0]?.[1]
    }))
    .sort((a, b) => a.party.localeCompare(b.party) || a.name.localeCompare(b.name));

  const easiest = Object.fromEntries(
    parties.map((party) => [
      party.key,
      difficulties
        .filter((item) => item.party === party.key)
        .sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)
        .slice(0, 5)
    ])
  );

  const hardest = Object.fromEntries(
    parties.map((party) => [
      party.key,
      difficulties
        .filter((item) => item.party === party.key)
        .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
        .slice(0, 5)
    ])
  );

  const mostMistakenAs = Object.fromEntries(
    parties.map((party) => [
      party.key,
      difficulties
        .filter((item) => item.topWrongParty === party.key)
        .sort((a, b) => (b.topWrongCount ?? 0) - (a.topWrongCount ?? 0) || a.accuracy - b.accuracy)
        .slice(0, 5)
    ])
  );

  const totalSessionGuesses = sessions.reduce((sum, session) => sum + session.guess_count, 0);
  const totalSessions = sessions.length;

  return {
    totalGuesses: guesses.length,
    totalSessions,
    averagePerSession: totalSessions === 0 ? 0 : totalSessionGuesses / totalSessions,
    longestSession: sessions.reduce((max, session) => Math.max(max, session.guess_count), 0),
    partyAccuracy,
    confusionMatrix,
    members,
    easiest,
    hardest,
    mostMistakenAs
  };
}
