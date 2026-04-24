# Customer Support / Ticketing SaaS

Portfolio-grade Customer Support / Ticketing SaaS built as a pnpm monorepo with a Next.js frontend and NestJS backend. The project is intentionally delivered milestone by milestone so each phase remains demoable, reviewable, and production-minded.

## Overview

This repository is designed as a strong portfolio project rather than a toy CRUD app. The target product is a single-company support workspace where:

- customers create and track support requests
- agents work the queue
- managers monitor operations
- admins configure the workspace

Current implementation status: **Milestone 2 is complete.**

Milestone 2 delivers the ticket-core slice on top of lean auth: ticket schema + seed data, live ticket list/new/detail flows, a metadata-only detail page, and the narrow customer-owned ticket patch scope. Conversation threads, attachments, notifications, realtime behavior, SLA logic, dashboards, and admin CRUD remain deferred.

## Product Positioning

- Single-company workspace in v1
- Portfolio-grade B2B SaaS architecture
- Milestone-based delivery only
- Security-first auth and RBAC baseline
- Backend/frontend/database work kept modular for later spec extraction

## Tech Stack

**Frontend**

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

**Backend**

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT auth with `httpOnly` access-token cookie
- Swagger / OpenAPI
- Pino logging

**Infra / Tooling**

- pnpm workspaces
- Redis and MinIO stubs via Docker Compose
- Vitest
- Playwright
- ESLint
- Prettier
- Husky
- GitHub Actions

## Architecture Summary

- `apps/web`: Next.js frontend
- `apps/api`: NestJS API
- `packages/config`: shared env/config helpers
- `packages/types`: shared TypeScript types
- `packages/ui`: shared UI scaffolding/primitives
- `packages/eslint-config`: shared lint config
- `packages/tsconfig`: shared TS config

The backend is a modular monolith. Milestone 0 established the repo foundation, Milestone 1 activated lean auth plus the app shell, and Milestone 2 activates the ticket-core slice without starting conversation or workflow-control milestones.

## Current Status

### Implemented now

- Monorepo foundation with `apps/web`, `apps/api`, and shared packages
- Prisma identity schema with `Role` and `User`
- Ticket-core schema with `Ticket`, `Team`, `TeamMember`, `Category`, `Tag`, `TicketTag`, and `TicketEvent`
- Seeded roles and local demo users
- Seeded teams, categories, tags, and demo tickets
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /tickets`
- `GET /tickets`
- `GET /tickets/categories`
- `GET /tickets/:id`
- narrow customer-owned `PATCH /tickets/:id`
- Password hashing with bcrypt
- JWT auth via a single `httpOnly` cookie
- `JwtAuthGuard`, `RolesGuard`, and `@Roles()`
- Swagger docs for auth and ticket routes
- Sign-in and sign-up flows in the frontend
- Session hydration via `/auth/me`
- Protected app routes
- Role-aware app shell and navigation
- Ticket list page with filters, sorting, pagination, and created-date display
- Customer ticket creation page with backend-sourced read-only category options
- Metadata-only ticket detail page with clean 403/404/error states
- Backend auth and ticket tests

### Intentionally deferred

- Refresh tokens
- `UserSession`
- Password reset
- Email verification
- Public replies / internal notes
- Attachments and storage integration
- Assignment, priority, category, tag, and team workflow controls
- BullMQ jobs/processors
- Notification center
- Realtime behavior
- SLA logic
- Real dashboard data
- Admin CRUD/configuration features

Milestone 2 is complete. Milestone 3 has not started yet.

## Roles

- **Customer**: sign up, sign in, create tickets, view own ticket list/detail, edit own subject/description, and close or reopen own tickets
- **Agent**: sign in with seeded account and view team-visible / assigned ticket list and metadata-only detail
- **Manager**: sign in with seeded account and view team-visible / directly assigned ticket list and metadata-only detail
- **Admin**: sign in with seeded account and view all current ticket-core surfaces plus existing shell destinations

Assignment controls, conversation threads, internal notes, attachments, notifications, realtime updates, dashboards, and admin management workflows all come later.

## Repository Structure

```text
.
|-- apps/
|   |-- api/        # NestJS API + Prisma schema/migrations/seed
|   `-- web/        # Next.js frontend
|-- packages/
|   |-- config/
|   |-- eslint-config/
|   |-- tsconfig/
|   |-- types/
|   `-- ui/
|-- docs/
|-- .specify/
|-- AGENTS.md
`-- docker-compose.yml
```

## Local Development

### Requirements

- Node.js 20+
- `corepack` enabled
- pnpm 10 via `corepack`
- PostgreSQL database

Optional for later milestones/final validation:

- Docker Desktop / Docker Compose
- Redis
- MinIO

### Environment setup

Copy the tracked template and provide local values:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
```

Notes:

- Root `.env` and `apps/api/.env` are local-only and must remain ignored.
- `.env.example` is the committed template.
- `WEB_APP_ORIGIN` must match the frontend origin used in the browser.
- `NEXT_PUBLIC_API_BASE_URL` should point to the local API, usually `http://localhost:4000`.

### Database note

Milestone 2 works with either:

- local Postgres
- a hosted Postgres instance such as Neon

Set `DATABASE_URL` accordingly. Docker Compose remains part of the target architecture, but local Docker usage can be postponed in early milestones if the milestone docs allow it.

### Install

```powershell
corepack pnpm install
```

### Prisma

```powershell
corepack pnpm prisma:generate
corepack pnpm prisma:migrate
corepack pnpm prisma:seed
```

The seed script creates the four auth roles plus demo users, teams, categories, tags, and demo tickets.
Those demo accounts are intended for local/dev verification only.

### Run the apps

Start both apps:

```powershell
corepack pnpm dev
```

Or run them separately:

```powershell
corepack pnpm dev:api
corepack pnpm dev:web
```

Expected local URLs:

- Frontend: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Swagger: `http://localhost:4000/api`

### Quality checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm check
```

## Current API Capabilities

Available now:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /tickets`
- `GET /tickets`
- `GET /tickets/categories`
- `GET /tickets/:id`
- `PATCH /tickets/:id`

Behavior:

- access-token only
- token stored in a single `httpOnly` cookie
- no refresh-token flow
- no session table
- no password reset
- no email verification
- customer-only ticket creation in M2
- customer-owned narrow ticket patch scope in M2: subject edit, description edit, close, and reopen only
- no assignment, team transfer, priority/category/tag workflow controls in M2
- no conversation replies, notes, or attachments in M2

Frontend session state is derived from `/auth/me`, not from client-side token storage.

## Roadmap

- **M0**: Project foundation
- **M1**: Authentication, roles, and app shell
- **M2**: Ticket core
- **M3**: Conversation, internal notes, attachments
- **M4**: Workflow actions, notifications, realtime
- **M5**: SLA, dashboards, admin controls
- **M6**: Testing hardening, polish, deployment

Next planned milestone after M2 completion: **M3 Conversation, Internal Notes & Attachments**.

## Project Guardrails

- Single-company workspace only in v1
- Milestone-based implementation only
- No one-shot full build
- Tests written alongside each milestone
- BullMQ and storage remain scaffold-only until later milestones
- `.specify` and `AGENTS.md` are part of the durable project context
