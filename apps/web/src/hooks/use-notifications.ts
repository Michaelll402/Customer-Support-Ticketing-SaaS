'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListQuery,
  type NotificationListResponse,
} from '@/lib/notifications';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

export const useNotifications = (query: NotificationListQuery = {}) =>
  useQuery<NotificationListResponse>({
    queryKey: ['notifications', 'list', query],
    queryFn: () => getNotifications(query),
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
