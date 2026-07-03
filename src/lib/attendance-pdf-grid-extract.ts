import type { Employee } from "../types";
import { getDaysInMonthStatic, MONTH_NAME_LIST } from "./date-helpers";

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type OcrMode = "header" | "name" | "total";

type RecognizeCropFn = (canvas: HTMLCanvasElement, mode: OcrMode) => Promise<string>;

type CellFeature = {
  day: number;
  inkRatio: number;
  vector: number[];
  presentScore: number;
  absentScore: number;
  bboxHeight: number;
  bboxWidth: number;
  leftDensity: number;
  upperRightDensity: number;
  lowerRightDensity: number;
  bottomDensity: number;
  centerDensity: number;
};

type ExtractOptions = {
  preferredMonthKey?: string;
  recognizeCrop: RecognizeCropFn;
  employees?: Employee[];
};

const REFERENCE_ROW_COUNT = 21;
const PAPER_THRESHOLD = 168;
const PAPER_ROW_RATIO = 0.14;
const PAPER_COL_RATIO = 0.14;

const MONTH_ABBR_TO_NAME: Record<string, string> = {
  JAN: "January",
  FEB: "February",
  MAR: "March",
  APR: "April",
  MAY: "May",
  JUN: "June",
  JUL: "July",
  AUG: "August",
  SEP: "September",
  OCT: "October",
  NOV: "November",
  DEC: "December",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toInt(value: number): number {
  return Math.round(value);
}

function longestRun(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  let bestStart = values[0];
  let bestEnd = values[0];
  let start = values[0];
  let prev = values[0];

  for (let i = 1; i < values.length; i += 1) {
    const current = values[i];
    if (current <= prev + 1) {
      prev = current;
      continue;
    }
    if (prev - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = prev;
    }
    start = current;
    prev = current;
  }

  if (prev - start > bestEnd - bestStart) {
    bestStart = start;
    bestEnd = prev;
  }

  return [bestStart, bestEnd];
}

function grayscalePixels(canvas: HTMLCanvasElement): { width: number; height: number; pixels: Uint8ClampedArray } {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to access the PDF image for attendance OCR.");
  }
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const pixels = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    pixels[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return { width, height, pixels };
}

function detectPaperBounds(gray: Uint8ClampedArray, width: number, height: number): Rect {
  const brightRows: number[] = [];
  const brightCols: number[] = [];

  for (let y = 0; y < height; y += 1) {
    let bright = 0;
    for (let x = 0; x < width; x += 1) {
      if (gray[y * width + x] >= PAPER_THRESHOLD) bright += 1;
    }
    if (bright >= width * PAPER_ROW_RATIO) brightRows.push(y);
  }

  for (let x = 0; x < width; x += 1) {
    let bright = 0;
    for (let y = 0; y < height; y += 1) {
      if (gray[y * width + x] >= PAPER_THRESHOLD) bright += 1;
    }
    if (bright >= height * PAPER_COL_RATIO) brightCols.push(x);
  }

  const rowRun = longestRun(brightRows);
  const colRun = longestRun(brightCols);

  if (!rowRun || !colRun) {
    return { left: 0, top: 0, right: width - 1, bottom: height - 1 };
  }

  return {
    left: colRun[0],
    top: rowRun[0],
    right: colRun[1],
    bottom: rowRun[1],
  };
}

function cropCanvas(
  source: HTMLCanvasElement,
  left: number,
  top: number,
  right: number,
  bottom: number,
): HTMLCanvasElement {
  const width = Math.max(1, toInt(right - left));
  const height = Math.max(1, toInt(bottom - top));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create OCR crop canvas.");
  }
  ctx.drawImage(source, left, top, width, height, 0, 0, width, height);
  return canvas;
}

function scaleAndThresholdCanvas(
  source: HTMLCanvasElement,
  {
    scale = 3,
    threshold = 172,
  }: {
    scale?: number;
    threshold?: number;
  } = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to prepare OCR canvas.");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const value = gray >= threshold ? 255 : 0;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function refineVerticalBoundary(
  gray: Uint8ClampedArray,
  width: number,
  bounds: Rect,
  expectedX: number,
  searchRadius: number,
): number {
  let bestX = clamp(toInt(expectedX), bounds.left, bounds.right);
  let bestScore = -1;
  const top = clamp(bounds.top, 0, Number.MAX_SAFE_INTEGER);
  const bottom = clamp(bounds.bottom, 0, Number.MAX_SAFE_INTEGER);

  for (let x = clamp(bestX - searchRadius, bounds.left, bounds.right); x <= clamp(bestX + searchRadius, bounds.left, bounds.right); x += 1) {
    let dark = 0;
    for (let y = top; y <= bottom; y += 1) {
      if (gray[y * width + x] < 145) dark += 1;
    }
    if (dark > bestScore) {
      bestScore = dark;
      bestX = x;
    }
  }

  return bestX;
}

function refineHorizontalBoundary(
  gray: Uint8ClampedArray,
  width: number,
  bounds: Rect,
  expectedY: number,
  searchRadius: number,
): number {
  let bestY = clamp(toInt(expectedY), bounds.top, bounds.bottom);
  let bestScore = -1;
  const left = clamp(bounds.left, 0, Number.MAX_SAFE_INTEGER);
  const right = clamp(bounds.right, 0, Number.MAX_SAFE_INTEGER);

  for (let y = clamp(bestY - searchRadius, bounds.top, bounds.bottom); y <= clamp(bestY + searchRadius, bounds.top, bounds.bottom); y += 1) {
    let dark = 0;
    for (let x = left; x <= right; x += 1) {
      if (gray[y * width + x] < 145) dark += 1;
    }
    if (dark > bestScore) {
      bestScore = dark;
      bestY = y;
    }
  }

  return bestY;
}

function parseMonthFromHeader(headerText: string, fallback?: string): string | undefined {
  const explicit = headerText.match(/MONTH_KEY:\s*([A-Za-z]+\s+20\d{2})/i);
  if (explicit) {
    const parts = explicit[1].trim().split(/\s+/);
    const monthName = MONTH_NAME_LIST.find((item) => item.toLowerCase() === parts[0].toLowerCase());
    if (monthName) return `${monthName} ${parts[1]}`;
  }

  const dateRange = headerText.match(/(\d{1,2})\s+([A-Z]{3})\s+(20\d{2})\s+TO\s+(\d{1,2})\s+([A-Z]{3})\s+(20\d{2})/i);
  if (dateRange) {
    const monthName = MONTH_ABBR_TO_NAME[dateRange[2].toUpperCase()];
    if (monthName) return `${monthName} ${dateRange[3]}`;
  }

  return fallback;
}

function dayOfWeekSet(monthKey: string | undefined): Set<number> {
  const set = new Set<number>();
  if (!monthKey) return set;
  const [monthName, yearText] = monthKey.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(monthName);
  const year = parseInt(yearText, 10);
  if (monthIndex < 0 || !Number.isFinite(year)) return set;
  const days = getDaysInMonthStatic(monthKey);
  for (let day = 1; day <= days; day += 1) {
    const jsDay = new Date(year, monthIndex, day).getDay();
    if (jsDay === 0) {
      set.add(day);
    }
  }
  return set;
}

function normalizeNameFromOcr(value: string): string {
  return value
    .replace(/[^A-Za-z.\-'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeMatchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0o]/g, "o")
    .replace(/[1l|]/g, "l")
    .replace(/[5$]/g, "s")
    .replace(/[8]/g, "b")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeMatchName(a);
  const nb = normalizeMatchName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const aParts = na.split(" ").filter(Boolean);
  const bParts = nb.split(" ").filter(Boolean);
  const aSet = new Set(aParts);
  const bSet = new Set(bParts);
  let overlap = 0;
  for (const part of aSet) {
    if (bSet.has(part) && part.length > 1) overlap += 1;
  }
  const tokenScore = overlap / Math.max(aSet.size, bSet.size, 1);
  const editScore = 1 - levenshteinDistance(na, nb) / Math.max(na.length, nb.length, 1);
  const surnameBonus =
    aParts.length > 0 && bParts.length > 0 && aParts[aParts.length - 1] === bParts[bParts.length - 1]
      ? 0.12
      : 0;
  const firstNameBonus =
    aParts.length > 0 && bParts.length > 0 && aParts[0] === bParts[0]
      ? 0.06
      : 0;
  return Math.min(1, tokenScore * 0.4 + editScore * 0.6 + surnameBonus + firstNameBonus);
}

function employeeDisplayName(employee: Employee): string {
  return (
    employee.nameAsPerAadharColumn ||
    employee.nameAsPerAadhar ||
    employee.nameAsPerBank ||
    employee.employeeCode
  );
}

type EmployeeCandidate = {
  employee: Employee;
  score: number;
};

function rankEmployeeCandidates(nameVariants: string[], employees: Employee[]): EmployeeCandidate[] {
  return employees
    .map((employee) => {
      const employeeNames = [
        employee.nameAsPerAadhar,
        employee.nameAsPerAadharColumn,
        employee.nameAsPerBank,
      ].filter(Boolean);
      let bestScore = 0;
      for (const variant of nameVariants) {
        for (const employeeName of employeeNames) {
          bestScore = Math.max(bestScore, nameSimilarity(variant, employeeName));
        }
      }
      return { employee, score: bestScore };
    })
    .filter((candidate) => candidate.score >= 0.35)
    .sort((a, b) => b.score - a.score);
}

function digitValue(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

function cellFeatureFromCanvas(source: HTMLCanvasElement): CellFeature {
  const canvas = scaleAndThresholdCanvas(source, { scale: 2.5, threshold: 170 });
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to inspect attendance cell.");
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const borderPad = 3;
  const grid = 12;
  const gridH = 16;
  const vector = new Array(grid * gridH).fill(0);
  let darkPixels = 0;
  let usablePixels = 0;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = borderPad; y < canvas.height - borderPad; y += 1) {
    for (let x = borderPad; x < canvas.width - borderPad; x += 1) {
      const idx = (y * canvas.width + x) * 4;
      const dark = image.data[idx] < 128;
      usablePixels += 1;
      if (!dark) continue;
      darkPixels += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const nx = clamp(Math.floor(((x - borderPad) / Math.max(1, canvas.width - borderPad * 2)) * grid), 0, grid - 1);
      const ny = clamp(Math.floor(((y - borderPad) / Math.max(1, canvas.height - borderPad * 2)) * gridH), 0, gridH - 1);
      vector[ny * grid + nx] += 1;
    }
  }

  const normalizer = Math.max(1, usablePixels / (grid * gridH));
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i] / normalizer;
  }

  const contentWidth = Math.max(1, canvas.width - borderPad * 2);
  const contentHeight = Math.max(1, canvas.height - borderPad * 2);
  const bboxWidth = maxX >= minX ? (maxX - minX + 1) / contentWidth : 0;
  const bboxHeight = maxY >= minY ? (maxY - minY + 1) / contentHeight : 0;
  const density = (
    rowStart: number,
    rowEnd: number,
    colStart: number,
    colEnd: number,
  ) => {
    let total = 0;
    let count = 0;
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let col = colStart; col <= colEnd; col += 1) {
        total += vector[row * grid + col];
        count += 1;
      }
    }
    return count > 0 ? total / count : 0;
  };
  const leftDensity = density(0, gridH - 1, 0, 2);
  const upperRightDensity = density(0, 6, 6, grid - 1);
  const lowerRightDensity = density(9, gridH - 1, 6, grid - 1);
  const bottomDensity = density(12, gridH - 1, 0, grid - 1);
  const centerDensity = density(5, 10, 3, 8);

  return {
    day: 0,
    inkRatio: darkPixels / Math.max(1, usablePixels),
    vector,
    presentScore: 0,
    absentScore: 0,
    bboxHeight,
    bboxWidth,
    leftDensity,
    upperRightDensity,
    lowerRightDensity,
    bottomDensity,
    centerDensity,
  };
}

function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const average = new Array(vectors[0].length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i += 1) {
      average[i] += vector[i];
    }
  }
  for (let i = 0; i < average.length; i += 1) {
    average[i] /= vectors.length;
  }
  return average;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function buildReferenceTableBounds(
  paper: Rect,
  dayCount: number,
  gray: Uint8ClampedArray,
  canvasWidth: number,
): {
  verticalLines: number[];
  horizontalLines: number[];
} {
  const paperWidth = paper.right - paper.left;
  const paperHeight = paper.bottom - paper.top;
  const table = {
    left: paper.left + paperWidth * 0.08,
    right: paper.left + paperWidth * 0.955,
    top: paper.top + paperHeight * 0.07,
    bottom: paper.top + paperHeight * 0.78,
  };

  const bounds = {
    left: toInt(table.left),
    right: toInt(table.right),
    top: toInt(table.top),
    bottom: toInt(table.bottom),
  };

  const tableWidth = bounds.right - bounds.left;
  const tableHeight = bounds.bottom - bounds.top;
  const srWidth = tableWidth * 0.043;
  const nameWidth = tableWidth * 0.245;
  const totalWidth = tableWidth * 0.045;
  const dayWidth = (tableWidth - srWidth - nameWidth - totalWidth) / dayCount;
  const headerHeight = tableHeight * 0.075;
  const rowHeight = (tableHeight - headerHeight) / REFERENCE_ROW_COUNT;

  const verticalExpected: number[] = [];
  verticalExpected.push(bounds.left);
  verticalExpected.push(bounds.left + srWidth);
  verticalExpected.push(bounds.left + srWidth + nameWidth);
  for (let day = 1; day <= dayCount; day += 1) {
    verticalExpected.push(bounds.left + srWidth + nameWidth + day * dayWidth);
  }
  verticalExpected.push(bounds.right);

  const horizontalExpected: number[] = [];
  horizontalExpected.push(bounds.top);
  horizontalExpected.push(bounds.top + headerHeight);
  for (let row = 1; row <= REFERENCE_ROW_COUNT; row += 1) {
    horizontalExpected.push(bounds.top + headerHeight + row * rowHeight);
  }

  const verticalLines = verticalExpected.map((value, index) =>
    refineVerticalBoundary(
      gray,
      canvasWidth,
      bounds,
      value,
      index <= 2 || index >= dayCount + 2 ? Math.max(6, Math.round(dayWidth)) : Math.max(4, Math.round(dayWidth * 0.55)),
    ),
  );

  const horizontalLines = horizontalExpected.map((value, index) =>
    refineHorizontalBoundary(
      gray,
      canvasWidth,
      bounds,
      value,
      index <= 1 ? Math.max(5, Math.round(rowHeight * 0.8)) : Math.max(4, Math.round(rowHeight * 0.5)),
    ),
  );

  return { verticalLines, horizontalLines };
}

export async function extractReferenceMusterRollPageText(
  pageCanvas: HTMLCanvasElement,
  options: ExtractOptions,
): Promise<{ text: string; monthKey?: string } | null> {
  const grayData = grayscalePixels(pageCanvas);
  const paper = detectPaperBounds(grayData.pixels, grayData.width, grayData.height);
  const initialDayCount = options.preferredMonthKey ? getDaysInMonthStatic(options.preferredMonthKey) : 31;

  let { verticalLines, horizontalLines } = buildReferenceTableBounds(
    paper,
    initialDayCount,
    grayData.pixels,
    grayData.width,
  );

  const headerCrop = cropCanvas(
    pageCanvas,
    verticalLines[0],
    clamp(horizontalLines[0] - 30, 0, pageCanvas.height - 1),
    verticalLines.at(-1) ?? pageCanvas.width,
    horizontalLines[0] + Math.max(28, Math.round((horizontalLines[1] - horizontalLines[0]) * 1.2)),
  );
  const headerText = await options.recognizeCrop(scaleAndThresholdCanvas(headerCrop, { scale: 2.5, threshold: 175 }), "header");
  const monthKey = parseMonthFromHeader(headerText, options.preferredMonthKey);
  const dayCount = monthKey ? getDaysInMonthStatic(monthKey) : initialDayCount;

  if (dayCount !== initialDayCount) {
    ({ verticalLines, horizontalLines } = buildReferenceTableBounds(paper, dayCount, grayData.pixels, grayData.width));
  }

  const sundayDays = dayOfWeekSet(monthKey);
  const pageRows: Array<{
    rowNumber: number;
    name: string;
    nameVariants: string[];
    total: number | null;
    cells: CellFeature[];
    employeeCandidates: EmployeeCandidate[];
    matchedEmployee?: Employee;
  }> = [];

  const allWorkingCells: CellFeature[] = [];

  for (let rowIndex = 0; rowIndex < REFERENCE_ROW_COUNT; rowIndex += 1) {
    const rowTop = horizontalLines[rowIndex + 1] + 1;
    const rowBottom = horizontalLines[rowIndex + 2] - 1;
    if (rowBottom <= rowTop) continue;

    const nameCanvas = cropCanvas(
      pageCanvas,
      verticalLines[1] + 2,
      rowTop,
      verticalLines[2] - 2,
      rowBottom,
    );
    const totalCanvas = cropCanvas(
      pageCanvas,
      verticalLines[dayCount + 2] + 1,
      rowTop,
      verticalLines[dayCount + 3] - 1,
      rowBottom,
    );
    const nameVariants = new Set<string>();
    for (const config of [
      { scale: 3.2, threshold: 174 },
      { scale: 3.8, threshold: 166 },
      { scale: 4.2, threshold: 182 },
    ]) {
      const ocrText = await options.recognizeCrop(
        scaleAndThresholdCanvas(nameCanvas, config),
        "name",
      );
      const normalized = normalizeNameFromOcr(ocrText);
      if (normalized) {
        nameVariants.add(normalized);
      }
    }

    let total: number | null = null;
    for (const config of [
      { scale: 4, threshold: 172 },
      { scale: 4.6, threshold: 162 },
      { scale: 4.6, threshold: 184 },
    ]) {
      const totalText = await options.recognizeCrop(
        scaleAndThresholdCanvas(totalCanvas, config),
        "total",
      );
      total = digitValue(totalText);
      if (total !== null) break;
    }

    const normalizedName = [...nameVariants][0] ?? "";
    const cells: CellFeature[] = [];

    for (let day = 1; day <= dayCount; day += 1) {
      if (sundayDays.has(day)) continue;
      const dayLeft = verticalLines[day + 1] + 2;
      const dayRight = verticalLines[day + 2] - 2;
      const cellCanvas = cropCanvas(pageCanvas, dayLeft, rowTop, dayRight, rowBottom);
      const feature = cellFeatureFromCanvas(cellCanvas);
      feature.day = day;
      cells.push(feature);
      allWorkingCells.push(feature);
    }

    pageRows.push({
      rowNumber: rowIndex + 1,
      name: normalizedName,
      nameVariants: [...nameVariants],
      total,
      cells,
      employeeCandidates: options.employees?.length
        ? rankEmployeeCandidates([...nameVariants], options.employees)
        : [],
    });
  }

  if (options.employees?.length) {
    const usedEmployeeIds = new Set<string>();
    const rowsByConfidence = [...pageRows].sort((a, b) => {
      const aTop = a.employeeCandidates[0]?.score ?? 0;
      const bTop = b.employeeCandidates[0]?.score ?? 0;
      const aSecond = a.employeeCandidates[1]?.score ?? 0;
      const bSecond = b.employeeCandidates[1]?.score ?? 0;
      return (bTop - bSecond) - (aTop - aSecond) || bTop - aTop;
    });

    for (const row of rowsByConfidence) {
      const bestAvailable = row.employeeCandidates.find(
        (candidate) => !usedEmployeeIds.has(candidate.employee.id) && candidate.score >= 0.52,
      );
      if (!bestAvailable) continue;
      row.matchedEmployee = bestAvailable.employee;
      usedEmployeeIds.add(bestAvailable.employee.id);
    }
  }

  const namedRows = pageRows.filter(
    (row) =>
      row.name.replace(/\s+/g, "").length >= 3 ||
      Boolean(row.matchedEmployee),
  );
  if (namedRows.length < 3) {
    return null;
  }

  const sortedByInk = [...allWorkingCells].sort((a, b) => a.inkRatio - b.inkRatio);
  const sampleSize = Math.max(10, Math.floor(sortedByInk.length * 0.18));
  const fullyPresentRows = pageRows.filter((row) => row.total !== null && row.total >= row.cells.length - 1);
  const lowPresentRows = pageRows.filter((row) => row.total !== null && row.total <= 2);
  const presentPrototype = averageVectors(
    (fullyPresentRows.length > 0
      ? fullyPresentRows.flatMap((row) => row.cells)
      : sortedByInk.slice(-sampleSize)
    ).map((cell) => cell.vector),
  );
  const blankPrototype = averageVectors(
    (lowPresentRows.length > 0
      ? lowPresentRows.flatMap((row) => row.cells)
      : sortedByInk.slice(0, sampleSize)
    ).map((cell) => cell.vector),
  );
  const allPresentScores: number[] = [];

  for (const row of pageRows) {
    for (const cell of row.cells) {
      const presentSimilarity = cosineSimilarity(cell.vector, presentPrototype);
      const blankSimilarity = cosineSimilarity(cell.vector, blankPrototype);
      cell.presentScore =
        presentSimilarity * 1.15 -
        blankSimilarity * 0.35 +
        cell.bboxHeight * 0.95 +
        cell.leftDensity * 0.9 +
        cell.upperRightDensity * 0.55 -
        cell.bottomDensity * 0.35 -
        cell.lowerRightDensity * 0.15 +
        cell.inkRatio * 0.25;
      cell.absentScore =
        blankSimilarity * 0.95 +
        (1 - cell.bboxHeight) * 1.05 +
        (1 - cell.leftDensity) * 0.85 +
        (1 - cell.upperRightDensity) * 0.45 +
        cell.bottomDensity * 0.1 -
        presentSimilarity * 0.4;
      allPresentScores.push(cell.presentScore);
    }
  }

  const scoreThreshold = median(allPresentScores);
  const outputLines = [`MONTH_KEY: ${monthKey ?? options.preferredMonthKey ?? ""}`.trim(), "GRID_FORMAT: REFERENCE_MUSTER_ROLL"];

  for (const row of namedRows) {
    const validTotal = row.total !== null ? clamp(row.total, 0, row.cells.length) : null;
    const presentDays = new Set<number>();
    const cellCount = row.cells.length;

    if (validTotal !== null) {
      const presentCount = clamp(validTotal, 0, cellCount);
      const absentCount = Math.max(0, cellCount - presentCount);
      if (presentCount === cellCount) {
        for (const cell of row.cells) {
          presentDays.add(cell.day);
        }
      } else if (presentCount === 0) {
        // Keep all as absent.
      } else if (absentCount <= presentCount) {
        const absentDays = new Set(
          [...row.cells]
            .sort((a, b) => b.absentScore - a.absentScore)
            .slice(0, absentCount)
            .map((cell) => cell.day),
        );
        for (const cell of row.cells) {
          if (!absentDays.has(cell.day)) {
            presentDays.add(cell.day);
          }
        }
      } else {
        for (const cell of [...row.cells].sort((a, b) => b.presentScore - a.presentScore).slice(0, presentCount)) {
          presentDays.add(cell.day);
        }
      }
    } else {
      for (const cell of row.cells) {
        if (cell.presentScore >= scoreThreshold) {
          presentDays.add(cell.day);
        }
      }
    }

    const dayTokens = row.cells
      .sort((a, b) => a.day - b.day)
      .map((cell) => `${cell.day}:${presentDays.has(cell.day) ? "P" : "A"}`);

    const displayName = row.matchedEmployee ? employeeDisplayName(row.matchedEmployee) : row.name;
    const codeToken = row.matchedEmployee ? `|CODE:${row.matchedEmployee.employeeCode}` : "";

    outputLines.push(
      `GRID_ROW|${row.rowNumber}|${displayName}${codeToken}|TOTAL:${validTotal ?? ""}|${dayTokens.join(" ")}`,
    );
  }

  return {
    text: outputLines.join("\n"),
    monthKey,
  };
}
