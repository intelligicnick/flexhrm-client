/** Column labels whose export values should be summed in grand-total rows. */
export const SALARY_SUM_COLUMN_LABELS = new Set([
  "Present Days",
  "Daily Wage",
  "Total Salary",
  "Gross Salary (Monthly)",
  "Basic Salary",
  "Employer PF (13%)",
  "Employer ESIC (3.25%)",
  "Employee PF (12%)",
  "Employee ESIC (0.75%)",
  "Professional Tax (PT)",
  "Advance Balance",
  "Uniform Deductions",
  "Penalty Balance",
  "Total Deductions",
  "Net Salary",
  "Food Perk",
  "Accommodation Perk",
  "Conveyance Perk",
  "Net Payable",
]);

export function isSummableExportValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sumExportRows(
  rows: unknown[][],
  columnIndices: number[],
): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const colIdx of columnIndices) {
    totals[colIdx] = 0;
    for (const row of rows) {
      const value = row[colIdx];
      if (isSummableExportValue(value)) {
        totals[colIdx] += value;
      }
    }
  }
  return totals;
}

export function buildLabeledGrandTotalRow(
  columnCount: number,
  labelColumnIndex: number,
  totalsByColumn: Record<number, number>,
  label = "GRAND TOTAL",
): (string | number)[] {
  const row: (string | number)[] = Array.from({ length: columnCount }, () => "");
  row[labelColumnIndex] = label;
  for (const [colIdx, total] of Object.entries(totalsByColumn)) {
    row[Number(colIdx)] = Math.round(total);
  }
  return row;
}

export function getSalarySummableColumnIndices(columns: string[]): number[] {
  return columns
    .map((col, index) => (SALARY_SUM_COLUMN_LABELS.has(col) ? index : -1))
    .filter((index) => index >= 0);
}

export function buildSalaryGrandTotalRow(
  rows: unknown[][],
  columns: string[],
  labelColumnIndex = 0,
): (string | number)[] {
  const sumIndices = getSalarySummableColumnIndices(columns);
  const totals = sumExportRows(rows, sumIndices);
  return buildLabeledGrandTotalRow(columns.length, labelColumnIndex, totals);
}
