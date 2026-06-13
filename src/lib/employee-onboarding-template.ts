import ExcelJS from "exceljs";
import { EXCEL_ROW_HEADERS } from "../types";

export interface EmployeeOnboardingTemplateOptions {
  availableLocations?: string[];
  availableRoles?: string[];
  isSample?: boolean;
}

export async function buildEmployeeOnboardingWorkbook(
  options: EmployeeOnboardingTemplateOptions = {},
): Promise<ExcelJS.Workbook> {
  const { availableLocations = [], availableRoles = [], isSample = false } = options;
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
      1076.92,
      "9876543211",
      "9876543212",
      "9876543213",
      "9876543214",
      "9876543215",
    ]);
  }

  const locFormula = registryLocations.length > 0 ? `"${registryLocations.join(",")}"` : null;
  const roleFormula = registryRoles.length > 0 ? `"${registryRoles.join(",")}"` : null;
  const genderFormula = '"Male,Female,Other"';
  const maritalFormula = '"Single,Married,Divorced,Widowed"';
  const esicFormula = '"Yes,No"';
  const skillFormula = '"Highly Skilled,Skilled,Semi Skilled,Unskilled"';

  for (let i = 2; i <= 200; i++) {
    if (locFormula) {
      ws.getCell(i, 4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [locFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Location Option",
        error:
          "Please select an office branch from the dropdown list or register a brand new location in the admin Configuration tab first!",
      };
    }

    ws.getCell(i, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [skillFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Skill Category",
      error: "Please select either Highly Skilled, Skilled, Semi Skilled, or Unskilled.",
    };

    if (roleFormula) {
      ws.getCell(i, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [roleFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Job Role",
        error:
          "Please select a registered job role from the dropdown list or register a new job role in the admin Configuration panel first!",
      };
    }

    ws.getCell(i, 7).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"22 Days (Sat/Sun Off),26 Days (Sun Off),30/31 Days (No Off)"'],
      showErrorMessage: true,
      errorTitle: "Invalid Working Days Cycle",
      error: "Allowed values: 22 Days (Sat/Sun Off), 26 Days (Sun Off), or 30/31 Days (No Off).",
    };

    ws.getCell(i, 23).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [genderFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Gender Input",
      error: "Please select either Male, Female or Other as per documentation.",
    };

    ws.getCell(i, 24).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [maritalFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Marital Option",
      error: "Allowed values: Single, Married, Divorced, or Widowed.",
    };

    ws.getCell(i, 10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [esicFormula],
      showErrorMessage: true,
      errorTitle: "Invalid ESIC Answer",
      error: "Allowed answers: Yes or No.",
    };
  }

  ws.columns.forEach((col, idx) => {
    if (idx === 2) {
      col.width = 24;
    } else if (idx === 3 || idx === 9 || idx === 11 || idx === 14 || idx === 24 || idx === 25) {
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
