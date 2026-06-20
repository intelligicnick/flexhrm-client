import { Employee } from "../types";
import { MONTH_NAME_LIST } from "./date-helpers";
import { inferSalaryWageMode } from "./salary-calc";

export type EmployeeWageModeRowVariant = "daily" | "monthly";

export function resolveEmployeeWageModeRowVariant(
  emp: Pick<Employee, "salaryWageMode" | "grossSalary" | "dailyWage" | "basicSalary" | "workingDaysType">,
): EmployeeWageModeRowVariant {
  return inferSalaryWageMode(emp) === "daily" ? "daily" : "monthly";
}

export function getEmployeeWageModeRowClassName(
  variant: EmployeeWageModeRowVariant,
  options?: { selected?: boolean; hasDraftChanges?: boolean },
): string {
  if (options?.hasDraftChanges) {
    return "bg-amber-50/60 hover:bg-amber-100/70";
  }
  if (variant === "daily") {
    return options?.selected
      ? "bg-sky-100/90 hover:bg-sky-100 ring-1 ring-inset ring-sky-200"
      : "bg-sky-50/80 hover:bg-sky-100/90";
  }
  return options?.selected
    ? "bg-emerald-100/80 hover:bg-emerald-100 ring-1 ring-inset ring-emerald-200"
    : "bg-emerald-50/60 hover:bg-emerald-100/70";
}

export function getEmployeeWageModeStickyCellClassName(
  variant: EmployeeWageModeRowVariant,
  options?: { selected?: boolean; hasDraftChanges?: boolean },
): string {
  if (options?.hasDraftChanges) {
    return "bg-amber-50 group-hover:bg-amber-100";
  }
  if (variant === "daily") {
    return options?.selected
      ? "bg-sky-100 group-hover:bg-sky-100"
      : "bg-sky-50 group-hover:bg-sky-100";
  }
  return options?.selected
    ? "bg-emerald-100 group-hover:bg-emerald-100"
    : "bg-emerald-50 group-hover:bg-emerald-100";
}

export const isEmployeeExitedGeneral = (emp: Employee) => {
  if (emp.exitDate && emp.exitDate.trim() !== "") return true;
  if (emp.customFields && Array.isArray(emp.customFields)) {
    const exitField = emp.customFields.find(f => 
      f.name.toLowerCase().includes("exit") || 
      f.name.toLowerCase().includes("resignation") || 
      f.name.toLowerCase().includes("leaving_date") ||
      f.name.toLowerCase().includes("leaving date")
    );
    if (exitField && exitField.value && exitField.value.trim() !== "") return true;
  }
  return false;
};

export const isEmployeeExitedOnDayStatic = (emp: Employee, monthStr: string, dayNum: number) => {
  let exitDateVal = "";
  if ((emp as any).exitDate) {
    exitDateVal = (emp as any).exitDate;
  } else if (emp.customFields && Array.isArray(emp.customFields)) {
    const exitField = emp.customFields.find(f => 
      f.name.toLowerCase().includes("exit") || 
      f.name.toLowerCase().includes("resignation") || 
      f.name.toLowerCase().includes("leaving_date") ||
      f.name.toLowerCase().includes("leaving date")
    );
    if (exitField) {
      exitDateVal = exitField.value || "";
    }
  }
  
  if (!exitDateVal || exitDateVal.trim() === "") return false;
  
  const exitParts = exitDateVal.split("-");
  if (exitParts.length !== 3) return false;
  const exitYear = parseInt(exitParts[0], 10);
  const exitMonth = parseInt(exitParts[1], 10);
  const exitDay = parseInt(exitParts[2], 10);
  
  const monthParts = monthStr.split(" ");
  if (monthParts.length !== 2) return false;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthIndex = monthNames.indexOf(monthParts[0]);
  const targetYear = parseInt(monthParts[1], 10);
  
  if (targetMonthIndex === -1 || isNaN(targetYear)) return false;
  const targetMonthNum = targetMonthIndex + 1;
  
  if (targetYear > exitYear) return true;
  if (targetYear === exitYear && targetMonthNum > exitMonth) return true;
  if (targetYear === exitYear && targetMonthNum === exitMonth && dayNum > exitDay) return true;
  
  return false;
};

export const isEmployeeExitedForMonth = (emp: Employee, monthStr: string) => {
  let exitDateVal = "";
  if ((emp as any).exitDate) {
    exitDateVal = (emp as any).exitDate;
  } else if (emp.customFields && Array.isArray(emp.customFields)) {
    const exitField = emp.customFields.find(f => 
      f.name.toLowerCase().includes("exit") || 
      f.name.toLowerCase().includes("resignation") || 
      f.name.toLowerCase().includes("leaving_date") ||
      f.name.toLowerCase().includes("leaving date")
    );
    if (exitField) {
      exitDateVal = exitField.value || "";
    }
  }
  
  if (!exitDateVal || exitDateVal.trim() === "") return false;
  
  const exitParts = exitDateVal.split("-");
  if (exitParts.length !== 3) return false;
  const exitYear = parseInt(exitParts[0], 10);
  const exitMonth = parseInt(exitParts[1], 10);
  
  const monthParts = monthStr.split(" ");
  if (monthParts.length !== 2) return false;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthIndex = monthNames.indexOf(monthParts[0]);
  const targetYear = parseInt(monthParts[1], 10);
  
  if (targetMonthIndex === -1 || isNaN(targetYear)) return false;
  const targetMonthNum = targetMonthIndex + 1;
  
  if (targetYear > exitYear) return true;
  if (targetYear === exitYear && targetMonthNum > exitMonth) return true;
  
  return false;
};
