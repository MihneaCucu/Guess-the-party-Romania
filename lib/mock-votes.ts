import type { LegislativePartyPosition, LegislativeQuestion, LegislativeSourceChamber, LegislativeVote, VoteGuessRecord, VoteStance } from "@/lib/types";

const NOW = "2026-05-11T00:00:00.000Z";

type PositionSeed = {
  party: string;
  label?: string;
  stance: VoteStance;
  votes: number;
  present: number;
};

type VoteSeed = {
  id: string;
  source_chamber: LegislativeSourceChamber;
  source_vote_id: string;
  voted_at: string;
  bill_number: string;
  title: string;
  source_url: string;
  target_party: string;
  target_stance: VoteStance;
  prompt_ro: string;
  prompt_en: string;
  positions: PositionSeed[];
};

const REVIEWED_VOTE_SEEDS: VoteSeed[] = [
  {
    id: "cdep-2025-drone-defense",
    source_chamber: "cdep",
    source_vote_id: "sample-22170",
    voted_at: "2025-02-26",
    bill_number: "PL-x 47/2025",
    title: "Reglementări privind spațiul aerian național și intervenția împotriva dronelor",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "USR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar ÎMPOTRIVA reglementărilor care permit intervenția armatei împotriva dronelor.",
    prompt_en: "Guess which party voted AGAINST the rules allowing military intervention against drones.",
    positions: [
      { party: "PSD", stance: "for", votes: 86, present: 91 },
      { party: "PNL", stance: "for", votes: 50, present: 54 },
      { party: "USR", stance: "against", votes: 31, present: 34 },
      { party: "AUR", stance: "abstain", votes: 24, present: 31 }
    ]
  },
  {
    id: "cdep-2025-special-pensions",
    source_chamber: "cdep",
    source_vote_id: "sample-22331",
    voted_at: "2025-03-19",
    bill_number: "PL-x 92/2025",
    title: "Modificări privind regimul pensiilor speciale",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "PSD",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU modificările privind pensiile speciale.",
    prompt_en: "Guess which party voted IN FAVOR of the special pensions changes.",
    positions: [
      { party: "PSD", stance: "for", votes: 78, present: 89 },
      { party: "PNL", stance: "against", votes: 42, present: 52 },
      { party: "USR", stance: "against", votes: 28, present: 32 },
      { party: "AUR", stance: "abstain", votes: 18, present: 30 }
    ]
  },
  {
    id: "cdep-2025-education-funding",
    source_chamber: "cdep",
    source_vote_id: "sample-22402",
    voted_at: "2025-04-08",
    bill_number: "PL-x 118/2025",
    title: "Finanțarea programelor locale pentru reducerea abandonului școlar",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "AUR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar ÎMPOTRIVA finanțării programelor locale pentru reducerea abandonului școlar.",
    prompt_en: "Guess which party voted AGAINST funding local programs to reduce school dropout.",
    positions: [
      { party: "PSD", stance: "for", votes: 74, present: 88 },
      { party: "PNL", stance: "for", votes: 44, present: 50 },
      { party: "USR", stance: "for", votes: 27, present: 33 },
      { party: "AUR", stance: "against", votes: 25, present: 29 }
    ]
  },
  {
    id: "cdep-2025-judicial-digitalization",
    source_chamber: "cdep",
    source_vote_id: "sample-22441",
    voted_at: "2025-04-16",
    bill_number: "PL-x 141/2025",
    title: "Digitalizarea dosarelor din instanțe și accesul online la acte procedurale",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "PNL",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU digitalizarea dosarelor din instanțe.",
    prompt_en: "Guess which party voted IN FAVOR of digitizing court case files.",
    positions: [
      { party: "PNL", stance: "for", votes: 47, present: 51 },
      { party: "PSD", stance: "against", votes: 60, present: 84 },
      { party: "USR", stance: "abstain", votes: 20, present: 31 },
      { party: "AUR", stance: "against", votes: 23, present: 30 }
    ]
  },
  {
    id: "cdep-2025-energy-price-cap",
    source_chamber: "cdep",
    source_vote_id: "sample-22506",
    voted_at: "2025-05-07",
    bill_number: "PL-x 188/2025",
    title: "Prelungirea plafonării prețurilor la energie pentru consumatorii vulnerabili",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "USR",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU prelungirea plafonării prețurilor la energie.",
    prompt_en: "Guess which party voted IN FAVOR of extending the energy price cap.",
    positions: [
      { party: "USR", stance: "for", votes: 29, present: 33 },
      { party: "PSD", stance: "against", votes: 62, present: 90 },
      { party: "PNL", stance: "abstain", votes: 32, present: 50 },
      { party: "AUR", stance: "against", votes: 24, present: 29 }
    ]
  },
  {
    id: "cdep-2025-cash-payment-limits",
    source_chamber: "cdep",
    source_vote_id: "sample-22578",
    voted_at: "2025-05-28",
    bill_number: "PL-x 207/2025",
    title: "Limitarea plăților cash pentru tranzacții comerciale mari",
    source_url: "https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1",
    target_party: "AUR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar ÎMPOTRIVA limitării plăților cash pentru tranzacții mari.",
    prompt_en: "Guess which party voted AGAINST limiting cash payments for large transactions.",
    positions: [
      { party: "AUR", stance: "against", votes: 28, present: 31 },
      { party: "PSD", stance: "for", votes: 81, present: 92 },
      { party: "PNL", stance: "for", votes: 46, present: 53 },
      { party: "USR", stance: "abstain", votes: 21, present: 34 }
    ]
  },
  {
    id: "senate-2025-private-pensions",
    source_chamber: "senate",
    source_vote_id: "sample-sen-214",
    voted_at: "2025-09-29",
    bill_number: "L214/2025",
    title: "Reguli noi pentru plata pensiilor private",
    source_url: "https://www.senat.ro/voturiplen.aspx",
    target_party: "PSD",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU noile reguli privind plata pensiilor private.",
    prompt_en: "Guess which party voted IN FAVOR of the new private pension payment rules.",
    positions: [
      { party: "PSD", stance: "for", votes: 38, present: 43 },
      { party: "PNL", stance: "against", votes: 18, present: 25 },
      { party: "USR", stance: "against", votes: 13, present: 16 },
      { party: "AUR", stance: "abstain", votes: 11, present: 16 }
    ]
  },
  {
    id: "senate-2025-traffic-cameras",
    source_chamber: "senate",
    source_vote_id: "sample-sen-231",
    voted_at: "2025-10-07",
    bill_number: "L231/2025",
    title: "Extinderea folosirii camerelor automate pentru sancțiuni rutiere",
    source_url: "https://www.senat.ro/voturiplen.aspx",
    target_party: "PNL",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU extinderea camerelor automate pentru sancțiuni rutiere.",
    prompt_en: "Guess which party voted IN FAVOR of expanding automated traffic enforcement cameras.",
    positions: [
      { party: "PNL", stance: "for", votes: 21, present: 24 },
      { party: "PSD", stance: "against", votes: 30, present: 42 },
      { party: "USR", stance: "abstain", votes: 10, present: 15 },
      { party: "AUR", stance: "against", votes: 13, present: 16 }
    ]
  },
  {
    id: "senate-2025-forestry-tracking",
    source_chamber: "senate",
    source_vote_id: "sample-sen-244",
    voted_at: "2025-10-21",
    bill_number: "L244/2025",
    title: "Urmărirea digitală a transporturilor de lemn",
    source_url: "https://www.senat.ro/voturiplen.aspx",
    target_party: "USR",
    target_stance: "for",
    prompt_ro: "Ghici ce partid a votat majoritar PENTRU urmărirea digitală a transporturilor de lemn.",
    prompt_en: "Guess which party voted IN FAVOR of digital tracking for timber transports.",
    positions: [
      { party: "USR", stance: "for", votes: 14, present: 16 },
      { party: "PSD", stance: "against", votes: 31, present: 44 },
      { party: "PNL", stance: "abstain", votes: 15, present: 24 },
      { party: "AUR", stance: "against", votes: 12, present: 15 }
    ]
  },
  {
    id: "senate-2025-public-media-funding",
    source_chamber: "senate",
    source_vote_id: "sample-sen-259",
    voted_at: "2025-11-04",
    bill_number: "L259/2025",
    title: "Creșterea finanțării pentru serviciile publice de radio și televiziune",
    source_url: "https://www.senat.ro/voturiplen.aspx",
    target_party: "AUR",
    target_stance: "against",
    prompt_ro: "Ghici ce partid a votat majoritar ÎMPOTRIVA creșterii finanțării pentru radioul și televiziunea publică.",
    prompt_en: "Guess which party voted AGAINST increasing funding for public radio and television.",
    positions: [
      { party: "AUR", stance: "against", votes: 15, present: 17 },
      { party: "PSD", stance: "for", votes: 36, present: 42 },
      { party: "PNL", stance: "for", votes: 19, present: 24 },
      { party: "USR", stance: "abstain", votes: 9, present: 15 }
    ]
  }
];

export const MOCK_LEGISLATIVE_VOTES: LegislativeVote[] = REVIEWED_VOTE_SEEDS.map((vote) => ({
  id: vote.id,
  source_chamber: vote.source_chamber,
  source_vote_id: vote.source_vote_id,
  voted_at: vote.voted_at,
  bill_number: vote.bill_number,
  title: vote.title,
  vote_type: "vot final",
  source_url: vote.source_url,
  total_for: vote.positions.filter((position) => position.stance === "for").reduce((sum, position) => sum + position.votes, 0),
  total_against: vote.positions.filter((position) => position.stance === "against").reduce((sum, position) => sum + position.votes, 0),
  total_abstain: vote.positions.filter((position) => position.stance === "abstain").reduce((sum, position) => sum + position.votes, 0),
  total_present: vote.positions.reduce((sum, position) => sum + position.present, 0),
  created_at: NOW,
  updated_at: NOW
}));

export const MOCK_LEGISLATIVE_PARTY_POSITIONS: LegislativePartyPosition[] = REVIEWED_VOTE_SEEDS.flatMap((vote) => (
  vote.positions.map((position) => ({
    id: `${vote.id}:${position.party}`,
    vote_id: vote.id,
    party_key: position.party,
    party_label: position.label ?? position.party,
    stance: position.stance,
    vote_count: position.votes,
    party_present_count: position.present,
    majority_share: Number((position.votes / position.present).toFixed(4))
  }))
));

export const MOCK_LEGISLATIVE_QUESTIONS: LegislativeQuestion[] = REVIEWED_VOTE_SEEDS.map((vote) => ({
  id: `q-${vote.id}-${vote.target_party.toLowerCase()}-${vote.target_stance}`,
  vote_id: vote.id,
  target_party: vote.target_party,
  target_stance: vote.target_stance,
  prompt_ro: vote.prompt_ro,
  prompt_en: vote.prompt_en,
  active: true,
  review_status: "approved",
  interesting: true,
  created_at: NOW,
  updated_at: NOW
}));

export const MOCK_VOTE_GUESSES: VoteGuessRecord[] = [];
