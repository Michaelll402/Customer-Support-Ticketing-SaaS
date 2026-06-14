# Implementation Milestones

**Project**: Customer Support / Ticketing SaaS
**Version**: 1.1.0
**Created**: 2026-04-04
**Last Updated**: 2026-05-14
**Status**: Active

---

## Delivery Strategy

This project is built in **7 milestones** (M0–M6).

Every milestone must end with the project in a runnable, reviewable, and demoable state.
No milestone may leave major half-built features behind.

### Ground rules

- **pnpm workspaces** is the package manager throughout the monorepo.
- **Tests are written alongside each milestone**, not consolidated at the end.
  M6 adds E2E journeys and polish only.
- **Infra that isn't needed yet is stubbed**, not wired. BullMQ and S3 abstraction
  are scaffolded in M0 but not connected until the milestone that first uses them.
- **Docker Compose remains part of the target architecture and final operational
  readiness**, even if local Docker usage is postponed on a given machine.
- **Local non-Docker verification is acceptable in early milestones** only when the
  milestone-specific docs say it is sufficient for the current scope.
- **Milestone-specific docs decide when infra-backed verification becomes required**.
- **DB schema + backend + frontend are combined** inside each milestone. Each milestone
  owns its full slice from database to UI.
- **Spec extraction follows the milestone model**: before each milestone begins, a
  focused spec must be extracted from the master planning documents (see §Spec Streams).

## Current Status Snapshot

- **M0 is complete and closed.**
- **M1 is complete and closed.**
- **M2 is complete and closed.**
- **M3 is complete and closed.**
- **M4 is complete and closed.**
- **M4.5 post-audit hardening is applied** (no new product scope): malformed-cookie
  safety on the realtime handshake and REST JWT strategy, customer-facing privacy
  serialization (staff emails and internal workflow events withheld from
  customers), staff-only `GET /tickets/tags` and `GET /tickets/teams`, BullMQ
  Redis-failure resilience (error listeners + bounded job options), robust
  `MINIO_USE_SSL` boolean parsing, generic 500 responses, and frontend realtime
  resubscribe / cache-invalidation / attachment-download fixes.
- **M4.6 pre-M5 hardening is applied** (mechanism only, no admin endpoints):
  atomic guarded staff status transitions (409 on concurrent change), a
  dependency-free CSRF Origin/Referer guard on unsafe methods, and JWT
  revocation via `User.tokenVersion` + `User.isActive` (the JWT strategy
  re-validates against the database and returns the fresh role). Requires the
  `user_active_token_version` Prisma migration.
- **M5 is in progress.**
  - **M5 Slice 0 (pre-M5 security hardening) is complete and committed:** auth
    rate limiting on `/auth/login` and `/auth/register` (`@nestjs/throttler`),
    a signed `Content-Disposition: attachment` override on attachment download
    URLs, and a `GET /health/ready` readiness probe; Swagger is gated off in
    production.
  - **M5 Slice 1 (DB-05 schema + audit foundation) is implemented:** `SlaPlan`
    and `AuditLog` models; `SlaPlanAppliesTo` / `SlaTargetState` enums and
    `SLA_AT_RISK` / `SLA_BREACHED` `TicketEventType` values; Ticket SLA tracking
    columns (`firstRespondedAt`, `resolvedAt`, `slaPlanId`, `firstResponseState`,
    `resolutionState`) plus scanner indexes; `isActive` archival flags on Team,
    Category, and Tag; an `AuditService.record(...)` foundation (no controller,
    no endpoints, no interception); and a default "Standard" SLA plan in the
    seed. The additive `sla_audit_foundation_db05` migration is **created but
    not yet applied** to Neon, and existing tickets are **not** backfilled with
    SLA due dates.
  - **Remaining M5 slices are pending:** SLA engine, reports/dashboards, admin
    CRUD, and the admin/audit read surfaces.
- The database/backend M1 lean-auth slice is implemented:
  - `DB-01` - Identity schema for `Role` and `User`
  - `BE-01` - Auth endpoints, JWT cookie auth, role guards, seed roles/users, backend tests
- The frontend M1 auth/app-shell slice is implemented:
  - `FE-01` - Sign-in, sign-up, `/auth/me` hydration, protected routes, role-aware shell, logout
- M2 includes:
  - `DB-02` - Ticket core schema and demo seed data
  - `BE-02` - Ticket create/list/detail, read-only category options, narrow customer-owned patch
  - `FE-02` - Ticket list, ticket creation, metadata ticket detail
- M3 includes:
  - `DB-03` - `TicketMessage` (with `isInternal`) and `Attachment` (with nullable
    `messageId`, `uploadedById`, `storedKey`, `mimeType`, `sizeBytes`), plus
    `TicketEventType` values `REPLIED`, `NOTE_ADDED`, `ATTACHMENT_ADDED`
  - `BE-03` - `POST /tickets/:id/replies`, `POST /tickets/:id/internal-notes`,
    `POST /tickets/:id/attachments`,
    `GET /tickets/:ticketId/attachments/:attachmentId/download-url`, and
    `GET /tickets/:id/timeline`; customer-side filtering enforced at the query
    layer; attachment linking restricted to the uploading actor; metadata
    failures wrap raw errors in a generic 500 and best-effort delete the object
  - `FE-03` - Combined timeline, public reply composer, staff-only internal note
    composer, attachment upload with client-side validation, on-demand signed-URL
    download, composer state reset on ticketId/kind changes, logout cache
    clearing for role-sensitive ticket queries
- M4 includes:
  - `DB-04` - `Notification` model, `NotificationType` enum
    (`TICKET_ASSIGNED`, `TICKET_REPLIED`, `STATUS_CHANGED`, `NOTE_ADDED`,
    `SLA_AT_RISK`, `SLA_BREACHED`), and `TEAM_TRANSFERRED` added to
    `TicketEventType`
  - `BE-04 Slice A` - Workflow REST endpoints
    (`PATCH /tickets/:id/assign`, `PATCH /tickets/:id/status`,
    `PATCH /tickets/:id/priority`, `PATCH /tickets/:id/tags` with full
    replacement, `PATCH /tickets/:id/category`, `PATCH /tickets/:id/team`),
    role-aware status transition matrix, and `GET /tickets/tags` plus
    `GET /tickets/:id/assignable-users` read-only options
  - `BE-04 tiny team options endpoint` - `GET /tickets/teams` read-only
    options endpoint added before FE work to close the team-listing contract
    gap
  - `BE-04 Slice B` - Notification REST API
    (`GET /notifications` with pagination + `unreadOnly` filter,
    `PATCH /notifications/:id/read` idempotent mark-read,
    `PATCH /notifications/read-all`)
  - `BE-04 Slice C` - BullMQ notification queue production: Redis-backed
    `notifications` queue with `notifications.create` job name, idempotent
    jobIds derived from event UUIDs, queue skipped in `NODE_ENV=test`,
    `NotificationsProcessor` writes notification rows via
    `createForRecipients` and emits one `notification.created` realtime
    event per recipient; REST workflow actions never block on queue
    failures
  - `BE-04 Slice D` - Socket.IO realtime gateway with JWT-cookie handshake,
    `user:{id}` / `ticket:{id}` / `ticket:{id}:staff` room model,
    four server events (`notification.created`, `ticket.updated`,
    `ticket.message.created.public`, `ticket.message.created.internal`),
    visibility checks on subscribe acks, customers refused from staff
    rooms, and `RealtimeService` `safeEmit` wrappers so emit failures
    never bubble into the REST request cycle
  - `FE-04 Slice A` - Ticket workflow controls on the detail page:
    status, priority, assignee, category, tag (staged Set with diff-aware
    Apply), and team transfer with a two-step confirm; role-gated and
    hidden from customers
  - `FE-04 Slice B` - Notification center: bell with unread badge,
    dropdown list, mark-as-read on click with fire-and-forget mutation,
    mark-all-read, 30s polling fallback, role-sensitive cache clearing
    widened to include notifications on logout
  - `FE-04 Slice C` - Frontend realtime client: singleton
    `socket.io-client` connection via a root-layout `RealtimeProvider`,
    per-ticket subscribe on detail mount, staff-only staff-room
    subscription via `useTicketRealtimeSubscription`, query invalidation
    only (no `setQueryData` write-through), neutral
    `lib/realtime-controller.ts` module that lets `useLogout.onMutate`
    disconnect the socket before clearing role-sensitive caches without a
    circular import
- M0 delivered the monorepo foundation, `apps/web`, `apps/api`, shared packages,
  Prisma initialization, Swagger, env validation, Pino logging, and testing setup.
- **BullMQ is wired in M4** for the `notifications` queue. Jobs are produced from
  REST workflow handlers and consumed by `NotificationsProcessor`, which writes
  `Notification` rows and emits per-recipient realtime events. Queue
  registration is skipped in `NODE_ENV=test`, and REST workflow actions never
  block on queue or realtime failures.
- **Storage abstraction is wired in M3.** Attachment upload and signed-URL
  download flow through a hand-rolled SigV4 client against the configured
  S3-compatible endpoint (MinIO by default).
- **Docker is postponed locally for now** on the current machine, but the repo must stay
  Docker-ready for later milestones and final validation. From M3 forward, live
  attachment verification requires a reachable S3-compatible service (MinIO or
  equivalent) and a pre-created `attachments` bucket. From M4 forward, live
  notification queue and realtime verification requires a reachable Redis
  instance.
- **Verification posture**: automated tests mock the Prisma client,
  `StorageService`, the BullMQ queue, and the Socket.IO server where needed,
  so passing CI proves business and privacy rules but does not by itself
  exercise live storage, live queue processing, or live WebSocket flow. Live
  end-to-end verification of M3 requires MinIO; live end-to-end verification of
  M4 requires Redis. Docker Compose is the recommended way to provide both
  locally, but equivalent local or cloud services are acceptable when Docker is
  not available on the active machine.
- Until a milestone-specific spec says otherwise, **local non-Docker verification is
  acceptable in early milestones**.

### Milestone overview

| #   | Name                                   | Demo outcome                                         |
| --- | -------------------------------------- | ---------------------------------------------------- |
| M0  | Project Foundation                     | Both apps boot; Docker-ready local foundation exists |
| M1  | Authentication, Roles & App Shell      | Sign up, sign in, role-aware shell                   |
| M2  | Ticket Core                            | Create, view, list, filter tickets                   |
| M3  | Conversation, Notes & Attachments      | Full support thread with files                       |
| M4  | Workflow, Notifications & Realtime     | Agents work tickets; live updates                    |
| M5  | SLA, Dashboards & Admin                | Managers monitor; admins configure                   |
| M6  | Testing Hardening, Polish & Deployment | Deployed, tested, recruiter-ready                    |

---

## Milestone 0 — Project Foundation

### Goal

Prepare the codebase, architecture, tooling, and local environment so every later milestone
can move fast and generate consistent code.

### Why this comes first

Skipping foundation work forces messy decisions mid-sprint: duplicated types, bad folder
boundaries, broken CI, unclear environment setup, and AI tools generating inconsistent code.

### Scope

#### Repository & monorepo

- Initialise pnpm workspace monorepo at repo root
- Create `apps/web` (Next.js)
- Create `apps/api` (NestJS)
- Create shared packages:
  - `packages/types` — shared TypeScript types and enums
  - `packages/config` — shared env/config helpers
  - `packages/ui` — shadcn/ui component re-exports and base components
  - `packages/eslint-config` — shared ESLint config
  - `packages/tsconfig` — shared TypeScript base configs
- Define import boundaries and internal package naming rules
- Configure `pnpm-workspace.yaml`

#### Frontend foundation (`apps/web`)

- Initialise Next.js (App Router, TypeScript)
- Install and configure Tailwind CSS
- Install and configure shadcn/ui
- Set up TanStack Query provider
- Set up React Hook Form + Zod baseline
- Define app layout shell (root layout, font, metadata)
- Define route group structure:
  - `(auth)` — unauthenticated pages
  - `(app)` — protected pages
- Placeholder pages for major modules (no content yet)

#### Backend foundation (`apps/api`)

- Initialise NestJS app (TypeScript strict)
- Configure module barrel structure
- Install and configure Prisma (connected to Postgres)
- Install and configure Swagger/OpenAPI
- Configure `@nestjs/config` with env validation (Zod or Joi)
- Set up Pino structured logging (`nestjs-pino`)
- Set up global validation pipe (`class-validator`, `class-transformer`)
- Set up global exception filter with structured error responses
- Scaffold empty module stubs: `auth`, `users`, `tickets`, `notifications`,
  `attachments`, `sla`, `audit`, `admin`
- **BullMQ**: add `@nestjs/bull` dependency; scaffold `QueueModule` stub only.
  No queues are wired yet. Full setup lands in M4.

#### Database & infra foundation

- Docker Compose with services:
  - `postgres` — PostgreSQL 16
  - `redis` — Redis 7 (present in compose; not wired to app code until M4)
  - `minio` — S3-compatible local storage (present in compose;
    storage abstraction stubbed but not wired until M3)
- Prisma initial schema file (empty models, just datasource + generator)
- `prisma migrate dev` workflow confirmed
- `prisma db seed` workflow confirmed (empty seed script)
- `.env.example` with all expected environment variables documented

#### Engineering quality

- ESLint (shared config from `packages/eslint-config`)
- Prettier
- Shared TypeScript configs (strict base in `packages/tsconfig`)
- Husky + lint-staged for pre-commit hooks
- GitHub Actions baseline CI:
  - `pnpm install`
  - type-check all packages
  - lint all packages
  - build both apps
- Vitest configured in `apps/api`
- Playwright configured in `apps/web`

### Testing scope for M0

- Smoke test: both apps build successfully in CI
- Local non-Docker verification is acceptable in M0 when Docker is unavailable on the
  active machine, provided the milestone's foundation acceptance criteria can still be
  exercised meaningfully.
- No business logic tests yet — there is no business logic

### Deliverable

At the end of M0:

- Docker Compose definition exists for Postgres, Redis, and MinIO, and remains ready
  for later infra-backed validation
- If Docker is available on the active machine, `docker compose up` starts Postgres,
  Redis, and MinIO without errors
- `pnpm install` resolves cleanly
- `pnpm run dev` starts both `apps/web` and `apps/api`
- `apps/web` renders the placeholder layout in a browser
- `apps/api` serves Swagger UI at `/api`
- `prisma migrate dev` runs without errors
- `prisma db seed` runs without errors
- GitHub Actions CI passes on the `main` branch

### Exit criteria

- [ ] Docker Compose definition exists and matches the target architecture
- [ ] If Docker is available on the active machine, `docker compose up` works end-to-end
- [ ] Both apps boot successfully in development mode
- [ ] Shared packages compile without errors
- [ ] Swagger UI loads
- [ ] Migration + seed commands work
- [ ] CI green

---

## Milestone 1 — Authentication, Roles & App Shell

### Goal

Establish identity, access control, and the first real product UI structure.

### Why this matters

Everything that follows depends on knowing who the user is, what role they have,
and what routes and actions they can access. This milestone must be stable before
any feature work touches protected resources.

### Auth scope decision

M1 implements **lean auth**: register, login, JWT access token, and role-based guards.

Deferred to polish phase (M6 or later): refresh token rotation, email verification,
password reset flow. Schema contains only what is needed now.

M1 MUST NOT add refresh tokens, a `UserSession` table, password reset, or email
verification.

### Database models added

```
User
  id            UUID PK
  email         String UNIQUE
  passwordHash  String
  roleId        UUID FK → Role
  firstName     String
  lastName      String
  createdAt     DateTime
  updatedAt     DateTime

Role
  id    UUID PK
  name  Enum (CUSTOMER | AGENT | MANAGER | ADMIN)
```

No session, `UserSession`, password reset, or email verification tables in M1.

### Backend scope

- `POST /auth/register` — create user, hash password, return access token
- `POST /auth/login` — validate credentials, return access token
- `GET /auth/me` — return current user from JWT
- `POST /auth/logout` — clear the access token cookie
- JWT strategy (`@nestjs/passport`, `passport-jwt`)
- Bcrypt password hashing
- `JwtAuthGuard` — protects routes
- `RolesGuard` + `@Roles()` decorator — enforces role access
- Seed script: create default roles and demo accounts:
  - `customer@demo.test` / `Password1!`
  - `agent@demo.test` / `Password1!`
  - `manager@demo.test` / `Password1!`
  - `admin@demo.test` / `Password1!`
- Swagger documents all auth routes with request/response schemas

### Frontend scope

- Sign-in page (`/sign-in`)
- Sign-up page (`/sign-up`)
- JWT storage via a single `httpOnly` access-token cookie
- `useCurrentUser` hook backed by `GET /auth/me`
- Route protection: unauthenticated users redirected to `/sign-in`
- Role-aware navigation sidebar:
  - Customer: My Tickets
  - Agent: Ticket Queue
  - Manager: My Queue + Dashboard link
  - Admin: All sections + Settings link
- Top bar with user name, role badge, and logout action
- Logout clears token and redirects to `/sign-in`
- Route placeholder pages for: tickets, dashboard, settings, profile
- Profile placeholder screen (static, no edit yet)

### Testing scope for M1

- Unit: password hashing, JWT payload validation
- Integration: register endpoint, login endpoint, `GET /auth/me` with valid/invalid token
- Integration: role guard rejects requests missing the required role
- No E2E yet

### Deliverable

At the end of M1:

- Users can sign up and sign in
- Session persists across page refreshes
- Role-aware sidebar renders correctly for each role
- Unauthenticated users cannot access protected routes
- Demo seed accounts work
- The app looks and feels like product software, not a tutorial project

### Exit criteria

- [ ] Register, login, and `/me` endpoints work and are documented in Swagger
- [ ] Unauthenticated access to protected routes returns 401
- [ ] Customer-role user cannot hit admin-only endpoints (403)
- [ ] Seeded demo accounts log in successfully
- [ ] Frontend route protection redirects correctly
- [ ] Role-aware sidebar shows correct nav items per role
- [ ] Integration tests for auth pass in CI

---

## Milestone 2 — Ticket Core

### Goal

Build the central business entity of the product: tickets.

### Why here

Auth is stable. We now have users with roles. The natural next step is to connect
those users to the core domain object and build the main business workflow.

### Database models added

```
Ticket
  id             UUID PK
  number         Int UNIQUE AUTO_INCREMENT (human-readable ID)
  subject        String
  description    String
  status         Enum (OPEN | PENDING | RESOLVED | CLOSED)
  priority       Enum (LOW | MEDIUM | HIGH | URGENT)
  requesterId    UUID FK → User
  assigneeId     UUID FK → User (nullable)
  teamId         UUID FK → Team (nullable)
  categoryId     UUID FK → Category (nullable)
  firstResponseDueAt DateTime (nullable, populated by SLA engine in M5)
  resolutionDueAt    DateTime (nullable, populated by SLA engine in M5)
  createdAt      DateTime
  updatedAt      DateTime

Team
  id          UUID PK
  name        String
  description String (nullable)
  createdAt   DateTime

TeamMember
  id        UUID PK
  userId    UUID FK → User
  teamId    UUID FK → Team
  createdAt DateTime

Category
  id          UUID PK
  name        String
  description String (nullable)
  color       String (nullable)
  createdAt   DateTime

Tag
  id    UUID PK
  name  String UNIQUE
  color String (nullable)

TicketTag
  ticketId UUID FK → Ticket
  tagId    UUID FK → Tag
  PK (ticketId, tagId)

TicketEvent
  id         UUID PK
  ticketId   UUID FK → Ticket
  actorId    UUID FK → User (nullable for system events)
  type       Enum (CREATED | STATUS_CHANGED | PRIORITY_CHANGED |
                   ASSIGNED | REASSIGNED | TAGGED | CATEGORIZED |
                   CLOSED_BY_CUSTOMER | REOPENED_BY_CUSTOMER)
  metadata   Json (nullable — captures old/new values)
  createdAt  DateTime
```

> **Reporting readiness**: `TicketEvent` captures the full lifecycle history.
> SLA deadline fields exist on `Ticket` from day one even though the SLA engine
> is not wired until M5. Timestamps are preserved on every model.

### Backend scope

- `POST /tickets` — customer creates a ticket
- `GET /tickets` — paginated, sortable, filterable list
  - Filter by: `status`, `priority`, `assigneeId`, `teamId`, `categoryId`
  - Sort by: `createdAt`, `updatedAt`, `priority`, `number`
  - Pagination: `page` + `limit` or cursor-based
- `GET /tickets/categories` — read-only category options for authenticated ticket-create flows
- `GET /tickets/:id` — full ticket detail
- `PATCH /tickets/:id` — narrow customer-owned patch scope only
  - subject edit
  - description edit
  - customer close
  - customer reopen

**Explicitly deferred from M2**:

- agent-on-behalf-of-customer creation
- assignment / reassignment
- priority change workflow controls
- team transfer workflow controls
- category/tag workflow controls

**Visibility rules**:

- Customer: only their own tickets (`requesterId = currentUser.id`)
- Agent: tickets assigned to them or to their team
- Manager: all tickets across their team
- Admin: all tickets

**Event emission**: every mutation emits a `TicketEvent` row. Status changes,
priority changes, assignments, and categorization are all auditable from day one.

Seed: add 3–5 realistic demo tickets across different statuses and priorities.

### Frontend scope

- Ticket creation page (`/tickets/new`):
  - subject, description, category selector, priority selector
  - category selector uses backend-sourced read-only category options
  - uncategorized submission remains allowed
  - Zod schema validation, loading state on submit
- Ticket list page (`/tickets`):
  - table with columns: number, subject, status badge, priority badge,
    assignee, created date
  - status and priority filter controls
  - sort by created date
  - pagination
- Ticket detail page (`/tickets/:id`):
  - header: subject, number, status badge, priority badge
  - metadata panel: requester, assignee, team, category, tags, dates
  - clearly labeled conversation placeholder only
  - no reply UI, internal notes UI, attachments UI, or workflow controls until M3+
- Status and priority badges use clear color coding

### Testing scope for M2

- Unit: visibility rule logic (can user X see ticket Y?)
- Integration: `POST /tickets` with valid/invalid payloads
- Integration: `GET /tickets/categories` returns read-only categories for authenticated users
- Integration: `GET /tickets` respects role-based visibility
- Integration: `PATCH /tickets/:id` status change emits a `TicketEvent` row
- Integration: customer cannot view another customer's ticket (403)

### Deliverable

At the end of M2:

- Customers can create tickets
- Customers can edit subject/description on their own tickets
- Customers can close and reopen their own tickets
- Agents and managers see their relevant ticket lists
- Ticket detail page renders correctly
- Ticket creation has a real read-only category source
- Role visibility is enforced end-to-end
- Ticket events are recorded for every mutation

### Exit criteria

- [ ] Ticket creation works for customer role only
- [ ] List filtering, sorting, and pagination work
- [ ] Read-only category options load for ticket creation
- [ ] Role visibility rules enforced on list and detail endpoints
- [ ] Narrow customer-owned patch scope works for subject/description edit and close/reopen
- [ ] `TicketEvent` rows exist after every state mutation that should emit them in M2
- [ ] Swagger documents all ticket endpoints
- [ ] Integration tests pass in CI

---

## Milestone 3 — Conversation Thread, Internal Notes & Attachments

### Goal

Turn tickets from static records into active support conversations with
public replies, private agent collaboration, and file attachments.

### Why this is a separate milestone

This is a major behavior and infrastructure expansion:

- Public conversation visible to customers
- Internal notes never visible to customers (security non-negotiable)
- File upload pipeline (S3 integration, validation, access control)
- Richer event timeline

Scoping this separately keeps M2 clean and gives this complex slice focused attention.

### Database models added

```
TicketMessage
  id         UUID PK
  ticketId   UUID FK → Ticket
  authorId   UUID FK → User
  body       String
  isInternal Boolean  ← true = internal note, false = public reply
  createdAt  DateTime
  updatedAt  DateTime

Attachment
  id            UUID PK
  ticketId      UUID FK → Ticket (nullable)
  messageId     UUID FK → TicketMessage (nullable)
  uploaderId    UUID FK → User
  filename      String (original filename)
  storedKey     String (object storage key, not exposed to frontend directly)
  mimeType      String
  sizeBytes     Int
  createdAt     DateTime
```

> `isInternal` is the enforcement gate for the security rule: customers must never
> see rows where `isInternal = true`. This is enforced at the query layer, not just
> in the presentation layer.

### Backend scope

**S3 / object storage — fully wired in this milestone**:

- Connect MinIO/S3 client (stub from M0 is now implemented)
- `StorageService` — `upload(key, buffer, mimeType)`, `getSignedUrl(key)`, `delete(key)`
- Enforce: file size limit (e.g., 10 MB), file type allowlist (images, PDFs, text)
- Attachment keys are never exposed directly; access is always via short-lived signed URLs

**Message endpoints**:

- `POST /tickets/:id/replies` — add public reply (customer, agent, manager, admin)
- `POST /tickets/:id/internal-notes` — add internal note (agent, manager, admin only)
- `GET /tickets/:id/timeline` — return the combined timeline (messages plus system events) for a ticket
  - Customers receive only public replies (`isInternal = false`) and never receive `NOTE_ADDED` or `ATTACHMENT_ADDED` system events
  - Agents/managers/admins receive all messages and all system events

**Attachment endpoints**:

- `POST /tickets/:id/attachments` — upload file (multipart); stored in S3
- `GET /tickets/:ticketId/attachments/:attachmentId/download-url` — returns a short-lived signed URL for authorized access
  - User must have visibility of the parent ticket to download
  - Customer access is denied for internal-note attachments and unattached staff uploads

**Event emission**: `TicketEvent` rows added for `REPLIED`, `NOTE_ADDED`, `ATTACHMENT_ADDED`.

### Frontend scope

- Ticket detail page gets a live conversation panel:
  - Timeline of public replies, internal notes (for staff), and system events
  - Public replies styled differently from internal notes
  - Internal notes have a visible "Internal" badge; staff only
  - System events (status change, assignment) rendered as timeline entries
- Reply composer at bottom of thread:
  - Rich textarea
  - Toggle: "Public Reply" / "Internal Note" (hidden from customer UI entirely)
  - Attach file button
  - Submit with loading + disabled state
- Attachment upload:
  - File picker with size/type validation in frontend before upload
  - Upload progress indicator
  - Attached files rendered as downloadable links in the message they belong to

### Testing scope for M3

- Unit/integration: `isInternal` filtering — customer timeline never returns
  internal notes or `NOTE_ADDED`/`ATTACHMENT_ADDED` system events
- Unit/integration: file type and size validation on the upload path
- Integration: `POST /tickets/:id/internal-notes` returns 403 for customer role
- Integration: `GET /tickets/:id/timeline` for customer omits internal notes
- Integration: attachment upload stores metadata, writes an `ATTACHMENT_ADDED`
  event, and returns safe metadata only
- Integration: signed download URL is denied for customers requesting an
  internal-note attachment, an unattached staff upload, or a cross-ticket
  attachment, and is allowed for customers requesting a public-message
  attachment and for staff requesting any visible attachment
- Integration: attachment linking on reply/internal note rejects attachments
  uploaded by a different user
- Integration: metadata-persistence failure best-effort deletes the uploaded
  object and surfaces a generic 500 instead of a raw Prisma/internal message
- Verification posture: the M3 integration suite uses a mocked Prisma client
  and a mocked `StorageService`, so it exercises business and privacy rules
  but does not by itself verify the real Prisma queries or the live SigV4
  signed-URL behavior. Live attachment verification against MinIO (or any
  S3-compatible service) plus a pre-created `attachments` bucket remains a
  local runtime requirement before the M3 demo is considered fully exercised.

### Deliverable

At the end of M3:

- Tickets function as full support threads
- Internal agent collaboration is invisible to customers
- Files can be attached and downloaded securely
- Event timeline renders a meaningful history

### Exit criteria

- [ ] Public replies visible to customer and staff
- [ ] Internal notes return 403 for customer role
- [ ] `GET /tickets/:id/messages` omits `isInternal = true` rows for customers
- [ ] File upload enforces size limit and type allowlist
- [ ] Attachment download requires visibility of parent ticket
- [ ] Event timeline shows replies, notes, and system events
- [ ] Integration tests pass in CI

---

## Milestone 4 — Workflow Actions, Notifications & Realtime

### Goal

Make the system operationally useful for agents and teams: ticket ownership, state
transitions, and live updates so the queue feels alive.

### Why here

Tickets and threads are working. The next gap is workflow ownership:

- Who is responsible for this ticket?
- What changed and when?
- Did anything happen while I was looking at another ticket?

### Database models added

```
Notification
  id         UUID PK
  userId     UUID FK → User (recipient)
  ticketId   UUID FK → Ticket (nullable)
  type       Enum (TICKET_ASSIGNED | TICKET_REPLIED | STATUS_CHANGED |
                   NOTE_ADDED | SLA_AT_RISK | SLA_BREACHED)
  message    String
  isRead     Boolean DEFAULT false
  createdAt  DateTime
```

> Additional `TicketEvent` types may be added as workflow actions are implemented.

### Backend scope

**BullMQ — fully wired in this milestone**:

- Connect BullMQ to Redis (stubbed in M0, now wired)
- `NotificationQueue` — background job that creates `Notification` rows
  and emits WebSocket events without blocking the request cycle

**Workflow action endpoints**:

- `PATCH /tickets/:id/assign` — assign or reassign ticket to a user
- `PATCH /tickets/:id/status` — change status with role validation
- `PATCH /tickets/:id/priority` — change priority (agent, manager, admin)
- `PATCH /tickets/:id/tags` — add or remove tags
- `PATCH /tickets/:id/category` — change category
- `PATCH /tickets/:id/team` — transfer to another team

All workflow actions emit `TicketEvent` rows and enqueue notification jobs.

**Notification endpoints**:

- `GET /notifications` — list notifications for current user (paginated)
- `PATCH /notifications/:id/read` — mark as read
- `PATCH /notifications/read-all` — mark all as read

**WebSocket gateway**:

- Authenticated connection (JWT validated on handshake)
- Client joins a room per user (`user:{id}`) and per ticket (`ticket:{id}`)
- Events emitted:
  - `ticket.created`
  - `ticket.updated` (status, priority, assignment, category, tag changes)
  - `ticket.message.created`
  - `notification.created`

**Realtime is additive**: all workflows succeed without a live socket connection.
The WebSocket only improves UX.

### Frontend scope

- Assignment panel on ticket detail: searchable assignee selector, team selector
- Status change control (dropdown or button group, role-gated)
- Priority change control (role-gated)
- Tag and category selectors on ticket detail
- Notification center in top bar:
  - Bell icon with unread count badge
  - Dropdown showing recent notifications
  - Mark as read on click
- Realtime behavior:
  - Ticket detail auto-updates when the backend emits `ticket.updated`
  - New replies appear in the thread without manual refresh
  - Notification count badge increments when `notification.created` arrives

### Testing scope for M4

- Unit: notification queue job creates correct `Notification` rows
- Unit: WebSocket room membership logic
- Integration: assignment endpoint creates `TicketEvent` and enqueues notification
- Integration: status change enforces role restrictions
- Integration: unauthenticated WebSocket connection is rejected

### Deliverable

At the end of M4:

- Agents can assign, reassign, change status and priority, tag and categorize tickets
- Notifications appear in-app for relevant events
- WebSocket events keep ticket detail fresh without polling
- Queue views feel like real operational software

### Exit criteria

- [ ] All workflow action endpoints work and emit `TicketEvent` rows
- [ ] Notifications are created for assignment and reply events
- [ ] WebSocket events fire on ticket mutation
- [ ] No customer-visible leakage of internal workflow data
- [ ] BullMQ jobs process without errors
- [ ] Integration tests pass in CI

---

## Milestone 5 — SLA Engine, Dashboards & Admin Controls

### Goal

Add management visibility and operational maturity: SLA deadlines, dashboard metrics,
and admin configuration surfaces.

### Why this is later

SLA and reporting depend on correct, stable ticket lifecycle data. We only build this
after ticket operations are proven correct in M2–M4.

### Database models added

```
SLAPlan
  id                  UUID PK
  name                String
  firstResponseHours  Float
  resolutionHours     Float
  appliesTo           Enum (ALL | PRIORITY_HIGH | PRIORITY_URGENT | CATEGORY)
  categoryId          UUID FK → Category (nullable)
  isActive            Boolean
  createdAt           DateTime

AuditLog
  id         UUID PK
  actorId    UUID FK → User
  action     String  (e.g., "admin.user.role_changed")
  targetType String  (e.g., "User", "Team", "SLAPlan")
  targetId   UUID
  metadata   Json (before/after values where relevant)
  createdAt  DateTime
```

> `Ticket.firstResponseDueAt` and `resolutionDueAt` fields (added in M2 schema)
> are now populated by the SLA engine.

### Backend scope

**SLA engine**:

- `SlaService.computeDeadlines(ticket)` — calculates first response and resolution due dates
  based on the matching `SLAPlan`
- Triggered on `ticket.created`
- Background job re-evaluates at-risk and breached status on a schedule (BullMQ cron)
- At-risk threshold: configurable (default: 80% of window elapsed)
- When a ticket breaches SLA: emit `notification.created` to assignee and manager

**Report endpoints**:

- `GET /reports/overview` — open/pending/resolved/closed counts, SLA breach rate
- `GET /reports/agent-metrics` — per-agent: ticket count, avg first response time,
  avg resolution time, SLA compliance rate
- `GET /reports/queue` — current queue depth by status, priority, and team

**Admin endpoints**:

- Users: `GET /admin/users`, `PATCH /admin/users/:id/role`
- Teams: full CRUD
- Categories: full CRUD
- Tags: full CRUD
- Priorities: manage active set
- Statuses: manage active set and transitions
- SLA plans: full CRUD

All admin actions write to `AuditLog`.

### Frontend scope

**Manager dashboard** (`/dashboard`):

- Overview cards: open, pending, resolved, at-risk SLA, breached SLA counts
- Agent workload table: tickets per agent, SLA compliance
- Queue snapshot by priority and team
- Refresh on WebSocket `ticket.updated` events

**Ticket detail SLA panel**:

- First response due and resolution due timestamps
- At-risk badge (amber) / Breached badge (red) when applicable

**Admin settings** (`/settings`):

- `/settings/users` — user list, role change control
- `/settings/teams` — team management
- `/settings/categories` — category management
- `/settings/tags` — tag management
- `/settings/sla` — SLA plan list, create/edit modal

### Testing scope for M5

- Unit: `SlaService.computeDeadlines` with various plan configurations
- Unit: at-risk and breach detection logic
- Integration: SLA deadlines populated on ticket creation
- Integration: `GET /reports/overview` returns correct counts
- Integration: admin role change writes to `AuditLog`
- Integration: non-admin cannot access `/admin/*` routes (403)

### Deliverable

At the end of M5:

- Managers can monitor ticket volume, SLA risk, and agent workload
- Admins can configure users, teams, categories, and SLA rules
- The app looks and behaves like real B2B support software
- Audit trail covers all sensitive admin actions

### Exit criteria

- [ ] SLA deadlines computed and stored on ticket creation
- [ ] At-risk and breached SLA states visible in ticket detail and dashboard
- [ ] Dashboard overview metrics are accurate
- [ ] Admin configuration persists correctly
- [ ] All admin mutations write `AuditLog` rows
- [ ] Integration tests pass in CI

---

## Milestone 6 — Testing Hardening, Portfolio Polish & Deployment

### Goal

Make the project stable, well-tested, visually polished, and recruiter-ready.
Deploy to a live URL.

### Deployment target

- **Frontend**: Vercel (Next.js)
- **Backend API**: Railway (NestJS)
- **PostgreSQL**: Railway managed Postgres
- **Redis**: Railway managed Redis
- **File storage**: MinIO on Railway or Cloudflare R2

### Scope

#### Testing hardening

**Unit tests**:

- Auth service (password hashing, JWT generation/validation)
- Ticket visibility rules
- `SlaService.computeDeadlines`
- `isInternal` filter on message queries

**Integration tests**:

- Full auth flow (register → login → protected route)
- Ticket lifecycle: create → reply → status change → SLA deadline
- Assignment creates `TicketEvent` and `Notification`
- Internal note is invisible to customer
- Admin role change writes `AuditLog`

**E2E tests (Playwright)**:

- Customer creates a ticket and receives a reply
- Agent assigns, replies, and resolves a ticket
- Manager checks dashboard metrics
- Admin changes a user role

#### Demo data polish

- Seeded demo accounts (4 roles, realistic names)
- 20+ realistic demo tickets across statuses and priorities
- Thread replies on several tickets showing real conversations
- SLA data that creates at-risk and breached examples in the dashboard
- Realistic team, category, and tag structure

#### UX & visual polish

- Loading skeletons on all list and detail pages
- Empty state illustrations/messages on ticket list, notification center
- Error boundary pages (404, 500, access denied)
- Responsive layout cleanup (desktop-first, basic mobile usability)
- Consistent spacing, typography, and color use across all pages
- Toast notifications for workflow actions (success/error feedback)

#### Documentation

- `README.md`:
  - Project overview and feature list
  - Architecture diagram (simple block diagram)
  - Local setup instructions
  - Demo account credentials
  - Screenshots of key screens
  - Tech stack list with versions
  - Deployment notes
- `docs/architecture.md` — module map and data flow
- `.env.example` reviewed and complete
- Swagger UI reviewed and clean

#### Deployment

- Environment variables configured in Vercel and Railway
- Database migrations run in Railway on deploy
- Seed script runs once in hosted environment
- Health check endpoint (`GET /health`) returns 200
- Both frontend and backend URLs confirmed working
- CORS configured for production URLs

### Testing scope for M6

This milestone finalises test coverage rather than adding new feature tests.
No new features are added in M6.

### Deliverable

At the end of M6:

- The app is live on public URLs
- Demo data is realistic and interesting
- All major user journeys have E2E test coverage
- README communicates the project clearly to a recruiter or interviewer
- The GitHub repository looks like a serious engineering project

### Exit criteria

- [ ] Vercel deployment serves frontend at production URL
- [ ] Railway deployment serves API at production URL
- [ ] `GET /health` returns 200 in production
- [ ] All E2E tests pass against the deployed environment
- [ ] Seeded demo data present and visible in dashboard
- [ ] README has screenshots, setup instructions, and architecture notes
- [ ] No placeholder text, dummy routes, or broken pages in demo flow

---

## Spec Stream Breakdown

When specs are extracted before each milestone, they follow these identifiers.
Each spec must be extracted and refined before implementation begins.

### Database specs

| ID    | Milestone | Scope                                                  |
| ----- | --------- | ------------------------------------------------------ |
| DB-01 | M1        | Identity schema — User, Role                           |
| DB-02 | M2        | Ticket core — Ticket, Team, Category, Tag, TicketEvent |
| DB-03 | M3        | Conversation — TicketMessage, Attachment               |
| DB-04 | M4        | Notifications — Notification, TicketEvent expansions   |
| DB-05 | M5        | SLA & audit — SLAPlan, AuditLog                        |

### Backend specs

| ID    | Milestone | Scope                                                  |
| ----- | --------- | ------------------------------------------------------ |
| BE-01 | M1        | Auth & RBAC — register, login, JWT guards, role guards |
| BE-02 | M2        | Ticket management API — CRUD, visibility, events       |
| BE-03 | M3        | Thread, notes & attachments API — messages, S3         |
| BE-04 | M4        | Workflow actions, notifications, WebSocket gateway     |
| BE-05 | M5        | SLA engine, report endpoints, admin endpoints          |

### Frontend specs

| ID    | Milestone | Scope                                               |
| ----- | --------- | --------------------------------------------------- |
| FE-01 | M1        | App shell, auth screens, role-aware navigation      |
| FE-02 | M2        | Ticket list, detail, and creation pages             |
| FE-03 | M3        | Conversation thread, notes, attachments UI          |
| FE-04 | M4        | Workflow controls, notification center, realtime UX |
| FE-05 | M5        | Manager dashboard, SLA panels, admin settings       |

---

## Implementation Order by Track

These sequences apply when work within a milestone is parallelized or sequenced.

### Backend-first order within any milestone

1. Database schema + migration
2. Prisma models and types
3. Service layer
4. Controller and DTOs
5. Guards and permission checks
6. Swagger documentation
7. Tests

### Frontend-first order within any milestone

1. Page and route scaffolding
2. API hook / TanStack Query integration
3. Form schema (Zod)
4. UI components
5. Loading, empty, and error states
6. Validation and feedback

### Cross-track dependency rule

Frontend work for a milestone **must not begin** until the backend endpoints for that
milestone are deployed to the local development environment and returning correct responses.
This prevents frontend developers from building against imaginary contracts.

---

## Definition of Done

A milestone is complete when **all of the following are true**:

- All scoped features are implemented
- Role-based access is enforced on every endpoint
- Input validation exists on all write paths
- Error cases are handled and return meaningful responses
- Tests for the milestone scope pass in CI
- Swagger reflects current API state
- The project remains demoable end-to-end

---

_This document is the primary milestone reference. Task breakdowns for each milestone
are extracted into separate spec files before implementation begins (see §Spec Stream Breakdown)._
