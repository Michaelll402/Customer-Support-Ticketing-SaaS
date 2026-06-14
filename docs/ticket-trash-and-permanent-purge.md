# Ticket Trash (Soft Delete) and Deferred Permanent Purge

**Status**: Soft-delete trash + restore are **implemented**. Permanent ("hard")
purge is **designed but deliberately not implemented** in this slice.

This document records what shipped, why hard delete was intentionally deferred,
and the concrete design a future slice should follow to add an admin-only
permanent purge safely.

---

## 1. What shipped: admin-only Move to Trash / Restore

A normal support system must not immediately hard-delete tickets: they hold
customer conversations, internal notes, workflow history, SLA evidence,
attachments, and audit-relevant data. The shipped feature is a reversible
soft delete.

### Data model

`Ticket` gained two nullable columns and one self-relation:

- `deletedAt DateTime?` — when the ticket was moved to the trash (`null` = live).
- `deletedById String? @db.Uuid` — the admin who trashed it.
- `deletedBy User? @relation("TicketDeletedBy", ... onDelete: SetNull)`.
- `@@index([deletedAt])` for the trash listing and scanner exclusion.

Migration: `20260613140000_ticket_soft_delete` (additive; generated DB-free with
`prisma migrate diff`, **not yet applied to Neon**).

### Behavior

- **Single exclusion point.** `TicketsService.buildVisibilityWhere` adds
  `deletedAt: null` for **every** role (customer, agent, manager, admin). Because
  list, detail, and all workflow mutations resolve the ticket through that
  visibility filter, a trashed ticket is uniformly hidden:
  - Excluded from `GET /tickets` for all roles.
  - `GET /tickets/:id` returns **403** (exists-but-not-visible, consistent with
    the codebase's existing not-visible handling) for all roles, including admin.
  - Every workflow mutation (replies, internal notes, attachments, status,
    priority, tags, category, assignment, team transfer, timeline,
    assignable-users) rejects with **403**.
- **SLA scanner.** `SlaService.runScan` candidate query filters `deletedAt: null`,
  so trashed tickets are excluded from AT_RISK/BREACHED evaluation entirely.
- **Admin-only endpoints:**
  - `DELETE /tickets/:id` → `204`, soft-deletes (sets `deletedAt`/`deletedById`).
    `409` if already trashed, `404` if it does not exist.
  - `POST /tickets/:id/restore` → `200` with the ticket detail; clears the trash
    markers. `409` if not trashed, `404` if it does not exist.
  - `GET /tickets/trash` → `200`, paginated list of trashed tickets. Rows carry
    the staff-only `deletedAt` marker.
  - All three are guarded by `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)` and
    re-checked in the service (`requireAdmin`). Non-admins get **403**.
- **Restore preserves everything.** Restore only flips the trash markers; it never
  touches messages, events, attachments, team, assignee, status, or SLA history.
  One assignee per ticket is unchanged.
- **Audit.** Trash and restore each append an `AuditLog` row
  (`admin.ticket.trashed` / `admin.ticket.restored`, `targetType: 'Ticket'`,
  metadata `{ number, subject }`) best-effort via `AuditService`.
- **Realtime.** Both emit `ticket.updated` so connected clients invalidate.
- **UI.** Admin-only "Move to Trash" on the ticket detail page (two-step
  confirm + redirect to the trash view) and an admin-only `/tickets/trash` page
  with per-row Restore. The nav shows "Trash" only for admins.

---

## 2. Relation and cascade inventory (source of truth for purge)

A permanent purge must account for every row and external object that references
a ticket. Current `onDelete` behavior in `schema.prisma`:

| Child / reference    | FK                    | `onDelete`  | Effect of a raw `ticket.delete()` |
| -------------------- | --------------------- | ----------- | --------------------------------- |
| `TicketTag`          | `ticketId → Ticket`   | **Cascade** | Row deleted automatically         |
| `TicketEvent`        | `ticketId → Ticket`   | **Cascade** | Row deleted automatically         |
| `TicketMessage`      | `ticketId → Ticket`   | **Cascade** | Row deleted automatically         |
| `Attachment`         | `ticketId → Ticket`   | **Cascade** | DB row deleted automatically      |
| `Notification`       | `ticketId → Ticket`   | **SetNull** | **Kept**, `ticketId` set to null  |
| `Attachment.message` | `messageId → Message` | SetNull     | N/A (attachment cascades anyway)  |

Two consequences that a naive `prisma.ticket.delete()` gets **wrong**:

1. **Orphaned storage objects.** Cascading the `Attachment` **rows** does not
   delete the underlying MinIO/S3 objects keyed by `Attachment.storedKey`. A raw
   delete leaks every blob for the ticket.
2. **Notifications are not deleted.** `Notification.ticketId` is `SetNull`, so a
   raw delete leaves dangling notifications with `ticketId = null`. The product
   intent for permanent purge is to remove them, which requires an **explicit**
   `notification.deleteMany({ where: { ticketId } })` before the ticket delete.

---

## 3. Deferred permanent-purge design

### 3.1 Preconditions (all required)

- **Admin only** (`RolesGuard` + `@Roles(ADMIN)` + service `requireAdmin`).
- **Only from trash.** Purge is allowed **only** when `deletedAt IS NOT NULL`.
  A live ticket can never be purged directly; it must be trashed first. This
  gives a mandatory two-step, reversible-then-irreversible flow.
- **Typed confirmation.** The request body must echo the ticket `number` (or the
  literal `DELETE`); reject with `400` on mismatch. The UI requires typing it.
- Never exposed to agent, manager, or customer.

### 3.2 Storage-first reconciliation order

Because the DB can roll back but object storage cannot, delete external objects
in a way that never leaves the DB pointing at a missing blob:

1. **Load** `Attachment.storedKey` for all attachments of the ticket
   (`select: { id, storedKey }`).
2. **Write the audit row first** (`admin.ticket.purged`, with `{ number, subject,
attachmentCount }`) so the irreversible act is always recorded even if a later
   step fails.
3. **Delete each storage object** via `StorageService.delete(storedKey)`,
   collecting failures. Treat "object already missing" as success (idempotent).
4. **Delete DB rows in one transaction**:
   - `notification.deleteMany({ where: { ticketId } })` (explicit — SetNull
     would otherwise keep them),
   - `ticket.delete({ where: { id } })` — cascade removes `TicketTag`,
     `TicketEvent`, `TicketMessage`, and `Attachment` rows.

Storage deletion happens **before** the DB transaction so that a storage failure
aborts the purge with the DB still intact (the ticket stays in trash, fully
restorable). The opposite order could delete the DB rows and then fail to remove
blobs, losing the `storedKey` needed to ever clean them up.

### 3.3 Idempotency and partial failure

- If any `StorageService.delete` call fails for a reason other than
  "not found", **abort before the DB transaction** and return `502/409` with the
  failed keys; the ticket remains trashed and the audit row notes the attempt.
- Optionally add a `purgeState`/reconciliation worker later so a half-deleted
  storage set can be retried, but the synchronous storage-first order above keeps
  the v1 simple and safe.

### 3.4 Proposed API

```
DELETE /tickets/:id/permanent     (admin only; body: { confirm: string })
  204 — purged
  400 — confirmation text mismatch
  409 — ticket is not in the trash (must be trashed first)
  404 — ticket does not exist
  502 — one or more storage objects could not be deleted (DB untouched)
```

UI: a "Permanently Delete" action that appears **only on the trash view**, behind
a typed confirmation. The trash label wording stays **Move to Trash / Restore /
Permanently Delete** — permanent deletion is never described as "freeing DB space".

### 3.5 Edge cases

- Attachments with a `null` `storedKey` (shouldn't occur) → skip storage delete.
- Shared storage keys (not currently possible — keys are per-ticket) would need a
  reference check before deletion; document the invariant if that ever changes.
- Concurrent restore vs purge → both re-check `deletedAt` under the same row;
  the guarded `where: { id, deletedAt: { not: null } }` makes the loser a no-op.

---

## 4. Why hard delete was deferred

- The reversible trash already satisfies the operational need ("remove it from
  everything") without destroying customer/audit data.
- Permanent deletion is irreversible and crosses a transactional boundary into
  object storage; it deserves its own slice with the storage-reconciliation
  handling, typed-confirmation UI, and audit guarantees above — not a quick
  `prisma.ticket.delete()` that silently orphans blobs and dangles notifications.
