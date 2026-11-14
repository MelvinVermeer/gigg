# Stack and dev

| Layer | Choice |
|---|---|
| Framework | **TanStack Start** (Vite, TanStack Router + Query, server functions), deployed on Vercel |
| Database | Postgres on **Neon** (Vercel marketplace); every table has `band_id` |
| Local dev / test DB | **PGlite** (Postgres in WASM, supports triggers + `pg_trgm`) |
| DB toolkit | **Drizzle** (custom SQL migrations for the audit trigger) |
| Auth | **Better Auth** (passkey + magic-link plugins) |
| Email | **SMTP** (one env var; any provider; `RESEND_API_KEY` as a shortcut) |
| Files | **Vercel Blob** |
| PWA / offline | Hand-written service worker, network-first cache of GETs |
| Search | Postgres `pg_trgm` |
| Stage-floor PDF | Print stylesheet |

Pinned exact versions (TanStack Start 1.0 is new).

Data model: see [../data-model.md](../data-model.md). Self-hosting: see the [README](../README.md).

## Dev

- `pnpm dev` runs on PGlite with seed data, no cloud accounts needed.
- Production DB easy to back up (`pg_dump` / Neon branching).
- Skills not in repo.
- Audit log references user IDs.
- CI migrates the production database on every push to `main`; Vercel deploys in parallel, so keep migrations additive.
