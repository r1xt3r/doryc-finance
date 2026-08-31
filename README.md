# Doryc

Doryc is a private personal-finance dashboard built with Next.js, Supabase and Anime.js. It tracks accounts, cash flow, recurring payments, credit cards, bank loans and money between people.

## Local development

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev` and open `http://localhost:3000`.

## Quality checks

- `pnpm lint` — code quality.
- `pnpm test` — financial date and card-payment calculations.
- `pnpm build` — production compilation and type checking.

## Database

`supabase/schema.sql` is the canonical schema. It enables row-level security for every financial table and restricts each record to its authenticated owner. Incremental SQL files in `supabase/` document changes needed by an existing project.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) before deployment or database maintenance.
