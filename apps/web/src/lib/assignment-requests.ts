import { z } from 'zod';

import { apiRequest } from '@/lib/api';
import { ticketStatusSchema } from '@/lib/tickets';

export const assignmentRequestTypeSchema = z.enum([
  'REASSIGN_USER',
  'RETURN_TO_QUEUE',
]);
export type AssignmentRequestType = z.infer<typeof assignmentRequestTypeSchema>;

export const assignmentRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
export type AssignmentRequestStatus = z.infer<
  typeof assignmentRequestStatusSchema
>;

const userSummarySchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

const ticketSummarySchema = z.object({
  id: z.string().min(1),
  number: z.number().int(),
  subject: z.string().min(1),
  status: ticketStatusSchema,
  teamId: z.string().nullable(),
  currentAssignee: userSummarySchema.nullable(),
});

export const assignmentRequestSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  type: assignmentRequestTypeSchema,
  status: assignmentRequestStatusSchema,
  reason: z.string(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ticket: ticketSummarySchema,
  requestedBy: userSummarySchema,
  requestedAssignee: userSummarySchema.nullable(),
  reviewedBy: userSummarySchema.nullable(),
});

export type AssignmentRequest = z.infer<typeof assignmentRequestSchema>;

export const assignmentRequestListSchema = z.array(assignmentRequestSchema);

export const ASSIGNMENT_REQUEST_REASON_MIN = 10;
export const ASSIGNMENT_REQUEST_REASON_MAX = 1_000;
export const ASSIGNMENT_REJECT_NOTE_MIN = 5;
export const ASSIGNMENT_REVIEW_NOTE_MAX = 1_000;

export const createAssignmentRequestFormSchema = z
  .object({
    type: assignmentRequestTypeSchema,
    requestedAssigneeId: z.string().trim(),
    reason: z
      .string()
      .trim()
      .min(
        ASSIGNMENT_REQUEST_REASON_MIN,
        `Give at least ${ASSIGNMENT_REQUEST_REASON_MIN} characters of context.`,
      )
      .max(
        ASSIGNMENT_REQUEST_REASON_MAX,
        `Keep the reason under ${ASSIGNMENT_REQUEST_REASON_MAX} characters.`,
      ),
  })
  .refine(
    (value) =>
      value.type !== 'REASSIGN_USER' || value.requestedAssigneeId.length > 0,
    {
      message: 'Choose the teammate to reassign to.',
      path: ['requestedAssigneeId'],
    },
  );

export type CreateAssignmentRequestFormInput = z.infer<
  typeof createAssignmentRequestFormSchema
>;

export const rejectAssignmentRequestFormSchema = z.object({
  reviewNote: z
    .string()
    .trim()
    .min(
      ASSIGNMENT_REJECT_NOTE_MIN,
      `Add at least ${ASSIGNMENT_REJECT_NOTE_MIN} characters explaining the decision.`,
    )
    .max(ASSIGNMENT_REVIEW_NOTE_MAX),
});

export type RejectAssignmentRequestFormInput = z.infer<
  typeof rejectAssignmentRequestFormSchema
>;

export interface CreateAssignmentRequestInput {
  type: AssignmentRequestType;
  requestedAssigneeId?: string | null;
  reason: string;
}

export const assignmentRequestTypeLabels: Record<
  AssignmentRequestType,
  string
> = {
  REASSIGN_USER: 'Assign to teammate',
  RETURN_TO_QUEUE: 'Return to team queue',
};

export const assignmentRequestStatusLabels: Record<
  AssignmentRequestStatus,
  string
> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const getTicketAssignmentRequests = async (ticketId: string) => {
  const response = await apiRequest<AssignmentRequest[]>(
    `/tickets/${ticketId}/assignment-requests`,
    { cache: 'no-store' },
  );

  return assignmentRequestListSchema.parse(response);
};

export const createAssignmentRequest = async (
  ticketId: string,
  input: CreateAssignmentRequestInput,
) => {
  const response = await apiRequest<AssignmentRequest>(
    `/tickets/${ticketId}/assignment-requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );

  return assignmentRequestSchema.parse(response);
};

export const cancelAssignmentRequest = async (
  ticketId: string,
  requestId: string,
) => {
  const response = await apiRequest<AssignmentRequest>(
    `/tickets/${ticketId}/assignment-requests/${requestId}`,
    { method: 'DELETE', cache: 'no-store' },
  );

  return assignmentRequestSchema.parse(response);
};

export const getAssignmentRequestsForReview = async (
  status: AssignmentRequestStatus = 'PENDING',
) => {
  const response = await apiRequest<AssignmentRequest[]>(
    `/assignment-requests?status=${status}`,
    { cache: 'no-store' },
  );

  return assignmentRequestListSchema.parse(response);
};

export const approveAssignmentRequest = async (
  requestId: string,
  reviewNote?: string,
) => {
  const response = await apiRequest<AssignmentRequest>(
    `/assignment-requests/${requestId}/approve`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewNote ? { reviewNote } : {}),
      cache: 'no-store',
    },
  );

  return assignmentRequestSchema.parse(response);
};

export const rejectAssignmentRequest = async (
  requestId: string,
  reviewNote: string,
) => {
  const response = await apiRequest<AssignmentRequest>(
    `/assignment-requests/${requestId}/reject`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote }),
      cache: 'no-store',
    },
  );

  return assignmentRequestSchema.parse(response);
};
