import { normalizePartyKey, partyLabelFor, stripDiacritics } from "@/lib/parties";
import type { LegislativePartyPosition, PartyKey, VoteStance } from "@/lib/types";

export const VOTE_STANCES: VoteStance[] = ["for", "against", "abstain"];

export type RawVoteRow = {
  name: string;
  partyLabel: string;
  stance: VoteStance | null;
};

export function normalizeVoteStance(value: string): VoteStance | null {
  const normalized = stripDiacritics(value).toLowerCase();
  if (/\b(pentru|da|yes|for)\b/.test(normalized)) return "for";
  if (/\b(contra|impotriva|împotriva|against|nu|no)\b/.test(normalized)) return "against";
  if (/abtiner|abtinere|abtin|abstain/.test(normalized)) return "abstain";
  return null;
}

export function voteStanceLabel(stance: VoteStance, language: "en" | "ro"): string {
  if (language === "ro") {
    if (stance === "for") return "PENTRU";
    if (stance === "against") return "ÎMPOTRIVĂ";
    return "ABȚINERE";
  }

  if (stance === "for") return "IN FAVOR";
  if (stance === "against") return "AGAINST";
  return "ABSTAINED";
}

export function computePartyPositions(voteId: string, rows: RawVoteRow[]): LegislativePartyPosition[] {
  const partyBuckets = new Map<PartyKey, { label: string; counts: Record<VoteStance, number> }>();

  for (const row of rows) {
    if (!row.stance || !row.partyLabel.trim()) continue;
    const partyKey = normalizePartyKey(row.partyLabel);
    const bucket = partyBuckets.get(partyKey) ?? {
      label: partyLabelFor(partyKey, row.partyLabel),
      counts: { for: 0, against: 0, abstain: 0 }
    };
    bucket.counts[row.stance] += 1;
    partyBuckets.set(partyKey, bucket);
  }

  return Array.from(partyBuckets.entries()).flatMap(([partyKey, bucket]) => {
    const partyPresentCount = VOTE_STANCES.reduce((sum, stance) => sum + bucket.counts[stance], 0);
    if (partyPresentCount === 0) return [];

    const [stance, voteCount] = VOTE_STANCES
      .map((item) => [item, bucket.counts[item]] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const majorityShare = voteCount / partyPresentCount;
    if (majorityShare <= 0.5) return [];

    return [{
      id: `${voteId}:${partyKey}`,
      vote_id: voteId,
      party_key: partyKey,
      party_label: bucket.label,
      stance,
      vote_count: voteCount,
      party_present_count: partyPresentCount,
      majority_share: Number(majorityShare.toFixed(4))
    }];
  });
}

export function isUniquePartyForStance(
  positions: Array<Pick<LegislativePartyPosition, "party_key" | "stance">>,
  targetParty: PartyKey,
  targetStance: VoteStance
): boolean {
  const matches = positions.filter((position) => position.stance === targetStance);
  return matches.length === 1 && matches[0].party_key === targetParty;
}

export function eligibleQuestionTargets(positions: LegislativePartyPosition[]): LegislativePartyPosition[] {
  return positions.filter((position) => isUniquePartyForStance(positions, position.party_key, position.stance));
}
