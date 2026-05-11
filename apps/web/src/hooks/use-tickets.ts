'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createTicket,
  createTicketInternalNote,
  createTicketPublicReply,
  getTicketAttachmentDownloadUrl,
  getTicketCategories,
  getTicketById,
  getTicketTimeline,
  getTickets,
  uploadTicketAttachment,
  type CreateTicketMessageInput,
  type CreateTicketInput,
  type TicketAttachmentDownloadUrlResponse,
  type TicketCategoryOption,
  type TicketDetailResponse,
  type TicketListQuery,
  type TicketTimelineAttachment,
  type TicketTimelineResponse,
} from '@/lib/tickets';

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets', 'timeline', ticketId],
      });
    },
  });
};

export const useCreateTicketInternalNote = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketMessageInput) =>
      createTicketInternalNote(ticketId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets', 'timeline', ticketId],
      });
    },
  });
};

export const useUploadTicketAttachment = (ticketId: string) =>
  useMutation<TicketTimelineAttachment, Error, File>({
    mutationFn: (file) => uploadTicketAttachment(ticketId, file),
  });

export const useTicketAttachmentDownloadUrl = (ticketId: string) =>
  useMutation<TicketAttachmentDownloadUrlResponse, Error, string>({
    mutationFn: (attachmentId) =>
      getTicketAttachmentDownloadUrl(ticketId, attachmentId),
  });
