import type { Contract } from "../types";
import { canViewModule, type UserPermissionsMap } from "./permissions";
import type { ObserverUiRestrictions } from "./role-ui-restrictions";

export type ObserverModuleId =
  | "notifications"
  | "employees"
  | "salary"
  | "advance-penalty"
  | "attendance"
  | "directory"
  | "birthdays"
  | "monitor"
  | "supervisors"
  | "map"
  | "visits"
  | "commitments"
  | "tenders"
  | "contracts"
  | "car-papers"
  | "it-renewals"
  | "licenses"
  | "expenses"
  | "partner-pay";

export interface ObserverModuleRow {
  id: ObserverModuleId;
  label: string;
  permissionTab: string;
}

export const OBSERVER_MODULE_ROWS: ObserverModuleRow[] = [
  { id: "notifications", label: "Notifications", permissionTab: "Admin" },
  { id: "employees", label: "Employees", permissionTab: "Employees" },
  { id: "salary", label: "Salary", permissionTab: "Salary" },
  { id: "advance-penalty", label: "Advance & Penalty", permissionTab: "Advance & Penalty" },
  { id: "attendance", label: "Attendance", permissionTab: "Attendance" },
  { id: "directory", label: "Directory", permissionTab: "Directory" },
  { id: "birthdays", label: "Birthdays", permissionTab: "Birthdays" },
  { id: "monitor", label: "Monitor", permissionTab: "Monitor" },
  { id: "supervisors", label: "Supervisors", permissionTab: "Field Team" },
  { id: "map", label: "Supervisors Map", permissionTab: "Field Team" },
  { id: "visits", label: "Visits", permissionTab: "Field Team" },
  { id: "commitments", label: "Commitment Diary", permissionTab: "Field Team" },
  { id: "tenders", label: "Tenders", permissionTab: "Tenders" },
  { id: "contracts", label: "Contracts", permissionTab: "Contracts" },
  { id: "car-papers", label: "Car Papers", permissionTab: "Car Papers" },
  { id: "it-renewals", label: "IT Renewals", permissionTab: "IT Renewals" },
  { id: "licenses", label: "Licenses", permissionTab: "Licenses" },
  { id: "expenses", label: "Expenses", permissionTab: "Expenses" },
  { id: "partner-pay", label: "Partner Pay", permissionTab: "Monthly Billing" },
];

export const ALL_OBSERVER_MODULE_IDS: ObserverModuleId[] = OBSERVER_MODULE_ROWS.map((row) => row.id);

/** Default allowlist for Observer Admin role preset and seed. */
export const DEFAULT_OBSERVER_ALLOWED_MODULES: ObserverModuleId[] = [...ALL_OBSERVER_MODULE_IDS];

const OBSERVER_MODULE_BY_ID = new Map(OBSERVER_MODULE_ROWS.map((row) => [row.id, row]));

export function getObserverModuleRow(moduleId: string): ObserverModuleRow | undefined {
  return OBSERVER_MODULE_BY_ID.get(moduleId as ObserverModuleId);
}

export function isWorksiteLocationRestricted(
  sessionUser: string,
  sessionLocations: string[] | null | undefined,
): boolean {
  if (sessionUser.toLowerCase() === "admin") return false;
  return Array.isArray(sessionLocations) && sessionLocations.length > 0;
}

export function matchesWorksiteLocation(
  value: string | null | undefined,
  sessionLocations: string[],
): boolean {
  const normalized = value?.trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return sessionLocations.some((loc) => loc.toLowerCase() === lower);
}

export function contractMatchesWorksite(contract: Contract, sessionLocations: string[]): boolean {
  const linked = (contract.linkedLocations || []).filter(Boolean);
  const hasLocationSignal =
    linked.length > 0 ||
    Boolean(contract.officeName?.trim()) ||
    Boolean(contract.correspondingOffice?.trim());

  if (linked.some((loc) => matchesWorksiteLocation(loc, sessionLocations))) {
    return true;
  }
  if (matchesWorksiteLocation(contract.officeName, sessionLocations)) return true;
  if (matchesWorksiteLocation(contract.correspondingOffice, sessionLocations)) return true;

  // Legacy contracts without any worksite assignment remain visible.
  return !hasLocationSignal;
}

export function filterContractsByWorksite(
  contracts: Contract[],
  sessionUser: string,
  sessionLocations: string[] | null | undefined,
): Contract[] {
  if (!isWorksiteLocationRestricted(sessionUser, sessionLocations)) return contracts;
  const locations = sessionLocations || [];
  return contracts.filter((contract) => contractMatchesWorksite(contract, locations));
}

export function isObserverModuleInAllowlist(
  moduleId: string,
  observerRestrictions: ObserverUiRestrictions | null | undefined,
): boolean {
  const allowed = observerRestrictions?.allowedModules;
  // undefined = no Observer module restriction on the role → allow RBAC-visible modules
  if (allowed === undefined) return true;
  return allowed.includes(moduleId);
}

export function listVisibleObserverModules(
  userPermissions: UserPermissionsMap,
  observerRestrictions: ObserverUiRestrictions | null | undefined,
): ObserverModuleRow[] {
  return OBSERVER_MODULE_ROWS.filter((row) =>
    isObserverModuleAllowed(row.id, userPermissions, observerRestrictions),
  );
}

export function isObserverModuleAllowed(
  moduleId: string,
  userPermissions: UserPermissionsMap,
  observerRestrictions: ObserverUiRestrictions | null | undefined,
): boolean {
  const row = getObserverModuleRow(moduleId);
  if (!row) return false;
  if (moduleId === "notifications") {
    return isObserverModuleInAllowlist(moduleId, observerRestrictions);
  }
  if (!canViewModule(userPermissions, row.permissionTab)) return false;
  return isObserverModuleInAllowlist(moduleId, observerRestrictions);
}

/** Map observer route moduleId (URL param) to observer module allowlist id. */
export function observerRouteToModuleId(routeModuleId: string): ObserverModuleId | null {
  if (routeModuleId === "supervisors") return "supervisors";
  const row = OBSERVER_MODULE_ROWS.find((r) => r.id === routeModuleId);
  return row?.id ?? null;
}
