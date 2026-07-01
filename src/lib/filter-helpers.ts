export function matchesMultiSelectFilter(
  value: string | undefined,
  filters: string[],
): boolean {
  if (filters.length === 0) return true;
  const normalized = (value || "").trim().toLowerCase();
  return filters.some((filter) => filter.trim().toLowerCase() === normalized);
}

export function formatMultiSelectSummary(
  selected: string[],
  allLabel: string,
): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
}

export function formatMultiSelectExportLabel(
  selected: string[],
  allLabel: string,
): string {
  if (selected.length === 0) return allLabel;
  return selected.join(", ");
}

export function toggleMultiSelectValue(
  selected: string[],
  option: string,
): string[] {
  const exists = selected.some(
    (value) => value.toLowerCase() === option.toLowerCase(),
  );
  if (exists) {
    return selected.filter(
      (value) => value.toLowerCase() !== option.toLowerCase(),
    );
  }
  return [...selected, option];
}
