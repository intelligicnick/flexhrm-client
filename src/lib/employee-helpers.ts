import { Employee } from "../types";
import { MONTH_NAME_LIST } from "./date-helpers";

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
