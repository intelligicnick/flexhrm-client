import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, RefreshCw, Save } from "lucide-react";
import { SchoolWork, SCHOOL_MATERIAL_ITEMS, SchoolVisit } from "../../types";
import { parseApiError } from "../../api";
import {
  hasValidVisitGps,
  probeGpsLocation,
  requireGpsLocationForStamp,
  stampVisitPhoto,
  StampedVisitPhoto,
  startGpsWarmup,
} from "../../lib/visit-photo";
import { captureLivePhoto } from "../../lib/live-camera";
import { formatDisplayDate, todayIsoInKolkata } from "../../lib/supervisor-dates";
import { pointsForVisit } from "../../lib/supervisor-gamification";
import { getMaterialLabel } from "../../lib/supervisor-materials";
import {
  canVisitSchoolAgain,
  daysUntilSchoolVisitAllowed,
  latestVisitDateBySchool,
} from "../../lib/supervisor-visit-cooldown";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import SupervisorPhotoLightbox from "./SupervisorPhotoLightbox";
import { SupervisorLoadingScreen } from "./SupervisorUI";

export default function SupervisorVisitPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang } = useSupervisorI18n();
  const [school, setSchool] = useState<SchoolWork | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [schoolLoadFailed, setSchoolLoadFailed] = useState(false);
  const [lastVisitDate, setLastVisitDate] = useState<string | null>(null);
  const visitDate = todayIsoInKolkata();

  const resolvePlaceName = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await supervisorFetch(
        `/api/school-visits/supervisor/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      );
      if (!res.ok) return "";
      const data = (await res.json()) as { placeName?: string };
      return String(data.placeName || "").trim();
    } catch {
      return "";
    }
  };

  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<{ item: string; qty: number }[]>([]);
  const [photos, setPhotos] = useState<StampedVisitPhoto[]>([]);
  const [gpsReady, setGpsReady] = useState<boolean | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsRefreshing, setGpsRefreshing] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [gpsPlaceName, setGpsPlaceName] = useState<string | null>(null);

  const refreshGps = async () => {
    setGpsRefreshing(true);
    try {
      const location = await probeGpsLocation(resolvePlaceName);
      setGpsReady(hasValidVisitGps(location));
      setGpsPlaceName(location.placeName || null);
      setGpsError(null);
    } catch (err: unknown) {
      setGpsReady(false);
      setGpsPlaceName(null);
      setGpsError(err instanceof Error ? err.message : t("gpsDenied"));
    } finally {
      setGpsRefreshing(false);
    }
  };

  useEffect(() => {
    const stopWarmup = startGpsWarmup();
    void refreshGps();
    return stopWarmup;
  }, [supervisorFetch]);

  useEffect(() => {
    if (!schoolId) {
      setSchool(null);
      setSchoolLoading(false);
      setSchoolLoadFailed(true);
      return;
    }

    let cancelled = false;

    (async () => {
      setSchoolLoading(true);
      setSchoolLoadFailed(false);
      try {
        const directRes = await supervisorFetch(
          `/api/school-visits/supervisor/schools/${encodeURIComponent(schoolId)}`,
        );
        if (directRes.ok) {
          const data = (await directRes.json()) as SchoolWork;
          if (!cancelled) setSchool(data);
        } else {
          const listRes = await supervisorFetch("/api/school-visits/supervisor/schools");
          if (listRes.ok) {
            const schools: SchoolWork[] = await listRes.json();
            const found = schools.find((entry) => String(entry.id) === String(schoolId)) || null;
            if (!cancelled) {
              setSchool(found);
              if (!found) setSchoolLoadFailed(true);
            }
          } else if (!cancelled) {
            setSchool(null);
            setSchoolLoadFailed(true);
          }
        }
      } catch {
        if (!cancelled) {
          setSchool(null);
          setSchoolLoadFailed(true);
        }
      } finally {
        if (!cancelled) setSchoolLoading(false);
      }

      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);
      const visitsRes = await supervisorFetch(
        `/api/school-visits/supervisor/mine?fromDate=${lookback.toISOString().slice(0, 10)}&toDate=${visitDate}`,
      );
      if (!cancelled && visitsRes.ok && schoolId) {
        const visits: SchoolVisit[] = await visitsRes.json();
        const map = latestVisitDateBySchool(visits);
        setLastVisitDate(map.get(schoolId) ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, supervisorFetch, visitDate]);

  const visitBlocked = useMemo(
    () => !canVisitSchoolAgain(lastVisitDate),
    [lastVisitDate],
  );
  const daysUntilAllowed = lastVisitDate ? daysUntilSchoolVisitAllowed(lastVisitDate) : 0;

  const changeMaterial = (item: string, delta: number) => {
    setMaterials((prev) => {
      const existing = prev.find((m) => m.item === item);
      if (!existing) {
        return delta > 0 ? [...prev, { item, qty: delta }] : prev;
      }
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((m) => m.item !== item);
      }
      return prev.map((m) => (m.item === item ? { ...m, qty: nextQty } : m));
    });
  };

  const handleLiveCapture = async () => {
    if (visitBlocked || !gpsReady) return;
    setCapturingPhoto(true);
    setError(null);
    try {
      const location = await requireGpsLocationForStamp(resolvePlaceName);
      const file = await captureLivePhoto();
      const stamped = await stampVisitPhoto(file, location, {
        schoolName: school?.schoolName,
        index: photos.length + 1,
      });
      setPhotos((prev) => [...prev, stamped]);
      setGpsPlaceName(location.placeName);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("photoCaptureFailed");
      setError(message);
      if (message.toLowerCase().includes("location") || message.toLowerCase().includes("gps")) {
        setGpsReady(false);
        setGpsError(message);
      }
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || visitBlocked) return;
    if (photos.length === 0) {
      setError(t("addPhotoRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const primary = photos[0];
      const res = await supervisorFetch("/api/school-visits/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolWorkId: schoolId,
          visitDate,
          notes,
          materialsGiven: materials,
          photos,
          gpsLocation: primary
            ? { lat: primary.lat, lng: primary.lng, locationLabel: primary.locationLabel }
            : undefined,
        }),
      });
      if (!res.ok) throw await parseApiError(res, t("requestSubmitFailed"));
      setEarnedXp(pointsForVisit(photos.length));
      setSuccess(true);
      setNotes("");
      setMaterials([]);
      setPhotos([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("requestSubmitFailed"));
    } finally {
      setSaving(false);
    }
  };

  const materialsCount = materials.reduce((sum, m) => sum + m.qty, 0);
  const canSubmit = photos.length > 0 && !saving && !capturingPhoto && !visitBlocked && gpsReady === true;

  if (schoolLoading) {
    return <SupervisorLoadingScreen message={t("loading")} />;
  }

  if (!school) {
    return (
      <div className="space-y-4 py-10 text-center px-4">
        <p className="text-slate-600 font-semibold">{t("schoolNotFound")}</p>
        {schoolLoadFailed && (
          <p className="text-xs text-slate-500 mt-2">{t("schoolNotFoundHint")}</p>
        )}
        <Link
          to="/supervisor"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#ff791a] mt-4"
        >
          <ArrowLeft size={16} /> {t("backToSchools")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <SupervisorPhotoLightbox
          src={photos[lightboxIndex].photoDataBase64}
          alt={photos[lightboxIndex].caption}
          caption={photos[lightboxIndex].locationLabel}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <Link
        to="/supervisor"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#ff791a]"
      >
        <ArrowLeft size={16} /> {t("backToSchools")}
      </Link>

      <div className="rounded-2xl bg-[#0C1E4A] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-300">{t("logVisit")}</p>
        <h1 className="font-bold text-lg mt-1 leading-snug break-words">{school.schoolName}</h1>
        <p className="text-sm text-slate-300 mt-1.5 flex items-start gap-1.5">
          <MapPin size={14} className="shrink-0 mt-0.5" />
          <span>
            {school.block} · UDISE {school.udise}
          </span>
        </p>
      </div>

      {visitBlocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">{t("visitCooldownTitle")}</p>
          <p className="mt-1 text-xs">
            {t("visitCooldownHint").replace("{days}", String(daysUntilAllowed))}
          </p>
        </div>
      )}

      <div
        className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${
          gpsReady
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : gpsReady === false
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-slate-50 border-slate-200 text-slate-600"
        }`}
      >
        <MapPin size={18} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {gpsReady === null && t("gpsChecking")}
            {gpsReady === true && t("gpsReady")}
            {gpsReady === false && (gpsError || t("gpsDenied"))}
          </p>
          {gpsReady === true && gpsPlaceName && (
            <p className="text-xs mt-1 opacity-90 truncate">{gpsPlaceName}</p>
          )}
          {gpsReady === false && (
            <button
              type="button"
              onClick={() => void refreshGps()}
              disabled={gpsRefreshing}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff791a] cursor-pointer"
            >
              <RefreshCw size={14} className={gpsRefreshing ? "animate-spin" : ""} />
              {t("retryGps")}
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-start gap-3">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold">{t("visitSubmitted")}</p>
            <p className="text-xs font-semibold text-[#ff791a] mt-1">
              {t("visitXpEarned").replace("{points}", String(earnedXp))}
            </p>
            <Link to="/supervisor" className="text-xs font-bold text-emerald-700 mt-2 inline-block">
              {t("backToSchools")} →
            </Link>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-800">{t("visitDetails")}</h2>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">{t("visitDate")}</label>
            <div className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 font-medium">
              {formatDisplayDate(visitDate, lang)}
            </div>
            <p className="text-xs text-slate-500 mt-1">{t("visitDateLocked")}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">{t("notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-[#ff791a]"
              placeholder={t("notesPlaceholder")}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-800">{t("materialsGiven")}</h2>
          <div className="space-y-2">
            {SCHOOL_MATERIAL_ITEMS.map((item) => {
              const qty = materials.find((m) => m.item === item)?.qty ?? 0;
              return (
                <div
                  key={item}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border ${
                    qty > 0 ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <span className="text-sm font-semibold text-slate-800 shrink-0">
                    {getMaterialLabel(item, t)}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeMaterial(item, -1)}
                      disabled={qty === 0}
                      className="w-9 h-9 flex items-center justify-center text-lg font-bold rounded-lg bg-white border border-slate-200 disabled:opacity-30 cursor-pointer"
                      aria-label={`Decrease ${item}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-[#ff791a]">{qty}</span>
                    <button
                      type="button"
                      onClick={() => changeMaterial(item, 1)}
                      className="w-9 h-9 flex items-center justify-center text-lg font-bold rounded-lg bg-white border border-slate-200 cursor-pointer"
                      aria-label={`Increase ${item}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {materialsCount > 0 && (
            <p className="text-xs font-semibold text-[#ff791a]">
              {materialsCount} {t("itemsGiven")}
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-800">{t("fieldPhotos")}</h2>
          <p className="text-xs text-slate-500">{t("photoStampHint")}</p>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo, i) => (
                <button
                  key={`${photo.takenAt}-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer text-left"
                >
                  <img
                    src={photo.photoDataBase64}
                    alt={photo.caption}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white">
                    <Camera size={16} />
                  </span>
                  <p className="text-[10px] text-slate-600 px-2 py-1.5 line-clamp-2 bg-white">
                    {photo.locationLabel}
                  </p>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleLiveCapture}
            disabled={capturingPhoto || visitBlocked || !gpsReady}
            className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-dashed border-[#ff791a] rounded-xl bg-orange-50 text-[#ff791a] font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            {capturingPhoto ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t("stampingPhoto")}
              </>
            ) : (
              <>
                <Camera size={20} />
                {photos.length > 0 ? t("addAnotherPhoto") : t("takePhoto")}
              </>
            )}
          </button>

          {!gpsReady && (
            <p className="text-xs text-amber-700 font-medium">{t("gpsRequiredForPhoto")}</p>
          )}

          {photos.length === 0 && (
            <p className="text-xs text-red-600 font-medium">{t("addPhotoRequired")}</p>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-4 pt-3 pb-4 safe-area-bottom bg-white border-t border-slate-200">
        <button
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold py-3.5 rounded-xl cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 text-base"
        >
          <Save size={18} />
          {saving ? t("submitting") : t("submitVisit")}
          {photos.length > 0 && !saving && <span className="text-orange-100">({photos.length})</span>}
        </button>
      </div>
    </div>
  );
}
