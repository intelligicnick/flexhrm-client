import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, CheckCircle, User } from "lucide-react";
import { Employee } from "../types";
import {
  countMonthAttendance,
  getDayOfWeekForMonthDay,
  getEffectiveAttendanceStatus,
  isWeeklyOffDay,
} from "../lib/attendance-helpers";
import { isEmployeeExitedOnDayStatic } from "../lib/employee-helpers";
import BulkAttendanceDateCalendar from "./BulkAttendanceDateCalendar";
import { getBulkAttendanceDisabledDays } from "../lib/attendance-helpers";

type AttendanceDb = Record<string, Record<string, Record<number, string>>>;

type EmployeeAttendanceMarkingViewProps = {
  employee: Employee;
  selectedMonth: string;
  monthsList: string[];
  attendanceDb: AttendanceDb;
  canEdit: boolean;
  getDaysInMonth: (month: string) => number;
  onMonthChange: (month: string) => void;
  onBack: () => void;
  onCellChange: (empId: string, day: number, status: string, monthKey?: string) => void;
  onBulkApply: (empId: string, monthKey: string, days: number[], status: string) => Promise<void>;
};

function attendanceBadgeClass(code: string): string {
  const base = "text-[9px] font-black text-center rounded px-1 py-0.5 inline-block min-w-[1.5rem]";
  switch (code) {
    case "P":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "A":
      return `${base} bg-rose-100 text-rose-800`;
    case "L":
      return `${base} bg-amber-100 text-amber-800`;
    case "H":
      return `${base} bg-blue-100 text-blue-800`;
    case "WO":
      return `${base} bg-red-100 text-red-800`;
    default:
      return `${base} bg-slate-100 text-slate-400 font-semibold`;
  }
}

function cellBackgroundClass(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case "P":
      return "bg-emerald-50 border-emerald-200";
    case "A":
      return "bg-rose-50 border-rose-200";
    case "L":
      return "bg-amber-50 border-amber-200";
    case "H":
      return "bg-blue-50 border-blue-200";
    case "WO":
      return "bg-red-50 border-red-200";
    default:
      return "bg-white border-slate-200";
  }
}

export default function EmployeeAttendanceMarkingView({
  employee,
  selectedMonth,
  monthsList,
  attendanceDb,
  canEdit,
  getDaysInMonth,
  onMonthChange,
  onBack,
  onCellChange,
  onBulkApply,
}: EmployeeAttendanceMarkingViewProps) {
  const [wizardStep, setWizardStep] = useState<"dates" | "review">("dates");
  const [selectedDates, setSelectedDates] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("P");
  const [calendarMonth, setCalendarMonth] = useState(selectedMonth);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setCalendarMonth(selectedMonth);
  }, [selectedMonth]);

  const calendarMonthKey = calendarMonth || selectedMonth;
  const daysInMonth = getDaysInMonth(calendarMonthKey);
  const empData = attendanceDb[calendarMonthKey]?.[employee.id] || {};

  const disabledDayMeta = useMemo(
    () => getBulkAttendanceDisabledDays([employee], calendarMonthKey, daysInMonth),
    [employee, calendarMonthKey, daysInMonth],
  );

  const initKeyRef = useRef<string>("");

  // Pre-select days that already have attendance marked when employee or month changes
  useEffect(() => {
    const initKey = `${employee.id}:${calendarMonthKey}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;

    const monthData = attendanceDb[calendarMonthKey]?.[employee.id] || {};
    const markedDays = Object.entries(monthData)
      .filter(([, status]) => status && status !== "")
      .map(([day]) => Number(day))
      .filter((day) => !disabledDayMeta.disabledDays.has(day));
    setSelectedDates(markedDays.sort((a, b) => a - b));
    setWizardStep("dates");
  }, [calendarMonthKey, employee.id, attendanceDb, disabledDayMeta.disabledDays]);

  const { presents, absents } = countMonthAttendance(
    empData,
    daysInMonth,
    (day) => isEmployeeExitedOnDayStatic(employee, calendarMonthKey, day),
    { workingDaysType: employee.workingDaysType, monthStr: calendarMonthKey },
  );

  const handleCalendarMonthChange = (month: string) => {
    setCalendarMonth(month);
    onMonthChange(month);
  };

  const handleApplyBulk = async () => {
    if (selectedDates.length === 0) return;
    setIsApplying(true);
    try {
      await onBulkApply(employee.id, calendarMonthKey, selectedDates, bulkStatus);
      setWizardStep("dates");
    } finally {
      setIsApplying(false);
    }
  };

  const renderDayStatusCell = (dayNum: number) => {
    const currentStatus = empData[dayNum] || "";
    const isExited = isEmployeeExitedOnDayStatic(employee, calendarMonthKey, dayNum);
    const isWeeklyOff = isWeeklyOffDay(employee.workingDaysType, calendarMonthKey, dayNum);
    const isSunday = getDayOfWeekForMonthDay(calendarMonthKey, dayNum) === 0;
    const effectiveStatus = getEffectiveAttendanceStatus(
      employee.workingDaysType,
      calendarMonthKey,
      dayNum,
      currentStatus,
    );

    if (isExited) {
      return (
        <div
          key={dayNum}
          className="h-14 flex flex-col items-center justify-center rounded-lg border bg-slate-100 border-slate-200 text-slate-400"
          title="Exited / Inactive"
        >
          <span className="text-[10px] font-bold">{dayNum}</span>
          <span className="text-[9px] font-bold">—</span>
        </div>
      );
    }

    const bgClass = cellBackgroundClass(isWeeklyOff && currentStatus !== "P" ? "WO" : effectiveStatus || currentStatus);

    return (
      <div
        key={dayNum}
        className={`h-14 flex flex-col items-center justify-center rounded-lg border gap-0.5 ${bgClass} ${isSunday ? "ring-1 ring-red-100" : ""}`}
      >
        <span className="text-[10px] font-bold text-slate-600">{dayNum}</span>
        {isWeeklyOff && currentStatus !== "P" ? (
          canEdit ? (
            <select
              value="WO"
              onChange={(e) => {
                if (e.target.value === "P") onCellChange(employee.id, dayNum, "P", calendarMonthKey);
              }}
              className="text-[9px] font-black text-center border-0 rounded px-0.5 py-0 focus:ring-0 focus:outline-none cursor-pointer bg-transparent text-red-800"
            >
              <option value="WO">WO</option>
              <option value="P">P</option>
            </select>
          ) : (
            <span className={attendanceBadgeClass("WO")}>WO</span>
          )
        ) : isWeeklyOff && currentStatus === "P" ? (
          canEdit ? (
            <select
              value="P"
              onChange={(e) => {
                const val = e.target.value;
                onCellChange(employee.id, dayNum, val === "WO" ? "" : val, calendarMonthKey);
              }}
              className="text-[9px] font-black text-center border-0 rounded px-0.5 py-0 focus:ring-0 focus:outline-none cursor-pointer bg-transparent text-emerald-800"
            >
              <option value="WO">WO</option>
              <option value="P">P</option>
            </select>
          ) : (
            <span className={attendanceBadgeClass("P")}>P</span>
          )
        ) : canEdit ? (
          <select
            value={currentStatus}
            onChange={(e) => onCellChange(employee.id, dayNum, e.target.value, calendarMonthKey)}
            className={`text-[9px] font-black text-center border-0 rounded px-0.5 py-0 focus:ring-0 focus:outline-none cursor-pointer bg-transparent ${
              effectiveStatus === "P"
                ? "text-emerald-800"
                : effectiveStatus === "A"
                  ? "text-rose-800"
                  : effectiveStatus === "L"
                    ? "text-amber-800"
                    : effectiveStatus === "H"
                      ? "text-blue-800"
                      : "text-slate-400"
            }`}
          >
            <option value="">—</option>
            <option value="P">P</option>
            <option value="A">A</option>
            <option value="L">L</option>
            <option value="H">H</option>
          </select>
        ) : (
          <span className={attendanceBadgeClass(effectiveStatus || currentStatus || "—")}>
            {effectiveStatus || currentStatus || "—"}
          </span>
        )}
      </div>
    );
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
            <User size={16} className="text-[#ff791a]" />
            Individual Attendance Marking
          </h4>
          <p className="text-xs font-bold text-slate-700 mt-1">
            {employee.nameAsPerAadharColumn || employee.nameAsPerAadhar}{" "}
            <span className="font-mono text-slate-500">({employee.employeeCode})</span>
          </p>
          <p className="text-[11px] text-slate-455 mt-0.5">{employee.location || "Unassigned location"}</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
          {[
            { id: "dates" as const, label: "1. Select & Edit Dates", icon: Calendar },
            { id: "review" as const, label: "2. Review & Apply", icon: CheckCircle },
          ].map((stepItem) => {
            const Icon = stepItem.icon;
            const isDone = stepItem.id === "dates" && wizardStep === "review";
            const isActive = wizardStep === stepItem.id;
            return (
              <button
                key={stepItem.id}
                type="button"
                onClick={() => {
                  if (stepItem.id === "dates") setWizardStep("dates");
                  else if (stepItem.id === "review" && selectedDates.length > 0) setWizardStep("review");
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

      {wizardStep === "dates" ? (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-left">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block pb-1 border-b border-slate-200">
                Employee Summary
              </span>
              <div className="space-y-2 text-xs">
                <p className="text-slate-500 font-semibold">
                  Cycle Month:{" "}
                  <select
                    value={calendarMonthKey}
                    onChange={(e) => handleCalendarMonthChange(e.target.value)}
                    className="ml-1 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                  >
                    {monthsList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </p>
                <p className="text-slate-500 font-semibold">
                  Present: <strong className="text-emerald-600">{presents}</strong>
                </p>
                <p className="text-slate-500 font-semibold">
                  Absent: <strong className="text-rose-600">{absents}</strong>
                </p>
                <p className="text-slate-500 font-semibold">
                  Marked Days: <strong className="text-slate-800">{selectedDates.length}</strong>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Status Legend</span>
                <div className="flex flex-wrap gap-1">
                  {["P", "A", "L", "H", "WO"].map((code) => (
                    <span key={code} className={attendanceBadgeClass(code)}>{code}</span>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-200">
                Days with existing attendance are pre-selected. Use the calendar below to select dates for bulk marking, or edit each day directly in the month grid.
              </p>
            </div>

            <BulkAttendanceDateCalendar
              selectedDates={selectedDates}
              onSelectedDatesChange={setSelectedDates}
              calendarMonth={calendarMonthKey}
              onCalendarMonthChange={handleCalendarMonthChange}
              availableMonths={monthsList}
              getDaysInMonth={getDaysInMonth}
              disabledDates={disabledDayMeta.disabledDays}
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block pb-1 border-b border-slate-200 text-left">
              Daily Status Grid — {calendarMonthKey}
            </span>
            <p className="text-[10px] text-slate-500 text-left">
              Change attendance for any day using the dropdown. Existing marks are shown and saved immediately.
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <div key={label} className="text-center text-[9px] font-black text-slate-400 uppercase py-1">
                  {label}
                </div>
              ))}
              {Array.from({ length: getDayOfWeekForMonthDay(calendarMonthKey, 1) }).map((_, i) => (
                <div key={`pad-${i}`} className="h-14" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => renderDayStatusCell(i + 1))}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)] rounded-b-xl flex justify-end">
            <button
              type="button"
              disabled={selectedDates.length === 0}
              onClick={() => setWizardStep("review")}
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                selectedDates.length > 0
                  ? "bg-[#ff791a] hover:bg-[#e4640c] text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              Continue to Review & Apply →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-left">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200">
              Review & Apply Bulk Status
            </h5>
            <div className="space-y-2 text-xs font-semibold text-slate-755">
              <p>
                Employee:{" "}
                <strong className="text-slate-800">
                  {employee.nameAsPerAadharColumn || employee.nameAsPerAadhar} ({employee.employeeCode})
                </strong>
              </p>
              <p>
                Month: <strong className="text-slate-800">{calendarMonthKey}</strong>
              </p>
              <p>
                Selected Days ({selectedDates.length}):{" "}
                <span className="inline-flex flex-wrap gap-0.5 mt-1">
                  {selectedDates.sort((a, b) => a - b).map((d) => (
                    <span
                      key={d}
                      className="w-5 h-5 flex items-center justify-center bg-slate-200 border border-slate-300 text-slate-700 rounded font-bold text-[10px]"
                    >
                      {d}
                    </span>
                  ))}
                </span>
              </p>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-slate-500 font-semibold">Apply Status:</span>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  disabled={!canEdit}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                >
                  <option value="P">Present (P)</option>
                  <option value="A">Absent (A)</option>
                  <option value="L">Leave (L)</option>
                  <option value="H">Holiday (H)</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500">
                Weekly off days are marked as WO automatically based on the employee&apos;s salary cycle.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)] rounded-b-xl flex justify-between items-center">
            <button
              type="button"
              onClick={() => setWizardStep("dates")}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              ← Back to Date Selection
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={selectedDates.length === 0 || isApplying}
                onClick={handleApplyBulk}
                className="px-6 py-2.5 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? "Applying…" : `Apply ${bulkStatus} to ${selectedDates.length} Day(s)`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
