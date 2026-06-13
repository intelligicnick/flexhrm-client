import { describe, it, expect } from "vitest";
import { parseSheetRows, analyzeHeaders, findHeaderIndex } from "./utils";
import { EXCEL_ROW_HEADERS } from "./types";

describe("excel parse trim safety", () => {
  it("handles header-only sheet", () => {
    expect(() => analyzeHeaders([EXCEL_ROW_HEADERS])).not.toThrow();
    expect(parseSheetRows([EXCEL_ROW_HEADERS])).toEqual([]);
  });

  it("handles undefined header cells via findHeaderIndex", () => {
    expect(() =>
      findHeaderIndex(["SR NO", undefined as unknown as string, "Location"], "Location"),
    ).not.toThrow();
  });

  it("parses one data row", () => {
    const row = new Array(EXCEL_ROW_HEADERS.length).fill("");
    row[0] = 1;
    row[1] = "EMP001";
    row[2] = "Test User";
    const rows = [EXCEL_ROW_HEADERS, row];
    expect(() => parseSheetRows(rows)).not.toThrow();
    expect(parseSheetRows(rows).length).toBe(1);
  });
});
