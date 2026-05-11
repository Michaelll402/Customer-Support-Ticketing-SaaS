# Customer Support / Ticketing SaaS

Portfolio-grade Customer Support / Ticketing SaaS built as a pnpm monorepo with a Next.js frontend and NestJS backend. The project is intentionally delivered milestone by milestone so each phase remains demoable, reviewable, and production-minded.

## Overview

This repository is designed as a strong portfolio project rather than a toy CRUD app. The target product is a single-company support workspace where:

- customers create and track support requests, reply to staff, and attach files
- agents work the queue, reply publicly, capture internal notes, and attach files
- managers monitor operations
- admins configure the workspace

Current implementation status: **Milestone 3 is complete.**

Milestone 3 delivers the conversation slice on top of the M2 ticket core: `TicketMessage` and `Attachment` schemas, public replies, staff-only internal notes, multipart attachment uploads to S3-compatible storage, short-lived signed download URLs, a combined ticket timeline, and the frontend composers and attachment UI for all four roles. Notifications, realtime behavior, SLA logic, dashboards, broad workflow controls, and admin CRUD remain deferred.

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
- Redis (Docker Compose; BullMQ remains scaffolded)
- MinIO (Docker Compose; wired for M3 attachment uploads/downloads)
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

The backend is a modular monolith. Milestone 0 established the repo foundation, Milestone 1 activated lean auth plus the app shell, Milestone 2 activated the ticket-core slice, and Milestone 3 activates the conversation/notes/attachments slice without starting workflow-control milestones.

## Current Status

### Implemented now

- Monorepo foundation with `apps/web`, `apps/api`, and shared packages
- Prisma identity schema with `Role` and `User`
- Ticket-core schema with `Ticket`, `Team`, `TeamMember`, `Category`, `Tag`, `TicketTag`, and `TicketEvent`
- Conversation schema with `TicketMessage` (`isInternal` flag) and `Attachment` (with nullable `messageId`, `uploadedById`, `storedKey`, `mimeType`, `sizeBytes`)
- `TicketEventType` extended with `REPLIED`, `NOTE_ADDED`, `ATTACHMENT_ADDED`
- Seeded roles, demo users, teams, categories, tags, and demo tickets
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `POST /tickets`, `GET /tickets`, `GET /tickets/categories`, `GET /tickets/:id`, `PATCH /tickets/:id`
- `POST /tickets/:id/replies` (visible-ticket access, blocks closed tickets)
- `POST /tickets/:id/internal-notes` (staff only; allowed on closed tickets)
- `POST /tickets/:id/attachments` (multipart, 10 MB cap, MIME allowlist)
- `GET /tickets/:ticketId/attachments/:attachmentId/download-url` (short-lived signed URL; customer access blocked for internal-note attachments and unattached staff uploads)
- `GET /tickets/:id/timeline` (chronological merge of public replies, internal notes for staff, and system events; customers never receive internal notes, `NOTE_ADDED`, or `ATTACHMENT_ADDED` items)
- Password hashing with bcrypt
- JWT auth via a single `httpOnly` cookie
- `JwtAuthGuard`, `RolesGuard`, and `@Roles()`
- Swagger docs for auth and ticket routes
- Sign-in and sign-up flows in the frontend with `router.replace` post-auth
- Session hydration via `/auth/me` with narrow auth-query retry on transient failure
- Protected app routes
- Role-aware app shell and navigation
- Ticket list page with filters, sorting, pagination, and created-date display
- Customer ticket creation page with backend-sourced read-only category options
- Ticket detail page with metadata panel, combined conversation timeline, public reply composer, staff-only internal note composer, attachment upload with client-side validation, and signed-URL download
- Logout cancels and removes role-sensitive ticket/timeline/attachment cache entries to prevent cross-role flashes
- Backend auth and ticket tests, including conversation/attachment privacy regression coverage

### Intentionally deferred

- Refresh tokens
- `UserSession`
- Password reset
- Email verification
- Assignment, priority, category, tag, and team workflow controls
- BullMQ jobs/processors
- Notification center
- Realtime behavior / WebSocket gateway
- SLA logic, deadlines, and breach detection
- Real dashboard data
- Admin CRUD/configuration features
- Email inbox sync, chatbot, billing

Milestone 3 is complete. Milestone 4 has not started yet.

## Roles

- **Customer**: sign up, sign in, create tickets, view own ticket list/detail, edit own subject/description, close or reopen own tickets, reply publicly on own non-closed tickets, attach files to their replies, and download attachments linked to public replies on their tickets
- **Agent**: sign in with a seeded account, view team-visible / assigned tickets, reply publicly, add internal notes (including on closed tickets), upload attachments, see the full timeline (including internal notes and `NOTE_ADDED`/`ATTACHMENT_ADDED` events), and download any attachment on a visible ticket
- **Manager**: sign in with a seeded account, view team-visible / directly assigned tickets, and use the same reply/note/attachment surfaces as Agents within their team visibility
- **Admin**: sign in with a seeded account, view all current ticket-core surfaces and the full conversation/timeline/attachment surfaces; admin CRUD remains deferred

Assignment controls, priority/category/tag workflow controls, notifications, realtime updates, dashboards, and admin management workflows all come later.

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

Required for live M3 attachment verification:

- Docker Desktop / Docker Compose (or a manually run equivalent)
- MinIO (or any S3-compatible service)
- A pre-created `attachments` bucket on the MinIO endpoint

Optional for later milestones:

- Redis (used in M4+ for BullMQ jobs)

### Environment setup

Copy the tracked template and provide local values:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
Copy-Item .env.example apps/web/.env
```

Notes:

- Root `.env`, `apps/api/.env`, and `apps/web/.env` are local-only and must remain ignored.
- `.env.example` is the committed template.
- Next.js does not auto-load env from the monorepo root, so the web app needs its own `apps/web/.env` (or `apps/web/.env.local`) to receive `NEXT_PUBLIC_*` values reliably. Only the `NEXT_PUBLIC_*` lines are read on the frontend.
- `WEB_APP_ORIGIN` must match the frontend origin used in the browser. The API's CORS automatically accepts both `localhost` and `127.0.0.1` variants of the configured origin when one of those two hostnames is used, so opening the web app at either origin works in development.
- `NEXT_PUBLIC_API_BASE_URL` should point to the local API, usually `http://localhost:4000`.
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, and `MINIO_USE_SSL` must point at a reachable S3-compatible service for M3 attachment runtime verification.

### Database note

Milestone 3 works with either:

- local Postgres
- a hosted Postgres instance such as Neon

Set `DATABASE_URL` accordingly. Docker Compose is the recommended way to start Postgres, Redis, and MinIO locally; non-Docker setups can still work as long as Postgres is reachable and an S3-compatible store is available for attachment uploads.

### Storage note for M3

Attachment upload and signed-URL download require a reachable S3-compatible service and an existing bucket. The bundled `docker-compose.yml` starts MinIO with the default `MINIO_*` values from `.env.example`; the `attachments` bucket is not auto-created and must be created once via the MinIO console (`http://localhost:9001`) or `mc mb local/attachments` before exercising the upload path. The automated integration suite uses a mocked Prisma client and mocked `StorageService`, so green CI proves business and privacy rules but does not exercise the real storage path end-to-end. Live MinIO verification remains a local runtime step.

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
- `POST /tickets/:id/replies`
- `POST /tickets/:id/internal-notes`
- `POST /tickets/:id/attachments`
- `GET /tickets/:ticketId/attachments/:attachmentId/download-url`
- `GET /tickets/:id/timeline`

Behavior:

- access-token only
- token stored in a single `httpOnly` cookie
- no refresh-token flow
- no session table
- no password reset
- no email verification
- customer-only ticket creation
- customer-owned narrow ticket patch scope: subject edit, description edit, close, and reopen only
- public replies blocked on closed tickets; internal notes remain allowed on closed tickets for staff
- internal notes restricted to AGENT/MANAGER/ADMIN
- attachments require a reachable S3-compatible service and the configured bucket
- signed download URLs are short-lived; customer access is denied for internal-note attachments and unattached staff uploads
- no assignment, team transfer, priority/category/tag workflow controls
- no notifications, realtime, BullMQ jobs, SLA logic, dashboards, or admin CRUD

Frontend session state is derived from `/auth/me`, not from client-side token storage.

## Roadmap

- **M0**: Project foundation
- **M1**: Authentication, roles, and app shell
- **M2**: Ticket core
- **M3**: Conversation, internal notes, attachments
- **M4**: Workflow actions, notifications, realtime
- **M5**: SLA, dashboards, admin controls
- **M6**: Testing hardening, polish, deployment

Next planned milestone after M3 completion: **M4 Workflow Actions, Notifications & Realtime**.

## Project Guardrails

- Single-company workspace only in v1
- Milestone-based implementation only
- No one-shot full build
- Tests written alongside each milestone
- BullMQ remains scaffold-only until M4; storage is wired for M3 attachments
- `.specify` and `AGENTS.md` are part of the durable project context
