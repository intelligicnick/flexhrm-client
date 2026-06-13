export const HRMS_PAYROLL_CONFIG_KEY = "hrms_payroll_config";

export type PayrollConfig = {
  esicEligibilityLimit: number;
  basicSalaryPercentage: number;
  companyBranch: string;
};

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  esicEligibilityLimit: 21000,
  basicSalaryPercentage: 50,
  companyBranch: "Corporate HQ, Mumbai",
};

export const BASIC_SALARY_OPTIONS = [40, 45, 50, 55, 60] as const;

export function loadPayrollConfig(): PayrollConfig {
  if (typeof window === "undefined") return { ...DEFAULT_PAYROLL_CONFIG };
  try {
    const saved = localStorage.getItem(HRMS_PAYROLL_CONFIG_KEY);
    if (!saved) return { ...DEFAULT_PAYROLL_CONFIG };
    const parsed = JSON.parse(saved);
    const limit = Number(parsed.esicEligibilityLimit);
    const basic = Number(parsed.basicSalaryPercentage);
    return {
      esicEligibilityLimit: Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_PAYROLL_CONFIG.esicEligibilityLimit,
      basicSalaryPercentage: Number.isFinite(basic) && basic > 0 && basic <= 100
        ? basic
        : DEFAULT_PAYROLL_CONFIG.basicSalaryPercentage,
      companyBranch: String(parsed.companyBranch || DEFAULT_PAYROLL_CONFIG.companyBranch).trim()
        || DEFAULT_PAYROLL_CONFIG.companyBranch,
    };
  } catch {
    return { ...DEFAULT_PAYROLL_CONFIG };
  }
}

export function savePayrollConfig(config: PayrollConfig): void {
  localStorage.setItem(HRMS_PAYROLL_CONFIG_KEY, JSON.stringify(config));
}

export function validatePayrollConfig(config: PayrollConfig): string | null {
  if (!Number.isFinite(config.esicEligibilityLimit) || config.esicEligibilityLimit < 0) {
    return "ESIC ceiling must be a non-negative number.";
  }
  if (config.esicEligibilityLimit > 100000) {
    return "ESIC ceiling looks unusually high. Please verify the amount.";
  }
  if (!BASIC_SALARY_OPTIONS.includes(config.basicSalaryPercentage as (typeof BASIC_SALARY_OPTIONS)[number])) {
    return "Select a valid basic salary percentage.";
  }
  if (!config.companyBranch.trim()) {
    return "Default branch is required for new employee registration.";
  }
  return null;
}
