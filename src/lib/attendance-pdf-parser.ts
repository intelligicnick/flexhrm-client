import { Employee } from "../types";
import { getDaysInMonthStatic } from "./date-helpers";
import { detectMonthKeyFromText } from "./attendance-pdf-extract";

export type ParsedAttendanceRow = {
  rowIndex: number;
  employeeCode: string;
  name: string;
  location: string;
  dayMarks: Record<number, string>;
  presents: number;
  absents: number;
  matchedEmployeeId: string | null;
  matchConfidence: "high" | "medium" | "low" | "none";
  matchNote: string;
  included: boolean;
  rawLine: string;
};

export type ParsedAttendanceSheet = {
  monthKey: string | null;
  locationHint: string | null;
  source: "typed-text" | "ocr";
  rows: ParsedAttendanceRow[];
  warnings: string[];
};

const STATUS_TOKENS: Record<string, string> = {
  P: "P",
  PRESENT: "P",
  PR: "P",
  A: "A",
  ABSENT: "A",
  AB: "A",
  L: "L",
  LEAVE: "L",
  H: "H",
  HOLIDAY: "H",
  WO: "WO",
  W: "WO",
  OFF: "WO",
};

function normalizeName(value: string): string {
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
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
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
      ? 0.1
      : 0;
  const firstNameBonus =
    aParts.length > 0 && bParts.length > 0 && aParts[0] === bParts[0]
      ? 0.05
      : 0;
  return Math.min(1, tokenScore * 0.45 + editScore * 0.55 + surnameBonus + firstNameBonus);
}

export function normalizeAttendanceStatusToken(token: string): string | null {
  const cleaned = token.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!cleaned || cleaned === "—" || cleaned === "-") return null;
  if (STATUS_TOKENS[cleaned]) return STATUS_TOKENS[cleaned];
  if (cleaned.length === 1 && STATUS_TOKENS[cleaned]) return STATUS_TOKENS[cleaned];
  return null;
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^(sr|s\.?\s*no)/i.test(line) ||
    /emp\s*code/i.test(lower) ||
    /attendance\s+registry/i.test(lower) ||
    /worksite\s+location/i.test(lower) ||
    /total\s+staff/i.test(lower) ||
    /generated:/i.test(lower) ||
    /grand\s+total/i.test(lower) ||
    /^flexhrm/i.test(lower)
  );
}

function isDataLine(line: string): boolean {
  if (line.length < 8) return false;
  if (isHeaderLine(line)) return false;
  const statusHits = (line.match(/\b[PAHL]\b/g) ?? []).length;
  const hasCodeOrName = /[A-Za-z]{3,}/.test(line);
  return hasCodeOrName && (statusHits >= 2 || /\b\d{1,2}\b/.test(line));
}

function extractLocationHint(text: string): string | null {
  const match = text.match(/worksite\s+location\s+designation:\s*(.+)/i);
  if (!match) return null;
  const value = match[1].split("|")[0].trim();
  return value && !/^all/i.test(value) ? value : null;
}

function parseStructuredGridRow(line: string): ParsedAttendanceRow | null {
  if (!line.startsWith("GRID_ROW|")) return null;
  const parts = line.split("|");
  if (parts.length < 5) return null;

  const rowIndex = parseInt(parts[1] || "", 10);
  const name = (parts[2] || "").trim();
  let employeeCode = "";
  let totalIndex = -1;
  for (let i = 3; i < parts.length; i += 1) {
    const part = parts[i] || "";
    if (part.startsWith("CODE:")) {
      employeeCode = part.slice("CODE:".length).trim();
    }
    if (part.startsWith("TOTAL:")) {
      totalIndex = i;
      break;
    }
  }
  if (totalIndex === -1) return null;
  const dayMarks: Record<number, string> = {};
  let presents = 0;
  let absents = 0;

  const marksText = parts.slice(totalIndex + 1).join("|");
  for (const token of marksText.split(/\s+/)) {
    const match = token.match(/^(\d{1,2}):([A-Z]+)$/i);
    if (!match) continue;
    const day = parseInt(match[1], 10);
    const status = normalizeAttendanceStatusToken(match[2]);
    if (!day || !status) continue;
    dayMarks[day] = status;
    if (status === "P") presents += 1;
    if (status === "A") absents += 1;
  }

  if (!name || Object.keys(dayMarks).length === 0) return null;

  return {
    rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0,
    employeeCode,
    name,
    location: "",
    dayMarks,
    presents,
    absents,
    matchedEmployeeId: null,
    matchConfidence: "none",
    matchNote: "Not matched",
    included: true,
    rawLine: line,
  };
}

function splitRowTokens(line: string): string[] {
  return line
    .replace(/\|/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseDayMarksFromTail(tokens: string[], daysInMonth: number): {
  dayMarks: Record<number, string>;
  presents: number;
  absents: number;
  consumed: number;
} {
  const dayMarks: Record<number, string> = {};
  let presents = 0;
  let absents = 0;
  const statusTokens: string[] = [];

  for (let i = tokens.length - 1; i >= 0 && statusTokens.length < daysInMonth + 4; i -= 1) {
    const token = tokens[i];
    const asNumber = parseInt(token, 10);
    if (!Number.isNaN(asNumber) && asNumber <= daysInMonth + 5 && statusTokens.length === 0) {
      continue;
    }
    const status = normalizeAttendanceStatusToken(token);
    if (status) {
      statusTokens.unshift(token);
    } else if (statusTokens.length > 0) {
      break;
    }
  }

  const marks = statusTokens
    .map((t) => normalizeAttendanceStatusToken(t))
    .filter((s): s is string => Boolean(s));

  const dayCount = Math.min(marks.length, daysInMonth);
  for (let d = 0; d < dayCount; d += 1) {
    const status = marks[d];
    if (!status) continue;
    dayMarks[d + 1] = status;
    if (status === "P") presents += 1;
    if (status === "A") absents += 1;
  }

  return { dayMarks, presents, absents, consumed: statusTokens.length };
}

function parseAttendanceRow(line: string, rowIndex: number, daysInMonth: number): ParsedAttendanceRow | null {
  const tokens = splitRowTokens(line);
  if (tokens.length < 4) return null;

  let start = 0;
  if (/^\d+$/.test(tokens[0])) start = 1;

  const codeCandidate = tokens[start] ?? "";
  const hasCode = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,}$/.test(codeCandidate);
  const employeeCode = hasCode ? codeCandidate : "";

  const headTokens = tokens.slice(start + (hasCode ? 1 : 0));
  const { dayMarks, presents, absents, consumed } = parseDayMarksFromTail(headTokens, daysInMonth);
  if (Object.keys(dayMarks).length === 0) return null;

  const metaTokens = headTokens.slice(0, Math.max(0, headTokens.length - consumed));
  if (metaTokens.length === 0) return null;

  let location = "";
  let name = "";

  if (metaTokens.length >= 3) {
    location = metaTokens[metaTokens.length - 1] ?? "";
    name = metaTokens.slice(0, -1).join(" ");
  } else if (metaTokens.length === 2) {
    name = metaTokens[0] ?? "";
    location = metaTokens[1] ?? "";
  } else {
    name = metaTokens.join(" ");
  }

  if (!name && employeeCode) {
    name = employeeCode;
  }

  return {
    rowIndex,
    employeeCode,
    name: name.trim(),
    location: location.trim(),
    dayMarks,
    presents,
    absents,
    matchedEmployeeId: null,
    matchConfidence: "none",
    matchNote: "Not matched",
    included: true,
    rawLine: line,
  };
}

export function matchAttendanceRowToEmployee(
  row: Pick<ParsedAttendanceRow, "employeeCode" | "name" | "location">,
  employees: Employee[],
  locationHint?: string | null,
): { employeeId: string | null; confidence: ParsedAttendanceRow["matchConfidence"]; note: string } {
  const code = row.employeeCode.trim().toLowerCase();
  if (code) {
    const exactCode = employees.find((e) => e.employeeCode.toLowerCase() === code);
    if (exactCode) {
      return { employeeId: exactCode.id, confidence: "high", note: `Matched by code ${exactCode.employeeCode}` };
    }
  }

  const rowLocation = (row.location || locationHint || "").trim().toLowerCase();
  const candidates = employees
    .map((emp) => {
      const names = [emp.nameAsPerAadhar, emp.nameAsPerAadharColumn, emp.nameAsPerBank].filter(Boolean);
      const bestNameScore = Math.max(...names.map((n) => nameSimilarity(row.name, n)), 0);
      const locMatch =
        !rowLocation ||
        (emp.location || "").toLowerCase().includes(rowLocation) ||
        rowLocation.includes((emp.location || "").toLowerCase());
      return { emp, bestNameScore, locMatch };
    })
    .filter((c) => c.bestNameScore >= 0.35)
    .sort((a, b) => {
      if (a.locMatch !== b.locMatch) return a.locMatch ? -1 : 1;
      return b.bestNameScore - a.bestNameScore;
    });

  if (candidates.length === 0) {
    return { employeeId: null, confidence: "none", note: "No employee match found" };
  }

  const best = candidates[0];
  const second = candidates[1];
  if (best.bestNameScore >= 0.9 && best.locMatch) {
    return {
      employeeId: best.emp.id,
      confidence: "high",
      note: `Matched ${best.emp.nameAsPerAadharColumn || best.emp.nameAsPerAadhar} (${best.emp.employeeCode})`,
    };
  }
  if (best.bestNameScore >= 0.72 || (best.bestNameScore >= 0.62 && (!second || best.bestNameScore - second.bestNameScore >= 0.12))) {
    return {
      employeeId: best.emp.id,
      confidence: "medium",
      note: `Likely ${best.emp.nameAsPerAadharColumn || best.emp.nameAsPerAadhar} — verify location`,
    };
  }
  if (best.bestNameScore >= 0.48 && (!second || best.bestNameScore - second.bestNameScore >= 0.08)) {
    return {
      employeeId: best.emp.id,
      confidence: "low",
      note: `Possible ${best.emp.nameAsPerAadharColumn || best.emp.nameAsPerAadhar} — check before apply`,
    };
  }
  return {
    employeeId: null,
    confidence: "none",
    note: "No reliable employee match found",
  };
}

export function parseAttendanceSheetText(
  text: string,
  options: {
    source: "typed-text" | "ocr";
    fallbackMonthKey?: string;
    employees?: Employee[];
    locationHint?: string | null;
  },
): ParsedAttendanceSheet {
  const monthKey = detectMonthKeyFromText(text, options.fallbackMonthKey) ?? options.fallbackMonthKey ?? null;
  const daysInMonth = monthKey ? getDaysInMonthStatic(monthKey) : 31;
  const locationHint = options.locationHint ?? extractLocationHint(text);
  const warnings: string[] = [];

  if (!monthKey) {
    warnings.push("Could not detect month from PDF — select month manually before applying.");
  }

  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: ParsedAttendanceRow[] = [];
  const structuredLines = lines.filter((line) => line.startsWith("GRID_ROW|"));

  if (structuredLines.length > 0) {
    structuredLines.forEach((line, index) => {
      const parsed = parseStructuredGridRow(line);
      if (!parsed) return;

      if (options.employees) {
        const match = matchAttendanceRowToEmployee(parsed, options.employees, locationHint);
        parsed.matchedEmployeeId = match.employeeId;
        parsed.matchConfidence = match.confidence;
        parsed.matchNote = match.note;
        parsed.included = match.employeeId !== null && match.confidence !== "low";
      }

      parsed.rowIndex = parsed.rowIndex || index + 1;
      rows.push(parsed);
    });
  } else {
    const dataLines = lines.filter(isDataLine);
    if (dataLines.length === 0) {
      warnings.push("No attendance rows detected. Try a clearer scan or typed export PDF.");
    }

    dataLines.forEach((line, index) => {
      const parsed = parseAttendanceRow(line, index + 1, daysInMonth);
      if (!parsed) return;

      if (options.employees) {
        const match = matchAttendanceRowToEmployee(parsed, options.employees, locationHint);
        parsed.matchedEmployeeId = match.employeeId;
        parsed.matchConfidence = match.confidence;
        parsed.matchNote = match.note;
        parsed.included = match.employeeId !== null && match.confidence !== "low";
      }

      rows.push(parsed);
    });
  }

  if (rows.length === 0 && structuredLines.length > 0) {
    warnings.push("No attendance rows detected. Try a clearer scan or typed export PDF.");
  }

  const unmatched = rows.filter((r) => !r.matchedEmployeeId).length;
  if (unmatched > 0) {
    warnings.push(`${unmatched} row(s) could not be matched to an employee.`);
  }

  return {
    monthKey,
    locationHint,
    source: options.source,
    rows,
    warnings,
  };
}

export function buildAttendanceEntriesFromParsedRows(
  rows: ParsedAttendanceRow[],
  monthKey: string,
  employees: Employee[],
  resolveStatus: (
    workingDaysType: string | undefined,
    monthStr: string,
    dayNum: number,
    workingDayStatus: string,
  ) => string,
  isExitedOnDay: (emp: Employee, monthStr: string, day: number) => boolean,
): Array<{
  employeeId: string;
  employeeCode?: string;
  location?: string;
  monthKey: string;
  day: number;
  status: string;
}> {
  const entries: Array<{
    employeeId: string;
    employeeCode?: string;
    location?: string;
    monthKey: string;
    day: number;
    status: string;
  }> = [];

  for (const row of rows) {
    if (!row.included || !row.matchedEmployeeId) continue;
    const emp = employees.find((e) => e.id === row.matchedEmployeeId);
    if (!emp) continue;

    for (const [dayStr, status] of Object.entries(row.dayMarks)) {
      const day = Number(dayStr);
      if (!day || !status) continue;
      if (isExitedOnDay(emp, monthKey, day)) continue;
      entries.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        location: emp.location,
        monthKey,
        day,
        status: resolveStatus(emp.workingDaysType, monthKey, day, status),
      });
    }
  }

  return entries;
}
