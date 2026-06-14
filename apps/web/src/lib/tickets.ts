import { z } from 'zod';

import { apiRequest } from '@/lib/api';

export const ticketStatusSchema = z.enum([
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketSortBySchema = z.enum([
  'createdAt',
  'updatedAt',
  'priority',
  'number',
]);
export type TicketSortBy = z.infer<typeof ticketSortBySchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

export interface TicketListQuery {
  page: number;
  limit: number;
  sortBy: TicketSortBy;
  sortOrder: SortOrder;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  teamId?: string;
  categoryId?: string;
}

export const defaultTicketListQuery: Pick<
  TicketListQuery,
  'page' | 'limit' | 'sortBy' | 'sortOrder'
> = {
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export interface TicketFilterDraft {
  status: '' | TicketStatus;
  priority: '' | TicketPriority;
  assigneeId: string;
  teamId: string;
  categoryId: string;
}

export const createTicketFormSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required.')
    .max(160, 'Subject must stay under 160 characters.'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required.')
    .max(5_000, 'Description must stay under 5,000 characters.'),
  priority: ticketPrioritySchema,
  categoryId: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().uuid().safeParse(value).success,
      'Select a valid category.',
    ),
});

export type CreateTicketFormInput = z.infer<typeof createTicketFormSchema>;

export const createTicketMessageFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body is required.')
    .max(5_000, 'Message body must stay under 5,000 characters.'),
});

export type CreateTicketMessageFormInput = z.infer<
  typeof createTicketMessageFormSchema
>;

export const ticketAttachmentMaxBytes = 10 * 1024 * 1024;

export const ticketAttachmentAllowedMimeTypes = [
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
] as const;

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  categoryId?: string;
}

export interface CreateTicketMessageInput {
  body: string;
  attachmentIds?: string[];
}

export const ticketCategoryOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().nullable(),
});

export type TicketCategoryOption = z.infer<typeof ticketCategoryOptionSchema>;

export const ticketCategoryListResponseSchema = z.array(
  ticketCategoryOptionSchema,
);

const ticketListUserSummarySchema = z.object({
  id: z.string().min(1),
  // Omitted for staff users in customer-facing responses (privacy hardening).
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const ticketListTeamSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const ticketListCategorySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const ticketListItemSchema = z.object({
  id: z.string().min(1),
  number: z.number().int(),
  subject: z.string().min(1),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  assignee: ticketListUserSummarySchema.nullable(),
  team: ticketListTeamSummarySchema.nullable(),
  category: ticketListCategorySummarySchema.nullable(),
  // Staff-only marker. Absent from normal list rows; present (a timestamp) on
  // the admin trash listing so trashed rows can show when they were removed.
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TicketListItem = z.infer<typeof ticketListItemSchema>;

const ticketListMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  sortBy: ticketSortBySchema,
  sortOrder: sortOrderSchema,
});

export const ticketListResponseSchema = z.object({
  items: z.array(ticketListItemSchema),
  meta: ticketListMetaSchema,
});

export type TicketListResponse = z.infer<typeof ticketListResponseSchema>;

const ticketDetailUserSummarySchema = z.object({
  id: z.string().min(1),
  // Omitted for staff users in customer-facing responses (privacy hardening).
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const ticketDetailTeamSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
});

const ticketDetailCategorySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().nullable(),
});

const ticketDetailTagSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().nullable(),
});

export const ticketDetailResponseSchema = z.object({
  id: z.string().min(1),
  number: z.number().int(),
  subject: z.string().min(1),
  description: z.string().min(1),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  requester: ticketDetailUserSummarySchema,
  assignee: ticketDetailUserSummarySchema.nullable(),
  team: ticketDetailTeamSummarySchema.nullable(),
  category: ticketDetailCategorySummarySchema.nullable(),
  tags: z.array(ticketDetailTagSummarySchema),
  // SLA fields are staff-only on the API now, so they are absent from
  // customer responses. Slice 6 adds the SLA indicator UI.
  firstResponseDueAt: z.string().datetime().nullable().optional(),
  resolutionDueAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;

const ticketTimelineUserSummarySchema = z.object({
  id: z.string().min(1),
  // Omitted for staff users in customer-facing timelines (privacy hardening).
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const ticketTimelineAttachmentSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  messageId: z.string().min(1).nullable(),
  uploadedById: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type TicketTimelineAttachment = z.infer<
  typeof ticketTimelineAttachmentSchema
>;

export const ticketTimelineEventTypeSchema = z.enum([
  'CREATED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'ASSIGNED',
  'REASSIGNED',
  'TAGGED',
  'CATEGORIZED',
  'CLOSED_BY_CUSTOMER',
  'REOPENED_BY_CUSTOMER',
  'REPLIED',
  'NOTE_ADDED',
  'ATTACHMENT_ADDED',
]);

export type TicketTimelineEventType = z.infer<
  typeof ticketTimelineEventTypeSchema
>;

const ticketTimelineMessageItemSchema = z.object({
  type: z.enum(['PUBLIC_REPLY', 'INTERNAL_NOTE']),
  id: z.string().min(1),
  ticketId: z.string().min(1),
  author: ticketTimelineUserSummarySchema,
  body: z.string(),
  isInternal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  attachments: z.array(ticketTimelineAttachmentSchema),
});

const ticketTimelineSystemEventItemSchema = z.object({
  type: z.literal('SYSTEM_EVENT'),
  id: z.string().min(1),
  ticketId: z.string().min(1),
  eventType: ticketTimelineEventTypeSchema,
  actor: ticketTimelineUserSummarySchema.nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});

export const ticketTimelineItemSchema = z.discriminatedUnion('type', [
  ticketTimelineMessageItemSchema,
  ticketTimelineSystemEventItemSchema,
]);

export type TicketTimelineItem = z.infer<typeof ticketTimelineItemSchema>;

export type TicketTimelineMessageItem = Extract<
  TicketTimelineItem,
  { type: 'PUBLIC_REPLY' | 'INTERNAL_NOTE' }
>;

export type TicketTimelineSystemEventItem = Extract<
  TicketTimelineItem,
  { type: 'SYSTEM_EVENT' }
>;

export const ticketTimelineResponseSchema = z.object({
  ticketId: z.string().min(1),
  items: z.array(ticketTimelineItemSchema),
});

export type TicketTimelineResponse = z.infer<
  typeof ticketTimelineResponseSchema
>;

export const ticketMessageResponseSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  author: ticketTimelineUserSummarySchema,
  body: z.string(),
  isInternal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  attachments: z.array(ticketTimelineAttachmentSchema),
});

export type TicketMessageResponse = z.infer<typeof ticketMessageResponseSchema>;

export const ticketAttachmentDownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type TicketAttachmentDownloadUrlResponse = z.infer<
  typeof ticketAttachmentDownloadUrlResponseSchema
>;

const uuidFilterSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.string().uuid().safeParse(value).success,
    'Enter a valid UUID or leave the field empty.',
  );

export const ticketFilterDraftSchema = z.object({
  status: ticketStatusSchema.or(z.literal('')),
  priority: ticketPrioritySchema.or(z.literal('')),
  assigneeId: uuidFilterSchema,
  teamId: uuidFilterSchema,
  categoryId: uuidFilterSchema,
});

const numberFromSearch = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const enumFromSearch = <T extends string>(
  schema: z.ZodType<T>,
  value: string | null,
): T | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const stringFromSearch = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseTicketListSearchParams = (
  searchParams: URLSearchParams,
): TicketListQuery => ({
  page: numberFromSearch(searchParams.get('page'), defaultTicketListQuery.page),
  limit: numberFromSearch(
    searchParams.get('limit'),
    defaultTicketListQuery.limit,
  ),
  sortBy:
    enumFromSearch(ticketSortBySchema, searchParams.get('sortBy')) ??
    defaultTicketListQuery.sortBy,
  sortOrder:
    enumFromSearch(sortOrderSchema, searchParams.get('sortOrder')) ??
    defaultTicketListQuery.sortOrder,
  status: enumFromSearch(ticketStatusSchema, searchParams.get('status')),
  priority: enumFromSearch(ticketPrioritySchema, searchParams.get('priority')),
  assigneeId: stringFromSearch(searchParams.get('assigneeId')),
  teamId: stringFromSearch(searchParams.get('teamId')),
  categoryId: stringFromSearch(searchParams.get('categoryId')),
});

export const buildTicketListSearchParams = (query: TicketListQuery) => {
  const params = new URLSearchParams();

  if (query.page !== defaultTicketListQuery.page) {
    params.set('page', String(query.page));
  }

  if (query.limit !== defaultTicketListQuery.limit) {
    params.set('limit', String(query.limit));
  }

  if (query.sortBy !== defaultTicketListQuery.sortBy) {
    params.set('sortBy', query.sortBy);
  }

  if (query.sortOrder !== defaultTicketListQuery.sortOrder) {
    params.set('sortOrder', query.sortOrder);
  }

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.priority) {
    params.set('priority', query.priority);
  }

  if (query.assigneeId) {
    params.set('assigneeId', query.assigneeId);
  }

  if (query.teamId) {
    params.set('teamId', query.teamId);
  }

  if (query.categoryId) {
    params.set('categoryId', query.categoryId);
  }

  return params;
};

export const queryToFilterDraft = (
  query: TicketListQuery,
): TicketFilterDraft => ({
  status: query.status ?? '',
  priority: query.priority ?? '',
  assigneeId: query.assigneeId ?? '',
  teamId: query.teamId ?? '',
  categoryId: query.categoryId ?? '',
});

export const getTickets = async (query: TicketListQuery) => {
  const params = buildTicketListSearchParams(query);
  const path = params.toString() ? `/tickets?${params.toString()}` : '/tickets';

  const response = await apiRequest<TicketListResponse>(path, {
    cache: 'no-store',
  });

  return ticketListResponseSchema.parse(response);
};

export const getTrashedTickets = async (query: TicketListQuery) => {
  const params = buildTicketListSearchParams(query);
  const path = params.toString()
    ? `/tickets/trash?${params.toString()}`
    : '/tickets/trash';

  const response = await apiRequest<TicketListResponse>(path, {
    cache: 'no-store',
  });

  return ticketListResponseSchema.parse(response);
};

export const getTicketById = async (ticketId: string) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}`,
    {
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const moveTicketToTrash = async (ticketId: string) => {
  // DELETE returns 204 No Content; there is no response body to parse.
  await apiRequest<void>(`/tickets/${ticketId}`, {
    method: 'DELETE',
    cache: 'no-store',
  });
};

export const restoreTicket = async (ticketId: string) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/restore`,
    {
      method: 'POST',
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const getTicketTimeline = async (ticketId: string) => {
  const response = await apiRequest<TicketTimelineResponse>(
    `/tickets/${ticketId}/timeline`,
    {
      cache: 'no-store',
    },
  );

  return ticketTimelineResponseSchema.parse(response);
};

export const uploadTicketAttachment = async (ticketId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiRequest<TicketTimelineAttachment>(
    `/tickets/${ticketId}/attachments`,
    {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    },
  );

  return ticketTimelineAttachmentSchema.parse(response);
};

export const getTicketAttachmentDownloadUrl = async (
  ticketId: string,
  attachmentId: string,
) => {
  const response = await apiRequest<TicketAttachmentDownloadUrlResponse>(
    `/tickets/${ticketId}/attachments/${attachmentId}/download-url`,
    {
      cache: 'no-store',
    },
  );

  return ticketAttachmentDownloadUrlResponseSchema.parse(response);
};

export const getTicketCategories = async () => {
  const response = await apiRequest<TicketCategoryOption[]>(
    '/tickets/categories',
    {
      cache: 'no-store',
    },
  );

  return ticketCategoryListResponseSchema.parse(response);
};

export const createTicket = async (input: CreateTicketInput) => {
  const response = await apiRequest<TicketDetailResponse>('/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  return ticketDetailResponseSchema.parse(response);
};

export const createTicketPublicReply = async (
  ticketId: string,
  input: CreateTicketMessageInput,
) => {
  const response = await apiRequest<TicketMessageResponse>(
    `/tickets/${ticketId}/replies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketMessageResponseSchema.parse(response);
};

export const createTicketInternalNote = async (
  ticketId: string,
  input: CreateTicketMessageInput,
) => {
  const response = await apiRequest<TicketMessageResponse>(
    `/tickets/${ticketId}/internal-notes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketMessageResponseSchema.parse(response);
};

export const allowedStaffStatusTransitions: Record<
  TicketStatus,
  ReadonlyArray<TicketStatus>
> = {
  OPEN: ['PENDING', 'RESOLVED', 'CLOSED'],
  PENDING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export const ticketTagOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().nullable(),
});

export type TicketTagOption = z.infer<typeof ticketTagOptionSchema>;

export const ticketTagListResponseSchema = z.array(ticketTagOptionSchema);

export const ticketTeamOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
});

export type TicketTeamOption = z.infer<typeof ticketTeamOptionSchema>;

export const ticketTeamListResponseSchema = z.array(ticketTeamOptionSchema);

export const assignableUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['AGENT', 'MANAGER', 'ADMIN']),
});

export type AssignableUser = z.infer<typeof assignableUserSchema>;

export const assignableUserListResponseSchema = z.array(assignableUserSchema);

export interface UpdateTicketStatusInput {
  status: TicketStatus;
}

export interface UpdateTicketPriorityInput {
  priority: TicketPriority;
}

export interface AssignTicketInput {
  assigneeId: string | null;
}

export interface UpdateTicketTagsInput {
  tagIds: string[];
}

export interface UpdateTicketCategoryInput {
  categoryId: string | null;
}

export interface TransferTicketTeamInput {
  teamId: string;
}

export const getTicketTags = async () => {
  const response = await apiRequest<TicketTagOption[]>('/tickets/tags', {
    cache: 'no-store',
  });

  return ticketTagListResponseSchema.parse(response);
};

export const getTicketTeams = async () => {
  const response = await apiRequest<TicketTeamOption[]>('/tickets/teams', {
    cache: 'no-store',
  });

  return ticketTeamListResponseSchema.parse(response);
};

export const getAssignableUsers = async (ticketId: string) => {
  const response = await apiRequest<AssignableUser[]>(
    `/tickets/${ticketId}/assignable-users`,
    {
      cache: 'no-store',
    },
  );

  return assignableUserListResponseSchema.parse(response);
};

export const updateTicketStatus = async (
  ticketId: string,
  input: UpdateTicketStatusInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const updateTicketPriority = async (
  ticketId: string,
  input: UpdateTicketPriorityInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/priority`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const assignTicket = async (
  ticketId: string,
  input: AssignTicketInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/assign`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const updateTicketTags = async (
  ticketId: string,
  input: UpdateTicketTagsInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/tags`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const updateTicketCategory = async (
  ticketId: string,
  input: UpdateTicketCategoryInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/category`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const transferTicketTeam = async (
  ticketId: string,
  input: TransferTicketTeamInput,
) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}/team`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
};

export const userRoleLabels: Record<AssignableUser['role'], string> = {
  ADMIN: 'Admin',
  AGENT: 'Agent',
  MANAGER: 'Manager',
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const ticketTimelineEventTypeLabels: Record<
  TicketTimelineEventType,
  string
> = {
  ASSIGNED: 'Ticket assigned',
  ATTACHMENT_ADDED: 'Attachment uploaded',
  CATEGORIZED: 'Ticket categorized',
  CLOSED_BY_CUSTOMER: 'Closed by customer',
  CREATED: 'Ticket created',
  NOTE_ADDED: 'Internal note added',
  PRIORITY_CHANGED: 'Priority changed',
  REASSIGNED: 'Ticket reassigned',
  REOPENED_BY_CUSTOMER: 'Reopened by customer',
  REPLIED: 'Reply added',
  STATUS_CHANGED: 'Status changed',
  TAGGED: 'Tags updated',
};
