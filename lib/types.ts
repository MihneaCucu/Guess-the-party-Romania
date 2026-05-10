export type PartyKey = string;

export type PartyOption = {
  key: PartyKey;
  label: string;
  color: string;
  textColor?: string;
};

export type ReviewStatus = "approved" | "needs_review" | "rejected";

export type PoliticianChamber = "Camera Deputatilor" | "Senat" | "Guvern" | "Parlamentul European";
export type PoliticianScope = "all" | PoliticianChamber;

export type Politician = {
  id: string;
  name: string;
  slug: string;
  party_key: PartyKey;
  party_label: string;
  chamber: PoliticianChamber;
  constituency: string;
  photo_url: string;
  source_url: string;
  active: boolean;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

export type PublicPolitician = Omit<Politician, "party_key" | "party_label" | "active" | "review_status" | "created_at" | "updated_at">;

export type GuessRecord = {
  id: string;
  session_id: string;
  politician_id: string;
  actual_party: PartyKey;
  guessed_party: PartyKey;
  correct: boolean;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  started_at: string;
  last_seen_at: string;
  guess_count: number;
  best_streak: number;
};

export type GuessResult = {
  correct: boolean;
  politician: Politician;
};

export type RandomPoliticianResult = {
  politician: PublicPolitician;
  parties: PartyOption[];
  totalLoaded: number;
  remainingInCycle: number;
  scope: PoliticianScope;
};

export type PartyAccuracy = {
  party: PartyKey;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type ConfusionRow = {
  actualParty: PartyKey;
  label: string;
  guesses: Record<PartyKey, number>;
};

export type PoliticianDifficulty = {
  politicianId: string;
  name: string;
  party: PartyKey;
  partyLabel: string;
  photoUrl: string;
  attempts: number;
  correct: number;
  accuracy: number;
  topWrongParty?: PartyKey;
  topWrongCount?: number;
};

export type StatsSummary = {
  totalGuesses: number;
  totalSessions: number;
  averagePerSession: number;
  longestSession: number;
  partyAccuracy: PartyAccuracy[];
  confusionMatrix: ConfusionRow[];
  members: PoliticianDifficulty[];
  easiest: Record<PartyKey, PoliticianDifficulty[]>;
  hardest: Record<PartyKey, PoliticianDifficulty[]>;
  mostMistakenAs: Record<PartyKey, PoliticianDifficulty[]>;
};
