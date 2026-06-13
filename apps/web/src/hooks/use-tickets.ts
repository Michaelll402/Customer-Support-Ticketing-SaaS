'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  assignTicket,
  createTicket,
  createTicketInternalNote,
  createTicketPublicReply,
  getAssignableUsers,
  getTicketAttachmentDownloadUrl,
  getTicketCategories,
  getTicketById,
  getTicketTags,
  getTicketTeams,
  getTicketTimeline,
  getTickets,
  transferTicketTeam,
  updateTicketCategory,
  updateTicketPriority,
  updateTicketStatus,
  updateTicketTags,
  uploadTicketAttachment,
  type AssignTicketInput,
  type AssignableUser,
  type CreateTicketMessageInput,
  type CreateTicketInput,
  type TicketAttachmentDownloadUrlResponse,
  type TicketCategoryOption,
  type TicketDetailResponse,
  type TicketListQuery,
  type TicketTagOption,
  type TicketTeamOption,
  type TicketTimelineAttachment,
  type TicketTimelineResponse,
  type TransferTicketTeamInput,
  type UpdateTicketCategoryInput,
  type UpdateTicketPriorityInput,
  type UpdateTicketStatusInput,
  type UpdateTicketTagsInput,
} from '@/lib/tickets';

import type { QueryClient } from '@tanstack/react-query';

const invalidateTicketWorkflowCaches = async (
  queryClient: QueryClient,
  ticketId: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['tickets', 'detail', ticketId],
    }),
    queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] }),
    queryClient.invalidateQueries({
      queryKey: ['tickets', 'timeline', ticketId],
    }),
  ]);
};

export const useTickets = (query: TicketListQuery) =>
  useQuery({
    queryKey: ['tickets', 'list', query],
    queryFn: () => getTickets(query),
    placeholderData: keepPreviousData,
  });

export const useTicket = (ticketId: string) =>
  useQuery<TicketDetailResponse>({
    enabled: ticketId.length > 0,
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => getTicketById(ticketId),
  });

export const useTicketTimeline = (ticketId: string) =>
  useQuery<TicketTimelineResponse>({
    enabled: ticketId.length > 0,
    queryKey: ['tickets', 'timeline', ticketId],
    queryFn: () => getTicketTimeline(ticketId),
  });

export const useTicketCategories = (enabled = true) =>
  useQuery<TicketCategoryOption[]>({
    enabled,
    queryKey: ['tickets', 'categories'],
    queryFn: () => getTicketCategories(),
  });

export const useTicketTags = (enabled = true) =>
  useQuery<TicketTagOption[]>({
    enabled,
    queryKey: ['tickets', 'tags'],
    queryFn: () => getTicketTags(),
  });

export const useTicketTeams = (enabled = true) =>
  useQuery<TicketTeamOption[]>({
    enabled,
    queryKey: ['tickets', 'teams'],
    queryFn: () => getTicketTeams(),
  });

export const useAssignableUsers = (ticketId: string, enabled = true) =>
  useQuery<AssignableUser[]>({
    enabled: enabled && ticketId.length > 0,
    queryKey: ['tickets', 'assignable-users', ticketId],
    queryFn: () => getAssignableUsers(ticketId),
  });

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets', 'list'],
      });
    },
  });
};

export const useCreateTicketPublicReply = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketMessageInput) =>
      createTicketPublicReply(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useCreateTicketInternalNote = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketMessageInput) =>
      createTicketInternalNote(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useUploadTicketAttachment = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation<TicketTimelineAttachment, Error, File>({
    mutationFn: (file) => uploadTicketAttachment(ticketId, file),
    onSuccess: async () => {
      // Uploading writes a staff-visible ATTACHMENT_ADDED timeline event before
      // the message is posted, so refresh the timeline to surface it.
      await queryClient.invalidateQueries({
        queryKey: ['tickets', 'timeline', ticketId],
      });
    },
  });
};

export const useTicketAttachmentDownloadUrl = (ticketId: string) =>
  useMutation<TicketAttachmentDownloadUrlResponse, Error, string>({
    mutationFn: (attachmentId) =>
      getTicketAttachmentDownloadUrl(ticketId, attachmentId),
  });

export const useUpdateTicketStatus = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketStatusInput) =>
      updateTicketStatus(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useUpdateTicketPriority = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketPriorityInput) =>
      updateTicketPriority(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useAssignTicket = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignTicketInput) => assignTicket(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useUpdateTicketTags = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketTagsInput) =>
      updateTicketTags(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useUpdateTicketCategory = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketCategoryInput) =>
      updateTicketCategory(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};

export const useTransferTicketTeam = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransferTicketTeamInput) =>
      transferTicketTeam(ticketId, input),
    onSuccess: () => invalidateTicketWorkflowCaches(queryClient, ticketId),
  });
};
