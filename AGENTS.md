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
- Milestone 3 is functionally complete and ready for the completion commit
- Milestone 4 has not started yet
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
- The next required step is focused spec extraction for M4:
  - `DB-04` notifications schema and workflow event expansions
  - `BE-04` workflow actions, notification queue, realtime gateway
  - `FE-04` workflow controls, notification center, realtime UX

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

## Deferred Beyond M3

- BullMQ jobs/processors and Redis queue wiring
- realtime workflows / WebSocket gateway
- in-app notifications and notification center
- SLA logic, deadlines, breach detection
- dashboards and admin business features
- workflow actions (assign/reassign, priority, tags, category, team transfer)
- email inbox sync, chatbot, billing

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

## Working Rules For Future Agents

- Re-read the constitution and milestone plan before editing code
- Confirm the current milestone and what is explicitly deferred
- Preserve Milestone 0 scaffolding boundaries until later milestones activate them
- Update markdown when milestone status or policy changes
- If code and docs disagree, flag it before implementing
