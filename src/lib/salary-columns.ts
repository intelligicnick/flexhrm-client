import { Employee } from "../types";
import {
  normalizeSkillCategory,
  prorateSalaryByAttendance,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  resolveLocationPtAmount,
} from "../utils";
import { safeNumber, getDaysInMonthStatic } from "./date-helpers";
import { isEmployeeExitedOnDayStatic } from "./employee-helpers";

export const getSalaryColumnValue = (
  emp: Employee,
  col: string,
  month: string,
  esicEligibilityLimit: number,
  attendanceDb?: any,
  locationComplianceMap: Record<string, boolean> = {},
  locationPtMap: Record<string, number> = {}
) => {
  let presents = 0;
  let daysInMonth = 30;
  
  if (attendanceDb && month) {
    daysInMonth = getDaysInMonthStatic(month);
    const monthData = attendanceDb[month] || {};
    const empData = monthData[emp.id] || {};
    for (let i = 1; i <= daysInMonth; i++) {
      if (isEmployeeExitedOnDayStatic(emp, month, i)) {
        continue;
      }
      if (empData[i] === "P") {
        presents++;
      }
    }
  }

  const rawGross = safeNumber(emp.grossSalary);
  const rawBasic = safeNumber(emp.basicSalary);
  const empMonthAttendance = attendanceDb && month ? (attendanceDb[month]?.[emp.id] || {}) : {};

  const gross = attendanceDb
    ? prorateSalaryByAttendance(rawGross, daysInMonth, presents, empMonthAttendance)
    : rawGross;
  const basic = attendanceDb
    ? prorateSalaryByAttendance(rawBasic, daysInMonth, presents, empMonthAttendance)
    : rawBasic;

  const isLocCompliant = emp.location ? !!locationComplianceMap[emp.location] : false;
  const isEmpCompliant = emp.complianceEnabled !== false;
  const isCompliant = isLocCompliant && isEmpCompliant;

  const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
    mode: emp.pfCalculationMode,
    isCompliant,
  });
  const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, emp.esic);
  const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
  const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
  const pt = calculateProfessionalTax(gross, {
    isCompliant,
    locationPtAmount: resolveLocationPtAmount(emp.location, locationPtMap),
  });
  
  const ledger = emp.monthlyLedger?.[month];
  const adv = ledger ? safeNumber(ledger.advance) : 0;
  const pen = ledger ? safeNumber(ledger.penalty) : 0;
  const uniform = ledger ? safeNumber(ledger.uniform) : 0;
  const food = ledger ? safeNumber(ledger.foodPerk) : 0;
  const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
  const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
  
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
    case "Total Salary":
      return rawGross;
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
      return isCompliant ? pt : "";
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
      return Math.round(Math.max(0, netPayableVal));
    case "Payment Status":
      return ledger?.paymentStatus || "Unpaid";
  }
};
