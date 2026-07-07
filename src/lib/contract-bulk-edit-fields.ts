import { Contract, ContractStatus, ContractType, CreateContractInput } from "../types";
import { parseFlexibleDateMs } from "./date-helpers";

export type ContractBulkEditFieldType = "text" | "select" | "boolean";

export interface ContractBulkEditFieldDef {
  key: keyof CreateContractInput;
  label: string;
  type: ContractBulkEditFieldType;
  options?: string[];
  dynamicOptions?: "company" | "category";
  minWidth?: string;
  group?: string;
}

export const CONTRACT_TYPE_OPTIONS: ContractType[] = ["manpower", "travel"];
export const CONTRACT_STATUS_OPTIONS: ContractStatus[] = [
  "active",
  "upcoming",
  "expired",
  "extended",
  "terminated",
];
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  expired: "Expired",
  extended: "Extended",
  terminated: "Terminated",
};
export const BOOLEAN_OPTIONS = ["Yes", "No"];

export const CONTRACT_BULK_EDIT_FIELDS: ContractBulkEditFieldDef[] = [
  { key: "contractNo", label: "Contract No", type: "text", minWidth: "130px", group: "Contract" },
  { key: "tenderBidNo", label: "Tender Bid No", type: "text", minWidth: "120px", group: "Contract" },
  { key: "officerName", label: "Officer", type: "text", minWidth: "140px", group: "Parties" },
  { key: "officeName", label: "Office", type: "text", minWidth: "140px", group: "Parties" },
  {
    key: "correspondingOffice",
    label: "Corresponding Office",
    type: "text",
    minWidth: "150px",
    group: "Parties",
  },
  { key: "companyName", label: "Company", type: "select", dynamicOptions: "company", minWidth: "120px", group: "Parties" },
  { key: "category", label: "Category", type: "select", dynamicOptions: "category", minWidth: "130px", group: "Classification" },
  {
    key: "contractType",
    label: "Type",
    type: "select",
    options: CONTRACT_TYPE_OPTIONS,
    minWidth: "100px",
    group: "Classification",
  },
  { key: "contractValue", label: "Contract Value", type: "text", minWidth: "110px", group: "Classification" },
  { key: "fromDate", label: "From Date", type: "text", minWidth: "110px", group: "Period" },
  { key: "toDate", label: "To Date", type: "text", minWidth: "110px", group: "Period" },
  { key: "hasExtension", label: "Extension", type: "boolean", minWidth: "90px", group: "Period" },
  { key: "extensionEndDate", label: "Extension End", type: "text", minWidth: "120px", group: "Period" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: CONTRACT_STATUS_OPTIONS,
    minWidth: "100px",
    group: "Period",
  },
  { key: "entryDate", label: "Entry Date", type: "text", minWidth: "110px", group: "Period" },
  { key: "bgApplicable", label: "BG Applicable", type: "boolean", minWidth: "100px", group: "Bank Guarantee" },
  { key: "bgNumber", label: "BG Number", type: "text", minWidth: "120px", group: "Bank Guarantee" },
  { key: "bgAmount", label: "BG Amount", type: "text", minWidth: "100px", group: "Bank Guarantee" },
  { key: "bgIssuingBank", label: "BG Bank", type: "text", minWidth: "130px", group: "Bank Guarantee" },
  { key: "bgExpiryDate", label: "BG Expiry", type: "text", minWidth: "110px", group: "Bank Guarantee" },
  { key: "bgDetails", label: "BG Details", type: "text", minWidth: "150px", group: "Bank Guarantee" },
  { key: "ddoName", label: "DDO Name", type: "text", minWidth: "130px", group: "DDO" },
  { key: "ddoIssuingDetails", label: "DDO Details", type: "text", minWidth: "150px", group: "DDO" },
  { key: "notes", label: "Notes", type: "text", minWidth: "180px", group: "Other" },
];

export function contractEffectiveEndDate(contract: Contract): string {
  if (contract.hasExtension && contract.extensionEndDate.trim()) {
    return contract.extensionEndDate;
  }
  return contract.toDate;
}

export function contractMatchesExpiryBand(
  contract: Contract,
  band: "all" | "active" | "expiring_soon" | "expired",
): boolean {
  if (band === "all") return true;
  const now = Date.now();
  const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;
  const ts = parseFlexibleDateMs(contractEffectiveEndDate(contract));
  if (ts === null) return band === "active";
  if (band === "expired") return ts < now;
  if (band === "expiring_soon") return ts >= now && ts <= soonCutoff;
  return ts >= now;
}

export function contractMatchesBgDueSoon(contract: Contract): boolean {
  if (!contract.bgApplicable) return false;
  const now = Date.now();
  const soonCutoff = now + 30 * 24 * 60 * 60 * 1000;
  const ts = parseFlexibleDateMs(contract.bgExpiryDate);
  return ts !== null && ts >= now && ts <= soonCutoff;
}

export function contractMatchesLocationFilter(contract: Contract, locations: string[]): boolean {
  if (locations.length === 0) return true;
  const normalized = new Set(locations.map((loc) => loc.trim().toLowerCase()).filter(Boolean));
  const linked = (contract.linkedLocations || []).some((loc) =>
    normalized.has(loc.trim().toLowerCase()),
  );
  if (linked) return true;
  const office = contract.officeName?.trim().toLowerCase() || "";
  return office ? normalized.has(office) : false;
}

function coerceText(value: string | null | undefined): string {
  return value == null ? "" : String(value);
}

export function getContractFieldValue(contract: Contract, key: keyof CreateContractInput): string {
  if (key === "hasExtension" || key === "bgApplicable") {
    return contract[key as keyof Contract] ? "Yes" : "No";
  }
  if (key === "contractType") {
    return contract.contractType || "manpower";
  }
  if (key === "status") {
    return contract.status || "active";
  }
  const val = contract[key as keyof Contract];
  if (val === undefined || val === null) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

export function buildMergedContract(
  original: Contract,
  draft: Partial<CreateContractInput> | undefined,
): Contract {
  if (!draft) return original;
  const merged = { ...original, ...draft };
  if (draft.hasExtension !== undefined) {
    merged.hasExtension = draft.hasExtension === true || String(draft.hasExtension) === "Yes";
  }
  if (draft.bgApplicable !== undefined) {
    merged.bgApplicable = draft.bgApplicable === true || String(draft.bgApplicable) === "Yes";
  }
  return merged;
}

export function parseContractFieldValueForSubmit(
  field: ContractBulkEditFieldDef,
  raw: string,
): unknown {
  if (field.type === "boolean") return raw === "Yes";
  if (field.key === "contractType") return raw === "travel" ? "travel" : "manpower";
  if (field.key === "status") {
    return CONTRACT_STATUS_OPTIONS.includes(raw as ContractStatus) ? raw : "active";
  }
  return raw;
}

export function countContractDraftChanges(
  contracts: Contract[],
  drafts: Record<string, Partial<CreateContractInput>>,
): { contractCount: number; fieldCount: number } {
  let contractCount = 0;
  let fieldCount = 0;

  for (const contract of contracts) {
    const draft = drafts[contract.id];
    if (!draft) continue;

    let rowChanged = false;
    for (const field of CONTRACT_BULK_EDIT_FIELDS) {
      const originalVal = getContractFieldValue(contract, field.key);
      const draftVal =
        draft[field.key] !== undefined
          ? getContractFieldValue(
              { ...contract, ...draft } as Contract,
              field.key,
            )
          : originalVal;
      if (originalVal !== draftVal) {
        fieldCount += 1;
        rowChanged = true;
      }
    }
    if (rowChanged) contractCount += 1;
  }

  return { contractCount, fieldCount };
}

export interface ContractBulkEditReviewFieldChange {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface ContractBulkEditReviewEntry {
  contractId: string;
  contractNo: string;
  companyName: string;
  fieldChanges: ContractBulkEditReviewFieldChange[];
}

export function formatContractBulkEditDisplayValue(val: unknown, key?: keyof CreateContractInput): string {
  if (val === undefined || val === null || val === "") return "(empty)";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (key === "contractType") return val === "travel" ? "Travel Plus" : "Manpower";
  if (key === "status" && typeof val === "string") {
    return CONTRACT_STATUS_LABELS[val as ContractStatus] || val;
  }
  return String(val);
}

export function buildContractReviewEntries(
  contracts: Contract[],
  drafts: Record<string, Partial<CreateContractInput>>,
): ContractBulkEditReviewEntry[] {
  const entries: ContractBulkEditReviewEntry[] = [];

  for (const contract of contracts) {
    const draft = drafts[contract.id];
    if (!draft) continue;

    const merged = buildMergedContract(contract, draft);
    const fieldChanges: ContractBulkEditReviewFieldChange[] = [];

    for (const field of CONTRACT_BULK_EDIT_FIELDS) {
      const oldValue = getContractFieldValue(contract, field.key);
      const newValue = getContractFieldValue(merged, field.key);
      if (oldValue !== newValue) {
        fieldChanges.push({
          key: field.key,
          label: field.label,
          oldValue: formatContractBulkEditDisplayValue(oldValue, field.key),
          newValue: formatContractBulkEditDisplayValue(newValue, field.key),
        });
      }
    }

    if (fieldChanges.length > 0) {
      entries.push({
        contractId: contract.id,
        contractNo: coerceText(merged.contractNo || contract.contractNo) || contract.id,
        companyName: coerceText(merged.companyName || contract.companyName) || "—",
        fieldChanges,
      });
    }
  }

  return entries;
}

export function buildContractSubmissionPayload(
  contracts: Contract[],
  drafts: Record<string, Partial<CreateContractInput>>,
): Array<{ id: string; payload: Partial<CreateContractInput> }> {
  const updates: Array<{ id: string; payload: Partial<CreateContractInput> }> = [];

  for (const contract of contracts) {
    const draft = drafts[contract.id];
    if (!draft) continue;

    const merged = buildMergedContract(contract, draft);
    const payload: Partial<CreateContractInput> = {};

    for (const field of CONTRACT_BULK_EDIT_FIELDS) {
      const originalVal = getContractFieldValue(contract, field.key);
      const newVal = getContractFieldValue(merged, field.key);
      if (originalVal !== newVal) {
        (payload as Record<string, unknown>)[field.key] = parseContractFieldValueForSubmit(
          field,
          newVal,
        );
      }
    }

    if (Object.keys(payload).length > 0) {
      updates.push({ id: contract.id, payload });
    }
  }

  return updates;
}

export function isContractFieldDirty(
  contract: Contract,
  draft: Partial<CreateContractInput> | undefined,
  key: keyof CreateContractInput,
): boolean {
  if (!draft || draft[key] === undefined) return false;
  const originalVal = getContractFieldValue(contract, key);
  const draftVal = getContractFieldValue({ ...contract, ...draft } as Contract, key);
  return originalVal !== draftVal;
}

export function collectContractCompanies(contracts: Contract[]): string[] {
  return Array.from(
    new Set(contracts.map((c) => c.companyName?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

export function collectContractCategories(contracts: Contract[]): string[] {
  return Array.from(
    new Set(contracts.map((c) => c.category?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

export function applyContractBulkDraftUpdate(
  drafts: Record<string, Partial<CreateContractInput>>,
  contracts: Contract[],
  contractId: string,
  field: keyof CreateContractInput,
  rawValue: string,
): Record<string, Partial<CreateContractInput>> {
  const contract = contracts.find((c) => c.id === contractId);
  if (!contract) return drafts;

  const fieldDef = CONTRACT_BULK_EDIT_FIELDS.find((f) => f.key === field);
  const parsed = fieldDef
    ? parseContractFieldValueForSubmit(fieldDef, rawValue)
    : rawValue;

  const originalVal = getContractFieldValue(contract, field);
  const newVal = getContractFieldValue(
    { ...contract, [field]: parsed } as Contract,
    field,
  );

  const nextEntry = { ...(drafts[contractId] || {}) };

  if (originalVal === newVal) {
    delete nextEntry[field];
    if (field === "hasExtension") delete nextEntry.extensionEndDate;
  } else {
    (nextEntry as Record<string, unknown>)[field] = parsed;
    if (field === "hasExtension" && parsed === false) {
      nextEntry.extensionEndDate = "";
    }
  }

  if (Object.keys(nextEntry).length === 0) {
    const next = { ...drafts };
    delete next[contractId];
    return next;
  }

  return { ...drafts, [contractId]: nextEntry };
}
