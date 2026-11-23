# Contributing

Issues and pull requests are welcome. For anything bigger than a fix, open an issue first so we can agree on the approach.

1. `pnpm install && pnpm dev`: local mode needs no accounts or database (see the README).
2. Make the change on a branch, with a test: Vitest for server logic, Playwright for flows.
3. `pnpm typecheck && pnpm test && pnpm test:e2e` before opening the PR; CI runs the same.

Rules the checks enforce:

- **UI text** goes in `src/lib/i18n.en.ts` and `src/lib/i18n.nl.ts`, never inline.
- **Schema changes**: `pnpm db:generate` and commit the migration. Keep migrations additive: production migrates while the old code still runs.
- **No instance specifics** in code: gigg.band is just one instance (see `docs/principles.md`).

How features work is described in `docs/`.
