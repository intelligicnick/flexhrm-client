import { Employee } from "../types";

export type BulkEditFieldType = "text" | "number" | "select" | "boolean";

export interface BulkEditFieldDef {
  key: keyof Employee;
  label: string;
  type: BulkEditFieldType;
  options?: string[];
  /** Pull options from parent props (locations / roles registry) */
  dynamicOptions?: "location" | "role";
  minWidth?: string;
  group?: string;
}

export const WORKING_DAYS_OPTIONS = [
  "22 Days (Sat/Sun Off)",
  "26 Days (Sun Off)",
  "30/31 Days (No Off)",
];

export const ESIC_OPTIONS = ["Yes", "No"];
export const GENDER_OPTIONS = ["Male", "Female", "Other"];
export const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"];
export const SKILL_OPTIONS = [
  "Highly Skilled",
  "Skilled",
  "Semi Skilled",
  "Unskilled",
];
export const PF_CALCULATION_OPTIONS = ["gross", "ceiling_15000"];
export const BOOLEAN_OPTIONS = ["Yes", "No"];

const NUMBER_FIELDS = new Set<keyof Employee>([
  "grossSalary",
  "basicSalary",
  "dailyWage",
  "advance",
  "penalty",
  "uniform",
  "foodPerk",
  "accommodationPerk",
  "conveyancePerk",
]);

/** Every editable scalar field on the employee master profile (matches form modal tabs). */
export const BULK_EDIT_FIELDS: BulkEditFieldDef[] = [
  // Corporate & Salary
  { key: "employeeCode", label: "Employee Code", type: "text", minWidth: "120px", group: "Corporate" },
  { key: "nameAsPerAadhar", label: "Name (Aadhar)", type: "text", minWidth: "180px", group: "Corporate" },
  { key: "location", label: "Location", type: "select", dynamicOptions: "location", minWidth: "130px", group: "Corporate" },
  { key: "skillCategory", label: "Skill Category", type: "select", options: SKILL_OPTIONS, minWidth: "130px", group: "Corporate" },
  { key: "role", label: "Job Role", type: "select", dynamicOptions: "role", minWidth: "130px", group: "Corporate" },
  { key: "workingDaysType", label: "Working Days", type: "select", options: WORKING_DAYS_OPTIONS, minWidth: "160px", group: "Corporate" },
  { key: "grossSalary", label: "Gross Salary", type: "number", minWidth: "100px", group: "Corporate" },
  { key: "basicSalary", label: "Basic Salary", type: "number", minWidth: "100px", group: "Corporate" },
  { key: "dailyWage", label: "Daily Wage", type: "number", minWidth: "100px", group: "Corporate" },
  { key: "esic", label: "ESIC", type: "select", options: ESIC_OPTIONS, minWidth: "80px", group: "Corporate" },
  { key: "complianceEnabled", label: "Statutory Compliance", type: "boolean", minWidth: "100px", group: "Corporate" },
  { key: "pfCalculationMode", label: "PF Calculation Mode", type: "select", options: PF_CALCULATION_OPTIONS, minWidth: "130px", group: "Corporate" },
  { key: "uan", label: "UAN", type: "text", minWidth: "130px", group: "Corporate" },
  { key: "pfJoiningDate", label: "PF Join Date", type: "text", minWidth: "110px", group: "Corporate" },
  { key: "previousUanNo", label: "Previous UAN", type: "text", minWidth: "120px", group: "Corporate" },
  { key: "previousEsicNo", label: "Previous ESIC", type: "text", minWidth: "120px", group: "Corporate" },
  // Perks & deductions (employee-level defaults)
  { key: "advance", label: "Advance", type: "number", minWidth: "90px", group: "Perks" },
  { key: "penalty", label: "Penalty", type: "number", minWidth: "90px", group: "Perks" },
  { key: "uniform", label: "Uniform", type: "number", minWidth: "90px", group: "Perks" },
  { key: "foodPerk", label: "Food Perk", type: "number", minWidth: "90px", group: "Perks" },
  { key: "accommodationPerk", label: "Accommodation Perk", type: "number", minWidth: "110px", group: "Perks" },
  { key: "conveyancePerk", label: "Conveyance Perk", type: "number", minWidth: "110px", group: "Perks" },
  // Identity & Personal
  { key: "aadharNo", label: "Aadhar No", type: "text", minWidth: "130px", group: "Identity" },
  { key: "nameAsPerAadharColumn", label: "Name as per Aadhar", type: "text", minWidth: "160px", group: "Identity" },
  { key: "panNo", label: "PAN No", type: "text", minWidth: "110px", group: "Identity" },
  { key: "nameAsPerPan", label: "Name as per PAN", type: "text", minWidth: "140px", group: "Identity" },
  { key: "dateOfBirth", label: "Date of Birth", type: "text", minWidth: "110px", group: "Identity" },
  { key: "gender", label: "Gender", type: "select", options: GENDER_OPTIONS, minWidth: "90px", group: "Identity" },
  { key: "maritalStatus", label: "Marital Status", type: "select", options: MARITAL_OPTIONS, minWidth: "110px", group: "Identity" },
  { key: "fatherName", label: "Father Name", type: "text", minWidth: "140px", group: "Identity" },
  { key: "husbandName", label: "Husband Name", type: "text", minWidth: "140px", group: "Identity" },
  { key: "aadharLinkMobNo", label: "Aadhar Mobile", type: "text", minWidth: "120px", group: "Identity" },
  { key: "employeeMobile", label: "Employee Mobile", type: "text", minWidth: "120px", group: "Identity" },
  // Banking & Address
  { key: "bankAccountNo", label: "Bank Account", type: "text", minWidth: "140px", group: "Bank" },
  { key: "ifscCode", label: "IFSC", type: "text", minWidth: "110px", group: "Bank" },
  { key: "nameAsPerBank", label: "Name as per Bank", type: "text", minWidth: "150px", group: "Bank" },
  { key: "presentAddress", label: "Present Address", type: "text", minWidth: "180px", group: "Bank" },
  { key: "permanentAddress", label: "Permanent Address", type: "text", minWidth: "180px", group: "Bank" },
  // Nominee & Dependents
  { key: "nomineeName", label: "Nominee Name", type: "text", minWidth: "130px", group: "Nominee" },
  { key: "nomineeDob", label: "Nominee DOB", type: "text", minWidth: "110px", group: "Nominee" },
  { key: "nomineeRelation", label: "Nominee Relation", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "nomineeMobile", label: "Nominee Mobile", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember1Name", label: "Family 1 Name", type: "text", minWidth: "130px", group: "Nominee" },
  { key: "familyMember1Dob", label: "Family 1 DOB", type: "text", minWidth: "110px", group: "Nominee" },
  { key: "familyMember1Relation", label: "Family 1 Relation", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember1Mobile", label: "Family 1 Mobile", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember2Name", label: "Family 2 Name", type: "text", minWidth: "130px", group: "Nominee" },
  { key: "familyMember2Dob", label: "Family 2 DOB", type: "text", minWidth: "110px", group: "Nominee" },
  { key: "familyMember2Relation", label: "Family 2 Relation", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember2Mobile", label: "Family 2 Mobile", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember3Name", label: "Family 3 Name", type: "text", minWidth: "130px", group: "Nominee" },
  { key: "familyMember3Dob", label: "Family 3 DOB", type: "text", minWidth: "110px", group: "Nominee" },
  { key: "familyMember3Relation", label: "Family 3 Relation", type: "text", minWidth: "120px", group: "Nominee" },
  { key: "familyMember3Mobile", label: "Family 3 Mobile", type: "text", minWidth: "120px", group: "Nominee" },
  // Exit
  { key: "exitDate", label: "Exit Date", type: "text", minWidth: "110px", group: "Exit" },
  { key: "exitReason", label: "Exit Reason", type: "text", minWidth: "150px", group: "Exit" },
];

export function collectCustomFieldNames(employees: Employee[]): string[] {
  const names = new Set<string>();
  for (const emp of employees) {
    for (const f of emp.customFields || []) {
      if (f.name?.trim()) names.add(f.name.trim());
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function getEmployeeFieldValue(emp: Employee, key: keyof Employee): string {
  if (key === "complianceEnabled") {
    return emp.complianceEnabled === false ? "No" : "Yes";
  }
  const val = emp[key];
  if (val === undefined || val === null) return "";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

export function getEffectiveCustomFields(
  emp: Employee,
  draft: Partial<Employee> | undefined,
): Array<{ name: string; type: string; value: string }> {
  if (draft?.customFields) return draft.customFields;
  return (emp.customFields || []).map((f) => ({ ...f }));
}

export function getCustomFieldValue(
  emp: Employee,
  draft: Partial<Employee> | undefined,
  fieldName: string,
): string {
  const fields = getEffectiveCustomFields(emp, draft);
  const match = fields.find((f) => f.name === fieldName);
  return match?.value ?? "";
}

export function getOriginalCustomFieldValue(emp: Employee, fieldName: string): string {
  const match = (emp.customFields || []).find((f) => f.name === fieldName);
  return match?.value ?? "";
}

export function parseFieldValueForSubmit(
  field: BulkEditFieldDef,
  raw: string,
): unknown {
  if (field.type === "boolean") return raw === "Yes";
  if (field.type === "number" || NUMBER_FIELDS.has(field.key)) {
    return Number(raw) || 0;
  }
  return raw;
}

export function buildMergedEmployee(
  original: Employee,
  draft: Partial<Employee> | undefined,
): Employee {
  if (!draft) return original;
  const merged = { ...original, ...draft };
  for (const key of NUMBER_FIELDS) {
    if (draft[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = Number(draft[key]) || 0;
    }
  }
  if (draft.complianceEnabled !== undefined) {
    merged.complianceEnabled =
      draft.complianceEnabled === true ||
      String(draft.complianceEnabled) === "Yes";
  }
  if (draft.customFields) {
    merged.customFields = draft.customFields;
  }
  return merged;
}

function customFieldsEqual(
  a: Array<{ name: string; type: string; value: string }> | undefined,
  b: Array<{ name: string; type: string; value: string }> | undefined,
): boolean {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

export function countDraftChanges(
  employees: Employee[],
  drafts: Record<string, Partial<Employee>>,
): { employeeCount: number; fieldCount: number } {
  let employeeCount = 0;
  let fieldCount = 0;
  const customNames = collectCustomFieldNames(employees);

  for (const emp of employees) {
    const draft = drafts[emp.id];
    if (!draft) continue;

    let rowChanged = false;

    for (const field of BULK_EDIT_FIELDS) {
      const originalVal = getEmployeeFieldValue(emp, field.key);
      const draftVal =
        draft[field.key] !== undefined
          ? getEmployeeFieldValue({ ...emp, [field.key]: draft[field.key] } as Employee, field.key)
          : originalVal;
      if (originalVal !== draftVal) {
        fieldCount++;
        rowChanged = true;
      }
    }

    for (const name of customNames) {
      const originalVal = getOriginalCustomFieldValue(emp, name);
      const draftVal = getCustomFieldValue(emp, draft, name);
      if (originalVal !== draftVal) {
        fieldCount++;
        rowChanged = true;
      }
    }

    if (rowChanged) employeeCount++;
  }

  return { employeeCount, fieldCount };
}

export interface BulkEditReviewFieldChange {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface BulkEditReviewEntry {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  fieldChanges: BulkEditReviewFieldChange[];
}


export function formatBulkEditDisplayValue(val: unknown): string {
  if (val === undefined || val === null || val === "") return "(empty)";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  return String(val);
}

export function buildReviewEntries(
  employees: Employee[],
  drafts: Record<string, Partial<Employee>>,
): BulkEditReviewEntry[] {
  const entries: BulkEditReviewEntry[] = [];
  const customNames = collectCustomFieldNames(employees);

  for (const emp of employees) {
    const draft = drafts[emp.id];
    if (!draft) continue;

    const merged = buildMergedEmployee(emp, draft);
    const fieldChanges: BulkEditReviewFieldChange[] = [];

    for (const field of BULK_EDIT_FIELDS) {
      const oldValue = getEmployeeFieldValue(emp, field.key);
      const newValue = getEmployeeFieldValue(merged, field.key);
      if (oldValue !== newValue) {
        fieldChanges.push({
          key: field.key,
          label: field.label,
          oldValue: formatBulkEditDisplayValue(oldValue),
          newValue: formatBulkEditDisplayValue(newValue),
        });
      }
    }

    for (const name of customNames) {
      const oldValue = getOriginalCustomFieldValue(emp, name);
      const newValue = getCustomFieldValue(emp, draft, name);
      if (oldValue !== newValue) {
        fieldChanges.push({
          key: `custom:${name}`,
          label: name,
          oldValue: formatBulkEditDisplayValue(oldValue),
          newValue: formatBulkEditDisplayValue(newValue),
        });
      }
    }

    if (fieldChanges.length > 0) {
      entries.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode || emp.id,
        employeeName: emp.nameAsPerAadhar || emp.employeeCode || emp.id,
        fieldChanges,
      });
    }
  }

  return entries;
}

export function buildSubmissionPayload(
  employees: Employee[],
  drafts: Record<string, Partial<Employee>>,
): Array<{ employeeId: string; changes: Partial<Employee> }> {
  const updates: Array<{ employeeId: string; changes: Partial<Employee> }> = [];
  const customNames = collectCustomFieldNames(employees);

  for (const emp of employees) {
    const draft = drafts[emp.id];
    if (!draft) continue;

    const merged = buildMergedEmployee(emp, draft);
    const changes: Partial<Employee> = {};

    for (const field of BULK_EDIT_FIELDS) {
      const originalVal = getEmployeeFieldValue(emp, field.key);
      const newVal = getEmployeeFieldValue(merged, field.key);
      if (originalVal !== newVal) {
        (changes as Record<string, unknown>)[field.key] = parseFieldValueForSubmit(
          field,
          newVal,
        );
      }
    }

    const mergedCustom = getEffectiveCustomFields(emp, draft);
    const originalCustom = emp.customFields || [];
    let customChanged = false;
    for (const name of customNames) {
      if (
        getOriginalCustomFieldValue(emp, name) !== getCustomFieldValue(emp, draft, name)
      ) {
        customChanged = true;
        break;
      }
    }
    if (customChanged && !customFieldsEqual(originalCustom, mergedCustom)) {
      changes.customFields = mergedCustom;
    }

    if (Object.keys(changes).length > 0) {
      updates.push({ employeeId: emp.id, changes });
    }
  }

  return updates;
}

export function isFieldDirty(
  emp: Employee,
  draft: Partial<Employee> | undefined,
  key: keyof Employee,
): boolean {
  if (!draft || draft[key] === undefined) return false;
  const originalVal = getEmployeeFieldValue(emp, key);
  const draftVal = getEmployeeFieldValue(
    { ...emp, [key]: draft[key] } as Employee,
    key,
  );
  return originalVal !== draftVal;
}

export function isCustomFieldDirty(
  emp: Employee,
  draft: Partial<Employee> | undefined,
  fieldName: string,
): boolean {
  if (!draft?.customFields) return false;
  return (
    getOriginalCustomFieldValue(emp, fieldName) !==
    getCustomFieldValue(emp, draft, fieldName)
  );
}

export function buildCustomFieldsAfterEdit(
  emp: Employee,
  draft: Partial<Employee> | undefined,
  fieldName: string,
  value: string,
): Array<{ name: string; type: string; value: string }> {
  const base = getEffectiveCustomFields(emp, draft);
  const existing = base.find((f) => f.name === fieldName);
  if (existing) {
    return base.map((f) => (f.name === fieldName ? { ...f, value } : f));
  }
  const original = (emp.customFields || []).find((f) => f.name === fieldName);
  return [
    ...base,
    {
      name: fieldName,
      type: original?.type || "text",
      value,
    },
  ];
}
