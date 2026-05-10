# Guess The Party RO

A Romanian politics version of the minimal “guess the party from the portrait” game.

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

Official portraits should be reviewed before launch for reuse rights, quality, duplicates, and party-logo contamination.

## Checks

```bash
npm run test
npm run build
npm run test:e2e
```
