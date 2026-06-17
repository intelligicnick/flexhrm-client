import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, Volume2, VolumeX } from "lucide-react";
import { AppNotification } from "../types";
import {
  isBrowserPushEnabled,
  isNotificationSoundEnabled,
  requestBrowserNotificationPermission,
  setBrowserPushEnabled,
  setNotificationSoundEnabled,
} from "../lib/notification-alerts";

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function typeLabel(type: AppNotification["type"]): string {
  const map: Record<AppNotification["type"], string> = {
    commitment_created: "New Commitment",
    commitment_overdue: "Overdue Commitment",
    commitment_reminder: "Commitment Reminder",
    commitment_admin_update: "Commitment Update",
    supervisor_request_new: "Supervisor Request",
    supervisor_request_response: "Request Response",
    supervisor_request_escalated: "Escalated Request",
    visit_submitted: "Visit Submitted",
    visit_reviewed: "Visit Review",
    planned_visit_due: "Visit Due Today",
    planned_visit_missed: "Visit Missed",
  };
  return map[type] || type;
}

interface NotificationsBellProps {
  unreadCount: number;
  notifications: AppNotification[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onNavigate?: (notification: AppNotification) => void;
}

export default function NotificationsBell({
  unreadCount,
  notifications,
  loading = false,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isNotificationSoundEnabled);
  const [pushOn, setPushOn] = useState(isBrowserPushEnabled);
  const panelRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!open) return;
    void requestBrowserNotificationPermission();
    void onRefreshRef.current();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 transition cursor-pointer"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[24rem] bg-white rounded-xl shadow-xl border border-slate-200 z-50 text-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-black text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="text-[10px] font-bold text-[#ff791a] flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[20rem]">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-8 px-4">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const unread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (unread) void onMarkRead(n.id);
                      onNavigate?.(n);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer ${
                      unread ? "bg-orange-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase text-[#ff791a]">
                        {typeLabel(n.type)}
                      </span>
                      {unread && (
                        <span className="text-[8px] font-bold bg-[#ff791a] text-white px-1.5 py-0.5 rounded-full shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{n.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatWhen(n.createdAt)}</p>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                const next = !soundOn;
                setSoundOn(next);
                setNotificationSoundEnabled(next);
              }}
              className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                soundOn ? "text-[#ff791a]" : "text-slate-400"
              }`}
              title="Toggle notification sound"
            >
              {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
              Sound
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !pushOn;
                setPushOn(next);
                setBrowserPushEnabled(next);
                if (next) void requestBrowserNotificationPermission();
              }}
              className={`text-[10px] font-bold cursor-pointer ${
                pushOn ? "text-[#ff791a]" : "text-slate-400"
              }`}
              title="Toggle browser notifications"
            >
              Browser alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
