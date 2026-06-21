import { Employee } from "../types";
import { getMonthLedger } from "./ledger-helpers";
import {
  normalizeSkillCategory,
  computeProratedGrossAndBasic,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  isPfEsicCompliant,
  isProfessionalTaxApplicable,
  resolveFullMonthSalary,
  resolveEmployeeDailyWage,
} from "../utils";
import { safeNumber, getDaysInMonthStatic } from "./date-helpers";
import { isEmployeeExitedOnDayStatic } from "./employee-helpers";
import { countMonthAttendance } from "./attendance-helpers";

export { resolveEmployeeDailyWage } from "../utils";

export const getSalaryColumnValue = (
  emp: Employee,
  col: string,
  month: string,
  esicEligibilityLimit: number,
  attendanceDb?: any,
  locationComplianceMap: Record<string, boolean> = {},
  locationPtEnabledMap: Record<string, boolean> = {},
) => {
  let presents = 0;

  if (attendanceDb && month) {
    const daysInMonth = getDaysInMonthStatic(month);
    const monthData = attendanceDb[month] || {};
    const empData = monthData[emp.id] || {};
    presents = countMonthAttendance(
      empData,
      daysInMonth,
      (day) => isEmployeeExitedOnDayStatic(emp, month, day),
      { workingDaysType: emp.workingDaysType, monthStr: month },
    ).presents;
  }

  const rawGross = safeNumber(emp.grossSalary);
  const rawBasic = safeNumber(emp.basicSalary);
  const empMonthAttendance = attendanceDb && month ? (attendanceDb[month]?.[emp.id] || {}) : {};

  const { gross, basic } = attendanceDb && month
    ? computeProratedGrossAndBasic(emp, presents, empMonthAttendance, month)
    : { gross: rawGross, basic: rawBasic };

  const isCompliant = isPfEsicCompliant(emp, locationComplianceMap);
  const isPtEnabled = isProfessionalTaxApplicable(emp, locationPtEnabledMap);

  const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
    mode: emp.pfCalculationMode,
    isCompliant,
  });
  const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, emp.esic);
  const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
  const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
  const pt = calculateProfessionalTax(gross, {
    isPtEnabled,
    gender: emp.gender,
    month,
  });
  
  const ledger = getMonthLedger(emp, month);
  const adv = ledger.advance;
  const pen = ledger.penalty;
  const uniform = ledger.uniform;
  const food = ledger.foodPerk;
  const acc = ledger.accommodationPerk;
  const conv = ledger.conveyancePerk;
  
  const netSalaryVal = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
  const totalDeductionsVal = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
  const netPayableVal = safeNumber(netSalaryVal) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);

  switch (col) {
    case "Employee Code":
      return emp.employeeCode;
    case "Employee Name":
      return emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "";
    case "Skill Category":
      return normalizeSkillCategory(emp.skillCategory) || "";
    case "Job Role":
      return emp.role || "";
    case "Present Days":
      return attendanceDb ? presents : 0;
    case "Daily Wage":
      return resolveEmployeeDailyWage(emp);
    case "Total Salary":
      return month ? resolveFullMonthSalary(emp, month) : rawGross;
    case "Gross Salary (Monthly)":
      return gross;
    case "Basic Salary":
      return basic;
    case "Employer PF (13%)":
      return isCompliant ? Math.round(erPf) : "";
    case "Employer ESIC (3.25%)":
      return isCompliant ? Math.round(erEsic) : "";
    case "Employee PF (12%)":
      return isCompliant ? Math.round(empPf) : "";
    case "Employee ESIC (0.75%)":
      return isCompliant ? Math.round(empEsic) : "";
    case "Professional Tax (PT)":
      return isPtEnabled ? pt : "";
    case "Advance Balance":
      return adv;
    case "Uniform Deductions":
      return uniform;
    case "Penalty Balance":
      return pen;
    case "Net Salary":
      return Math.round(netSalaryVal);
    case "Total Deductions":
      return Math.round(totalDeductionsVal);
    case "Food Perk":
      return food;
    case "Accommodation Perk":
      return acc;
    case "Conveyance Perk":
      return conv;
    case "Net Payable":
      return attendanceDb && presents <= 0 ? 0 : Math.round(Math.max(0, netPayableVal));
    case "Payment Status":
      return ledger?.paymentStatus || "Unpaid";
  }
};
