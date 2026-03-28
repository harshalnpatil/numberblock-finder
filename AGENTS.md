# Agent Guidelines — Numberblock Finder

## Product docs

- **Changelog (completed work):** [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Backlog (upcoming work):** [`docs/product_backlog.md`](docs/product_backlog.md)

## Auto-generated files — DO NOT EDIT

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

## .env — Lovable connectivity only

The `.env` file in this repo is committed intentionally. It contains **only Lovable/Supabase publishable keys** (anon key, project URL) used for client-side connectivity — not general secrets. These keys are safe to commit because they are restricted by Row Level Security (RLS) policies on the Supabase side.

**Do NOT add private/secret keys** (service role keys, API secrets, etc.) to this `.env` file. Those belong in Supabase Edge Function secrets or server-side environment variables.

## UI Components

Use **shadcn/ui** components from `src/components/ui/`. Prefer these over custom components.
