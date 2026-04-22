# Customer Support / Ticketing SaaS

Portfolio-grade Customer Support / Ticketing SaaS built as a pnpm monorepo with a Next.js frontend and NestJS backend. The project is intentionally delivered milestone by milestone so each phase remains demoable, reviewable, and production-minded.

## Overview

This repository is designed as a strong portfolio project rather than a toy CRUD app. The target product is a single-company support workspace where:

- customers create and track support requests
- agents work the queue
- managers monitor operations
- admins configure the workspace

Current implementation status: **Milestone 1 is complete.**

Milestone 1 delivers lean authentication and the first real product shell. Ticket workflows, conversation threads, attachments, notifications, realtime behavior, SLA logic, dashboards, and admin CRUD are intentionally deferred.

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

The backend is a modular monolith. Milestone 0 established the repo foundation and scaffolds for later modules such as tickets, notifications, storage, queueing, SLA, and admin surfaces. Milestone 1 activates only the auth and app-shell slice.

## Current Status

### Implemented now

- Monorepo foundation with `apps/web`, `apps/api`, and shared packages
- Prisma identity schema with `Role` and `User`
- Seeded roles and local demo users
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- Password hashing with bcrypt
- JWT auth via a single `httpOnly` cookie
- `JwtAuthGuard`, `RolesGuard`, and `@Roles()`
- Swagger docs for the auth slice
- Sign-in and sign-up flows in the frontend
- Session hydration via `/auth/me`
- Protected app routes
- Role-aware app shell and navigation
- Backend auth tests

### Intentionally deferred

- Refresh tokens
- `UserSession`
- Password reset
- Email verification
- Ticket CRUD and workflows
- Attachments and storage integration
- BullMQ jobs/processors
- Notification center
- Realtime behavior
- SLA logic
- Real dashboard data
- Admin CRUD/configuration features

Milestone 2 is the ticket-core milestone and is **not implemented yet**.

## Roles

- **Customer**: sign up, sign in, access the authenticated shell, see `My Tickets` placeholder navigation
- **Agent**: sign in with seeded account, access `Ticket Queue` placeholder navigation
- **Manager**: sign in with seeded account, access `My Queue` plus `Dashboard` placeholder navigation
- **Admin**: sign in with seeded account, access all M1 shell destinations including `Settings` placeholder navigation

These role-specific routes are navigation and access-shell behavior only in Milestone 1. Business workflows for those areas come later.

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

Milestone 1 works with either:

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

The seed script creates the four Milestone 1 roles and local demo users.
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

## Current API / Auth Capabilities

Available now in Milestone 1:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Behavior:

- access-token only
- token stored in a single `httpOnly` cookie
- no refresh-token flow
- no session table
- no password reset
- no email verification

Frontend session state is derived from `/auth/me`, not from client-side token storage.

## Roadmap

- **M0**: Project foundation
- **M1**: Authentication, roles, and app shell
- **M2**: Ticket core
- **M3**: Conversation, internal notes, attachments
- **M4**: Workflow actions, notifications, realtime
- **M5**: SLA, dashboards, admin controls
- **M6**: Testing hardening, polish, deployment

Next milestone: **M2 Ticket Core**. Ticket workflows are deliberately not implemented in this repository state yet.

## Project Guardrails

- Single-company workspace only in v1
- Milestone-based implementation only
- No one-shot full build
- Tests written alongside each milestone
- BullMQ and storage remain scaffold-only until later milestones
- `.specify` and `AGENTS.md` are part of the durable project context
