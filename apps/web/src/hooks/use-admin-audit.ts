'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getAuditLogs,
  type AuditLogListQuery,
  type AuditLogListResponse,
} from '@/lib/admin-audit';

export const useAuditLogs = (query: AuditLogListQuery, enabled = true) =>
  useQuery<AuditLogListResponse>({
    enabled,
    queryKey: ['admin', 'audit', 'list', query],
    queryFn: () => getAuditLogs(query),
    placeholderData: keepPreviousData,
  });
