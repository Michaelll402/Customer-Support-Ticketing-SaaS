<!--
SYNC IMPACT REPORT
==================
Version change: (unversioned template) → 1.1.0 → 1.1.1
Bump rationale:
  1.1.0 — MINOR: initial population from project constitution v1.1.0;
    all sections are net-new content replacing placeholder tokens.
  1.1.1 — PATCH: version stamp aligned to header and footer; clarification
    and wording-only adjustments. No principle, governance, MVP-scope, or
    non-negotiable changes.

Modified sections (template token → concrete content):
  [PROJECT_NAME]         → Customer Support / Ticketing SaaS
  [PRINCIPLE_1_NAME/DESC] → I. Portfolio-Grade Realism
  [PRINCIPLE_2_NAME/DESC] → II. Security-First & RBAC
  [PRINCIPLE_3_NAME/DESC] → III. Spec-Before-Build
  [PRINCIPLE_4_NAME/DESC] → IV. Modular Monolith Architecture
  [PRINCIPLE_5_NAME/DESC] → V. Business-Rule Testing
  [SECTION_2_NAME/CONTENT] → Technology & Data Constraints
  [SECTION_3_NAME/CONTENT] → Delivery & Planning Rules
  [GOVERNANCE_RULES]      → Amendment process from §18 + non-negotiables

Added sections (beyond base template):
  - Product Scope & MVP Boundaries
  - Non-Negotiable Rules (17 items)
  - AI-Assisted Development Rules
  - Final Principle

Removed sections: none

Templates checked:
  ✅ .specify/templates/plan-template.md   — no constitution-specific refs require update
  ✅ .specify/templates/spec-template.md   — no constitution-specific refs require update
  ✅ .specify/templates/tasks-template.md  — no constitution-specific refs require update
  ✅ .specify/templates/agent-file-template.md — generic, no updates needed
  (no commands/*.md files found)

Deferred TODOs: none — all fields resolved from user-supplied constitution.
-->

# Customer Support / Ticketing SaaS Constitution

**Status:** Active
**Version:** 1.1.1
**Project Type:** Portfolio-grade B2B SaaS
**Project Mode:** Single-company workspace, single-repository, phased delivery

## Mission

This project builds a modern Customer Support / Ticketing SaaS that feels like real business software.
The application MUST allow customers to create and manage support tickets, agents to process and
respond to them, managers to monitor operations and SLA risk, and admins to configure the workspace.

This project MUST NOT become a toy CRUD app. Every important product and engineering decision MUST
move the system toward portfolio-grade realism, strong interview value, and maintainable implementation.

## Core Principles

### I. Portfolio-Grade Realism (NON-NEGOTIABLE)

The product MUST resemble modern B2B support software in quality and behavior. Every feature
decision MUST satisfy at least one of: stronger product realism, stronger engineering clarity,
stronger portfolio value, safer AI-assisted implementation, or faster delivery without reckless
shortcuts. Decisions that add complexity without improving any of these outcomes MUST be rejected.

The single-company workspace model means one logical workspace with no true multi-tenancy in v1,
but authorization MUST be designed cleanly enough to support future multi-tenant growth.

### II. Security-First & RBAC (NON-NEGOTIABLE)

Security is a baseline requirement, not optional polish.

Every protected action MUST enforce: authentication, authorization, input validation, and
ownership/visibility checks where applicable. No auth or RBAC bypass is permitted for convenience.

Role model:

- **Customer** — own tickets only; MUST NOT see internal notes; close/reopen only when rules allow
- **Agent** — team-scoped tickets; reply, note, status, priority, assignment, tags
- **Manager** — team visibility, SLA monitoring, workload management, dashboards
- **Admin** — users, teams, categories, SLA rules, workspace configuration

Internal notes MUST never be exposed to customers in any API response or UI surface.
Internal notes and public replies MUST be represented separately in both backend and frontend.

File uploads are untrusted input and MUST enforce: size limits, file type allowlist, access control
before retrieval, external object storage (never PostgreSQL blobs), and metadata validation.

### III. Spec-Before-Build (NON-NEGOTIABLE)

No major feature work may begin without a focused, scoped specification.

A monolithic specification covering the entire application in a single pass is FORBIDDEN.
The project MUST be developed through multiple focused specs organized around three implementation
streams: Database Setup, Backend Work, and Frontend Work.

For every meaningful chunk, implementation MUST follow this sequence:

1. Extract focused spec from master planning documents
2. Refine scope and acceptance criteria
3. Create or update tasks
4. Implement
5. Verify against acceptance criteria
6. Revise spec/tasks if acceptance feedback reveals necessary corrections

Master planning documents (`speckit.constitution.md`, `speckit.specify.md`, `speckit.tasks.md`)
are project-level source documents. They do NOT replace per-feature specs; they are the source of
truth from which stream-specific or feature-specific specs are extracted.

### IV. Modular Monolith Architecture (NON-NEGOTIABLE)

The backend MUST be implemented as a modular monolith. Microservices are FORBIDDEN in v1.

The system MUST preserve explicit layers: presentation, application, data, infrastructure.

Backend module boundaries MUST be respected:
`auth`, `users`, `teams`, `tickets`, `ticket-messages`, `ticket-events`, `attachments`,
`categories`, `tags`, `notifications`, `reports`, `sla`, `audit`, `admin`.
No module may become a generic dumping ground for unrelated logic.

Realtime behavior (WebSockets) is additive — it improves UX but MUST NOT be required for core
correctness. All critical business workflows MUST succeed without a live WebSocket connection.

Important business actions MUST emit explicit timeline events, audit logs, or both. At minimum:
ticket creation, assignment/reassignment, status changes, priority changes, customer close/reopen,
public replies, internal notes, SLA transitions.

Binary files MUST NOT be stored in PostgreSQL. Only attachment references, metadata, relationships,
and access rules belong in the relational database.

The repository MUST be maintained as a monorepo with structure:

```
/apps/web        ← Next.js frontend
/apps/api        ← NestJS backend
/packages/ui
/packages/types
/packages/config
/packages/eslint-config
/packages/tsconfig
```

### V. Business-Rule Testing (NON-NEGOTIABLE)

Testing MUST focus on correctness of business behavior, not only utilities.

High-priority test areas: auth flows, permission checks, ticket visibility rules, status transition
rules, public reply vs internal note behavior, assignment logic, SLA calculations, audit logging.

The project MUST include unit tests, integration tests, and end-to-end tests.

Minimum E2E journeys required:

- Customer creates a ticket
- Agent replies and updates ticket state
- Manager reviews queue or metrics
- Admin changes core configuration

A feature is DONE only when: requirements are implemented, validation exists, permissions are
correct, errors are handled, tests or meaningful verification exist, docs are updated, and the UI
is operationally acceptable.

## Technology & Data Constraints

### Approved Technology Stack

**Frontend**: React, Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query,
React Hook Form, Zod.

**Backend**: Node.js, NestJS, TypeScript, Prisma ORM, JWT authentication, WebSocket gateway.

**Data & Infrastructure**: PostgreSQL, Redis, BullMQ, S3-compatible object storage.

**Testing & Quality**: Playwright, Vitest or Jest, Swagger/OpenAPI, Docker, GitHub Actions,
Pino logging, OpenTelemetry.

Deviations from the approved stack MUST be documented and justified against a constitution
principle before implementation.

### Data Design Rules

The database MUST be designed around real business relationships and future reporting needs.
Shortcut schema design that hides workflow history is FORBIDDEN.

The Ticket entity MUST support: requester, assignee, team ownership, category, status, priority,
timestamps, SLA deadlines, lifecycle events, and reporting/history fields.

The schema MUST preserve timestamps and histories needed for: first response time, resolution time,
SLA breaches, reassignment history, and workload distribution.

### API Standards

REST is used for core business workflows. WebSockets are used for realtime notifications and
ticket updates. All write paths MUST validate input through DTOs or schemas before reaching
persistence or business logic. List endpoints MUST support pagination, sorting, filtering, and
stable response structure. Public API routes MUST be documented in OpenAPI/Swagger.

### Frontend UX Standards

The frontend MUST feel like modern dashboard SaaS, not a classroom admin panel. Required qualities:
clean layouts, strong hierarchy, clear workflow state, professional forms, consistent table/detail
patterns, polished loading/empty/error states.

The UI MUST clearly distinguish: public reply vs internal note, customer-facing vs internal
content, open/pending/resolved/closed ticket state, at-risk vs breached SLA state.

Forms MUST use typed schemas, field-level validation, clear user feedback, disabled/loading submit
states, and no silent failure behavior.

### Observability

The backend MUST use structured logging (Pino) for: auth failures, permission failures, ticket
workflow failures, background job failures, file upload failures, SLA processing issues.

Local development MUST remain Docker-ready via Docker Compose with: environment variable
management, database migration flow, seed data, health checks, and clear startup instructions.
Docker Compose remains part of the target architecture and final operational readiness.

Early milestone progress MAY be verified without Docker on machines where Docker is not yet
available, but only when the active milestone documentation explicitly allows non-Docker
verification and the missing infrastructure does not hide milestone-critical risk.

## Delivery & Planning Rules

### MVP Boundaries

MVP scope INCLUDES: customer registration/login, RBAC, ticket management, status/priority changes,
public replies, internal notes, attachments, list filtering/sorting/pagination, WebSocket realtime
updates, in-app notifications, basic dashboard metrics, first-response and resolution SLA due
dates, audit logging, admin configuration for users/teams/categories/statuses/priorities/SLA rules.

MVP scope EXCLUDES (deferred): full email inbox sync, chatbot-first support, billing/subscriptions,
deep workspace customization, true multi-tenancy, advanced escalation automation, duplicate ticket
merge, canned replies, advanced BI-style reporting.

### Phase Delivery Model

The project MUST be built in phases, each ending in a working and demoable state:

1. Foundation
2. Database Setup
3. Backend Platform
4. Frontend Platform
5. Ticket Workflows
6. Realtime & Notifications
7. SLA & Management
8. Admin & Portfolio Polish

Large uncontrolled implementation bursts are FORBIDDEN. Every substantial build step MUST have a
defined scope, clear boundaries, acceptance target, and known dependencies.

Milestone-specific planning documents own the verification threshold for their scope. Early
milestones MAY allow non-Docker local verification when explicitly stated. Milestones that depend
on live infrastructure behavior MUST elevate infra-backed verification from optional to required.

### AI-Assisted Development Rules

- **ChatGPT**: product manager, architecture reviewer, planning lead
- **Spec Kit**: constitution, spec generation, planning, task decomposition
- **Claude Code**: backend implementation, refactoring, tests
- **Codex**: implementation support, code review, backend/API alternatives, cleanup
- **Gemini via Antigravity**: frontend generation, dashboard composition, page UX, UI polish

AI-generated output MUST always be reviewed for: correctness, security, architectural fit,
consistency with this constitution, and maintainability.

## Non-Negotiable Rules

1. No bypassing auth or RBAC for convenience.
2. No exposing internal notes to customers under any circumstances.
3. No storing file blobs directly in PostgreSQL.
4. No major feature work without a focused spec with defined scope.
5. No monolithic specification covering the entire application in one pass.
6. No pretending realtime (WebSockets) replaces backend correctness.
7. No feature marked "done" without validation, permissions, error handling, and verification.
8. No scope creep into billing, chatbot, or email inbox sync during MVP.
9. No oversized modules with mixed or unrelated responsibilities.
10. No portfolio shortcuts that reduce realism of product behavior.

## Governance

This constitution supersedes all other practices and informal conventions.

**Amendment procedure**: Any amendment MUST document what changed, why it changed, which stream or
modules are affected, whether MVP scope changed, and whether downstream specs or tasks must be
regenerated.

**Versioning policy**:

- **MAJOR**: Breaking governance change — principle removal or incompatible redefinition.
- **MINOR**: New principle or section added, or materially expanded guidance.
- **PATCH**: Clarification, wording improvement, or typo fix.

**Compliance**: All implementation decisions MUST be checked against this constitution before
execution. Any violation discovered during review MUST be corrected before the relevant work is
considered done. Complexity MUST be justified by explicit reference to a principle in this
document.

---

**Version**: 1.1.1 | **Ratified**: 2026-04-04 | **Last Amended**: 2026-04-22
