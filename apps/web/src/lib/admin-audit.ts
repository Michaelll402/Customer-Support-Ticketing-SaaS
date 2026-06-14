import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const auditActorSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
});

export const auditLogSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  actor: auditActorSchema.nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

const listMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogSchema),
  meta: listMetaSchema,
});

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;

// Human-readable labels for the dotted action identifiers, used by the action
// filter and the table. Unknown actions fall back to the raw code.
export const auditActionLabels: Record<string, string> = {
  'admin.user.created': 'User created',
  'admin.user.profile_updated': 'Profile updated',
  'admin.user.role_changed': 'Role changed',
  'admin.user.deactivated': 'User deactivated',
  'admin.user.activated': 'User activated',
  'admin.user.sessions_revoked': 'Sessions revoked',
  'admin.user.teams_updated': 'Teams updated',
  'admin.ticket.trashed': 'Ticket moved to trash',
  'admin.ticket.restored': 'Ticket restored',
  'workflow.assignment_request.created': 'Reassignment requested',
  'workflow.assignment_request.cancelled': 'Reassignment cancelled',
  'workflow.assignment_request.approved': 'Reassignment approved',
  'workflow.assignment_request.rejected': 'Reassignment declined',
};

export const auditActionOptions = Object.keys(auditActionLabels);

export const formatAuditAction = (action: string): string =>
  auditActionLabels[action] ?? action;

export interface AuditLogListQuery {
  page: number;
  limit: number;
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

const buildAuditParams = (query: AuditLogListQuery) => {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  if (query.actorId) params.set('actorId', query.actorId);
  if (query.action) params.set('action', query.action);
  if (query.targetType) params.set('targetType', query.targetType);
  if (query.targetId) params.set('targetId', query.targetId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return params;
};

export const getAuditLogs = async (query: AuditLogListQuery) => {
  const response = await apiRequest<AuditLogListResponse>(
    `/admin/audit?${buildAuditParams(query).toString()}`,
    { cache: 'no-store' },
  );
  return auditLogListResponseSchema.parse(response);
};

export interface MetadataEntry {
  key: string;
  label: string;
  value: string;
  mono: boolean;
  copyable: boolean;
}

// Defensive: never surface a value whose key hints at a secret, even if a future
// action accidentally records one.
const SENSITIVE_KEY =
  /pass|secret|token|hash|authorization|cookie|credential|api[_-]?key|ssn|private/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "fromRole" -> "From role", "actor_id" -> "Actor ID".
const humanizeKey = (key: string): string =>
  key
    .replace(/[._]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/\bid\b/gi, 'ID');

/**
 * Turns arbitrary metadata JSON into readable, display-ready rows — never a raw
 * JSON dump. Sensitive keys are redacted, identifier-like values are flagged for
 * monospace + copy, and nested objects are compacted safely.
 */
export const metadataEntries = (metadata: unknown): MetadataEntry[] => {
  if (
    metadata === null ||
    metadata === undefined ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata)
  ) {
    return [];
  }
  return Object.entries(metadata as Record<string, unknown>).map(
    ([key, raw]) => {
      const label = humanizeKey(key);
      if (SENSITIVE_KEY.test(key)) {
        return {
          key,
          label,
          value: '•••••• (redacted)',
          mono: false,
          copyable: false,
        };
      }
      if (raw === null || raw === undefined) {
        return { key, label, value: '—', mono: false, copyable: false };
      }
      if (typeof raw === 'object') {
        return {
          key,
          label,
          value: JSON.stringify(raw),
          mono: true,
          copyable: false,
        };
      }
      const value = String(raw);
      const idLike = UUID.test(value) || /(^|[^a-z])(id|uuid)$/i.test(key);
      return {
        key,
        label,
        value,
        mono: idLike,
        copyable: idLike && value.length >= 8,
      };
    },
  );
};
