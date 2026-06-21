import React, { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, CalendarRange } from "lucide-react";
import { SchoolWork, PlannedVisit, CommitmentDiary, SchoolVisit } from "../../types";
import { parseApiError } from "../../api";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import {
  formatDisplayDate,
  getCalendarDays,
  isDateInRange,
  isPastDate,
  toIsoDate,
} from "../../lib/supervisor-dates";
import {
  canVisitSchoolAgain,
  latestVisitDateBySchool,
} from "../../lib/supervisor-visit-cooldown";
import { fetchSupervisorSchools } from "../../lib/supervisor-schools-cache";

type SelectionMode = "single" | "multi" | "range";

export default function SupervisorCalendarPage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang } = useSupervisorI18n();
  const today = new Date();
  const todayIso = toIsoDate(today);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("single");
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedDates, setSelectedDates] = useState<string[]>([todayIso]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedVisit[]>([]);
  const [commitments, setCommitments] = useState<CommitmentDiary[]>([]);
  const [recentVisits, setRecentVisits] = useState<SchoolVisit[]>([]);
  const [schools, setSchools] = useState<SchoolWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planSchoolIds, setPlanSchoolIds] = useState<string[]>([]);
  const [schoolsByDate, setSchoolsByDate] = useState<Record<string, string[]>>({});
  const [planNotes, setPlanNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

  const loadData = async () => {
    setLoading(true);
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);
      const [planRes, schoolList, commitRes, visitsRes] = await Promise.all([
        supervisorFetch(`/api/planned-visits/supervisor/mine?monthKey=${monthKey}`),
        fetchSupervisorSchools(supervisorFetch),
        supervisorFetch("/api/commitment-diary/supervisor/mine"),
        supervisorFetch(
          `/api/school-visits/supervisor/mine?fromDate=${toIsoDate(lookback)}&toDate=${toIsoDate(today)}&lite=1`,
        ),
      ]);
      if (planRes.ok) setPlanned(await planRes.json());
      setSchools(schoolList);
      if (commitRes.ok) setCommitments(await commitRes.json());
      if (visitsRes.ok) setRecentVisits(await visitsRes.json());
    } catch {
      setPlanned([]);
      setCommitments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supervisorFetch, monthKey]);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const plannedByDate = useMemo(() => {
    const map = new Map<string, PlannedVisit[]>();
    for (const p of planned) {
      const list = map.get(p.plannedDate) || [];
      list.push(p);
      map.set(p.plannedDate, list);
    }
    return map;
  }, [planned]);

  const commitmentByDate = useMemo(() => {
    const map = new Map<string, CommitmentDiary[]>();
    for (const c of commitments) {
      if (c.status === "cancelled") continue;
      const cursor = new Date(c.fromDate + "T12:00:00");
      const end = new Date(c.toDate + "T12:00:00");
      while (cursor <= end) {
        const iso = toIsoDate(cursor);
        const list = map.get(iso) || [];
        list.push(c);
        map.set(iso, list);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [commitments]);

  const effectiveFromDate =
    selectionMode === "range" && rangeStart
      ? rangeEnd
        ? rangeStart <= rangeEnd
          ? rangeStart
          : rangeEnd
        : rangeStart
      : selectedDate;
  const effectiveToDate =
    selectionMode === "range" && rangeStart && rangeEnd
      ? rangeStart <= rangeEnd
        ? rangeEnd
        : rangeStart
      : selectedDate;

  const selectedCommitments = commitmentByDate.get(selectedDate) || [];
  const multiSelectedCommitments = useMemo(() => {
    if (selectionMode !== "multi") return [];
    const seen = new Set<string>();
    const rows: CommitmentDiary[] = [];
    for (const date of selectedDates) {
      for (const entry of commitmentByDate.get(date) || []) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        rows.push(entry);
      }
    }
    return rows;
  }, [selectionMode, selectedDates, commitmentByDate]);
  const rangeSelectedCommitments = useMemo(() => {
    if (selectionMode !== "range" || !rangeStart || !rangeEnd) return [];
    const from = effectiveFromDate;
    const to = effectiveToDate;
    const seen = new Set<string>();
    const rows: CommitmentDiary[] = [];
    for (const entry of commitments) {
      if (entry.status === "cancelled") continue;
      if (entry.fromDate <= to && entry.toDate >= from && !seen.has(entry.id)) {
        seen.add(entry.id);
        rows.push(entry);
      }
    }
    return rows.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }, [selectionMode, rangeStart, rangeEnd, effectiveFromDate, effectiveToDate, commitments]);
  const legacyPlannedVisits = useMemo(() => {
    const plans = plannedByDate.get(selectedDate) || [];
    const committedSchoolIds = new Set(
      selectedCommitments.map((c) => c.schoolWorkId),
    );
    return plans.filter((p) => !committedSchoolIds.has(p.schoolWorkId));
  }, [plannedByDate, selectedDate, selectedCommitments]);
  const rangeComplete = selectionMode === "range" && rangeStart && rangeEnd;
  const selectionIncludesPastDate = useMemo(() => {
    if (selectionMode === "single") return isPastDate(selectedDate, today);
    if (selectionMode === "multi") {
      return selectedDates.some((date) => isPastDate(date, today));
    }
    if (selectionMode === "range" && rangeStart && rangeEnd) {
      return isPastDate(effectiveFromDate, today);
    }
    return false;
  }, [
    selectionMode,
    selectedDate,
    selectedDates,
    rangeStart,
    rangeEnd,
    effectiveFromDate,
    today,
  ]);
  const sortedSelectedDates = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates],
  );

  const cooldownSchoolIds = useMemo(() => {
    const map = latestVisitDateBySchool(recentVisits);
    const blocked = new Set<string>();
    for (const [schoolId, lastVisit] of map) {
      if (!canVisitSchoolAgain(lastVisit)) blocked.add(schoolId);
    }
    return blocked;
  }, [recentVisits]);

  const getCommittedSchoolIds = (date: string) => {
    const set = new Set((commitmentByDate.get(date) || []).map((c) => c.schoolWorkId));
    for (const id of cooldownSchoolIds) set.add(id);
    return set;
  };

  const getCommittedSchoolIdsForRange = (fromDate: string, toDate: string) => {
    const set = new Set<string>();
    for (const entry of commitments) {
      if (entry.status === "cancelled") continue;
      if (entry.fromDate <= toDate && entry.toDate >= fromDate) {
        set.add(entry.schoolWorkId);
      }
    }
    for (const id of cooldownSchoolIds) set.add(id);
    return set;
  };

  const resetPlanForm = () => {
    setShowPlanForm(false);
    setPlanSchoolIds([]);
    setSchoolsByDate({});
    setPlanNotes("");
    setError(null);
  };

  const openPlanForm = () => {
    if (selectionIncludesPastDate) {
      setError(t("pastDateNotAllowed"));
      return;
    }
    if (selectionMode === "multi") {
      const initial: Record<string, string[]> = {};
      for (const date of sortedSelectedDates) {
        initial[date] = [];
      }
      setSchoolsByDate(initial);
    } else {
      setPlanSchoolIds([]);
    }
    setPlanNotes("");
    setError(null);
    setShowPlanForm(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));

  const monthCommitmentCount = useMemo(() => {
    let count = 0;
    for (const [iso, list] of commitmentByDate) {
      if (iso.startsWith(monthKey)) count += list.length;
    }
    return count;
  }, [commitmentByDate, monthKey]);

  const handleDateClick = (iso: string) => {
    if (selectionMode === "single") {
      setSelectedDate(iso);
      setSelectedDates([iso]);
      return;
    }
    if (selectionMode === "multi") {
      setSelectedDate(iso);
      setSelectedDates((prev) => {
        if (prev.includes(iso)) {
          const next = prev.filter((d) => d !== iso);
          return next.length > 0 ? next : [iso];
        }
        return [...prev, iso].sort();
      });
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso);
      setRangeEnd(null);
      setSelectedDate(iso);
      setSelectedDates([iso]);
      return;
    }
    setRangeEnd(iso);
    setSelectedDate(iso);
  };

  type CommitPayload = {
    schoolWorkId: string;
    fromDate: string;
    toDate: string;
  };

  const buildCommitPayloads = (): CommitPayload[] => {
    if (selectionMode === "multi") {
      const payloads: CommitPayload[] = [];
      for (const date of sortedSelectedDates) {
        const schoolIds = schoolsByDate[date] || [];
        for (const schoolWorkId of schoolIds) {
          payloads.push({ schoolWorkId, fromDate: date, toDate: date });
        }
      }
      return payloads;
    }

    const fromDate = effectiveFromDate;
    const toDate = effectiveToDate;
    return planSchoolIds.map((schoolWorkId) => ({
      schoolWorkId,
      fromDate,
      toDate,
    }));
  };

  const handleSaveCommitments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectionIncludesPastDate) {
      setError(t("pastDateNotAllowed"));
      return;
    }
    const payloads = buildCommitPayloads();
    if (payloads.length === 0) {
      setError(
        selectionMode === "multi" && sortedSelectedDates.length === 0
          ? t("selectAtLeastOneDate")
          : t("selectAtLeastOneSchool"),
      );
      return;
    }
    if (selectionMode === "range" && !rangeComplete) return;

    setSaving(true);
    setError(null);
    try {
      for (const payload of payloads) {
        const res = await supervisorFetch("/api/commitment-diary/supervisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            notes: planNotes,
          }),
        });
        if (!res.ok) throw await parseApiError(res, "Failed to commit visit.");
      }
      resetPlanForm();
      setRangeStart(null);
      setRangeEnd(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  };

  const formatRangeLabel = () => {
    if (effectiveFromDate === effectiveToDate) {
      return formatDisplayDate(effectiveFromDate, lang);
    }
    return `${formatDisplayDate(effectiveFromDate, lang)} – ${formatDisplayDate(effectiveToDate, lang)}`;
  };

  const weekDays = lang === "hi"
    ? ["र", "सो", "मं", "बु", "गु", "शु", "श"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth} className="p-2 text-slate-500 cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-black text-slate-900 text-sm">{monthLabel}</h2>
          <p className="text-[10px] text-slate-400 font-bold text-center">
            {monthCommitmentCount} {t("commitmentsThisMonth")}
          </p>
          <button type="button" onClick={nextMonth} className="p-2 text-slate-500 cursor-pointer">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setSelectionMode("single");
              setRangeStart(null);
              setRangeEnd(null);
              setSelectedDates([selectedDate]);
            }}
            className={`py-2 text-xs font-bold rounded-lg cursor-pointer ${
              selectionMode === "single"
                ? "bg-[#ff791a] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {t("singleDay")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode("range");
              setRangeStart(selectedDate);
              setRangeEnd(null);
              setSelectedDates([selectedDate]);
            }}
            className={`py-2 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 ${
              selectionMode === "range"
                ? "bg-[#ff791a] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <CalendarRange size={12} />
            {t("dateRangeMode")}
          </button>
        </div>

        {selectionMode === "range" && (
          <p className="text-[10px] text-slate-500 mb-2 text-center">
            {!rangeStart || rangeEnd
              ? t("rangeSelected")
              : t("rangeSelectEnd")}
          </p>
        )}

        {selectionMode === "multi" && (
          <p className="text-[10px] text-slate-500 mb-2 text-center">
            {t("multiDayHint")} · {selectedDates.length} {t("datesSelected")}
          </p>
        )}

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
          {weekDays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const iso = toIsoDate(day);
            const isToday = iso === todayIso;
            const isPast = isPastDate(iso, today);
            const dayPlans = plannedByDate.get(iso) || [];
            const dayCommitments = commitmentByDate.get(iso) || [];
            const commitmentCount = dayCommitments.length;
            const hasPlans = dayPlans.length > 0;
            const hasCommitment = commitmentCount > 0;

            let cellClass = isPast
              ? "text-slate-300 bg-slate-50 cursor-default"
              : "hover:bg-slate-100 text-slate-700";
            if (selectionMode === "single") {
              const isSelected = iso === selectedDate;
              cellClass = isSelected
                ? "bg-[#ff791a] text-white"
                : isToday
                  ? "bg-orange-100 text-orange-700"
                  : isPast
                    ? "text-slate-300 bg-slate-50 cursor-default"
                    : cellClass;
            } else if (selectionMode === "multi") {
              const isSelected = selectedDates.includes(iso);
              cellClass = isSelected
                ? "bg-[#ff791a] text-white"
                : isToday
                  ? "bg-orange-100 text-orange-700"
                  : isPast
                    ? "text-slate-300 bg-slate-50 cursor-default"
                    : cellClass;
            } else if (rangeStart && rangeEnd) {
              const inRange = isDateInRange(iso, rangeStart, rangeEnd);
              const isStart = iso === effectiveFromDate;
              const isEnd = iso === effectiveToDate;
              cellClass = inRange
                ? isStart || isEnd
                  ? "bg-[#ff791a] text-white"
                  : "bg-orange-200 text-orange-900"
                : isToday
                  ? "bg-orange-50 text-orange-700"
                  : isPast
                    ? "text-slate-300 bg-slate-50 cursor-default"
                    : cellClass;
            } else if (rangeStart && iso === rangeStart) {
              cellClass = "bg-[#ff791a] text-white";
            } else if (isToday) {
              cellClass = "bg-orange-100 text-orange-700";
            } else if (isPast) {
              cellClass = "text-slate-300 bg-slate-50 cursor-default";
            }

            const showMarkers = (hasPlans || hasCommitment) && !cellClass.includes("bg-[#ff791a]");

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDateClick(iso)}
                className={`min-h-[52px] rounded-xl text-xs font-bold flex flex-col items-center justify-between py-1.5 px-1 cursor-pointer transition ${cellClass}`}
              >
                <span className="leading-none">{day.getDate()}</span>
                {showMarkers ? (
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    {hasCommitment && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-blue-600 text-white leading-none">
                        {commitmentCount > 9 ? "9+" : commitmentCount}
                      </span>
                    )}
                    {hasPlans && !hasCommitment && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff791a]" />
                    )}
                  </div>
                ) : (
                  <span className="h-3" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-slate-900 text-sm">
          {selectionMode === "range"
            ? formatRangeLabel()
            : selectionMode === "multi"
              ? selectedDates.length === 1
                ? formatDisplayDate(selectedDates[0], lang)
                : `${selectedDates.length} ${t("datesSelected")}`
              : formatDisplayDate(selectedDate, lang)}
        </h3>
        <button
          type="button"
          onClick={openPlanForm}
          disabled={
            selectionIncludesPastDate ||
            (selectionMode === "range" && !rangeComplete) ||
            (selectionMode === "multi" && selectedDates.length === 0)
          }
          title={selectionIncludesPastDate ? t("pastDateNotAllowed") : undefined}
          className="flex items-center gap-1 px-3 py-2 bg-[#ff791a] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40"
        >
          <Plus size={14} />
          {selectionMode === "range" ? t("commitRange") : t("commitVisit")}
        </button>
      </div>

      {showPlanForm && (
        <form
          onSubmit={handleSaveCommitments}
          className="bg-white rounded-2xl border border-orange-200 p-4 space-y-3"
        >
          {selectionMode === "range" ? (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              <span className="font-bold block">{t("commitRangeHint")}</span>
              {formatRangeLabel()}
            </div>
          ) : selectionMode === "multi" ? (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              <span className="font-bold block">{t("commitmentDiary")}</span>
              {sortedSelectedDates.map((date) => formatDisplayDate(date, lang)).join(" · ")}
            </div>
          ) : (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              <span className="font-bold block">{t("commitmentDiary")}</span>
              {formatDisplayDate(selectedDate, lang)}
            </div>
          )}

          {selectionMode === "multi" ? (
            <div className="space-y-3">
              {sortedSelectedDates.map((date) => (
                <SchoolMultiSelect
                  key={date}
                  label={formatDisplayDate(date, lang)}
                  schools={schools}
                  selectedIds={schoolsByDate[date] || []}
                  excludedIds={getCommittedSchoolIds(date)}
                  onChange={(ids) =>
                    setSchoolsByDate((prev) => ({ ...prev, [date]: ids }))
                  }
                  t={t}
                />
              ))}
            </div>
          ) : (
            <SchoolMultiSelect
              label={t("selectSchools")}
              schools={schools}
              selectedIds={planSchoolIds}
              excludedIds={
                selectionMode === "range"
                  ? getCommittedSchoolIdsForRange(effectiveFromDate, effectiveToDate)
                  : getCommittedSchoolIds(selectedDate)
              }
              onChange={setPlanSchoolIds}
              t={t}
            />
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">{t("notes")}</label>
            <input
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              placeholder="Optional"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || (selectionMode === "range" && !rangeComplete)}
              className="flex-1 py-2.5 bg-[#ff791a] text-white font-bold rounded-xl text-xs disabled:opacity-50"
            >
              {saving
                ? t("loading")
                : selectionMode === "range"
                  ? t("commitRange")
                  : t("savePlan")}
            </button>
            <button
              type="button"
              onClick={resetPlanForm}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
            >
              {t("cancelPlan")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-slate-400 text-sm">{t("loading")}</p>
      ) : selectionMode === "range" ? (
        rangeComplete && rangeSelectedCommitments.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-6">{t("noCommitmentsForDay")}</p>
        ) : rangeComplete ? (
          <CommitmentListSection
            title={formatRangeLabel()}
            count={rangeSelectedCommitments.length}
            entries={rangeSelectedCommitments}
            lang={lang}
            t={t}
            cooldownSchoolIds={cooldownSchoolIds}
          />
        ) : null
      ) : selectionMode === "multi" ? (
        multiSelectedCommitments.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-6">{t("noCommitmentsForDay")}</p>
        ) : (
          <CommitmentListSection
            title={`${selectedDates.length} ${t("datesSelected")}`}
            count={multiSelectedCommitments.length}
            entries={multiSelectedCommitments}
            lang={lang}
            t={t}
            showDate
            cooldownSchoolIds={cooldownSchoolIds}
          />
        )
      ) : selectionMode === "single" && selectedCommitments.length === 0 && legacyPlannedVisits.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">{t("noCommitmentsForDay")}</p>
      ) : selectionMode === "single" ? (
        <div className="space-y-2">
          {selectedCommitments.length > 0 && (
            <CommitmentListSection
              title={formatDisplayDate(selectedDate, lang)}
              count={selectedCommitments.length}
              entries={selectedCommitments}
              lang={lang}
              t={t}
              cooldownSchoolIds={cooldownSchoolIds}
            />
          )}
          {legacyPlannedVisits.length > 0 && (
            <>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {t("planned")}
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {legacyPlannedVisits.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm truncate">{plan.schoolName}</p>
                      <p className="text-xs text-slate-400">{plan.block}</p>
                      {plan.notes && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{plan.notes}</p>}
                      <span className="inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {t("planned")}
                      </span>
                    </div>
                    <Link
                      to={`/supervisor/visit/${plan.schoolWorkId}`}
                      className={`shrink-0 px-3 py-2 text-[10px] font-bold rounded-xl transition ${
                        cooldownSchoolIds.has(plan.schoolWorkId)
                          ? "bg-slate-200 text-slate-500 pointer-events-none"
                          : "bg-[#ff791a] text-white hover:bg-orange-600"
                      }`}
                    >
                      {t("completeCommitment")}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CommitmentListSection({
  title,
  count,
  entries,
  lang,
  t,
  showDate = false,
  cooldownSchoolIds = new Set<string>(),
}: {
  title: string;
  count: number;
  entries: CommitmentDiary[];
  lang: "en" | "hi";
  t: (key: string) => string;
  showDate?: boolean;
  cooldownSchoolIds?: Set<string>;
}) {
  const statusLabel: Record<CommitmentDiary["status"], string> = {
    committed: t("statusCommitted"),
    in_progress: t("statusInProgress"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled"),
  };
  const statusStyle: Record<CommitmentDiary["status"], string> = {
    committed: "bg-indigo-100 text-indigo-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
          {t("commitmentDiary")}
        </p>
        <span className="text-[10px] font-bold text-slate-500">
          {count} total
        </span>
      </div>
      <p className="text-xs font-bold text-slate-700">{title}</p>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        {entries.map((entry) => {
          const canComplete =
            (entry.status === "committed" || entry.status === "in_progress") &&
            !cooldownSchoolIds.has(entry.schoolWorkId);
          return (
            <div
              key={entry.id}
              className="bg-white border border-blue-100 rounded-2xl p-3 flex items-start gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm break-words">{entry.schoolName}</p>
                <p className="text-xs text-slate-400">
                  {showDate || entry.fromDate !== entry.toDate
                    ? entry.fromDate === entry.toDate
                      ? formatDisplayDate(entry.fromDate, lang)
                      : `${formatDisplayDate(entry.fromDate, lang)} – ${formatDisplayDate(entry.toDate, lang)}`
                    : entry.block}
                  {showDate && entry.block ? ` · ${entry.block}` : !showDate && entry.block ? ` · ${entry.block}` : ""}
                </p>
                {entry.notes && (
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{entry.notes}</p>
                )}
                <span
                  className={`inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusStyle[entry.status]}`}
                >
                  {statusLabel[entry.status]}
                </span>
              </div>
              {canComplete && (
                <Link
                  to={`/supervisor/visit/${entry.schoolWorkId}`}
                  className="shrink-0 px-3 py-2 bg-[#ff791a] text-white text-[10px] font-bold rounded-xl hover:bg-orange-600 transition"
                >
                  {t("completeCommitment")}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchoolMultiSelect({
  label,
  schools,
  selectedIds,
  excludedIds,
  onChange,
  t,
}: {
  label: string;
  schools: SchoolWork[];
  selectedIds: string[];
  excludedIds: Set<string>;
  onChange: (ids: string[]) => void;
  t: (key: string) => string;
}) {
  const [search, setSearch] = useState("");
  const availableSchools = schools.filter((school) => !excludedIds.has(school.id));
  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableSchools;
    return availableSchools.filter(
      (s) =>
        s.schoolName.toLowerCase().includes(q) ||
        s.udise.toLowerCase().includes(q) ||
        s.block.toLowerCase().includes(q),
    );
  }, [availableSchools, search]);

  const toggleSchool = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div>
      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchSchool")}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs mb-2"
      />
      <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2">
        {filteredSchools.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">{t("noSchoolsFound")}</p>
        ) : (
          filteredSchools.map((school) => {
            const checked = selectedIds.includes(school.id);
            return (
              <label
                key={school.id}
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer text-xs ${
                  checked ? "bg-orange-50 border border-orange-200" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSchool(school.id)}
                  className="mt-0.5 accent-[#ff791a]"
                />
                <span>
                  <span className="font-bold text-slate-800 block">{school.schoolName}</span>
                  <span className="text-slate-400">{school.block} · {school.udise}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-[10px] text-[#ff791a] font-bold mt-1">
          {selectedIds.length} {t("schoolsSelected")}
        </p>
      )}
    </div>
  );
}
