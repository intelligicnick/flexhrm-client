import { describe, it, expect } from "vitest";
import {
  buildLabeledGrandTotalRow,
  buildSalaryGrandTotalRow,
  sumExportRows,
} from "./export-totals";

describe("export totals helpers", () => {
  it("sums numeric columns and labels the grand total row", () => {
    const rows = [
      ["A1", "Alice", 100, 10],
      ["A2", "Bob", 200, 5],
    ];
    const totals = sumExportRows(rows, [2, 3]);
    expect(totals[2]).toBe(300);
    expect(totals[3]).toBe(15);
    expect(buildLabeledGrandTotalRow(4, 1, totals)).toEqual(["", "GRAND TOTAL", 300, 15]);
  });

  it("builds salary grand total rows for known payroll columns", () => {
    const rows = [
      ["IK01", "Dheeraj", 26, 16392, 8196],
      ["IK02", "Ravi", 24, 15000, 7500],
    ];
    const columns = ["Employee Code", "Employee Name", "Present Days", "Gross Salary (Monthly)", "Basic Salary"];
    expect(buildSalaryGrandTotalRow(rows, columns, 0)).toEqual([
      "GRAND TOTAL",
      "",
      50,
      31392,
      15696,
    ]);
  });
});
