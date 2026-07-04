import { computeEsicStatusFromGross, normalizeEsicStatus, ESIC_STATUS_NO } from "./esic";
import { getDaysInMonthStatic } from "./date-helpers";

export type SalaryAnchor = "gross" | "daily" | "basic";

export type SalaryWageMode = "monthly" | "daily";

export type SalaryCascadeField =
  | "grossSalary"
  | "dailyWage"
  | "basicSalary"
  | "workingDaysType";

export interface SalaryFieldValues {
  grossSalary: number;
  dailyWage: number;
  basicSalary: number;
  workingDaysType: string;
  esic: string;
  /** When true, basic is not re-derived from the configured gross percentage. */
  basicSalaryManual?: boolean;
}

/** True when stored basic differs from the configured percentage of gross. */
export function inferBasicSalaryManual(
  values: Pick<SalaryFieldValues, "grossSalary" | "basicSalary">,
  basicPercent: number,
): boolean {
  const gross = Number(values.grossSalary) || 0;
  const basic = Number(values.basicSalary) || 0;
  if (gross <= 0 || basic <= 0) return false;
  const pct = Math.min(100, Math.max(0, basicPercent)) / 100;
  return basic !== Math.round(gross * pct);
}

const FIELD_TO_ANCHOR: Record<Exclude<SalaryCascadeField, "workingDaysType">, SalaryAnchor> = {
  grossSalary: "gross",
  dailyWage: "daily",
  basicSalary: "basic",
};

export const SALARY_CASCADE_FIELDS = new Set<SalaryCascadeField>([
  "grossSalary",
  "dailyWage",
  "basicSalary",
  "workingDaysType",
]);

export function isSalaryCascadeField(field: string): field is SalaryCascadeField {
  return SALARY_CASCADE_FIELDS.has(field as SalaryCascadeField);
}

export function isCalendarMonthWorkingCycle(cycle: string | undefined): boolean {
  if (!cycle) return false;
  return cycle.includes("30") || cycle.includes("31") || /no off/i.test(cycle);
}

export function getWorkingDaysCount(cycle: string | undefined): number {
  if (!cycle) return 26;
  if (isCalendarMonthWorkingCycle(cycle)) return 30;
  const match = cycle.match(/(\d+)\s*Days?/i);
  if (match) return parseInt(match[1], 10);
  if (cycle.includes("22")) return 22;
  if (cycle.includes("26")) return 26;
  return 26;
}

/**
 * Denominator for monthly-wage proration: fixed cycle days (22/26) or actual
 * calendar days in the month for the 30/31 (no off) cycle.
 */
export function getMonthlySalaryProrationDays(
  workingDaysType: string | undefined,
  month: string,
): number {
  if (isCalendarMonthWorkingCycle(workingDaysType)) {
    const days = getDaysInMonthStatic(month);
    return days > 0 ? days : 30;
  }
  return getWorkingDaysCount(workingDaysType);
}

export function computeEsic(gross: number, esicLimit: number): string {
  return computeEsicStatusFromGross(gross, esicLimit);
}

export function wageModeToAnchor(mode: SalaryWageMode): Exclude<SalaryAnchor, "basic"> {
  return mode === "daily" ? "daily" : "gross";
}

export function deriveSalaryFromAnchor(
  anchor: SalaryAnchor,
  anchorValue: number,
  workingDaysType: string,
  basicPercent: number,
  esicLimit: number,
  preserveBasic?: number | null,
): Pick<SalaryFieldValues, "grossSalary" | "dailyWage" | "basicSalary" | "esic"> {
  const days = getWorkingDaysCount(workingDaysType);
  const pct = Math.min(100, Math.max(0, basicPercent)) / 100;
  const keptBasic =
    preserveBasic !== undefined && preserveBasic !== null && preserveBasic > 0
      ? preserveBasic
      : null;
  let gross = 0;
  let daily = 0;
  let basic = 0;

  if (anchor === "gross") {
    gross = anchorValue;
    daily = days > 0 ? parseFloat((gross / days).toFixed(2)) : 0;
    basic = keptBasic ?? Math.round(gross * pct);
  } else if (anchor === "daily") {
    daily = anchorValue;
    gross = Math.round(daily * days);
    basic = keptBasic ?? Math.round(gross * pct);
  } else {
    basic = anchorValue;
    gross = pct > 0 ? Math.round(basic / pct) : 0;
    daily = days > 0 && gross > 0 ? parseFloat((gross / days).toFixed(2)) : 0;
  }

  return {
    grossSalary: gross,
    dailyWage: daily,
    basicSalary: basic,
    esic: computeEsic(gross, esicLimit),
  };
}

export function getAnchorValue(values: SalaryFieldValues, anchor: SalaryAnchor): number {
  if (anchor === "gross") return values.grossSalary || 0;
  if (anchor === "daily") return values.dailyWage || 0;
  return values.basicSalary || 0;
}

/** Guess the salary anchor for an existing employee record. */
export function inferSalaryAnchor(values: SalaryFieldValues): SalaryAnchor {
  if ((values.grossSalary || 0) > 0) return "gross";
  if ((values.dailyWage || 0) > 0) return "daily";
  if ((values.basicSalary || 0) > 0) return "basic";
  return "gross";
}

export function inferSalaryWageMode(
  source: Partial<SalaryFieldValues> & { salaryWageMode?: string },
): SalaryWageMode {
  if (source.salaryWageMode === "monthly" || source.salaryWageMode === "daily") {
    return source.salaryWageMode;
  }
  return inferSalaryAnchor(toSalaryFieldValues(source)) === "daily" ? "daily" : "monthly";
}

export function toSalaryFieldValues(
  source: Partial<SalaryFieldValues>,
  defaults?: Partial<SalaryFieldValues>,
): SalaryFieldValues {
  return {
    grossSalary: Number(source.grossSalary ?? defaults?.grossSalary ?? 0) || 0,
    dailyWage: Number(source.dailyWage ?? defaults?.dailyWage ?? 0) || 0,
    basicSalary: Number(source.basicSalary ?? defaults?.basicSalary ?? 0) || 0,
    workingDaysType:
      source.workingDaysType ?? defaults?.workingDaysType ?? "26 Days (Sun Off)",
    esic: normalizeEsicStatus(source.esic ?? defaults?.esic ?? ESIC_STATUS_NO) || ESIC_STATUS_NO,
  };
}

export function applyWageModeSwitch(
  current: SalaryFieldValues,
  newMode: SalaryWageMode,
  basicPercent: number,
  esicLimit: number,
): SalaryFieldValues {
  const basicSalaryManual =
    current.basicSalaryManual ?? inferBasicSalaryManual(current, basicPercent);
  const preservedBasic = basicSalaryManual ? current.basicSalary || 0 : null;
  const anchor = wageModeToAnchor(newMode);
  let anchorValue = getAnchorValue(current, anchor);

  if (anchorValue <= 0) {
    const fallbackAnchor = anchor === "gross" ? "daily" : "gross";
    const fallbackValue = getAnchorValue(current, fallbackAnchor);
    if (fallbackValue > 0) {
      const interim = deriveSalaryFromAnchor(
        fallbackAnchor,
        fallbackValue,
        current.workingDaysType,
        basicPercent,
        esicLimit,
        preservedBasic,
      );
      anchorValue = getAnchorValue(toSalaryFieldValues(interim), anchor);
    }
  }

  const derived = deriveSalaryFromAnchor(
    anchor,
    anchorValue,
    current.workingDaysType,
    basicPercent,
    esicLimit,
    preservedBasic,
  );

  return {
    ...current,
    ...derived,
    esic: current.esic,
    basicSalaryManual,
  };
}

/**
 * Apply a salary-field edit using the explicit monthly/daily wage mode.
 * - Monthly mode: gross is the source field; daily and basic are derived.
 * - Daily mode: daily is the source field; gross and basic are derived.
 * - Basic can always be overridden manually.
 * - Working-days changes recalculate derived fields from the active mode.
 */
export function applySalaryFieldChange(
  current: SalaryFieldValues,
  wageMode: SalaryWageMode,
  field: SalaryCascadeField,
  rawValue: string,
  basicPercent: number,
  esicLimit: number,
): { values: SalaryFieldValues; wageMode: SalaryWageMode } {
  const anchor = wageModeToAnchor(wageMode);
  let basicSalaryManual =
    current.basicSalaryManual ?? inferBasicSalaryManual(current, basicPercent);
  const numValue = Math.max(0, Number(rawValue) || 0);

  if (field === "basicSalary") {
    basicSalaryManual = numValue > 0;
  }

  const preservedBasic = basicSalaryManual
    ? (field === "basicSalary" ? numValue : current.basicSalary) || numValue || 0
    : null;

  if (field === "workingDaysType") {
    const cycle = rawValue || "26 Days (Sun Off)";
    const anchorValue = getAnchorValue(current, anchor);
    const derived = deriveSalaryFromAnchor(
      anchor,
      anchorValue,
      cycle,
      basicPercent,
      esicLimit,
      preservedBasic,
    );
    return {
      values: {
        ...current,
        workingDaysType: cycle,
        ...derived,
        esic: current.esic,
        basicSalaryManual,
      },
      wageMode,
    };
  }

  const editedAnchor = FIELD_TO_ANCHOR[field];

  if (editedAnchor === anchor) {
    const derived = deriveSalaryFromAnchor(
      anchor,
      numValue,
      current.workingDaysType,
      basicPercent,
      esicLimit,
      field === "basicSalary" ? null : preservedBasic,
    );
    return {
      values: {
        ...current,
        ...derived,
        esic: current.esic,
        basicSalaryManual,
      },
      wageMode,
    };
  }

  const updated: SalaryFieldValues = {
    ...current,
    basicSalaryManual,
  };
  if (field === "grossSalary") {
    updated.grossSalary = numValue;
  } else if (field === "dailyWage") {
    updated.dailyWage = numValue;
  } else {
    updated.basicSalary = numValue;
  }

  return { values: updated, wageMode };
}
