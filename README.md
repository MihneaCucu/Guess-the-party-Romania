# Guess The Party RO

A Romanian Parliament version of the minimal “guess the party from the portrait” game.

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3007` without Supabase credentials by using an in-memory mock dataset. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` to use Supabase Postgres.

## Data

- `supabase/migrations/001_initial_schema.sql` defines the production tables.
- `data/seed-politicians.csv` is a reviewed local seed using official portrait URLs where available. The local seed currently includes Senate, Chamber of Deputies, and Government records that have non-empty portrait URLs.
- `data/manual-review.csv` is the review format for source, image, duplicate, and logo/background checks.
- `scripts/import-senate.ts`, `scripts/import-chamber.ts`, and `scripts/import-government.ts` are the import entrypoints.

Official portraits should be reviewed before launch for reuse rights, quality, duplicates, and party-logo contamination.

## Checks

```bash
npm run test
npm run build
npm run test:e2e
```
