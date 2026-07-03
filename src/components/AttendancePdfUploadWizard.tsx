import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileUp,
  Loader2,
  ScanLine,
  Upload,
  User,
} from "lucide-react";
import { Employee } from "../types";
import { extractAttendancePdfText, terminateAttendanceOcrWorker } from "../lib/attendance-pdf-extract";
import {
  ParsedAttendanceRow,
  ParsedAttendanceSheet,
  parseAttendanceSheetText,
} from "../lib/attendance-pdf-parser";

type WizardStep = "upload" | "review";

type AttendancePdfUploadWizardProps = {
  employees: Employee[];
  monthsList: string[];
  defaultMonth: string;
  canEdit: boolean;
  onBack: () => void;
  onApply: (sheet: ParsedAttendanceSheet, rows: ParsedAttendanceRow[], monthKey: string) => Promise<void>;
};

function confidenceBadge(confidence: ParsedAttendanceRow["matchConfidence"]): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "low":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-rose-100 text-rose-800 border-rose-200";
  }
}

export default function AttendancePdfUploadWizard({
  employees,
  monthsList,
  defaultMonth,
  canEdit,
  onBack,
  onApply,
}: AttendancePdfUploadWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedSheet, setParsedSheet] = useState<ParsedAttendanceSheet | null>(null);
  const [reviewRows, setReviewRows] = useState<ParsedAttendanceRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      void terminateAttendanceOcrWorker();
    };
  }, []);

  const includedCount = useMemo(
    () => reviewRows.filter((r) => r.included && r.matchedEmployeeId).length,
    [reviewRows],
  );

  const totalMarks = useMemo(() => {
    let count = 0;
    for (const row of reviewRows) {
      if (!row.included || !row.matchedEmployeeId) continue;
      count += Object.keys(row.dayMarks).length;
    }
    return count;
  }, [reviewRows]);

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Please upload a PDF file (typed export or scanned / pen-written sheet).");
      return;
    }
    setSelectedFile(file);
    setErrorMessage("");
    setParsedSheet(null);
    setReviewRows([]);
    setWizardStep("upload");
  }, []);

  const handleScanPdf = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setErrorMessage("");
    setProgressPercent(0);
    setProgressMessage("Starting…");

    try {
      const extracted = await extractAttendancePdfText(
        selectedFile,
        (message, percent) => {
          setProgressMessage(message);
          setProgressPercent(percent);
        },
        selectedMonth,
        employees,
      );

      const sheet = parseAttendanceSheetText(extracted.fullText, {
        source: extracted.source,
        fallbackMonthKey: selectedMonth,
        employees,
      });

      if (sheet.monthKey) {
        setSelectedMonth(sheet.monthKey);
      }

      setParsedSheet(sheet);
      setReviewRows(sheet.rows);
      setWizardStep("review");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to read the PDF.";
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
      setProgressPercent(0);
    }
  };

  const updateRow = (rowIndex: number, patch: Partial<ParsedAttendanceRow>) => {
    setReviewRows((prev) =>
      prev.map((row) => (row.rowIndex === rowIndex ? { ...row, ...patch } : row)),
    );
  };

  const handleApply = async () => {
    if (!parsedSheet || !canEdit) return;
    const monthKey = selectedMonth || parsedSheet.monthKey || defaultMonth;
    setIsApplying(true);
    try {
      await onApply({ ...parsedSheet, monthKey }, reviewRows, monthKey);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="text-left">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-slate-500 hover:text-[#ff791a] text-xs font-bold transition cursor-pointer mb-2"
          >
            ← Back to Daily Attendance Sheet
          </button>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mt-1">
            <ScanLine size={16} className="text-[#ff791a]" />
            Mark Attendance via PDF Upload
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload a typed or pen-written attendance PDF. OCR identifies name, work location, and P/A marks for review before saving.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
          {[
            { id: "upload" as const, label: "1. Upload & Scan", icon: Upload },
            { id: "review" as const, label: "2. Review & Confirm", icon: CheckCircle },
          ].map((stepItem) => {
            const Icon = stepItem.icon;
            const isDone = stepItem.id === "upload" && wizardStep === "review";
            const isActive = wizardStep === stepItem.id;
            return (
              <button
                key={stepItem.id}
                type="button"
                onClick={() => {
                  if (stepItem.id === "upload") setWizardStep("upload");
                  else if (stepItem.id === "review" && reviewRows.length > 0) setWizardStep("review");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#ff791a] text-white shadow-xs"
                    : isDone
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                      : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon size={14} />
                {stepItem.label}
              </button>
            );
          })}
        </div>
      </div>

      {wizardStep === "upload" ? (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-left">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block pb-1 border-b border-slate-200">
                How it works
              </span>
              <ul className="text-[11px] text-slate-600 space-y-2 list-disc pl-4">
                <li>Supports FlexHRM exported PDFs (typed text) and scanned / handwritten registers.</li>
                <li>Detects employee name, worksite location, and daily P / A marks.</li>
                <li>Matches rows to your employee registry before marking.</li>
                <li>Review every row on the next step before confirming.</li>
              </ul>
              <div className="pt-2 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Fallback month (if not in PDF)
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                >
                  {monthsList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  handleFileSelect(file ?? null);
                }}
                className="border-2 border-dashed border-slate-300 hover:border-[#ff791a] bg-white rounded-xl p-8 text-center cursor-pointer transition"
              >
                <FileUp size={36} className="mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-700">Drop attendance PDF here or click to browse</p>
                <p className="text-[11px] text-slate-500 mt-1">Typed export, scanned sheet, or pen-written register</p>
                {selectedFile && (
                  <p className="text-xs font-semibold text-[#ff791a] mt-3">
                    Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </div>

              {isProcessing && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                    <Loader2 size={14} className="animate-spin" />
                    {progressMessage || "Processing PDF…"}
                  </div>
                  <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ff791a] transition-all duration-300"
                      style={{ width: `${Math.max(5, progressPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3 text-left">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)] rounded-b-xl flex justify-end">
            <button
              type="button"
              disabled={!selectedFile || isProcessing}
              onClick={handleScanPdf}
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                selectedFile && !isProcessing
                  ? "bg-[#ff791a] hover:bg-[#e4640c] text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Scanning…
                </>
              ) : (
                <>
                  <ScanLine size={14} /> Scan PDF &amp; Continue to Review →
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-left">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200">
              Review extracted attendance
            </h5>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
              <span>
                Source:{" "}
                <strong className="text-slate-800">
                  {parsedSheet?.source === "ocr" ? "OCR (handwritten / scanned)" : "Typed PDF text"}
                </strong>
              </span>
              <span>
                Month:{" "}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="ml-1 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                >
                  {(parsedSheet?.monthKey ? [parsedSheet.monthKey, ...monthsList] : monthsList)
                    .filter((m, i, arr) => arr.indexOf(m) === i)
                    .map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </span>
              <span>
                Rows to apply: <strong className="text-emerald-700">{includedCount}</strong> / {reviewRows.length}
              </span>
              <span>
                Day marks: <strong className="text-[#ff791a]">{totalMarks}</strong>
              </span>
            </div>

            {parsedSheet?.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2.5"
              >
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {warning}
              </div>
            ))}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">Include</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">PDF Name</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">Location</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">Code</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">Match</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">P / A</th>
                    <th className="px-3 py-2 font-black text-slate-600 uppercase text-[10px]">Day marks</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                        No rows extracted. Go back and try another PDF.
                      </td>
                    </tr>
                  ) : (
                    reviewRows.map((row) => (
                      <tr key={row.rowIndex} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.included}
                            disabled={!row.matchedEmployeeId}
                            onChange={(e) => updateRow(row.rowIndex, { included: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-[#f57416] focus:ring-[#f57416]"
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800 max-w-[140px] truncate" title={row.name}>
                          {row.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[100px] truncate" title={row.location}>
                          {row.location || parsedSheet?.locationHint || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.employeeCode || "—"}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.matchedEmployeeId ?? ""}
                            onChange={(e) => {
                              const empId = e.target.value || null;
                              const emp = employees.find((x) => x.id === empId);
                              updateRow(row.rowIndex, {
                                matchedEmployeeId: empId,
                                matchConfidence: empId ? "medium" : "none",
                                matchNote: emp
                                  ? `Manually matched to ${emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}`
                                  : "Not matched",
                                included: Boolean(empId),
                              });
                            }}
                            className="max-w-[180px] px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-none"
                          >
                            <option value="">— Select employee —</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.nameAsPerAadharColumn || emp.nameAsPerAadhar} ({emp.employeeCode})
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 flex items-center gap-1">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${confidenceBadge(row.matchConfidence)}`}
                            >
                              {row.matchConfidence.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={row.matchNote}>
                              {row.matchNote}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-bold">
                          <span className="text-emerald-700">{row.presents}P</span>
                          {" / "}
                          <span className="text-rose-700">{row.absents}A</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-0.5 max-w-[220px]">
                            {Object.entries(row.dayMarks)
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([day, status]) => (
                                <span
                                  key={day}
                                  className={`text-[9px] font-black px-1 py-0.5 rounded ${
                                    status === "P"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : status === "A"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                  title={`Day ${day}: ${status}`}
                                >
                                  {day}
                                  {status}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)] rounded-b-xl flex justify-between items-center">
            <button
              type="button"
              onClick={() => setWizardStep("upload")}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              ← Back to Upload
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={includedCount === 0 || isApplying || !selectedMonth}
                onClick={handleApply}
                className="px-6 py-2.5 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Applying…
                  </>
                ) : (
                  <>
                    <User size={14} /> Confirm &amp; Mark {totalMarks} Day(s) for {includedCount} Employee(s)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
