# Enot Tea

Enot Tea is an e-commerce monorepo for a tea storefront and owner-operated order workflow. The implemented backend lives in `apps/api` and exposes catalog, order, inventory, health, OpenAPI, and generated API-client contracts.

## Local Setup

Requirements:
- Node.js `24.15.0` (`.nvmrc`)
- `pnpm` `10.33.0`
- Docker Desktop for local PostgreSQL

Common local flow:

```bash
pnpm install
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
pnpm --filter @enot-tea/api db:migrate
pnpm start:back:dev
```

Runbooks and architecture docs:
- Local development: `docs/runbooks/local-dev.md`
- Release process: `docs/runbooks/release-process.md`
- Project overview: `docs/project-overview.md`
- API client/OpenAPI workflow: `docs/architecture/openapi-and-api-client.md`

## Verification

Main release gate from the repository root:

```bash
pnpm ci:verify
```

This runs API typecheck/tests/build, Prisma schema validation, OpenAPI export, Orval client generation, and `@enot-tea/api-client` typecheck.