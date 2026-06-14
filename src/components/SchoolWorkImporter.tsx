import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, AlertTriangle, CheckCircle, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import {
  analyzeSchoolHeaders,
  parseSchoolSheetRows,
  validateSchoolWork,
} from "../lib/school-work-helpers";

interface SchoolWorkImporterProps {
  onImportSuccess: (schools: Partial<SchoolWork>[]) => void;
  existingUdiseCodes: string[];
}

export default function SchoolWorkImporter({
  onImportSuccess,
  existingUdiseCodes,
}: SchoolWorkImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [headerAnalysis, setHeaderAnalysis] = useState<{
    matched: string[];
    unmatched: string[];
    headerRowIndex: number;
    actualHeaderNames: string[];
  } | null>(null);
  const [validationResults, setValidationResults] = useState<{
    valid: Partial<SchoolWork>[];
    invalid: { row: Partial<SchoolWork>; index: number; errors: Record<string, string> }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async (isSample = false) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("School Work Template");
    ws.addRow(SCHOOL_EXCEL_ROW_HEADERS);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF791A" } };
    if (isSample) {
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
        "Bank Transfer",
        4,
        50,
        3750,
        3750,
        "Standard rate per toilet",
        "Block A",
        "Patna",
        12000,
        "Sample entry",
      ]);
    }
    ws.columns.forEach((col) => { col.width = 18; });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = isSample ? "school_work_sample.xlsx" : "school_work_template.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    setErrorDetails(null);
    setValidationResults(null);
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isExcel) {
      setErrorDetails("Only Excel formats (.xlsx, .xls) are supported for school imports.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(ab), { type: "array" });
        const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        const analysis = analyzeSchoolHeaders(sheetRows);
        setHeaderAnalysis(analysis);
        const rows = parseSchoolSheetRows(sheetRows);

        const valid: Partial<SchoolWork>[] = [];
        const invalid: { row: Partial<SchoolWork>; index: number; errors: Record<string, string> }[] = [];
        rows.forEach((row, i) => {
          const errors = validateSchoolWork(row);
          const udise = row.udise || "";
          if (existingUdiseCodes.includes(udise)) {
            errors.udise = `UDISE "${udise}" already exists.`;
          }
          const dupeInFile = rows.findIndex((r) => r.udise === udise) !== i;
          if (dupeInFile && udise) {
            errors.udise = `UDISE "${udise}" is repeated in this file.`;
          }
          if (Object.keys(errors).length > 0) invalid.push({ row, index: i + 1, errors });
          else valid.push(row);
        });
        setValidationResults({ valid, invalid });
      } catch (err: unknown) {
        setErrorDetails("Failure parsing Excel file: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4" id="school-work-importer">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-orange-500" />
            Bulk School Work Import
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload Excel matching the school work column layout (school name, UDISE, headmaster, bank details, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDownloadTemplate(false)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Download size={14} /> Blank Template
          </button>
          <button
            type="button"
            onClick={() => handleDownloadTemplate(true)}
            className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Download size={14} /> Sample
          </button>
        </div>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          dragActive ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-orange-300 hover:bg-slate-50"
        }`}
      >
        <Upload className="mx-auto text-slate-400 mb-2" size={28} />
        <p className="text-sm font-semibold text-slate-700">Drop Excel file here or click to browse</p>
        <p className="text-xs text-slate-400 mt-1">.xlsx / .xls supported</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
      </div>

      {errorDetails && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {errorDetails}
        </div>
      )}

      {headerAnalysis && (
        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="font-bold">Header match:</span> {headerAnalysis.matched.length} of {SCHOOL_EXCEL_ROW_HEADERS.length} columns found.
          {headerAnalysis.unmatched.length > 0 && (
            <span className="text-amber-700 block mt-1">Missing: {headerAnalysis.unmatched.join(", ")}</span>
          )}
        </div>
      )}

      {validationResults && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[80] flex items-center justify-center p-4" onClick={() => setValidationResults(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-800">Import Preview</h3>
              <button type="button" onClick={() => setValidationResults(null)} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                <CheckCircle size={16} />
                <span className="font-bold">{validationResults.valid.length} valid row(s) ready to import</span>
              </div>
              {validationResults.invalid.length > 0 && (
                <div className="text-rose-700 bg-rose-50 p-3 rounded-lg">
                  <span className="font-bold">{validationResults.invalid.length} row(s) skipped due to errors</span>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setValidationResults(null)} className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={validationResults.valid.length === 0}
                onClick={() => {
                  onImportSuccess(validationResults.valid);
                  setValidationResults(null);
                }}
                className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-40"
              >
                Import {validationResults.valid.length} School(s)
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
