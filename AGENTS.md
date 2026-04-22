# Agent Context

Read these files before making changes:

1. `AGENTS.md`
2. `.specify/memory/constitution.md`
3. `docs/implementation-milestones.md`

## Project

- Portfolio-grade Customer Support / Ticketing SaaS
- Single-company workspace only in v1; no true multi-tenancy
- Monorepo target structure: `apps/web`, `apps/api`, `packages/*`
- Milestone-based implementation only; no one-shot full build

## Current Status

- Milestone 0 is complete and closed
- Milestone 1 has not started yet
- The next required step is focused spec extraction for M1:
  - `DB-01` identity schema
  - `BE-01` auth and RBAC
  - `FE-01` app shell and auth screens

## What M0 Already Delivered

- pnpm workspace monorepo foundation
- `apps/web` Next.js app-shell foundation
- `apps/api` NestJS platform foundation
- shared packages for config, types, UI, ESLint, and TypeScript
- Prisma initialized with datasource + generator only
- Swagger baseline
- env validation baseline
- Pino logging baseline
- testing framework setup only
- BullMQ scaffold only, not wired
- storage abstraction scaffold only, not implemented

## Non-Negotiable Guardrails

- Stay in a single-company workspace model
- Work one milestone at a time
- Extract focused specs before implementation
- Write tests alongside each milestone
- Do not build the whole SaaS in one pass
- Keep frontend/backend/database specs split when milestone planning requires it

## M1 Constraints

- M1 uses lean auth only
- Allowed scope: register, login, JWT access token, `/auth/me`, role-aware guards, role-aware shell
- M1 MUST NOT add refresh tokens
- M1 MUST NOT add `UserSession`
- M1 MUST NOT add password reset
- M1 MUST NOT add email verification

## Deferred Beyond M0

- all auth implementation
- ticket business logic
- conversation thread and attachments
- BullMQ jobs/processors and Redis queue wiring
- storage/S3 implementation
- realtime workflows
- SLA logic
- dashboards and admin business features

## Docker Policy

- Docker Compose remains part of the target architecture and final operational readiness
- Local Docker usage is postponed for now on this machine
- Early milestone progress may use non-Docker verification when the active milestone docs allow it
- Milestone-specific docs decide when infra-backed verification becomes required

## Working Rules For Future Agents

- Re-read the constitution and milestone plan before editing code
- Confirm the current milestone and what is explicitly deferred
- Preserve Milestone 0 scaffolding boundaries until later milestones activate them
- Update markdown when milestone status or policy changes
- If code and docs disagree, flag it before implementing
