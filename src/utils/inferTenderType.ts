import type { TenderType } from "../types";

export function inferTenderTypeFromCategory(category: string): TenderType {
  const lower = category.toLowerCase().trim();

  if (
    lower.startsWith("manpower") ||
    lower.includes("facility") ||
    lower.includes("security") ||
    lower.includes("hiring of sanitation") ||
    lower.includes("cleaning") ||
    lower.includes("sanitation")
  ) {
    return "manpower";
  }

  if (
    lower.includes("cab") ||
    lower.includes("taxi") ||
    lower.includes("travel") ||
    lower.includes("ticket") ||
    lower.includes("passage")
  ) {
    return "travel";
  }

  return "manpower";
}
