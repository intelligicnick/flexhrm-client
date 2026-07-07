import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, AlertTriangle, CheckCircle, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx";
import { SchoolBlock, SchoolDistrict, SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import {
  analyzeSchoolHeaders,
  formatSchoolFieldColumnRef,
  parseSchoolSheetRows,
  validateSchoolWork,
} from "../lib/school-work-helpers";
import { downloadSchoolWorkTemplate } from "../lib/school-work-template";

interface SchoolWorkImporterProps {
  onImportSuccess: (schools: Partial<SchoolWork>[]) => void;
  existingUdiseCodes: string[];
  districts?: SchoolDistrict[];
  blocks?: SchoolBlock[];
}

export default function SchoolWorkImporter({
  onImportSuccess,
  existingUdiseCodes,
  districts = [],
  blocks = [],
}: SchoolWorkImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [headerAnalysis, setHeaderAnalysis] = useState<{
    matched: string[];
    unmatched: string[];
    headerRowIndex: number;
    actualHeaderNames: string[];
    idxMap: Record<string, number>;
  } | null>(null);
  const [validationResults, setValidationResults] = useState<{
    valid: Partial<SchoolWork>[];
    invalid: {
      row: Partial<SchoolWork>;
      sheetRow: number;
      errors: Record<string, string>;
    }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configuredDistricts = districts.filter((d) => !d.deleted && d.name.trim());
  const configuredBlocks = blocks.filter((b) => !b.deleted && b.name.trim());
  const hasLocationLists = configuredDistricts.length > 0 && configuredBlocks.length > 0;

  const handleDownloadTemplate = async (isSample = false) => {
    try {
      await downloadSchoolWorkTemplate({ isSample, districts, blocks });
    } catch (err: unknown) {
      setErrorDetails(
        "Failed to create Excel template: " + (err instanceof Error ? err.message : String(err)),
      );
    }
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
        const parsedRows = parseSchoolSheetRows(sheetRows);

        const valid: Partial<SchoolWork>[] = [];
        const invalid: {
          row: Partial<SchoolWork>;
          sheetRow: number;
          errors: Record<string, string>;
        }[] = [];
        parsedRows.forEach(({ row, sheetRow }) => {
          const errors = validateSchoolWork(row, { districts, blocks });
          const udise = row.udise || "";
          if (existingUdiseCodes.includes(udise)) {
            errors.udise = `UDISE "${udise}" already exists in the system.`;
          }
          const dupeInFile = parsedRows.findIndex((r) => r.row.udise === udise) !== parsedRows.findIndex((r) => r.sheetRow === sheetRow);
          if (dupeInFile && udise) {
            errors.udise = `UDISE "${udise}" is repeated in this file.`;
          }
          if (Object.keys(errors).length > 0) invalid.push({ row, sheetRow, errors });
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
            Upload Excel matching the school work column layout. Choose district first — block dropdown lists only blocks under that district.
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

      {!hasLocationLists && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          Add districts and blocks under Employees → Configuration to enable Block and District dropdowns in the Excel template.
        </div>
      )}

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
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-800">School Import Preview</h3>
              <button type="button" onClick={() => setValidationResults(null)} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <CheckCircle size={16} className="shrink-0" />
                  <div>
                    <span className="font-bold block">{validationResults.valid.length} valid row(s)</span>
                    <span className="text-emerald-600">Ready to import</span>
                  </div>
                </div>
                {validationResults.invalid.length > 0 && (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-100">
                    <AlertTriangle size={16} className="shrink-0" />
                    <div>
                      <span className="font-bold block">{validationResults.invalid.length} row(s) with errors</span>
                      <span className="text-rose-600">Fix these in Excel and re-upload</span>
                    </div>
                  </div>
                )}
              </div>

              {validationResults.invalid.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm mb-2">
                    Errors by row and column ({validationResults.invalid.length})
                  </h4>
                  <div className="border border-amber-200 bg-amber-50/20 rounded-lg overflow-hidden">
                    <div className="max-h-[320px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-amber-50/90 text-slate-700 border-b border-amber-100 font-medium">
                            <th className="p-2.5 w-16 text-center">Row</th>
                            <th className="p-2.5 w-40">UDISE / School</th>
                            <th className="p-2.5">Column &amp; Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 bg-white">
                          {validationResults.invalid.map(({ row, sheetRow, errors }) => (
                            <tr key={sheetRow} className="hover:bg-amber-50/20 align-top">
                              <td className="p-2.5 text-center font-bold text-slate-600">#{sheetRow}</td>
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800">{row.udise || "—"}</div>
                                <div className="text-slate-500 truncate max-w-[150px]" title={row.schoolName || ""}>
                                  {row.schoolName || "No school name"}
                                </div>
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col gap-1.5">
                                  {Object.entries(errors).map(([field, errMsg]) => (
                                    <div key={field} className="text-rose-800 bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                                      <span className="font-bold">
                                        {formatSchoolFieldColumnRef(field, headerAnalysis?.idxMap)}:
                                      </span>{" "}
                                      {errMsg}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Row numbers match your Excel sheet. Column letters refer to the matched header row
                    {headerAnalysis && headerAnalysis.headerRowIndex >= 0
                      ? ` (row ${headerAnalysis.headerRowIndex + 1})`
                      : ""}.
                  </p>
                </div>
              )}

              {validationResults.invalid.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="bg-emerald-100 text-emerald-800 p-3 rounded-full mb-3">
                    <CheckCircle size={32} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">All rows passed validation</h4>
                  <p className="text-xs text-slate-500 mt-1">You can proceed with the import.</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-2 shrink-0">
              <button type="button" onClick={() => setValidationResults(null)} className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer">
                Cancel
              </button>
              <div className="flex gap-2">
                {validationResults.invalid.length > 0 && validationResults.valid.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onImportSuccess(validationResults.valid);
                      setValidationResults(null);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Import Only Valid ({validationResults.valid.length})
                  </button>
                )}
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
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
