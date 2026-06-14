import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ChevronRight,
  CalendarDays,
  MessageSquarePlus,
  History,
  ClipboardList,
  Building2,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { SchoolWork, CommitmentDiary, SchoolVisit } from "../../types";
import { parseApiError } from "../../api";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import { toIsoDate } from "../../lib/supervisor-dates";
import {
  SupervisorChip,
  SupervisorEmptyState,
  SupervisorLoadingScreen,
  SupervisorPageHeader,
  SupervisorQuickAction,
  SupervisorSearchInput,
  SupervisorSection,
  SupervisorStatCard,
  SupervisorStatGrid,
} from "./SupervisorUI";

function getWeekBounds(): { fromDate: string; toDate: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { fromDate: toIsoDate(monday), toDate: toIsoDate(sunday) };
}

function isTodayInRange(fromDate: string, toDate: string, today: string): boolean {
  return fromDate <= today && toDate >= today;
}

export default function SupervisorHomePage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang } = useSupervisorI18n();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<SchoolWork[]>([]);
  const [commitments, setCommitments] = useState<CommitmentDiary[]>([]);
  const [weekVisits, setWeekVisits] = useState<SchoolVisit[]>([]);
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const today = toIsoDate(new Date());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { fromDate, toDate } = getWeekBounds();
      try {
        const [schoolsRes, commitRes, visitsRes] = await Promise.all([
          supervisorFetch("/api/school-visits/supervisor/schools"),
          supervisorFetch("/api/commitment-diary/supervisor/mine"),
          supervisorFetch(`/api/school-visits/supervisor/mine?fromDate=${fromDate}&toDate=${toDate}`),
        ]);
        if (schoolsRes.ok) setSchools(await schoolsRes.json());
        if (commitRes.ok) setCommitments(await commitRes.json());
        if (visitsRes.ok) setWeekVisits(await visitsRes.json());
      } catch {
        setSchools([]);
        setCommitments([]);
        setWeekVisits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supervisorFetch]);

  const blocks = useMemo(() => {
    const set = new Set(schools.map((s) => s.block).filter(Boolean));
    return Array.from(set).sort();
  }, [schools]);

  const todayCommitments = useMemo(
    () =>
      commitments.filter(
        (c) =>
          c.status !== "cancelled" &&
          c.status !== "completed" &&
          isTodayInRange(c.fromDate, c.toDate, today),
      ),
    [commitments, today],
  );

  const pendingCommitments = useMemo(
    () => commitments.filter((c) => c.status === "committed" || c.status === "in_progress"),
    [commitments],
  );

  const visitedSchoolIds = useMemo(
    () => new Set(weekVisits.map((v) => v.schoolWorkId)),
    [weekVisits],
  );

  const filtered = useMemo(() => {
    return schools
      .filter((s) => blockFilter === "all" || s.block === blockFilter)
      .filter(
        (s) =>
          !search.trim() ||
          s.schoolName?.toLowerCase().includes(search.toLowerCase()) ||
          s.udise?.includes(search) ||
          s.block?.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools, search, blockFilter]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("goodMorning");
    if (hour < 17) return t("goodAfternoon");
    return t("goodEvening");
  }, [t]);

  const name = localStorage.getItem("hrms_supervisor_name")?.split(" ")[0] || "";

  if (loading) {
    return <SupervisorLoadingScreen message={t("loading")} />;
  }

  return (
    <div className="space-y-4 pb-2">
      <SupervisorPageHeader
        title={`${greeting}${name ? `, ${name}` : ""}`}
        subtitle={new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      <SupervisorStatGrid>
        <SupervisorStatCard icon={Building2} label={t("schools")} value={schools.length} accent="orange" />
        <SupervisorStatCard
          icon={ClipboardList}
          label={t("todayPlan")}
          value={todayCommitments.length}
          accent="blue"
        />
        <SupervisorStatCard
          icon={History}
          label={t("thisWeek")}
          value={weekVisits.length}
          accent="emerald"
        />
      </SupervisorStatGrid>

      <div className="grid grid-cols-3 gap-2">
        <SupervisorQuickAction
          icon={CalendarDays}
          label={t("calendar")}
          onClick={() => navigate("/supervisor/calendar")}
        />
        <SupervisorQuickAction
          icon={MessageSquarePlus}
          label={t("raiseRequest")}
          onClick={() => navigate("/supervisor/requests")}
          variant="primary"
        />
        <SupervisorQuickAction
          icon={History}
          label={t("history")}
          onClick={() => navigate("/supervisor/history")}
        />
      </div>

      {todayCommitments.length > 0 && (
        <SupervisorSection title={t("todayCommitments")}>
          <div className="space-y-2 -my-1">
            {todayCommitments.slice(0, 5).map((entry) => (
              <Link
                key={entry.id}
                to={`/supervisor/visit/${entry.schoolWorkId}`}
                className="flex items-center gap-3 p-3 -mx-1 rounded-xl hover:bg-orange-50 active:bg-orange-100 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-sm truncate">{entry.schoolName}</p>
                  <p className="text-[11px] text-slate-400">{entry.block}</p>
                </div>
                <span className="text-[10px] font-bold text-[#ff791a] shrink-0 group-hover:underline">
                  {t("logVisit")} →
                </span>
              </Link>
            ))}
            {todayCommitments.length > 5 && (
              <p className="text-[10px] text-center text-slate-400 font-medium pt-1">
                +{todayCommitments.length - 5} {t("more")}
              </p>
            )}
          </div>
        </SupervisorSection>
      )}

      {pendingCommitments.length > 0 && todayCommitments.length === 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs text-blue-800">
          <p className="font-bold">{t("pendingCommitmentsHint")}</p>
          <button
            type="button"
            onClick={() => navigate("/supervisor/calendar")}
            className="mt-1 text-[#ff791a] font-bold cursor-pointer"
          >
            {t("viewCalendar")} →
          </button>
        </div>
      )}

      <SupervisorSection
        scrollable
        title={t("mySchools")}
        action={
          <span className="text-[10px] font-bold text-slate-400">
            {filtered.length} / {schools.length}
          </span>
        }
      >
        <div className="shrink-0 space-y-3 -mt-1">
          <SupervisorSearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("searchSchool")}
          />

          {blocks.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <SupervisorChip
                label={t("allBlocks")}
                active={blockFilter === "all"}
                onClick={() => setBlockFilter("all")}
                count={schools.length}
              />
              {blocks.map((block) => (
                <SupervisorChip
                  key={block}
                  label={block}
                  active={blockFilter === block}
                  onClick={() => setBlockFilter(block)}
                  count={schools.filter((s) => s.block === block).length}
                />
              ))}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 mt-3 -mx-1 px-1 overscroll-contain">
          {filtered.length === 0 ? (
            <SupervisorEmptyState
              icon={Building2}
              title={t("noSchoolsFound")}
              hint={t("tryDifferentFilter")}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((school) => {
                const visitedThisWeek = visitedSchoolIds.has(school.id);
                const hasTodayCommit = todayCommitments.some((c) => c.schoolWorkId === school.id);
                return (
                  <Link
                    key={school.id}
                    to={`/supervisor/visit/${school.id}`}
                    className={`block rounded-xl border p-3.5 transition active:scale-[0.99] ${
                      hasTodayCommit
                        ? "bg-orange-50 border-orange-200 shadow-sm"
                        : "bg-slate-50/80 border-slate-100 hover:border-orange-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                          hasTodayCommit
                            ? "bg-[#ff791a] text-white"
                            : visitedThisWeek
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-white border border-slate-200 text-slate-400"
                        }`}
                      >
                        {school.schoolName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm truncate">{school.schoolName}</p>
                          {hasTodayCommit && (
                            <span className="shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#ff791a] text-white">
                              {t("today")}
                            </span>
                          )}
                          {!hasTodayCommit && visitedThisWeek && (
                            <span className="shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              {t("visited")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          {school.block}
                          {school.noOfToilets > 0 && ` · ${school.noOfToilets} ${t("toilets")}`}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">UDISE {school.udise}</p>
                      </div>
                      <ChevronRight className="text-slate-300 shrink-0" size={18} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </SupervisorSection>
    </div>
  );
}
