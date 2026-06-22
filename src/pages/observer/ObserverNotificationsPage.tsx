import React, { useCallback, useEffect } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHRMS } from "../../context/HRMSContext";
import { AppNotification } from "../../types";
import { getObserverNotificationTarget } from "../../lib/notification-navigation";

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

export default function ObserverNotificationsPage() {
  const navigate = useNavigate();
  const {
    adminNotifications,
    adminNotificationUnreadCount,
    isFetchingAdminNotifications,
    fetchAdminNotifications,
    handleMarkAdminNotificationRead,
    handleMarkAllAdminNotificationsRead,
  } = useHRMS();

  useEffect(() => {
    void fetchAdminNotifications();
  }, [fetchAdminNotifications]);

  const handleNavigate = useCallback(
    async (notif: AppNotification) => {
      if (!notif.readAt) {
        await handleMarkAdminNotificationRead(notif.id);
      }
      const target = getObserverNotificationTarget(notif);
      if (target) navigate(target);
    },
    [handleMarkAdminNotificationRead, navigate],
  );

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-[#ff791a]" />
          <div>
            <p className="text-sm font-black text-slate-800">Notifications</p>
            <p className="text-[11px] text-slate-500">
              {adminNotificationUnreadCount > 0
                ? `${adminNotificationUnreadCount} unread`
                : "All caught up"}
            </p>
          </div>
        </div>
        {adminNotificationUnreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAllAdminNotificationsRead()}
            className="text-[10px] font-bold text-[#ff791a] flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {isFetchingAdminNotifications && adminNotifications.length === 0 ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : adminNotifications.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12 px-4">No notifications yet.</p>
        ) : (
          adminNotifications.map((n) => {
            const unread = !n.readAt;
            const target = getObserverNotificationTarget(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void handleNavigate(n)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition cursor-pointer ${
                  unread ? "bg-orange-50/50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase text-[#ff791a]">{typeLabel(n.type)}</span>
                  {unread && (
                    <span className="text-[8px] font-bold bg-[#ff791a] text-white px-1.5 py-0.5 rounded-full shrink-0">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{n.title}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-slate-400">{formatWhen(n.createdAt)}</p>
                  {target && (
                    <span className="text-[10px] font-bold text-[#ff791a]">Open module →</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center px-4">
        Tap a notification to open the related module.
      </p>
    </div>
  );
}
