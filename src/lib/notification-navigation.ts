import { AppNotification } from "../types";

export type FieldTeamView = "visits" | "supervisors" | "requests" | "commitments";

export type SupervisorRequestsTab = "raise" | "mine" | "notifications";

export interface AdminNotificationTarget {
  tab: string;
  fieldTeamView?: FieldTeamView;
}

export interface SupervisorNotificationTarget {
  path: string;
  tab?: SupervisorRequestsTab;
}

export function getAdminNotificationTarget(
  notification: AppNotification,
): AdminNotificationTarget | null {
  if (
    notification.type === "commitment_created" ||
    notification.type === "commitment_overdue" ||
    notification.refType === "commitment"
  ) {
    return { tab: "Field Team", fieldTeamView: "commitments" };
  }

  if (
    notification.type === "supervisor_request_new" ||
    notification.type === "supervisor_request_escalated" ||
    notification.refType === "supervisor_request"
  ) {
    return { tab: "Field Team", fieldTeamView: "requests" };
  }

  if (
    notification.type === "visit_submitted" ||
    notification.refType === "school_visit" ||
    notification.type === "planned_visit_due" ||
    notification.type === "planned_visit_missed" ||
    notification.refType === "planned_visit"
  ) {
    return { tab: "Field Team", fieldTeamView: "visits" };
  }

  return null;
}

/** Observer admin mobile app routes for notification deep links. */
export function getObserverNotificationTarget(notification: AppNotification): string | null {
  const admin = getAdminNotificationTarget(notification);
  if (!admin) return null;
  if (admin.fieldTeamView === "visits") return "/observer/visits";
  if (admin.fieldTeamView === "commitments") return "/observer/commitments";
  if (admin.fieldTeamView === "requests") return "/observer/visits";
  if (admin.fieldTeamView === "supervisors") return "/observer/supervisors";
  return null;
}

export function getSupervisorNotificationTarget(
  notification: AppNotification,
): SupervisorNotificationTarget | null {
  if (
    notification.type === "supervisor_request_response" ||
    notification.refType === "supervisor_request"
  ) {
    return { path: "/supervisor/requests", tab: "mine" };
  }

  if (notification.type === "visit_reviewed" || notification.refType === "school_visit") {
    return { path: "/supervisor/history" };
  }

  if (
    notification.type === "planned_visit_due" ||
    notification.type === "planned_visit_missed" ||
    notification.refType === "planned_visit" ||
    notification.type === "commitment_overdue" ||
    notification.type === "commitment_admin_update" ||
    notification.refType === "commitment"
  ) {
    return { path: "/supervisor/calendar" };
  }

  return null;
}
