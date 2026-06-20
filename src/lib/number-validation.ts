const NUMERIC_CLEANUP = /[^0-9.-]/g;

export function parseNonNegativeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  const cleaned = String(value).trim().replace(NUMERIC_CLEANUP, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function validateOptionalAmountString(
  value: string | undefined | null,
  fieldLabel: string,
): string | null {
  if (value === undefined || value === null || value.trim() === "") return null;

  const cleaned = value.trim().replace(NUMERIC_CLEANUP, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") {
    return `${fieldLabel} must be a valid number.`;
  }

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return `${fieldLabel} must be a valid number.`;
  }
  if (parsed < 0) {
    return `${fieldLabel} cannot be negative.`;
  }
  return null;
}

export function validateNonNegativeNumberField(
  value: unknown,
  fieldLabel: string,
  options?: { required?: boolean },
): string | null {
  if (value === undefined || value === null || value === "") {
    return options?.required ? `${fieldLabel} is required.` : null;
  }

  const cleaned = String(value).trim().replace(NUMERIC_CLEANUP, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") {
    return `${fieldLabel} must be a valid number.`;
  }

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return `${fieldLabel} must be a valid number.`;
  }
  if (parsed < 0) {
    return `${fieldLabel} cannot be negative.`;
  }
  return null;
}

export function clampNonNegativeInput(value: string): string {
  if (value === "" || value === "-") return value === "-" ? "" : value;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed < 0 ? "0" : value;
}

export const LEDGER_AMOUNT_FIELDS = [
  "advance",
  "penalty",
  "uniform",
  "foodPerk",
  "accommodationPerk",
  "conveyancePerk",
] as const;

const LEDGER_FIELD_LABELS: Record<(typeof LEDGER_AMOUNT_FIELDS)[number], string> = {
  advance: "Advance",
  penalty: "Penalty",
  uniform: "Uniform",
  foodPerk: "Food perk",
  accommodationPerk: "Accommodation perk",
  conveyancePerk: "Conveyance perk",
};

export function validateLedgerEntries(
  entries: Partial<Record<(typeof LEDGER_AMOUNT_FIELDS)[number], string>>,
): string | null {
  for (const field of LEDGER_AMOUNT_FIELDS) {
    const err = validateNonNegativeNumberField(
      entries[field],
      LEDGER_FIELD_LABELS[field],
    );
    if (err) return err;
  }
  return null;
}
