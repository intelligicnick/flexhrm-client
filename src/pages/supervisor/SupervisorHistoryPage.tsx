import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronDown, MapPin, Package } from "lucide-react";
import { SchoolVisit } from "../../types";
import { parseApiError } from "../../api";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import {
  buildHistoryVisitQuery,
  createDefaultHistoryFilter,
  formatDisplayDate,
  groupVisitsByDate,
  visitMatchesFilter,
} from "../../lib/supervisor-dates";
import SupervisorDateFilter from "./SupervisorDateFilter";
import { SupervisorEmptyState, SupervisorLoadingScreen } from "./SupervisorUI";

import SupervisorPhotoLightbox from "./SupervisorPhotoLightbox";

function photoSrc(photo: SchoolVisit["photos"][number]) {
  return photo.photoDataBase64.startsWith("data:")
    ? photo.photoDataBase64
    : `data:${photo.mimeType};base64,${photo.photoDataBase64}`;
}

function VisitCard({ visit, tStatus }: { visit: SchoolVisit; tStatus: (s: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { t } = useSupervisorI18n();

  const statusColors = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    submitted: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {lightboxSrc && (
        <SupervisorPhotoLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left cursor-pointer hover:bg-slate-50/50 transition"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm break-words">{visit.schoolName}</p>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />
              {visit.block}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                statusColors[visit.status as keyof typeof statusColors] || statusColors.submitted
              }`}
            >
              {tStatus(visit.status)}
            </span>
            <ChevronDown
              size={16}
              className={`text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
        {visit.photos?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {visit.photos.slice(0, 3).map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxSrc(photoSrc(photo));
                }}
                className="cursor-pointer"
              >
                <img
                  src={photoSrc(photo)}
                  alt=""
                  className="w-14 h-14 object-cover rounded-xl border border-slate-200"
                />
              </button>
            ))}
            {visit.photos.length > 3 && (
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                +{visit.photos.length - 3}
              </div>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          {visit.notes && (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{t("notes")}</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{visit.notes}</p>
            </div>
          )}
          {visit.materialsGiven?.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                <Package size={10} /> {t("materialsGiven")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visit.materialsGiven.map((m) => (
                  <span
                    key={m.item}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100"
                  >
                    {m.item} × {m.qty}
                  </span>
                ))}
              </div>
            </div>
          )}
          {visit.photos?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {visit.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxSrc(photoSrc(photo))}
                  className="cursor-pointer"
                >
                  <img
                    src={photoSrc(photo)}
                    alt=""
                    className="w-full aspect-square object-cover rounded-xl border border-slate-200"
                  />
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 font-mono">UDISE {visit.udise}</p>
        </div>
      )}
    </div>
  );
}

export default function SupervisorHistoryPage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, tStatus, lang } = useSupervisorI18n();
  const [visits, setVisits] = useState<SchoolVisit[]>([]);
  const [filter, setFilter] = useState(createDefaultHistoryFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = buildHistoryVisitQuery(filter);
        const res = await supervisorFetch(`/api/school-visits/supervisor/mine?${params}`);
        if (!res.ok) throw await parseApiError(res, "Failed to load visits.");
        const data: SchoolVisit[] = await res.json();
        setVisits(data.filter((v) => visitMatchesFilter(v.visitDate, filter)));
      } catch {
        setVisits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supervisorFetch, filter]);

  const grouped = useMemo(() => groupVisitsByDate(visits), [visits]);

  return (
    <div className="space-y-4 pb-2">
      <SupervisorDateFilter filter={filter} onChange={setFilter} visitCount={loading ? undefined : visits.length} />

      {loading ? (
        <SupervisorLoadingScreen message={t("loading")} />
      ) : visits.length === 0 ? (
        <SupervisorEmptyState
          icon={MapPin}
          title={t("noVisitsInRange")}
          hint={t("tryDifferentFilter")}
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ date, items }) => (
            <section key={date}>
              <div className="sticky top-[72px] z-10 flex items-center justify-between mb-2 px-1 py-1.5 bg-[#f4f6f9] border-b border-slate-200/80 rounded-lg">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                  {formatDisplayDate(date, lang)}
                </h3>
                <span className="text-[10px] font-bold text-[#ff791a] bg-orange-100 px-2 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? t("visitSingular") : t("visitsCount")}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} tStatus={tStatus} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
