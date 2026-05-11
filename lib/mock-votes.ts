import type { LegislativePartyPosition, LegislativeQuestion, LegislativeVote, VoteGuessRecord } from "@/lib/types";

const NOW = "2026-05-11T00:00:00.000Z";

export const MOCK_LEGISLATIVE_VOTES: LegislativeVote[] = [
  {
    id: "cdep-2025-drone-defense",
    source_chamber: "cdep",
    source_vote_id: "mock-22170",
    voted_at: "2025-02-26",
    bill_number: "PL-x 47/2025",
    title: "Reglementări privind spațiul aerian național și intervenția împotriva dronelor",
    vote_type: "vot final",
    source_url: "https://www.cdep.ro/pls/steno/evot2015.nominal?idv=22170&ord=2",
    total_for: 204,
    total_against: 46,
    total_abstain: 35,
    total_present: 285,
    created_at: NOW,
    updated_at: NOW
  },
  {
    id: "cdep-2025-special-pensions",
    source_chamber: "cdep",
    source_vote_id: "mock-22331",
    voted_at: "2025-03-19",
    bill_number: "PL-x 92/2025",
    title: "Modificări privind regimul pensiilor speciale",
    vote_type: "vot final",
    source_url: "https://www.cdep.ro/pls/steno/evot2015.nominal?idv=22331&ord=2",
    total_for: 132,
    total_against: 118,
    total_abstain: 18,
    total_present: 268,
    created_at: NOW,
    updated_at: NOW
  },
  {
    id: "cdep-2025-education-funding",
    source_chamber: "cdep",
    source_vote_id: "mock-22402",
    voted_at: "2025-04-08",
    bill_number: "PL-x 118/2025",
    title: "Finanțarea programelor locale pentru reducerea abandonului școlar",
    vote_type: "vot final",
    source_url: "https://www.cdep.ro/pls/steno/evot2015.nominal?idv=22402&ord=2",
    total_for: 190,
    total_against: 61,
    total_abstain: 22,
    total_present: 273,
    created_at: NOW,
    updated_at: NOW
  }
];

export const MOCK_LEGISLATIVE_PARTY_POSITIONS: LegislativePartyPosition[] = [
  { id: "cdep-2025-drone-defense:PSD", vote_id: "cdep-2025-drone-defense", party_key: "PSD", party_label: "PSD", stance: "for", vote_count: 86, party_present_count: 91, majority_share: 0.9451 },
  { id: "cdep-2025-drone-defense:PNL", vote_id: "cdep-2025-drone-defense", party_key: "PNL", party_label: "PNL", stance: "for", vote_count: 50, party_present_count: 54, majority_share: 0.9259 },
  { id: "cdep-2025-drone-defense:USR", vote_id: "cdep-2025-drone-defense", party_key: "USR", party_label: "USR", stance: "against", vote_count: 31, party_present_count: 34, majority_share: 0.9118 },
  { id: "cdep-2025-drone-defense:AUR", vote_id: "cdep-2025-drone-defense", party_key: "AUR", party_label: "AUR", stance: "abstain", vote_count: 24, party_present_count: 31, majority_share: 0.7742 },
  { id: "cdep-2025-special-pensions:PSD", vote_id: "cdep-2025-special-pensions", party_key: "PSD", party_label: "PSD", stance: "for", vote_count: 78, party_present_count: 89, majority_share: 0.8764 },
  { id: "cdep-2025-special-pensions:PNL", vote_id: "cdep-2025-special-pensions", party_key: "PNL", party_label: "PNL", stance: "against", vote_count: 42, party_present_count: 52, majority_share: 0.8077 },
  { id: "cdep-2025-special-pensions:USR", vote_id: "cdep-2025-special-pensions", party_key: "USR", party_label: "USR", stance: "against", vote_count: 28, party_present_count: 32, majority_share: 0.875 },
  { id: "cdep-2025-special-pensions:AUR", vote_id: "cdep-2025-special-pensions", party_key: "AUR", party_label: "AUR", stance: "abstain", vote_count: 18, party_present_count: 30, majority_share: 0.6 },
  { id: "cdep-2025-education-funding:PSD", vote_id: "cdep-2025-education-funding", party_key: "PSD", party_label: "PSD", stance: "for", vote_count: 74, party_present_count: 88, majority_share: 0.8409 },
  { id: "cdep-2025-education-funding:PNL", vote_id: "cdep-2025-education-funding", party_key: "PNL", party_label: "PNL", stance: "for", vote_count: 44, party_present_count: 50, majority_share: 0.88 },
  { id: "cdep-2025-education-funding:USR", vote_id: "cdep-2025-education-funding", party_key: "USR", party_label: "USR", stance: "for", vote_count: 27, party_present_count: 33, majority_share: 0.8182 },
  { id: "cdep-2025-education-funding:AUR", vote_id: "cdep-2025-education-funding", party_key: "AUR", party_label: "AUR", stance: "against", vote_count: 25, party_present_count: 29, majority_share: 0.8621 }
];

export const MOCK_LEGISLATIVE_QUESTIONS: LegislativeQuestion[] = [
  {
    id: "q-drone-defense-usr-against",
    vote_id: "cdep-2025-drone-defense",
    target_party: "USR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar împotriva reglementărilor care permit intervenția armatei împotriva dronelor.",
    prompt_en: "Guess which party mostly voted against the rules allowing military intervention against drones.",
    active: true,
    review_status: "approved",
    interesting: true,
    created_at: NOW,
    updated_at: NOW
  },
  {
    id: "q-special-pensions-psd-for",
    vote_id: "cdep-2025-special-pensions",
    target_party: "PSD",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar pentru modificările privind pensiile speciale.",
    prompt_en: "Guess which party mostly voted for the special pensions changes.",
    active: true,
    review_status: "approved",
    interesting: true,
    created_at: NOW,
    updated_at: NOW
  },
  {
    id: "q-education-funding-aur-against",
    vote_id: "cdep-2025-education-funding",
    target_party: "AUR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar împotriva finanțării programelor locale pentru reducerea abandonului școlar.",
    prompt_en: "Guess which party mostly voted against funding local programs to reduce school dropout.",
    active: true,
    review_status: "approved",
    interesting: true,
    created_at: NOW,
    updated_at: NOW
  }
];

export const MOCK_VOTE_GUESSES: VoteGuessRecord[] = [];
