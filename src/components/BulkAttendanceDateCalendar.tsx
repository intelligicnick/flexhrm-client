import React, { useCallback, useEffect, useRef, useState } from "react";

type MoveDirection = "left" | "right" | "up" | "down";

type BulkAttendanceDateCalendarProps = {
  selectedDates: number[];
  onSelectedDatesChange: React.Dispatch<React.SetStateAction<number[]>>;
  calendarMonth: string;
  onCalendarMonthChange: (month: string) => void;
  availableMonths: string[];
  getDaysInMonth: (month: string) => number;
  disabledDates?: Set<number>;
};

function buildWeeks(daysInMonth: number): number[][] {
  const weeks: number[][] = [];
  let currentWeek: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7 || day === daysInMonth) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  return weeks;
}

function rangeDays(anchor: number, focus: number): number[] {
  const start = Math.min(anchor, focus);
  const end = Math.max(anchor, focus);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function addDaysToSelection(previous: number[], days: number[]): number[] {
  return [...new Set([...previous, ...days])].sort((a, b) => a - b);
}

function getNextEnabledDay(
  dayNum: number,
  direction: MoveDirection,
  daysInMonth: number,
  disabledDates: Set<number>,
): number | null {
  let nextDay = dayNum;
  for (let step = 0; step < daysInMonth; step++) {
    if (direction === "left") nextDay -= 1;
    else if (direction === "right") nextDay += 1;
    else if (direction === "up") nextDay -= 7;
    else nextDay += 7;

    if (nextDay < 1 || nextDay > daysInMonth) return null;
    if (!disabledDates.has(nextDay)) return nextDay;
  }
  return null;
}

export default function BulkAttendanceDateCalendar({
  selectedDates,
  onSelectedDatesChange,
  calendarMonth,
  onCalendarMonthChange,
  availableMonths,
  getDaysInMonth,
  disabledDates = new Set<number>(),
}: BulkAttendanceDateCalendarProps) {
  const [anchorDay, setAnchorDay] = useState<number | null>(null);
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const daysInMonth = getDaysInMonth(calendarMonth);
  const weeks = buildWeeks(daysInMonth);

  const isDisabled = useCallback(
    (dayNum: number) => disabledDates.has(dayNum),
    [disabledDates],
  );

  useEffect(() => {
    setAnchorDay(null);
    setFocusDay(null);
  }, [calendarMonth]);

  useEffect(() => {
    if (selectedDates.length === 0) {
      setAnchorDay(null);
      setFocusDay(null);
    }
  }, [selectedDates.length]);

  const focusDayButton = useCallback((day: number) => {
    requestAnimationFrame(() => {
      buttonRefs.current.get(day)?.focus();
    });
  }, []);

  const handleDayClick = useCallback(
    (dayNum: number, shiftKey: boolean) => {
      if (isDisabled(dayNum)) return;

      if (shiftKey && anchorDay !== null && !isDisabled(anchorDay)) {
        const range = rangeDays(anchorDay, dayNum).filter((day) => !isDisabled(day));
        onSelectedDatesChange((previous) => addDaysToSelection(previous, range));
        setFocusDay(dayNum);
        return;
      }

      const isSelected = selectedDates.includes(dayNum);
      onSelectedDatesChange((previous) =>
        isSelected
          ? previous.filter((day) => day !== dayNum)
          : [...previous, dayNum].sort((a, b) => a - b),
      );
      setAnchorDay(dayNum);
      setFocusDay(dayNum);
    },
    [anchorDay, isDisabled, onSelectedDatesChange, selectedDates],
  );

  const moveFocus = useCallback(
    (dayNum: number, direction: MoveDirection, shiftKey: boolean) => {
      const nextDay = getNextEnabledDay(dayNum, direction, daysInMonth, disabledDates);
      if (nextDay === null) return;

      if (shiftKey) {
        const anchor = anchorDay ?? dayNum;
        if (anchorDay === null) setAnchorDay(dayNum);
        const range = rangeDays(anchor, nextDay).filter((day) => !isDisabled(day));
        onSelectedDatesChange((previous) => addDaysToSelection(previous, range));
        setFocusDay(nextDay);
        focusDayButton(nextDay);
        return;
      }

      setAnchorDay(nextDay);
      setFocusDay(nextDay);
      focusDayButton(nextDay);
    },
    [anchorDay, daysInMonth, disabledDates, focusDayButton, isDisabled, onSelectedDatesChange],
  );

  const handleDayKeyDown = useCallback(
    (event: React.KeyboardEvent, dayNum: number) => {
      const directionByKey: Partial<Record<string, MoveDirection>> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = directionByKey[event.key];
      if (!direction) return;

      event.preventDefault();
      moveFocus(dayNum, direction, event.shiftKey);
    },
    [moveFocus],
  );

  const handleColumnToggle = (colNum: number) => {
    const colDays: number[] = [];
    for (let day = colNum; day <= daysInMonth; day += 7) {
      if (!isDisabled(day)) colDays.push(day);
    }
    if (colDays.length === 0) return;

    const allSelected = colDays.every((day) => selectedDates.includes(day));
    if (allSelected) {
      onSelectedDatesChange((previous) => previous.filter((day) => !colDays.includes(day)));
    } else {
      onSelectedDatesChange((previous) => addDaysToSelection(previous, colDays));
    }
  };

  const handleWeekToggle = (weekDays: number[]) => {
    const enabledDays = weekDays.filter((day) => !isDisabled(day));
    if (enabledDays.length === 0) return;

    const allSelected = enabledDays.every((day) => selectedDates.includes(day));
    if (allSelected) {
      onSelectedDatesChange((previous) => previous.filter((day) => !enabledDays.includes(day)));
    } else {
      onSelectedDatesChange((previous) => addDaysToSelection(previous, enabledDays));
    }
  };

  const getInitialFocusDay = () => {
    for (let day = 1; day <= daysInMonth; day++) {
      if (!isDisabled(day)) return day;
    }
    return 1;
  };

  const initialFocusDay = getInitialFocusDay();

  return (
    <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
      <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          📅 Calendar Date Picker
        </span>
        <select
          id="bulk-calendar-month"
          name="bulkCalendarMonth"
          value={calendarMonth}
          onChange={(event) => onCalendarMonthChange(event.target.value)}
          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-3xs cursor-pointer focus:outline-none"
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1 mb-2 text-left">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Click dates to select. Arrow keys + Shift for ranges. Weekly offs are marked as WO per employee based on month and salary cycle.
          </p>
          <span className="text-orange-500 font-extrabold text-[9px]">
            ⚡ Click C1-C7 (Columns) or W1-W5 (Weeks) to bulk toggle
          </span>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 items-center">
          <div className="w-8" />

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, colIdx) => {
              const colNum = colIdx + 1;
              return (
                <button
                  key={colIdx}
                  type="button"
                  onClick={() => handleColumnToggle(colNum)}
                  className="h-6 w-full text-[9px] font-black bg-slate-200 hover:bg-slate-350 text-slate-600 rounded-md transition cursor-pointer select-none"
                  title={`Toggle all days in Column ${colNum}`}
                >
                  C{colNum}
                </button>
              );
            })}
          </div>

          {weeks.map((weekDays, weekIdx) => {
            const weekNum = weekIdx + 1;
            return (
              <React.Fragment key={weekIdx}>
                <button
                  type="button"
                  onClick={() => handleWeekToggle(weekDays)}
                  className="h-9 w-8 text-[9px] font-black bg-orange-100/60 hover:bg-orange-100 text-[#e4640c] rounded-lg transition cursor-pointer select-none"
                  title={`Toggle all days in Week ${weekNum}`}
                >
                  W{weekNum}
                </button>

                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((dayNum) => {
                    const isSelected = selectedDates.includes(dayNum);
                    const isFocused = focusDay === dayNum;
                    const disabled = isDisabled(dayNum);

                    if (disabled) {
                      return (
                        <div
                          key={dayNum}
                          className="h-9 w-full flex items-center justify-center font-bold text-[9px] rounded-lg border select-none bg-slate-100 border-slate-200 text-slate-400"
                          title="Not selectable — all selected employees exited"
                        >
                          {dayNum}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={dayNum}
                        ref={(element) => {
                          if (element) buttonRefs.current.set(dayNum, element);
                          else buttonRefs.current.delete(dayNum);
                        }}
                        type="button"
                        tabIndex={
                          isFocused || (focusDay === null && dayNum === initialFocusDay) ? 0 : -1
                        }
                        onClick={(event) => handleDayClick(dayNum, event.shiftKey)}
                        onKeyDown={(event) => handleDayKeyDown(event, dayNum)}
                        onFocus={() => setFocusDay(dayNum)}
                        className={`h-9 w-full flex items-center justify-center font-bold text-xs rounded-lg border transition cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ff791a] focus-visible:ring-offset-1 ${
                          isSelected
                            ? "bg-[#ff791a] border-orange-500 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                  {weekDays.length < 7 &&
                    Array.from({ length: 7 - weekDays.length }).map((_, index) => (
                      <div key={`empty-${index}`} className="h-9 w-full" />
                    ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
