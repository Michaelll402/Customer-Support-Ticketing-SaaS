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

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  categoryId?: string;
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
  email: z.string().email(),
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
  email: z.string().email(),
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
  firstResponseDueAt: z.string().datetime().nullable(),
  resolutionDueAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;

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

export const getTicketById = async (ticketId: string) => {
  const response = await apiRequest<TicketDetailResponse>(
    `/tickets/${ticketId}`,
    {
      cache: 'no-store',
    },
  );

  return ticketDetailResponseSchema.parse(response);
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
