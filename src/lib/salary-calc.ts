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

export function getWorkingDaysCount(cycle: string | undefined): number {
  if (!cycle) return 26;
  if (cycle.includes("30") || cycle.includes("31")) return 30;
  const match = cycle.match(/(\d+)\s*Days?/i);
  if (match) return parseInt(match[1], 10);
  if (cycle.includes("22")) return 22;
  if (cycle.includes("26")) return 26;
  return 26;
}

export function computeEsic(gross: number, esicLimit: number): string {
  return gross > 0 && gross <= esicLimit ? "Yes" : "No";
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
): Pick<SalaryFieldValues, "grossSalary" | "dailyWage" | "basicSalary" | "esic"> {
  const days = getWorkingDaysCount(workingDaysType);
  const pct = Math.min(100, Math.max(0, basicPercent)) / 100;
  let gross = 0;
  let daily = 0;
  let basic = 0;

  if (anchor === "gross") {
    gross = anchorValue;
    daily = days > 0 ? parseFloat((gross / days).toFixed(2)) : 0;
    basic = Math.round(gross * pct);
  } else if (anchor === "daily") {
    daily = anchorValue;
    gross = Math.round(daily * days);
    basic = Math.round(gross * pct);
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
    esic: source.esic ?? defaults?.esic ?? "No",
  };
}

export function applyWageModeSwitch(
  current: SalaryFieldValues,
  newMode: SalaryWageMode,
  basicPercent: number,
  esicLimit: number,
): SalaryFieldValues {
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
      );
      anchorValue = getAnchorValue(interim, anchor);
    }
  }

  const derived = deriveSalaryFromAnchor(
    anchor,
    anchorValue,
    current.workingDaysType,
    basicPercent,
    esicLimit,
  );

  return { ...current, ...derived, esic: current.esic };
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

  if (field === "workingDaysType") {
    const cycle = rawValue || "26 Days (Sun Off)";
    const anchorValue = getAnchorValue(current, anchor);
    const derived = deriveSalaryFromAnchor(
      anchor,
      anchorValue,
      cycle,
      basicPercent,
      esicLimit,
    );
    return {
      values: {
        ...current,
        workingDaysType: cycle,
        ...derived,
        esic: current.esic,
      },
      wageMode,
    };
  }

  const editedAnchor = FIELD_TO_ANCHOR[field];
  const numValue = Math.max(0, Number(rawValue) || 0);

  if (editedAnchor === anchor) {
    const derived = deriveSalaryFromAnchor(
      anchor,
      numValue,
      current.workingDaysType,
      basicPercent,
      esicLimit,
    );
    return {
      values: { ...current, ...derived, esic: current.esic },
      wageMode,
    };
  }

  const updated = { ...current };
  if (field === "grossSalary") {
    updated.grossSalary = numValue;
  } else if (field === "dailyWage") {
    updated.dailyWage = numValue;
  } else {
    updated.basicSalary = numValue;
  }

  return { values: updated, wageMode };
}
