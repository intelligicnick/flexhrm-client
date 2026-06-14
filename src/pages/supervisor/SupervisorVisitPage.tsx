import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, Save } from "lucide-react";
import { SchoolWork, SCHOOL_MATERIAL_ITEMS } from "../../types";
import { parseApiError } from "../../api";
import { getGpsLocation, stampVisitPhoto, StampedVisitPhoto } from "../../lib/visit-photo";
import { captureLivePhoto } from "../../lib/live-camera";
import { formatDisplayDate, todayIsoInKolkata } from "../../lib/supervisor-dates";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import { SupervisorFormStep } from "./SupervisorUI";

export default function SupervisorVisitPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang } = useSupervisorI18n();
  const [school, setSchool] = useState<SchoolWork | null>(null);
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
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    (async () => {
      const res = await supervisorFetch("/api/school-visits/supervisor/schools");
      if (res.ok) {
        const schools: SchoolWork[] = await res.json();
        setSchool(schools.find((s) => s.id === schoolId) || null);
      }
    })();
  }, [schoolId, supervisorFetch]);

  useEffect(() => {
    getGpsLocation(resolvePlaceName)
      .then(() => {
        setGpsReady(true);
        setGpsError(null);
      })
      .catch((err: unknown) => {
        setGpsReady(false);
        setGpsError(err instanceof Error ? err.message : "GPS unavailable.");
      });
  }, [supervisorFetch]);

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
    setCapturingPhoto(true);
    setError(null);
    try {
      const location = await getGpsLocation(resolvePlaceName);
      setGpsReady(true);
      setGpsError(null);
      const file = await captureLivePhoto();
      const stamped = await stampVisitPhoto(file, location, {
        schoolName: school?.schoolName,
        index: photos.length + 1,
      });
      setPhotos((prev) => [...prev, stamped]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not capture photo with location.";
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
    if (!schoolId) return;
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
      if (!res.ok) throw await parseApiError(res, "Failed to submit visit.");
      setSuccess(true);
      setNotes("");
      setMaterials([]);
      setPhotos([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSaving(false);
    }
  };

  const materialsCount = materials.reduce((sum, m) => sum + m.qty, 0);
  const canSubmit = photos.length > 0 && !saving && !capturingPhoto;

  if (!school) {
    return <p className="text-center text-slate-400 py-10">{t("schoolNotFound")}</p>;
  }

  return (
    <div className="space-y-4 pb-28">
      <Link
        to="/supervisor"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#ff791a] transition"
      >
        <ArrowLeft size={14} /> {t("backToSchools")}
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-[#0C1E4A] to-[#1a3568] p-4 text-white shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300/80">{t("logVisit")}</p>
        <h1 className="font-black text-lg mt-0.5 leading-tight">{school.schoolName}</h1>
        <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
          <MapPin size={12} /> {school.block} · UDISE {school.udise}
        </p>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2.5 ${
          gpsReady
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : gpsReady === false
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-slate-50 border-slate-200 text-slate-500"
        }`}
      >
        <MapPin size={16} className="shrink-0" />
        <span>
          {gpsReady === null && t("gpsChecking")}
          {gpsReady === true && t("gpsReady")}
          {gpsReady === false && (gpsError || t("gpsDenied"))}
        </span>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-3">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold">{t("visitSubmitted")}</p>
            <Link to="/supervisor" className="text-xs font-bold text-emerald-600 mt-1 inline-block hover:underline">
              {t("backToSchools")} →
            </Link>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <SupervisorFormStep step={1} total={3} title={t("visitDetails")}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">{t("visitDate")}</label>
              <div className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-700 font-semibold">
                {formatDisplayDate(visitDate, lang)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{t("visitDateLocked")}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">{t("notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-200 focus:border-[#ff791a] focus:outline-none resize-none"
                placeholder={t("notesPlaceholder")}
              />
            </div>
          </div>
        </SupervisorFormStep>

        <SupervisorFormStep step={2} total={3} title={t("materialsGiven")}>
          <div className="grid grid-cols-2 gap-2">
            {SCHOOL_MATERIAL_ITEMS.map((item) => {
              const qty = materials.find((m) => m.item === item)?.qty ?? 0;
              return (
                <div
                  key={item}
                  className={`flex items-center justify-between rounded-xl px-2 py-2 border ${
                    qty > 0 ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-700 truncate flex-1 mr-1">{item}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeMaterial(item, -1)}
                      disabled={qty === 0}
                      className="w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg bg-white border border-slate-200 hover:bg-orange-100 disabled:opacity-30 cursor-pointer"
                      aria-label={`Decrease ${item}`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-black text-[#ff791a]">{qty}</span>
                    <button
                      type="button"
                      onClick={() => changeMaterial(item, 1)}
                      className="w-7 h-7 flex items-center justify-center text-sm font-black rounded-lg bg-white border border-slate-200 hover:bg-orange-100 cursor-pointer"
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
            <p className="text-[10px] text-[#ff791a] font-bold mt-2">
              {materialsCount} {t("itemsGiven")}
            </p>
          )}
        </SupervisorFormStep>

        <SupervisorFormStep step={3} total={3} title={t("fieldPhotos")}>
          <p className="text-[11px] text-slate-400 mb-3">{t("photoStampHint")}</p>
          <button
            type="button"
            onClick={handleLiveCapture}
            disabled={capturingPhoto}
            className={`flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed rounded-xl ${
              capturingPhoto
                ? "border-orange-300 bg-orange-50 opacity-70"
                : "border-slate-200 bg-slate-50 hover:border-[#ff791a] hover:bg-orange-50 cursor-pointer"
            }`}
          >
            {capturingPhoto ? (
              <>
                <Loader2 size={20} className="text-[#ff791a] animate-spin" />
                <span className="text-sm font-bold text-slate-600">{t("stampingPhoto")}</span>
              </>
            ) : (
              <>
                <Camera size={20} className="text-[#ff791a]" />
                <span className="text-sm font-bold text-slate-600">{t("takePhoto")}</span>
              </>
            )}
          </button>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {photos.map((photo, i) => (
                <div key={`${photo.takenAt}-${i}`}>
                  <img
                    src={photo.photoDataBase64}
                    alt={photo.caption}
                    className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200"
                  />
                  <p className="text-[9px] text-slate-500 mt-1 truncate">{photo.locationLabel}</p>
                </div>
              ))}
            </div>
          )}
          {photos.length === 0 && (
            <p className="text-[10px] text-red-500 font-semibold mt-2">{t("addPhotoRequired")}</p>
          )}
        </SupervisorFormStep>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-4 pt-3 pb-4 safe-area-bottom bg-[#f4f6f9] border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.1)]">
        <button
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-300/40 cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed text-base transition-colors"
        >
          <Save size={18} />
          {saving ? t("submitting") : t("submitVisit")}
          {photos.length > 0 && !saving && (
            <span className="ml-1 text-orange-200 text-sm">({photos.length})</span>
          )}
        </button>
      </div>
    </div>
  );
}
