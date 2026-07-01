import ExcelJS from "exceljs";
import { EXCEL_ROW_HEADERS } from "../types";

export interface EmployeeOnboardingTemplateOptions {
  availableLocations?: string[];
  availableRoles?: string[];
  isSample?: boolean;
  basicSalaryPercent?: number;
}

function excelColumnLetter(col: number): string {
  let n = col;
  let letter = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function workingDaysExcelExpr(cellRef: string): string {
  return `IF(${cellRef}="","",IF(ISNUMBER(SEARCH("30",${cellRef})),30,IF(ISNUMBER(SEARCH("22",${cellRef})),22,26)))`;
}

function applySalaryFormulas(
  ws: ExcelJS.Worksheet,
  row: number,
  headers: readonly string[],
  basicSalaryPercent: number,
): void {
  const workingDaysCol = headers.indexOf("Working Days Cycle") + 1;
  const wageModeCol = headers.indexOf("Salary Wage Mode") + 1;
  const dailyCol = headers.indexOf("Daily Wage") + 1;
  const grossCol = headers.indexOf("Gross Salary***") + 1;
  const basicCol = headers.indexOf("Basic Salary***") + 1;

  if ([workingDaysCol, wageModeCol, dailyCol, grossCol, basicCol].some((col) => col <= 0)) {
    return;
  }

  const workingDaysRef = `${excelColumnLetter(workingDaysCol)}${row}`;
  const wageModeRef = `${excelColumnLetter(wageModeCol)}${row}`;
  const dailyRef = `${excelColumnLetter(dailyCol)}${row}`;
  const grossRef = `${excelColumnLetter(grossCol)}${row}`;
  const daysExpr = workingDaysExcelExpr(workingDaysRef);
  const basicRatio = basicSalaryPercent / 100;
  const hasDays = `${daysExpr}<>""`;
  const isMonthly = `LOWER(${wageModeRef})="monthly"`;
  const isDaily = `LOWER(${wageModeRef})="daily"`;
  const hasGross = `AND(ISNUMBER(${grossRef}),${grossRef}>0)`;
  const hasDaily = `AND(ISNUMBER(${dailyRef}),${dailyRef}>0)`;

  ws.getCell(row, dailyCol).value = {
    formula: `IF(${wageModeRef}="","",IF(${isMonthly},IF(AND(${hasGross},${hasDays}),ROUND(${grossRef}/${daysExpr},2),""),IF(${isDaily},IF(${hasDaily},${dailyRef},""),"")))`,
  };

  ws.getCell(row, grossCol).value = {
    formula: `IF(${wageModeRef}="","",IF(${isDaily},IF(AND(${hasDaily},${hasDays}),ROUND(${dailyRef}*${daysExpr},0),""),IF(${isMonthly},IF(${hasGross},${grossRef},""),"")))`,
  };

  ws.getCell(row, basicCol).value = {
    formula: `IF(AND(${hasGross}),ROUND(${grossRef}*${basicRatio},0),IF(AND(${hasDaily},${hasDays}),ROUND(${dailyRef}*${daysExpr}*${basicRatio},0),""))`,
  };
}

export async function buildEmployeeOnboardingWorkbook(
  options: EmployeeOnboardingTemplateOptions = {},
): Promise<ExcelJS.Workbook> {
  const {
    availableLocations = [],
    availableRoles = [],
    isSample = false,
    basicSalaryPercent = 50,
  } = options;
  const headers = EXCEL_ROW_HEADERS;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Onboarding Template");

  ws.addRow(headers);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 10 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFF791A" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 25;

  const registryLocations = Array.from(new Set(availableLocations)).filter(Boolean);
  const registryRoles = Array.from(new Set(availableRoles)).filter(Boolean);

  if (isSample) {
    ws.addRow([
      1,
      "EMP505",
      "SURESH PRASAD SHARMA",
      registryLocations[0] || "",
      "Skilled",
      registryRoles[0] || "",
      "26 Days (Sun Off)",
      "monthly",
      1076.92,
      28000,
      14000,
      "No",
      "100987654399",
      "998877665544",
      "SURESH PRASAD SHARMA",
      "ABCDE1234E",
      "SURESH PRASAD SHARMA",
      "302910243689",
      "PUNB0121400",
      "SURESH PRASAD SHARMA",
      "MUKESH SHARMA",
      "",
      "2025-06-01",
      "1990-10-15",
      "Male",
      "Married",
      "9876543210",
      "",
      "",
      "Lane 5, Dwarka Sector 12, New Delhi",
      "Lane 5, Dwarka Sector 12, New Delhi",
      "REKHA SHARMA",
      "1992-04-12",
      "Wife",
      "REKHA SHARMA",
      "1992-04-12",
      "Wife",
      "",
      "",
      "",
      "",
      "",
      "",
      "9876543211",
      "9876543212",
      "9876543213",
      "9876543214",
      "9876543215",
      "Yes",
      "No",
      "ceiling_15000",
      "",
      "",
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
  }

  const locFormula = registryLocations.length > 0 ? `"${registryLocations.join(",")}"` : null;
  const roleFormula = registryRoles.length > 0 ? `"${registryRoles.join(",")}"` : null;
  const genderFormula = '"Male,Female,Other"';
  const maritalFormula = '"Single,Married,Divorced,Widowed"';
  const esicFormula = '"Yes,No"';
  const skillFormula = '"Highly Skilled,Skilled,Semi Skilled,Unskilled"';
  const yesNoFormula = '"Yes,No"';
  const pfModeFormula = '"gross,ceiling_15000"';
  const wageModeFormula = '"monthly,daily"';

  const locationCol = headers.indexOf("Location") + 1;
  const skillCol = headers.indexOf("Skill Category") + 1;
  const roleCol = headers.indexOf("Job Role") + 1;
  const workingDaysCol = headers.indexOf("Working Days Cycle") + 1;
  const esicCol = headers.indexOf("ESIC") + 1;
  const genderCol = headers.indexOf("GENDER **") + 1;
  const maritalCol = headers.indexOf("MARITAL STATUS **") + 1;
  const complianceCol = headers.indexOf("PF/ESIC Compliance **") + 1;
  const ptCol = headers.indexOf("Professional Tax (PT) **") + 1;
  const pfModeCol = headers.indexOf("PF Calculation Mode") + 1;
  const wageModeCol = headers.indexOf("Salary Wage Mode") + 1;

  for (let i = 2; i <= 200; i++) {
    if (!isSample) {
      applySalaryFormulas(ws, i, headers, basicSalaryPercent);
    }

    if (locFormula && locationCol > 0) {
      ws.getCell(i, locationCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [locFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Location Option",
        error:
          "Please select an office branch from the dropdown list or register a brand new location in the admin Configuration tab first!",
      };
    }

    if (skillCol > 0) {
      ws.getCell(i, skillCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [skillFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Skill Category",
        error: "Please select either Highly Skilled, Skilled, Semi Skilled, or Unskilled.",
      };
    }

    if (roleFormula && roleCol > 0) {
      ws.getCell(i, roleCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [roleFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Job Role",
        error:
          "Please select a registered job role from the dropdown list or register a new job role in the admin Configuration panel first!",
      };
    }

    if (workingDaysCol > 0) {
      ws.getCell(i, workingDaysCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"22 Days (Sat/Sun Off),26 Days (Sun Off),30/31 Days (No Off)"'],
        showErrorMessage: true,
        errorTitle: "Invalid Working Days Cycle",
        error: "Allowed values: 22 Days (Sat/Sun Off), 26 Days (Sun Off), or 30/31 Days (No Off).",
      };
    }

    if (genderCol > 0) {
      ws.getCell(i, genderCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [genderFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Gender Input",
        error: "Please select either Male, Female or Other as per documentation.",
      };
    }

    if (maritalCol > 0) {
      ws.getCell(i, maritalCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [maritalFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Marital Option",
        error: "Allowed values: Single, Married, Divorced, or Widowed.",
      };
    }

    if (esicCol > 0) {
      ws.getCell(i, esicCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [esicFormula],
        showErrorMessage: true,
        errorTitle: "Invalid ESIC Answer",
        error: "Allowed answers: Yes or No.",
      };
    }

    if (complianceCol > 0) {
      ws.getCell(i, complianceCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [yesNoFormula],
        showErrorMessage: true,
        errorTitle: "Invalid PF/ESIC Compliance",
        error: "Allowed answers: Yes or No.",
      };
    }

    if (ptCol > 0) {
      ws.getCell(i, ptCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [yesNoFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Professional Tax Setting",
        error: "Allowed answers: Yes or No.",
      };
    }

    if (pfModeCol > 0) {
      ws.getCell(i, pfModeCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [pfModeFormula],
        showErrorMessage: true,
        errorTitle: "Invalid PF Calculation Mode",
        error: "Allowed values: gross or ceiling_15000.",
      };
    }

    if (wageModeCol > 0) {
      ws.getCell(i, wageModeCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [wageModeFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Salary Wage Mode",
        error: "Allowed values: monthly or daily. Monthly: enter Gross Salary. Daily: enter Daily Wage.",
      };
    }
  }

  const wideColumnHeaders = new Set([
    "EMPLOYEE NAME AS PER AADHAR ***",
    "Location",
    "Gross Salary***",
    "UAN",
    "NAME AS PER AADHAR **",
    "Present Address**",
    "Permanent Address**",
  ]);

  ws.columns.forEach((col, idx) => {
    const header = headers[idx];
    if (header === "Employees Code **") {
      col.width = 24;
    } else if (header && wideColumnHeaders.has(header)) {
      col.width = 26;
    } else {
      col.width = 16;
    }
  });

  return workbook;
}

export async function downloadEmployeeOnboardingTemplate(
  options: EmployeeOnboardingTemplateOptions = {},
): Promise<void> {
  const isSample = !!options.isSample;

  try {
    const workbook = await buildEmployeeOnboardingWorkbook(options);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      isSample ? "employee_filled_sample.xlsx" : "employee_blank_template.xlsx",
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DOWNLOAD_TEMPLATE",
        target: isSample
          ? "Sample Excel Template: Downloaded pre-filled employee onboarding spreadsheet containing reference columns & in-cell dropdown validation rules."
          : "Blank Excel Template: Downloaded empty employee onboarding spreadsheet containing matching structure schemas & in-cell validation formulas.",
        details: { templateType: isSample ? "Sample Excel" : "Blank Excel" },
      }),
    }).catch((err) => console.error("Failed to log template download event", err));
  } catch (err) {
    console.error("Error creating Excel validation templates", err);
    throw err;
  }
}
