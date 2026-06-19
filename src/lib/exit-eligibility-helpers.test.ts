import { describe, expect, it } from "vitest";
import {
  getLastNMonthKeys,
  monthKeySortValue,
  pickLatestMonthKey,
  formatLastPresentDate,
} from "./exit-eligibility-helpers";

describe("exit-eligibility-helpers", () => {
  it("returns last N month keys ending at reference month", () => {
    expect(getLastNMonthKeys("June 2026", 3)).toEqual([
      "April 2026",
      "May 2026",
      "June 2026",
    ]);
    expect(getLastNMonthKeys("January 2026", 2)).toEqual([
      "December 2025",
      "January 2026",
    ]);
  });

  it("sorts and picks latest month key", () => {
    expect(monthKeySortValue("June 2026")).toBeGreaterThan(monthKeySortValue("May 2026"));
    expect(pickLatestMonthKey(["April 2026", "June 2026", "May 2026"])).toBe("June 2026");
  });

  it("formats last present date", () => {
    expect(formatLastPresentDate(null)).toBe("Never marked present");
    expect(formatLastPresentDate("2026-03-15")).toMatch(/15/);
  });
});
