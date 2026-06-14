'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  approveAssignmentRequest,
  cancelAssignmentRequest,
  createAssignmentRequest,
  getAssignmentRequestsForReview,
  getTicketAssignmentRequests,
  rejectAssignmentRequest,
  type AssignmentRequest,
  type AssignmentRequestStatus,
  type CreateAssignmentRequestInput,
} from '@/lib/assignment-requests';

const REVIEW_POLL_INTERVAL_MS = 30_000;

const invalidateForTicket = async (
  queryClient: QueryClient,
  ticketId: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['assignment-requests'] }),
    queryClient.invalidateQueries({
      queryKey: ['tickets', 'detail', ticketId],
    }),
    queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] }),
    queryClient.invalidateQueries({
      queryKey: ['tickets', 'timeline', ticketId],
    }),
  ]);
};

export const useTicketAssignmentRequests = (ticketId: string, enabled = true) =>
  useQuery<AssignmentRequest[]>({
    enabled: enabled && ticketId.length > 0,
    queryKey: ['assignment-requests', 'ticket', ticketId],
    queryFn: () => getTicketAssignmentRequests(ticketId),
  });

export const useReviewAssignmentRequests = (
  status: AssignmentRequestStatus = 'PENDING',
  enabled = true,
) =>
  useQuery<AssignmentRequest[]>({
    enabled,
    queryKey: ['assignment-requests', 'review', status],
    queryFn: () => getAssignmentRequestsForReview(status),
    refetchInterval: REVIEW_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

export const useCreateAssignmentRequest = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAssignmentRequestInput) =>
      createAssignmentRequest(ticketId, input),
    onSuccess: () => invalidateForTicket(queryClient, ticketId),
  });
};

export const useCancelAssignmentRequest = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      cancelAssignmentRequest(ticketId, requestId),
    onSuccess: () => invalidateForTicket(queryClient, ticketId),
  });
};

export const useApproveAssignmentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { requestId: string; reviewNote?: string }) =>
      approveAssignmentRequest(input.requestId, input.reviewNote),
    onSuccess: (result) => invalidateForTicket(queryClient, result.ticketId),
  });
};

export const useRejectAssignmentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { requestId: string; reviewNote: string }) =>
      rejectAssignmentRequest(input.requestId, input.reviewNote),
    onSuccess: (result) => invalidateForTicket(queryClient, result.ticketId),
  });
};
