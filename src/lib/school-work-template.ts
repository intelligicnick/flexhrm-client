import ExcelJS from "exceljs";
import {
  SCHOOL_EXCEL_ROW_HEADERS,
  SchoolBlock,
  SchoolDistrict,
} from "../types";
import { getBlocksForDistrictName } from "./school-work-helpers";

const TEMPLATE_ROW_COUNT = 200;
const LISTS_SHEET = "Lists";

export interface SchoolWorkTemplateOptions {
  isSample?: boolean;
  districts?: SchoolDistrict[];
  blocks?: SchoolBlock[];
}

function activeDistricts(districts: SchoolDistrict[] = []): SchoolDistrict[] {
  return districts
    .filter((d) => !d.deleted && d.name.trim())
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

function excelColumnLetter(col: number): string {
  let letter = "";
  let index = col;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

function districtRangeName(districtId: string): string {
  return `Dist_${districtId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function buildDistrictBlockLists(
  workbook: ExcelJS.Workbook,
  listsWs: ExcelJS.Worksheet,
  districts: SchoolDistrict[],
  blocks: SchoolBlock[],
): { districtRange: string | null; lookupRange: string | null; districtCount: number } {
  listsWs.getCell(1, 1).value = "District";
  listsWs.getCell(1, 2).value = "RangeName";

  let listCol = 3;

  districts.forEach((district, index) => {
    const row = index + 2;
    const rangeName = districtRangeName(district.id);
    listsWs.getCell(row, 1).value = district.name.trim();
    listsWs.getCell(row, 2).value = rangeName;

    const districtBlocks = getBlocksForDistrictName(blocks, districts, district.name);
    const colLetter = excelColumnLetter(listCol);
    const startRow = 2;
    const endRow = Math.max(startRow, districtBlocks.length + 1);

    if (districtBlocks.length > 0) {
      districtBlocks.forEach((blockName, blockIdx) => {
        listsWs.getCell(blockIdx + startRow, listCol).value = blockName;
      });
    } else {
      listsWs.getCell(startRow, listCol).value = "";
    }

    workbook.definedNames.add(
      rangeName,
      `'${LISTS_SHEET}'!$${colLetter}$${startRow}:$${colLetter}$${endRow}`,
    );
    listCol += 1;
  });

  const districtCount = districts.length;
  const districtRange =
    districtCount > 0 ? `'${LISTS_SHEET}'!$A$2:$A$${districtCount + 1}` : null;
  const lookupRange =
    districtCount > 0 ? `'${LISTS_SHEET}'!$A$2:$B$${districtCount + 1}` : null;

  return { districtRange, lookupRange, districtCount };
}

function applySchoolWorkValidations(
  ws: ExcelJS.Worksheet,
  options: {
    districtRange: string | null;
    lookupRange: string | null;
    districtCount: number;
  },
): void {
  const districtCol = SCHOOL_EXCEL_ROW_HEADERS.indexOf("District") + 1;
  const blockCol = SCHOOL_EXCEL_ROW_HEADERS.indexOf("Block") + 1;
  const districtLetter = excelColumnLetter(districtCol);

  for (let row = 2; row <= TEMPLATE_ROW_COUNT; row++) {
    if (options.districtRange && districtCol > 0) {
      ws.getCell(row, districtCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [options.districtRange],
        showErrorMessage: true,
        errorTitle: "Invalid District",
        error:
          "Please select a district from the dropdown list or add districts in Employees → Configuration first.",
      };
    }

    if (options.lookupRange && options.districtCount > 0 && blockCol > 0) {
      ws.getCell(row, blockCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`INDIRECT(VLOOKUP($${districtLetter}${row},${options.lookupRange},2,FALSE))`],
        showErrorMessage: true,
        errorTitle: "Invalid Block",
        error: "Select a district first, then choose a block configured under that district.",
      };
    }
  }
}

export async function buildSchoolWorkWorkbook(
  options: SchoolWorkTemplateOptions = {},
): Promise<ExcelJS.Workbook> {
  const isSample = !!options.isSample;
  const districts = activeDistricts(options.districts);
  const blocks = options.blocks || [];

  const workbook = new ExcelJS.Workbook();
  const listsWs = workbook.addWorksheet(LISTS_SHEET);
  listsWs.state = "veryHidden";
  const { districtRange, lookupRange, districtCount } = buildDistrictBlockLists(
    workbook,
    listsWs,
    districts,
    blocks,
  );

  const ws = workbook.addWorksheet("School Work Template");
  ws.addRow(SCHOOL_EXCEL_ROW_HEADERS);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF791A" } };

  if (isSample) {
    const sampleDistrict = districts[0]?.name || "Patna";
    const sampleBlocks = getBlocksForDistrictName(blocks, districts, sampleDistrict);
    const sampleBlock = sampleBlocks[0] || "Block A";
    ws.addRow([
      1,
      "Govt. Primary School Example",
      "12345678901",
      "Primary School",
      "Ramesh Kumar",
      "9876543210",
      "Suresh Das",
      "Suresh Das",
      "302910243689",
      "PUNB0121400",
      4,
      50,
      3750,
      3750,
      sampleDistrict,
      sampleBlock,
      "Sample entry",
    ]);
  }

  applySchoolWorkValidations(ws, { districtRange, lookupRange, districtCount });

  ws.columns.forEach((col) => {
    col.width = 18;
  });

  return workbook;
}

export async function downloadSchoolWorkTemplate(
  options: SchoolWorkTemplateOptions = {},
): Promise<void> {
  const isSample = !!options.isSample;
  const workbook = await buildSchoolWorkWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = isSample ? "school_work_sample.xlsx" : "school_work_template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
