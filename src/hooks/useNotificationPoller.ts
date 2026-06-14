import { useCallback, useEffect, useRef } from "react";
import { AppNotification } from "../types";
import {
  POLL_INTERVAL_MS,
  alertForNewNotifications,
  requestBrowserNotificationPermission,
} from "../lib/notification-alerts";

interface UseNotificationPollerOptions {
  enabled: boolean;
  unreadCount: number;
  fetchUnreadCount: () => Promise<number>;
  fetchNotifications?: () => Promise<AppNotification[]>;
  pollIntervalMs?: number;
}

export function useNotificationPoller({
  enabled,
  unreadCount,
  fetchUnreadCount,
  fetchNotifications,
  pollIntervalMs = POLL_INTERVAL_MS,
}: UseNotificationPollerOptions): void {
  const lastCountRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      lastCountRef.current = null;
      initializedRef.current = false;
      return;
    }
    void requestBrowserNotificationPermission();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!initializedRef.current) {
      lastCountRef.current = unreadCount;
      initializedRef.current = true;
    }
  }, [enabled, unreadCount]);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const nextCount = await fetchUnreadCount();
      const previousCount = lastCountRef.current ?? nextCount;
      if (nextCount > previousCount) {
        let latest: AppNotification | null = null;
        if (fetchNotifications) {
          const items = await fetchNotifications();
          latest = items.find((n) => !n.readAt) || items[0] || null;
        }
        alertForNewNotifications(previousCount, nextCount, latest);
      }
      lastCountRef.current = nextCount;
    } catch {
      /* ignore polling errors */
    }
  }, [enabled, fetchUnreadCount, fetchNotifications]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void poll();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, poll, pollIntervalMs]);
}
