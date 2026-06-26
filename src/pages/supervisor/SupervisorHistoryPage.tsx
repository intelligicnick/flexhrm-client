import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  toIsoDate,
  visitMatchesFilter,
} from "../../lib/supervisor-dates";
import SupervisorDateFilter from "./SupervisorDateFilter";
import { SupervisorEmptyState, SupervisorLoadingScreen } from "./SupervisorUI";
import SupervisorPhotoLightbox from "./SupervisorPhotoLightbox";
import { resolvePhotoSrc, resolvePhotoThumbnailSrc } from "../../lib/media-url";

function photoSrc(photo: SchoolVisitPhoto) {
  return resolvePhotoSrc(photo);
}

function photoThumbSrc(photo: SchoolVisitPhoto) {
  return resolvePhotoThumbnailSrc(photo);
}

type SchoolVisitPhoto = NonNullable<SchoolVisit["photos"]>[number];

function VisitCard({
  visit,
  tStatus,
  supervisorFetch,
  onPhotosLoaded,
}: {
  visit: SchoolVisit;
  tStatus: (s: string) => string;
  supervisorFetch: typeof fetch;
  onPhotosLoaded: (visitId: string, photos: NonNullable<SchoolVisit["photos"]>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<{ thumb: string; full: string } | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const { t } = useSupervisorI18n();

  const photoCount = visit.photos?.length ?? visit.photoCount ?? 0;
  const photos = visit.photos ?? [];

  const loadPhotos = useCallback(async () => {
    if (photos.length > 0 || loadingPhotos || photoCount === 0) return;
    setLoadingPhotos(true);
    try {
      const res = await supervisorFetch(
        `/api/school-visits/supervisor/mine?fromDate=${encodeURIComponent(visit.visitDate)}&toDate=${encodeURIComponent(visit.visitDate)}`,
      );
      if (!res.ok) return;
      const dayVisits: SchoolVisit[] = await res.json();
      const full = dayVisits.find((v) => v.id === visit.id);
      if (full?.photos?.length) {
        onPhotosLoaded(visit.id, full.photos);
      }
    } finally {
      setLoadingPhotos(false);
    }
  }, [loadingPhotos, onPhotosLoaded, photoCount, photos.length, supervisorFetch, visit.id, visit.visitDate]);

  useEffect(() => {
    if (expanded) void loadPhotos();
  }, [expanded, loadPhotos]);

  const statusColors = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    submitted: "bg-amber-100 text-amber-700",
  };

  const openLightbox = (photo: SchoolVisitPhoto) => {
    setLightbox({ thumb: photoThumbSrc(photo), full: photoSrc(photo) });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {lightbox && (
        <SupervisorPhotoLightbox
          thumbSrc={lightbox.thumb}
          src={lightbox.full}
          alt=""
          onClose={() => setLightbox(null)}
        />
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
        {photoCount > 0 && (
          <div className="flex gap-2 mt-3 items-center">
            {photos.slice(0, 3).map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(photo);
                }}
                className="cursor-pointer"
              >
                <img
                  src={photoThumbSrc(photo)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-14 h-14 object-cover rounded-xl border border-slate-200"
                />
              </button>
            ))}
            {photos.length === 0 && (
              <span className="text-[11px] font-medium text-slate-400">
                {loadingPhotos ? "…" : `${photoCount} photo${photoCount === 1 ? "" : "s"}`}
              </span>
            )}
            {photos.length > 3 && (
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                +{photos.length - 3}
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
                    {m.item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => openLightbox(photo)}
                  className="cursor-pointer"
                >
                  <img
                    src={photoThumbSrc(photo)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-square object-cover rounded-xl border border-slate-200"
                  />
                </button>
              ))}
            </div>
          )}
          {photoCount > 0 && photos.length === 0 && loadingPhotos && (
            <p className="text-xs text-slate-400">{t("loading")}</p>
          )}
          <p className="text-[10px] text-slate-400 font-mono">UDISE {visit.udise}</p>
        </div>
      )}
    </div>
  );
}

function splitFilterForProgressiveLoad(filter: ReturnType<typeof createDefaultHistoryFilter>) {
  const params = buildHistoryVisitQuery(filter);
  const search = new URLSearchParams(params);
  const fromDate = search.get("fromDate") || "";
  const toDate = search.get("toDate") || toDateFromToday();
  if (!fromDate) return { recentQuery: `${params}&lite=1`, olderQuery: null as string | null };

  const to = new Date(`${toDate}T12:00:00`);
  const recentFrom = new Date(to);
  recentFrom.setDate(recentFrom.getDate() - 6);
  const recentFromIso = toIsoDate(recentFrom);
  const effectiveRecentFrom = recentFromIso > fromDate ? recentFromIso : fromDate;

  const recentParams = new URLSearchParams(params);
  recentParams.set("fromDate", effectiveRecentFrom);
  recentParams.set("lite", "1");

  let olderQuery: string | null = null;
  if (effectiveRecentFrom > fromDate) {
    const dayBefore = new Date(`${effectiveRecentFrom}T12:00:00`);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const olderParams = new URLSearchParams(params);
    olderParams.set("toDate", toIsoDate(dayBefore));
    olderParams.set("lite", "1");
    olderQuery = olderParams.toString();
  }

  return { recentQuery: recentParams.toString(), olderQuery };
}

function toDateFromToday() {
  return toIsoDate(new Date());
}

export default function SupervisorHistoryPage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, tStatus, lang } = useSupervisorI18n();
  const [visits, setVisits] = useState<SchoolVisit[]>([]);
  const [filter, setFilter] = useState(createDefaultHistoryFilter);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const mergePhotos = useCallback((visitId: string, photos: NonNullable<SchoolVisit["photos"]>) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, photos, photoCount: photos.length } : v)),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadingOlder(false);
      try {
        const { recentQuery, olderQuery } = splitFilterForProgressiveLoad(filter);
        const res = await supervisorFetch(`/api/school-visits/supervisor/mine?${recentQuery}`);
        if (!res.ok) throw await parseApiError(res, "Failed to load visits.");
        const recent: SchoolVisit[] = await res.json();
        if (!cancelled) {
          setVisits(recent.filter((v) => visitMatchesFilter(v.visitDate, filter)));
          setLoading(false);
        }

        if (olderQuery && !cancelled) {
          setLoadingOlder(true);
          const oldRes = await supervisorFetch(`/api/school-visits/supervisor/mine?${olderQuery}`);
          if (oldRes.ok) {
            const older: SchoolVisit[] = await oldRes.json();
            if (!cancelled) {
              setVisits((prev) => {
                const ids = new Set(prev.map((v) => v.id));
                const merged = [
                  ...prev,
                  ...older.filter((v) => !ids.has(v.id) && visitMatchesFilter(v.visitDate, filter)),
                ];
                return merged.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
              });
            }
          }
          if (!cancelled) setLoadingOlder(false);
        }
      } catch {
        if (!cancelled) {
          setVisits([]);
          setLoading(false);
          setLoadingOlder(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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
          {loadingOlder && (
            <p className="text-center text-xs font-medium text-slate-400">{t("loading")}</p>
          )}
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
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    tStatus={tStatus}
                    supervisorFetch={supervisorFetch}
                    onPhotosLoaded={mergePhotos}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
