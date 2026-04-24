'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createTicket,
  getTicketCategories,
  getTicketById,
  getTickets,
  type CreateTicketInput,
  type TicketCategoryOption,
  type TicketDetailResponse,
  type TicketListQuery,
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
