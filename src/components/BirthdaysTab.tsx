import React, { useMemo, useState } from "react";
import { Cake, Gift, PartyPopper, Sparkles, Search, MapPin, CalendarDays } from "lucide-react";
import { Employee } from "../types";
import {
  MONTH_NAME_LIST,
  getOrdinalDay,
  parseDateOfBirth,
  formatEmployeeBirthDate,
} from "../lib/date-helpers";

type MonthBirthday = Employee & { birthdayDay?: number; age?: number };

interface BirthdaysTabProps {
  birthdaySearchMonth: string;
  setBirthdaySearchMonth: (month: string) => void;
  birthdayTodayList: Employee[];
  birthdayMonthList: MonthBirthday[];
  birthdayTodayLabel: string;
  isFetchingBirthdays: boolean;
  employees: Employee[];
  simulatedBirthdayEmpIds: string[];
  setSimulatedBirthdayEmpIds: (ids: string[]) => void;
  setShowConfetti: (show: boolean) => void;
  triggerSuccess: (message: string) => void;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getEmployeeName(emp: Employee) {
  return emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "Unknown";
}

function getEmployeeInitial(emp: Employee) {
  return getEmployeeName(emp).charAt(0).toUpperCase() || "?";
}

function getEmployeeAge(emp: MonthBirthday) {
  if (emp.age != null) return emp.age;
  const dob = parseDateOfBirth(emp.dateOfBirth);
  return dob ? new Date().getFullYear() - dob.year : null;
}

function dispatchCelebration(
  setShowConfetti: (show: boolean) => void,
  triggerSuccess: (message: string) => void,
  message: string
) {
  setShowConfetti(true);
  setTimeout(() => setShowConfetti(false), 4000);
  triggerSuccess(message);
}

function AvatarBadge({ emp, size = "md", festive = false }: { emp: Employee; size?: "sm" | "md" | "lg"; festive?: boolean }) {
  const sizeClass = size === "lg" ? "w-14 h-14 text-lg" : size === "md" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${sizeClass} rounded-full font-extrabold flex items-center justify-center shrink-0 ${
        festive
          ? "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg shadow-orange-200 ring-4 ring-orange-100"
          : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
      }`}
    >
      {getEmployeeInitial(emp)}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent
          ? "bg-gradient-to-br from-orange-500 to-amber-500 border-orange-400/30 text-white shadow-md shadow-orange-200/50"
          : "bg-white border-slate-200 text-slate-800 shadow-xs"
      }`}
    >
      <p className={`text-[10px] font-black uppercase tracking-widest ${accent ? "text-orange-50" : "text-slate-400"}`}>
        {label}
      </p>
      <p className={`text-2xl font-black mt-1 tracking-tight ${accent ? "text-white" : "text-slate-800"}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 font-medium ${accent ? "text-orange-50/90" : "text-slate-500"}`}>{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 text-2xl flex items-center justify-center">{icon}</div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="text-xs text-slate-450 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function BirthdaysTab({
  birthdaySearchMonth,
  setBirthdaySearchMonth,
  birthdayTodayList,
  birthdayMonthList,
  birthdayTodayLabel,
  isFetchingBirthdays,
  employees,
  simulatedBirthdayEmpIds,
  setSimulatedBirthdayEmpIds,
  setShowConfetti,
  triggerSuccess,
}: BirthdaysTabProps) {
  const [monthSearch, setMonthSearch] = useState("");
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const selectedMonthNum = MONTH_NAME_LIST.indexOf(birthdaySearchMonth) + 1;
  const isCurrentMonth = selectedMonthNum === todayMonth;

  const todayBirthdays = useMemo(() => {
    const simulated = employees.filter(
      (emp) => simulatedBirthdayEmpIds.includes(emp.id) && !birthdayTodayList.some((b) => b.id === emp.id)
    );
    return [...birthdayTodayList, ...simulated];
  }, [birthdayTodayList, employees, simulatedBirthdayEmpIds]);

  const filteredMonthList = useMemo(() => {
    const q = monthSearch.toLowerCase().trim();
    if (!q) return birthdayMonthList;
    return birthdayMonthList.filter((emp) => {
      const name = getEmployeeName(emp).toLowerCase();
      const code = emp.employeeCode.toLowerCase();
      const loc = (emp.location || "").toLowerCase();
      return name.includes(q) || code.includes(q) || loc.includes(q);
    });
  }, [birthdayMonthList, monthSearch]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<number, MonthBirthday[]>();
    for (const emp of filteredMonthList) {
      const day = emp.birthdayDay ?? parseDateOfBirth(emp.dateOfBirth)?.day ?? 1;
      const list = groups.get(day) ?? [];
      list.push(emp);
      groups.set(day, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [filteredMonthList]);

  const upcomingSection = useMemo(() => {
    if (!isCurrentMonth) return { upcoming: groupedByDay, past: [] as [number, MonthBirthday[]][] };
    const upcoming: [number, MonthBirthday[]][] = [];
    const past: [number, MonthBirthday[]][] = [];
    for (const entry of groupedByDay) {
      if (entry[0] >= todayDay) upcoming.push(entry);
      else past.push(entry);
    }
    return { upcoming, past };
  }, [groupedByDay, isCurrentMonth, todayDay]);

  const nextUpcoming = useMemo(() => {
    if (todayBirthdays.length > 0) return null;
    const future = birthdayMonthList
      .map((emp) => ({
        emp,
        day: emp.birthdayDay ?? parseDateOfBirth(emp.dateOfBirth)?.day ?? 0,
      }))
      .filter(({ day }) => (isCurrentMonth ? day > todayDay : true))
      .sort((a, b) => a.day - b.day);
    return future[0] ?? null;
  }, [birthdayMonthList, todayBirthdays.length, isCurrentMonth, todayDay]);

  const daysInMonth = useMemo(() => {
    const year = now.getFullYear();
    return new Date(year, selectedMonthNum, 0).getDate();
  }, [selectedMonthNum, now]);

  const birthdayDaysSet = useMemo(
    () => new Set(birthdayMonthList.map((e) => e.birthdayDay ?? parseDateOfBirth(e.dateOfBirth)?.day ?? 0)),
    [birthdayMonthList]
  );

  const calendarCells = useMemo(() => {
    const year = now.getFullYear();
    const firstDow = new Date(year, selectedMonthNum - 1, 1).getDay();
    const cells: Array<{ day: number | null; hasBirthday: boolean; isToday: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, hasBirthday: false, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        hasBirthday: birthdayDaysSet.has(d),
        isToday: isCurrentMonth && d === todayDay,
      });
    }
    return cells;
  }, [now, selectedMonthNum, daysInMonth, birthdayDaysSet, isCurrentMonth, todayDay]);

  const renderBirthdayRow = (emp: MonthBirthday, day: number, isToday = false) => {
    const age = getEmployeeAge(emp);
    return (
      <div
        key={emp.id}
        className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
          isToday
            ? "bg-gradient-to-r from-orange-50 to-amber-50/60 border-orange-200 shadow-sm"
            : "bg-white border-slate-150 hover:border-orange-200 hover:shadow-sm"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 font-black ${
            isToday ? "bg-orange-500 text-white shadow-sm" : "bg-slate-100 text-slate-600"
          }`}
        >
          <span className="text-[9px] uppercase leading-none opacity-80">{MONTH_SHORT[selectedMonthNum - 1]}</span>
          <span className="text-sm leading-none">{day}</span>
        </div>
        <AvatarBadge emp={emp} festive={isToday} />
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-slate-800 truncate">{getEmployeeName(emp)}</h4>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            {emp.employeeCode}
            {emp.location ? (
              <span className="inline-flex items-center gap-0.5 ml-1.5">
                <MapPin size={9} className="shrink-0" />
                {emp.location}
              </span>
            ) : null}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {formatEmployeeBirthDate(emp.dateOfBirth)}
            {age != null && <span className="text-orange-600 font-bold ml-1.5">Turning {age}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            dispatchCelebration(
              setShowConfetti,
              triggerSuccess,
              `🎉 Birthday wishes sent to ${getEmployeeName(emp)}!`
            )
          }
          className={`p-2.5 rounded-xl transition active:scale-95 cursor-pointer shrink-0 ${
            isToday
              ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
              : "bg-orange-50 hover:bg-orange-100 text-orange-600 opacity-0 group-hover:opacity-100"
          }`}
          title="Send wishes"
        >
          <Gift size={14} />
        </button>
      </div>
    );
  };

  const renderDayGroup = (day: number, emps: MonthBirthday[]) => (
    <div key={day} className="space-y-2">
      <div className="flex items-center gap-2 sticky top-0 bg-white/95 backdrop-blur-sm py-1.5 z-10">
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
            isCurrentMonth && day === todayDay
              ? "bg-orange-500 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {getOrdinalDay(day)} {birthdaySearchMonth}
        </span>
        <span className="text-[10px] text-slate-400 font-bold">
          {emps.length} {emps.length === 1 ? "person" : "people"}
        </span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="space-y-2 pl-1">
        {emps.map((emp) => renderBirthdayRow(emp, day, isCurrentMonth && day === todayDay))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in" id="birthdays-celebration-tab-view">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-rose-400 p-6 text-white shadow-lg shadow-orange-200/40">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-rose-300/20 blur-xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={11} /> Team celebrations
            </div>
            <h3 className="text-xl font-black tracking-tight flex items-center gap-2.5">
              <Cake size={24} /> Birthday Calendar
            </h3>
            <p className="text-sm text-orange-50/90 max-w-lg">
              Never miss a teammate&apos;s special day. Celebrate today&apos;s birthdays and plan ahead for the month.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <StatCard
              label="Today"
              value={todayBirthdays.length}
              sub={birthdayTodayLabel}
              accent={todayBirthdays.length > 0}
            />
            <StatCard label="This month" value={birthdayMonthList.length} sub={birthdaySearchMonth} />
            <StatCard
              label="Next up"
              value={nextUpcoming ? getOrdinalDay(nextUpcoming.day) : "—"}
              sub={nextUpcoming ? getEmployeeName(nextUpcoming.emp) : "No upcoming birthdays"}
            />
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select month</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {MONTH_NAME_LIST.map((m) => {
            const active = m === birthdaySearchMonth;
            const count =
              m === birthdaySearchMonth
                ? birthdayMonthList.length
                : undefined;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setBirthdaySearchMonth(m)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-150"
                }`}
              >
                {MONTH_SHORT[MONTH_NAME_LIST.indexOf(m)]}
                {active && count !== undefined && (
                  <span className="ml-1.5 bg-white/25 px-1.5 py-0.5 rounded-md text-[10px]">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Today's spotlight */}
        <div className="xl:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-amber-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PartyPopper size={16} className="text-orange-500" />
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Today&apos;s spotlight</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{birthdayTodayLabel}</span>
            </div>
            <div className="p-4">
              {isFetchingBirthdays ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400">Loading...</div>
              ) : todayBirthdays.length === 0 ? (
                <EmptyState
                  icon="🎈"
                  title="No birthdays today"
                  description={`Nobody on the team is celebrating today. Check the month view for upcoming dates.`}
                />
              ) : (
                <div className="space-y-3">
                  {todayBirthdays.map((emp) => {
                    const age = getEmployeeAge(emp as MonthBirthday);
                    return (
                      <div
                        key={emp.id}
                        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 p-4 text-white shadow-md"
                      >
                        <div className="absolute top-2 right-3 text-3xl opacity-30 pointer-events-none">🎂</div>
                        <div className="flex items-center gap-3 relative z-10">
                          <AvatarBadge emp={emp} size="lg" festive />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-black truncate">{getEmployeeName(emp)}</h4>
                            <p className="text-[11px] text-orange-50 font-medium mt-0.5">{emp.employeeCode}</p>
                            {emp.location && (
                              <p className="text-[10px] text-orange-100/80 mt-0.5 flex items-center gap-1">
                                <MapPin size={10} /> {emp.location}
                              </p>
                            )}
                            {age != null && (
                              <p className="text-xs font-black mt-1.5 bg-white/20 inline-block px-2 py-0.5 rounded-lg">
                                Turning {age} today!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      dispatchCelebration(
                        setShowConfetti,
                        triggerSuccess,
                        "🎉 Birthday wishes and confetti sent to everyone celebrating today!"
                      )
                    }
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Gift size={14} /> Send wishes to all
                  </button>
                  {simulatedBirthdayEmpIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSimulatedBirthdayEmpIds([])}
                      className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Reset simulation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mini calendar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              {birthdaySearchMonth} overview
            </h4>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-[9px] font-bold text-slate-400 py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, i) =>
                cell.day === null ? (
                  <div key={`empty-${i}`} className="aspect-square" />
                ) : (
                  <div
                    key={cell.day}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold relative ${
                      cell.isToday
                        ? "bg-orange-500 text-white shadow-sm"
                        : cell.hasBirthday
                          ? "bg-orange-50 text-orange-700 border border-orange-200"
                          : "text-slate-400"
                    }`}
                  >
                    {cell.day}
                    {cell.hasBirthday && !cell.isToday && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-400" />
                    )}
                  </div>
                )
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <span className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-50 border border-orange-200" /> Has birthday
              </span>
              <span className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Today
              </span>
            </div>
          </div>
        </div>

        {/* Month timeline */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-800">
                {birthdaySearchMonth} birthdays
              </h4>
              <p className="text-[11px] text-slate-450 mt-0.5">
                {filteredMonthList.length} team {filteredMonthList.length === 1 ? "member" : "members"}
                {isCurrentMonth && upcomingSection.past.length > 0 ? " · grouped by date" : ""}
              </p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={monthSearch}
                onChange={(e) => setMonthSearch(e.target.value)}
                placeholder="Search name, code, site..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-400 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="flex-1 min-h-[360px] max-h-[520px] overflow-y-auto p-5 scrollbar-thin">
            {isFetchingBirthdays ? (
              <div className="py-20 text-center text-xs font-bold text-slate-400">Loading birthdays...</div>
            ) : filteredMonthList.length === 0 ? (
              <EmptyState
                icon="📅"
                title={monthSearch ? "No matches found" : `No birthdays in ${birthdaySearchMonth}`}
                description={
                  monthSearch
                    ? "Try a different search term or clear the filter."
                    : "Birthdays will appear here once employee date-of-birth records are added."
                }
              />
            ) : isCurrentMonth && upcomingSection.past.length > 0 ? (
              <div className="space-y-6">
                {upcomingSection.upcoming.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Upcoming
                    </p>
                    {upcomingSection.upcoming.map(([day, emps]) => renderDayGroup(day, emps))}
                  </div>
                )}
                {upcomingSection.past.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Earlier this month
                    </p>
                    {upcomingSection.past.map(([day, emps]) => renderDayGroup(day, emps))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByDay.map(([day, emps]) => renderDayGroup(day, emps))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
