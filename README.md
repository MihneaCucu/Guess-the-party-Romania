# Guess The Party RO

A Romanian politics version of the minimal “guess the party from the portrait” game.

Live app: https://guess-the-party-romania.vercel.app

## Current Scope

The game uses active, reviewed public figures with usable portrait photos. The current local production seed contains 499 playable records:

- Senate: 122
- Chamber of Deputies: 331
- Government: 13
- Romanian members of the European Parliament: 33

The main game supports category filters for `All`, `Senate`, `Chamber`, `Government`, and `MEPs`. Party answer buttons are scoped to the selected category, so EP-only affiliations such as `PMP`, `PUSL`, `PAC`, `PNCR`, and `D&F` only appear when they can be a correct answer.

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3007` without Supabase credentials by using an in-memory mock dataset. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` to use Supabase Postgres.

## Data

- `supabase/migrations/001_initial_schema.sql` defines the production tables.
- `data/seed-politicians.csv` is a reviewed local seed. The local seed currently includes Senate, Chamber of Deputies, Government, and Romanian European Parliament records with cached local portraits.
- `data/manual-review.csv` is the review format for source, image, duplicate, and logo/background checks.
- `scripts/import-senate.ts`, `scripts/import-chamber.ts`, `scripts/import-government.ts`, and `scripts/import-meps.ts` are the import entrypoints.
- `scripts/cache-photos.ts` downloads approved portraits once, creates optimized 640px portraits and 96px thumbnails, and rewrites the seed/mock data to use local `/photos/...` URLs.

## Photos

Gameplay does not fetch photos from official sites at runtime. Portraits are cached into:

- `public/photos/portraits`: main 640px portraits
- `public/photos/thumbs`: 96px thumbnails for recent guesses and stats lists

The deployed Vercel app serves these as static files with long cache headers, which avoids slow or inconsistent loading from `senat.ro`, `cdep.ro`, `gov.ro`, or `europarl.europa.eu`.

## Affiliations

Official group or national party names are normalized in `lib/parties.ts` into game party keys. Current supported keys include:

`PSD`, `PNL`, `USR`, `AUR`, `UDMR`, `SOS`, `POT`, `PACE`, `PMP`, `PUSL`, `PAC`, `PNCR`, `DREPTATE_FRATIE`, `MINORITATI`, and `NEAFILIATI`.

Display labels are localized where needed, for example `MINORITATI` becomes `Minorities` in English and `Minorități` in Romanian. New or unmapped affiliations receive a deterministic fallback color and label, but should be reviewed before launch.

Official portraits should be reviewed before launch for reuse rights, quality, duplicates, and party-logo contamination.

## Checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Deployment

Production is deployed on Vercel from the GitHub `main` branch. Pushing to `main` triggers a new deployment for https://guess-the-party-romania.vercel.app.
