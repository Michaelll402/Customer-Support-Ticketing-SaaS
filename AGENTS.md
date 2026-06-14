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
- Milestone 1 is complete and closed
- Milestone 2 is complete and closed
- Milestone 3 is complete and closed
- Milestone 4 is complete and closed
- Milestone 4.5 (post-audit hardening) is applied: realtime/REST malformed-cookie
  safety, customer-facing privacy serialization (staff emails and internal
  workflow events withheld from customers), staff-only tag/team option
  endpoints, BullMQ Redis-failure resilience, robust env boolean parsing, and
  frontend realtime resubscribe / cache-invalidation / attachment-download
  fixes. No new product scope was added.
- Milestone 4.6 (pre-M5 hardening) is applied: atomic guarded staff status
  transitions (409 on concurrent change), a dependency-free CSRF Origin/Referer
  guard on unsafe methods, and JWT revocation via `User.tokenVersion` +
  `User.isActive` (the JWT strategy now re-validates against the database and
  returns the fresh role). Mechanism only — admin role-change endpoints remain
  M5. Requires the `user_active_token_version` migration.
- Milestone 5 is in progress:
  - Slice 0 (pre-M5 security hardening) is complete and committed: auth rate
    limiting, attachment `Content-Disposition`, readiness probe, production
    Swagger gate.
  - Slice 1 (DB-05 schema + audit foundation) is implemented: `SlaPlan` and
    `AuditLog` models, SLA enums + `TicketEventType` SLA values, Ticket SLA
    tracking columns + indexes, `isActive` on Team/Category/Tag, an
    `AuditService.record(...)` foundation (no endpoints), and a default SLA plan
    seed. The additive `sla_audit_foundation_db05` migration is created but not
    yet applied to Neon; existing tickets are not backfilled.
  - Slice 2 (SLA engine) is implemented: `SlaService` computes wall-clock SLA
    due dates from the matching plan on creation; first staff public reply stops
    the first-response clock; resolve/reopen drive the resolution clock; a 60s
    BullMQ repeatable scan flips ON_TRACK -> AT_RISK at 80% and -> BREACHED at
    due via guarded idempotent transitions, emitting SLA timeline events,
    deduped notifications (assignee + team managers, never the requester), and
    `ticket.updated`. SLA fields/events are staff-only. Wall-clock MVP;
    business-hours/pause/escalation deferred.
  - Admin ticket trash (soft delete + restore) is implemented (cross-cutting):
    `Ticket.deletedAt`/`deletedById` (additive `20260613140000_ticket_soft_delete`
    migration, not yet applied to Neon); a single `deletedAt: null` in
    `buildVisibilityWhere` hides trashed tickets from every role's
    list/detail/mutations (403) and from the SLA scanner; admin-only
    `DELETE /tickets/:id` (204 soft delete), `POST /tickets/:id/restore` (200),
    `GET /tickets/trash`; trash/restore write `AuditLog` rows + emit
    `ticket.updated`; restore preserves all history with one assignee unchanged;
    admin-only UI (detail two-step Move to Trash + `/tickets/trash` restore view +
    nav). Permanent hard delete is deferred — see
    `docs/ticket-trash-and-permanent-purge.md`.
  - Slice 2.5 (realistic demo organization + routing) is implemented: an
    idempotent `seedDemoOrganization()` (extracted to `prisma/seed-organization.ts`,
    side-effect-free, unit-tested) seeds one MANAGER (`manager@support.local`) as a
    `TeamMember` of three teams (Billing & Payments, Technical Support, Account &
    Access), each with three AGENT accounts (`*@support.local`), via pure upserts
    (no duplicates on re-run). No schema change/migration — `TeamMember` already
    encodes manager scope; assignment stays single-assignee. Category→team routing
    is now an ordered case-insensitive keyword matcher
    (`resolveTeamNameForCategory`, exported and unit-tested), falling back to
    `teamId: null` (manager triage) when the team is absent. The `@demo.test`
    accounts and legacy `Billing` team are untouched.
  - Slice 2.6 (agent reassignment approval workflow) is implemented: an
    `AssignmentRequest` model + `AssignmentRequestType`/`AssignmentRequestStatus`
    enums + three additive `NotificationType` values (additive
    `20260614120000_assignment_requests` migration, not applied to Neon). Policy:
    AGENT may only claim an unassigned same-team ticket for themselves
    (`PATCH /tickets/:id/assign` to self); any other agent direct
    reassign/steal/return is 403 and must use a request. New `AssignmentRequestsModule`
    (`POST /tickets/:id/assignment-requests`, `DELETE .../:requestId`,
    `GET /tickets/:id/assignment-requests`, `GET /assignment-requests`,
    `PATCH /assignment-requests/:id/approve|reject`). Approve/reject run in a
    transaction with full revalidation (409 on stale owner/assignee/team/trash),
    manager team-scoping (403), approval applies the single-assignee change +
    emits a `REASSIGNED` event (reused; no new event type) + AuditLog +
    notifications (managers on create; requester + new assignee on approve;
    requester on reject). Customers never see requests/reasons/notes/notifications.
    Single-assignee unchanged; cross-team requests deferred. Frontend: agent
    claim/request control + modal + pending banner on ticket detail; manager/admin
    `/assignment-requests` review page.
  - Slice 3 (reports backend) is implemented: a read-only `ReportsModule`
    (`GET /reports/overview`, `/queue`, `/agent-metrics` — MANAGER/ADMIN;
    `/reports/me` — AGENT/MANAGER/ADMIN, CUSTOMER 403, never a `userId` param;
    `/reports/assignment-requests` — MANAGER/ADMIN). No schema change/migration
    (existing indexes suffice). `windowDays` default 30 / min 1 / max 365,
    UTC window = [now − windowDays·24h, now] from a single `now`. ADMIN scope is
    global non-trashed; MANAGER scope = their teams + globally-unassigned triage
    (unrelated teams + trashed excluded). SLA % = MET / (MET + BREACHED), 1 dp,
    null on zero denominator. Aggregations use Prisma `count`/`groupBy`; averages
    use a slim in-memory aggregation (ids + timestamps + states only — no PII).
    Privacy: no descriptions, emails, message content, request reasons, or review
    notes. Frontend dashboard deferred.
  - Remaining slices (reports dashboard UI, admin CRUD, audit read surface, SLA
    indicator UI) are pending.
- M1 delivered:
  - `DB-01` identity schema for `Role` and `User`
  - `BE-01` lean auth foundation: register, login, logout, `/auth/me`, JWT cookie auth,
    `JwtAuthGuard`, `RolesGuard`, `@Roles()`, seed roles/users, Swagger docs
  - `FE-01` sign-in, sign-up, `/auth/me` hydration, protected app routing,
    role-aware shell/navigation, and logout
- M2 delivered:
  - `DB-02` ticket core schema for `Ticket`, `Team`, `TeamMember`, `Category`,
    `Tag`, `TicketTag`, and `TicketEvent`, plus demo seed data
  - `BE-02` ticket create/list/detail, read-only category options, and narrow
    customer-owned patch scope for subject/description edit plus close/reopen
  - `FE-02` ticket list, customer ticket creation, metadata-only ticket detail
- M3 delivered:
  - `DB-03` conversation schema: `TicketMessage` (with `isInternal`), `Attachment`
    (with nullable `messageId`, `uploadedById`, `storedKey`, `mimeType`,
    `sizeBytes`), and three new `TicketEventType` values (`REPLIED`, `NOTE_ADDED`,
    `ATTACHMENT_ADDED`)
  - `BE-03` thread, notes, and attachments API:
    - `POST /tickets/:id/replies`
    - `POST /tickets/:id/internal-notes` (AGENT/MANAGER/ADMIN only)
    - `POST /tickets/:id/attachments` (multipart, 10 MB cap, MIME allowlist)
    - `GET /tickets/:ticketId/attachments/:attachmentId/download-url` (signed
      short-lived URL; customers blocked from internal-note and unattached uploads)
    - `GET /tickets/:id/timeline` (combined messages + system events; customers
      never receive internal notes or `NOTE_ADDED`/`ATTACHMENT_ADDED` events)
    - Attachment linking requires the actor to own the unattached upload
    - Metadata-failure path deletes the uploaded object and surfaces a generic
      `InternalServerErrorException` instead of raw internal errors
  - `FE-03` conversation, notes, and attachments UI:
    - Combined ticket timeline
    - Public reply composer for any visible-ticket viewer
    - Staff-only internal note composer
    - Attachment upload with size/type validation and on-demand signed-URL download
    - Composer state resets on ticketId/kind changes
- M4 delivered:
  - `DB-04` `Notification` model, `NotificationType` enum
    (`TICKET_ASSIGNED`, `TICKET_REPLIED`, `STATUS_CHANGED`, `NOTE_ADDED`,
    `SLA_AT_RISK`, `SLA_BREACHED`), and `TEAM_TRANSFERRED` added to
    `TicketEventType`
  - `BE-04` workflow REST endpoints:
    - `PATCH /tickets/:id/assign`
    - `PATCH /tickets/:id/status`
    - `PATCH /tickets/:id/priority`
    - `PATCH /tickets/:id/tags` (full replacement)
    - `PATCH /tickets/:id/category`
    - `PATCH /tickets/:id/team`
  - `BE-04` read-only workflow options:
    - `GET /tickets/tags`
    - `GET /tickets/teams`
    - `GET /tickets/:id/assignable-users`
  - `BE-04` notification REST API:
    - `GET /notifications`
    - `PATCH /notifications/:id/read`
    - `PATCH /notifications/read-all`
  - `BE-04` BullMQ notification queue production (Redis-backed,
    skipped in test env, idempotent jobIds; REST workflow actions never
    block on queue failures)
  - `BE-04` Socket.IO realtime gateway with JWT-cookie handshake,
    per-user/per-ticket/per-staff rooms, and four server events
    (`notification.created`, `ticket.updated`,
    `ticket.message.created.public`, `ticket.message.created.internal`);
    customers never join staff rooms and never receive `NOTE_ADDED`
    notifications (server-side hard filter)
  - `FE-04` ticket workflow controls (status, priority, assignee,
    tags, category, team transfer) on the ticket detail page,
    role-gated and hidden from customers
  - `FE-04` notification center: bell with unread badge, dropdown
    list with mark-as-read and mark-all-read, 30s polling fallback,
    role-sensitive cache clearing on logout
  - `FE-04` frontend realtime client: singleton Socket.IO connection
    via a root-layout provider, per-ticket subscribe on detail mount,
    staff-only staff-room subscription, query invalidation only (no
    `setQueryData` write-through), neutral controller module for
    logout-driven disconnect

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
- storage abstraction scaffold (now wired in M3 for attachments)

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
- Chosen token transport: single JWT access token in an `httpOnly` cookie
- M1 MUST NOT add refresh tokens
- M1 MUST NOT add `UserSession`
- M1 MUST NOT add password reset
- M1 MUST NOT add email verification

## M3 Constraints

- M3 adds the conversation thread, internal notes, attachments, and signed
  download URLs only
- Internal notes MUST never reach customers in any API response or UI surface
- Customer signed-URL access MUST be denied for internal-note attachments and
  unattached staff uploads
- Attachment linking to a message MUST require `uploadedById === actorId`
- Public replies are blocked on closed tickets; internal notes remain allowed on
  closed tickets for staff
- M3 MUST NOT add notifications, realtime/WebSockets, BullMQ jobs, SLA logic,
  dashboards, admin CRUD, broad workflow controls, automatic status changes on
  reply, attachment cleanup jobs, or email/chatbot/billing

## Deferred Beyond M4

- SLA logic, deadlines, breach detection (`SLA_AT_RISK` and `SLA_BREACHED`
  notification types and SLA deadline columns exist in the schema but no
  SLA engine is wired)
- dashboards and reporting (manager overview, agent metrics, queue depth)
- admin CRUD / workspace configuration (users, teams, categories, tags,
  priorities, statuses, SLA plans)
- audit log
- email inbox sync, chatbot, billing
- advanced workflow automation
- attachment cleanup jobs

## Docker Policy

- Docker Compose remains part of the target architecture and final operational readiness
- Local Docker usage is postponed for now on this machine
- Early milestone progress may use non-Docker verification when the active milestone docs allow it
- Milestone-specific docs decide when infra-backed verification becomes required
- **M3 attachment runtime verification requires a running S3-compatible service
  (MinIO via the bundled Docker Compose stack, or any equivalent) plus a
  pre-created `attachments` bucket.** The automated test suite uses a mocked
  Prisma client and mocked `StorageService`, so passing CI does not by itself
  prove the live storage path works end-to-end.
- **M4 notification queue and realtime runtime verification requires a running
  Redis instance** for BullMQ to enqueue and process notification jobs. The
  automated suite mocks the queue and the Socket.IO server, so green CI proves
  business and privacy rules but does not by itself exercise the live queue
  worker or the live WebSocket flow. REST workflow actions remain correct and
  do not fail when Redis is unavailable; only the notification side-effect and
  realtime emit are skipped in that case.
- Automated tests mock storage, queue, and realtime where needed. Live
  end-to-end verification of M3 requires MinIO; live end-to-end verification of
  M4 requires Redis. Docker Compose is the recommended way to provide both
  locally, but equivalent local or cloud services are acceptable when Docker is
  not available on the active machine.

## Working Rules For Future Agents

- Re-read the constitution and milestone plan before editing code
- Confirm the current milestone and what is explicitly deferred
- Preserve Milestone 0 scaffolding boundaries until later milestones activate them
- Update markdown when milestone status or policy changes
- If code and docs disagree, flag it before implementing
