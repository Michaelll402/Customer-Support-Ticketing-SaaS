# Customer Support / Ticketing SaaS

Portfolio-grade Customer Support / Ticketing SaaS built as a pnpm monorepo with a Next.js frontend and NestJS backend. The project is intentionally delivered milestone by milestone so each phase remains demoable, reviewable, and production-minded.

## Overview

This repository is designed as a strong portfolio project rather than a toy CRUD app. The target product is a single-company support workspace where:

- customers create and track support requests, reply to staff, and attach files
- agents work the queue, reply publicly, capture internal notes, and attach files
- managers monitor operations
- admins configure the workspace

Current implementation status: **Milestone 4 is complete.**

Milestone 4 layers operational workflow on top of the M3 conversation slice: staff workflow REST endpoints (assign, status, priority, tags, category, team transfer) and matching read-only options endpoints, an in-app notification REST API, a BullMQ notification queue producer with idempotent job IDs, a Socket.IO realtime gateway with JWT-cookie handshake and per-user/per-ticket/per-staff rooms, a frontend workflow panel on ticket detail, a notification center with bell/dropdown and 30s polling fallback, and a frontend realtime client that turns server events into TanStack Query invalidations. SLA logic, dashboards, admin CRUD/configuration, audit log, email inbox sync, chatbot, and billing remain deferred.

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

The backend is a modular monolith. Milestone 0 established the repo foundation, Milestone 1 activated lean auth plus the app shell, Milestone 2 activated the ticket-core slice, Milestone 3 activated the conversation/notes/attachments slice, and Milestone 4 activated the operational slice: workflow REST actions, in-app notifications via a BullMQ queue, and a Socket.IO realtime gateway with a frontend invalidation client.

## Current Status

### Implemented now

- Monorepo foundation with `apps/web`, `apps/api`, and shared packages
- Prisma identity schema with `Role` and `User`
- Ticket-core schema with `Ticket`, `Team`, `TeamMember`, `Category`, `Tag`, `TicketTag`, and `TicketEvent`
- Conversation schema with `TicketMessage` (`isInternal` flag) and `Attachment` (with nullable `messageId`, `uploadedById`, `storedKey`, `mimeType`, `sizeBytes`)
- `TicketEventType` extended with `REPLIED`, `NOTE_ADDED`, `ATTACHMENT_ADDED`, and `TEAM_TRANSFERRED`
- `Notification` model and `NotificationType` enum (`TICKET_ASSIGNED`, `TICKET_REPLIED`, `STATUS_CHANGED`, `NOTE_ADDED`, `SLA_AT_RISK`, `SLA_BREACHED`)
- Seeded roles, demo users, teams, categories, tags, and demo tickets
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `POST /tickets`, `GET /tickets`, `GET /tickets/categories`, `GET /tickets/:id`, `PATCH /tickets/:id`
- `POST /tickets/:id/replies` (visible-ticket access, blocks closed tickets; enqueues `TICKET_REPLIED` notification)
- `POST /tickets/:id/internal-notes` (staff only; allowed on closed tickets; enqueues `NOTE_ADDED` notification to staff recipients only)
- `POST /tickets/:id/attachments` (multipart, 10 MB cap, MIME allowlist)
- `GET /tickets/:ticketId/attachments/:attachmentId/download-url` (short-lived signed URL; customer access blocked for internal-note attachments and unattached staff uploads)
- `GET /tickets/:id/timeline` (chronological merge of public replies, internal notes for staff, and system events; customers never receive internal notes, `NOTE_ADDED`, or `ATTACHMENT_ADDED` items)
- `PATCH /tickets/:id/assign` (staff workflow; enqueues `TICKET_ASSIGNED` notification)
- `PATCH /tickets/:id/status` (staff workflow with role-aware transition matrix; enqueues `STATUS_CHANGED` notification)
- `PATCH /tickets/:id/priority` (staff workflow)
- `PATCH /tickets/:id/tags` (full replacement)
- `PATCH /tickets/:id/category` (staff workflow)
- `PATCH /tickets/:id/team` (staff workflow; emits `TEAM_TRANSFERRED` ticket event)
- `GET /tickets/tags`, `GET /tickets/teams`, `GET /tickets/:id/assignable-users` (read-only workflow options for staff)
- `DELETE /tickets/:id`, `POST /tickets/:id/restore`, `GET /tickets/trash` (admin-only ticket trash: reversible soft delete + restore; trashed tickets are hidden from every role's list/detail/mutations and from the SLA scanner; trash/restore write `AuditLog` rows and emit `ticket.updated`; permanent hard delete is deferred — see `docs/ticket-trash-and-permanent-purge.md`)
- Agent reassignment approval workflow (`AssignmentRequest`): agents may only claim an unassigned same-team ticket for themselves; any other direct reassign/return is `403` and must go through a request. `POST /tickets/:id/assignment-requests` (agent; same-team REASSIGN_USER or RETURN_TO_QUEUE), `DELETE /tickets/:ticketId/assignment-requests/:requestId` (cancel own pending), `GET /tickets/:id/assignment-requests` (staff, scoped), `GET /assignment-requests` (manager/admin review queue), `PATCH /assignment-requests/:id/approve|reject` (manager/admin; transactional with state revalidation → 409 on stale state). The ticket stays assigned until approval; approval replaces the single assignee and emits a `REASSIGNED` event; AuditLog + staff notifications throughout; customers never see requests/reasons/notes/notifications. Cross-team requests deferred.
- Reports backend (read-only, manager/admin except `/reports/me`): `GET /reports/overview`, `GET /reports/queue`, `GET /reports/agent-metrics`, `GET /reports/assignment-requests` (MANAGER/ADMIN), and `GET /reports/me` (AGENT/MANAGER/ADMIN; CUSTOMER 403; uses the authenticated user, never a `userId` param). `windowDays` default 30 / min 1 / max 365 (UTC). ADMIN is global (non-trashed); MANAGER is scoped to their teams + globally-unassigned triage. SLA % = MET / (MET + BREACHED), null on zero denominator. No customer content, emails, request reasons, or review notes are exposed. The reports dashboard UI is deferred.
- Admin user management + audit read (admin-only): `GET/POST /admin/users`, `GET/PATCH /admin/users/:id`, `PATCH /admin/users/:id/role|status|teams`, `POST /admin/users/:id/revoke-sessions`, and `GET /admin/audit` (newest-first, filterable by actor/action/target/date). Role change, deactivation, and revoke-sessions bump `tokenVersion` (JWT revocation); deactivation flips `isActive`. The last active admin cannot be demoted or deactivated, and admins cannot deactivate themselves. Every mutation writes an `AuditLog`; responses never include `passwordHash`/`tokenVersion`. Admin UI lives at `/settings/users` and `/settings/audit`.
- `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- BullMQ notification queue producer (Redis-backed, skipped in test env, idempotent jobIds, REST never blocks on queue failures)
- Socket.IO realtime gateway with JWT-cookie handshake, `user:{id}` / `ticket:{id}` / `ticket:{id}:staff` rooms, and four server events (`notification.created`, `ticket.updated`, `ticket.message.created.public`, `ticket.message.created.internal`); customers never join staff rooms
- Password hashing with bcrypt
- JWT auth via a single `httpOnly` cookie
- `JwtAuthGuard`, `RolesGuard`, and `@Roles()`
- Swagger docs for auth, ticket, and notification routes
- Sign-in and sign-up flows in the frontend with `router.replace` post-auth
- Session hydration via `/auth/me` with narrow auth-query retry on transient failure
- Protected app routes
- Role-aware app shell and navigation
- Ticket list page with filters, sorting, pagination, and created-date display
- Customer ticket creation page with backend-sourced read-only category options
- Ticket detail page with metadata panel, combined conversation timeline, public reply composer, staff-only internal note composer, attachment upload with client-side validation, signed-URL download, and a staff-only workflow panel (status, priority, assignee, tags, category, team transfer)
- Notification center: bell with unread badge, dropdown list with mark-as-read and mark-all-read controls, 30s polling fallback, role-sensitive cache clearing on logout
- Frontend realtime client: singleton Socket.IO connection via a root-layout provider, per-ticket subscribe on detail mount, staff-only staff-room subscription, query invalidation only (no `setQueryData` write-through), neutral controller module that lets logout disconnect cleanly without a circular import
- Logout cancels and removes role-sensitive ticket/timeline/notification cache entries and disconnects the realtime socket to prevent cross-role flashes
- Backend auth, ticket, workflow, notification, queue, and realtime tests, including conversation/attachment privacy and customer-notification-filter regression coverage

### Intentionally deferred

- Refresh tokens
- `UserSession`
- Password reset
- Email verification
- SLA logic, deadlines, and breach detection (`SLA_AT_RISK` and `SLA_BREACHED` notification types exist in the schema but no SLA engine is wired)
- Real dashboard data and reporting
- Admin CRUD / workspace configuration features
- Audit log
- Email inbox sync, chatbot, billing
- Advanced workflow automation
- Attachment cleanup jobs

Milestone 4 is complete. Milestone 5 is in progress: the Slice 0 security hardening is complete and the Slice 1 DB-05 schema + audit foundation is implemented (migration created but not yet applied); the SLA engine, reports/dashboards, and admin CRUD remain pending.

## Roles

- **Customer**: sign up, sign in, create tickets, view own ticket list/detail, edit own subject/description, close or reopen own tickets, reply publicly on own non-closed tickets, attach files to their replies, download attachments linked to public replies on their tickets, receive in-app notifications for replies/assignment/status changes (never for internal notes), and see realtime updates on their own tickets
- **Agent**: sign in with a seeded account, view team-visible / assigned tickets, reply publicly, add internal notes (including on closed tickets), upload attachments, use the workflow panel to change status/priority/assignee/tags/category/team, see the full timeline (including internal notes and `NOTE_ADDED`/`ATTACHMENT_ADDED` events), download any attachment on a visible ticket, and receive in-app notifications and realtime updates for staff and customer activity on visible tickets
- **Manager**: sign in with a seeded account, view team-visible / directly assigned tickets, and use the same reply/note/attachment/workflow/notification/realtime surfaces as Agents within their team visibility
- **Admin**: sign in with a seeded account, view all current ticket-core surfaces and the full conversation/timeline/attachment/workflow/notification/realtime surfaces; admin CRUD remains deferred

Dashboards, SLA logic, and admin management workflows all come later.

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

Required for live M4 notification queue and realtime verification:

- Redis (used by BullMQ for notification job production)
- The API process running so the Socket.IO gateway can accept connections

Docker Compose is the recommended way to provide PostgreSQL, Redis, and MinIO locally. When Docker is not available on the active machine, equivalent local or cloud services are acceptable. Automated tests mock the storage layer, the BullMQ queue, and the Socket.IO server, so green CI proves business and privacy rules but does not by itself exercise live storage, live queue processing, or live WebSocket flow. REST workflow actions and the frontend continue to function without Redis; only the notification side-effect and realtime emit are skipped in that case.

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
It also seeds an idempotent demo organization: one manager who oversees three teams — Billing & Payments, Technical Support, and Account & Access — each staffed by three agents, all on the `@support.local` domain (distinct from the minimal `@demo.test` accounts). Every demo account uses the shared demo password defined in `prisma/seed.ts`; nothing prints credentials to logs.
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
- `GET /tickets/tags`
- `GET /tickets/teams`
- `GET /tickets/trash` (admin only)
- `GET /tickets/:id`
- `GET /tickets/:id/assignable-users`
- `PATCH /tickets/:id`
- `DELETE /tickets/:id` (admin only; move to trash)
- `POST /tickets/:id/restore` (admin only)
- `PATCH /tickets/:id/assign`
- `PATCH /tickets/:id/status`
- `PATCH /tickets/:id/priority`
- `PATCH /tickets/:id/tags`
- `PATCH /tickets/:id/category`
- `PATCH /tickets/:id/team`
- `POST /tickets/:id/replies`
- `POST /tickets/:id/internal-notes`
- `POST /tickets/:id/attachments`
- `GET /tickets/:ticketId/attachments/:attachmentId/download-url`
- `GET /tickets/:id/timeline`
- `POST /tickets/:id/assignment-requests` (agent only)
- `DELETE /tickets/:ticketId/assignment-requests/:requestId` (agent; cancel own)
- `GET /tickets/:id/assignment-requests` (staff; scoped)
- `GET /assignment-requests` (manager/admin review queue)
- `PATCH /assignment-requests/:id/approve` (manager/admin)
- `PATCH /assignment-requests/:id/reject` (manager/admin)
- `GET /reports/overview` (manager/admin)
- `GET /reports/queue` (manager/admin)
- `GET /reports/agent-metrics` (manager/admin)
- `GET /reports/me` (agent/manager/admin; customer 403)
- `GET /reports/assignment-requests` (manager/admin)
- `GET /admin/users`, `POST /admin/users` (admin)
- `GET /admin/users/:id`, `PATCH /admin/users/:id` (admin)
- `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status`, `PATCH /admin/users/:id/teams` (admin)
- `POST /admin/users/:id/revoke-sessions` (admin)
- `GET /admin/audit` (admin)
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

Realtime (Socket.IO, JWT-cookie handshake):

- `notification.created` (emitted to `user:{id}`)
- `ticket.updated` (emitted to `ticket:{id}`)
- `ticket.message.created.public` (emitted to `ticket:{id}`)
- `ticket.message.created.internal` (emitted to `ticket:{id}:staff`)

Behavior:

- access-token only
- token stored in a single `httpOnly` cookie
- no refresh-token flow
- no session table
- no password reset
- no email verification
- customer-only ticket creation
- customer-owned narrow ticket patch scope: subject edit, description edit, close, and reopen only
- staff workflow controls (assign, status, priority, tags, category, team) are role-gated and hidden from customers; status transitions enforce a role-aware transition matrix; tag updates use full replacement
- public replies blocked on closed tickets; internal notes remain allowed on closed tickets for staff
- internal notes restricted to AGENT/MANAGER/ADMIN
- attachments require a reachable S3-compatible service and the configured bucket
- signed download URLs are short-lived; customer access is denied for internal-note attachments and unattached staff uploads
- notifications are produced via a BullMQ queue with idempotent jobIds; REST workflow actions never block on queue or realtime failures
- customers never receive `NOTE_ADDED` notifications (server-side hard filter)
- realtime is additive: server emits `ticket.updated` and notification/message events; the frontend turns them into TanStack Query invalidations (no `setQueryData` write-through)
- SLA logic, dashboards, admin CRUD, audit log, email inbox sync, chatbot, and billing remain deferred

Frontend session state is derived from `/auth/me`, not from client-side token storage.

## Roadmap

- **M0**: Project foundation _(complete)_
- **M1**: Authentication, roles, and app shell _(complete)_
- **M2**: Ticket core _(complete)_
- **M3**: Conversation, internal notes, attachments _(complete)_
- **M4**: Workflow actions, notifications, realtime _(complete)_
- **M4.5**: Post-audit security/privacy/reliability hardening _(complete; no new product scope)_
- **M4.6**: Pre-M5 hardening — atomic status transitions, CSRF Origin guard, JWT revocation (`tokenVersion`/`isActive`) _(complete; mechanism only, no admin endpoints)_
- **M5**: SLA, dashboards, admin controls _(in progress — Slice 0 security hardening complete; Slice 1 DB-05 schema + audit foundation and Slice 2 SLA engine implemented (wall-clock SLA: due dates, first-response/resolution lifecycle, 60s BullMQ scan with at-risk/breach events, staff-only notifications + serialization); reports / admin CRUD / SLA UI pending)_
- **M6**: Testing hardening, polish, deployment _(not started)_

Next planned milestone after M4 completion: **M5 SLA, Dashboards & Admin Controls**.

## Project Guardrails

- Single-company workspace only in v1
- Milestone-based implementation only
- No one-shot full build
- Tests written alongside each milestone
- BullMQ is wired in M4 for the notification queue; storage is wired in M3 for attachments
- `.specify` and `AGENTS.md` are part of the durable project context
