import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useBlocker, useNavigate, useOutletContext, useParams } from 'react-router';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, MapPin, RefreshCw, Save, Trash2 } from "lucide-react";
import { SchoolWork, SCHOOL_MATERIAL_ITEMS } from "../../types";
import { parseApiError } from "../../api";
import {
  hasValidVisitGps,
  probeGpsLocation,
  requireGpsLocationForStamp,
  revokeStampedVisitPhotoUrls,
  stampVisitPhoto,
  StampedVisitPhoto,
  startGpsWarmup,
} from "../../lib/visit-photo";
import { captureLivePhoto } from "../../lib/live-camera";
import { formatLatLngDecimal, distanceMeters, isValidGpsCoord } from "../../lib/gps-coords";
import { geofenceAreaLabel, schoolGeofenceRadiusM } from "../../lib/school-geofence";
import { localityHintFromSchoolName, isUnsafeSchoolPin } from "../../lib/school-place-match";
import { formatDisplayDate, todayIsoInKolkata } from "../../lib/supervisor-dates";
import { pointsForVisit } from "../../lib/supervisor-gamification";
import { getMaterialLabel } from "../../lib/supervisor-materials";
import {
  canVisitSchoolAgain,
  daysUntilSchoolVisitAllowed,
  formatVisitCooldownHint,
  type SchoolVisitCooldownInfo,
} from "../../lib/supervisor-visit-cooldown";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import SupervisorPhotoLightbox from "./SupervisorPhotoLightbox";
import { fetchSupervisorSchools } from "../../lib/supervisor-schools-cache";
import { resolvePhotoSrc, resolvePhotoThumbnailSrc } from "../../lib/media-url";
import {
  queueVisitDraft,
  registerVisitOutboxSync,
  type PendingVisitDraft,
} from "../../lib/supervisor-visit-outbox";
import { useSupervisorOverlayBack, useSupervisorUnsavedBackGuard } from "../../lib/supervisor-back-handler";
import { SupervisorActionButton, SupervisorConfirmDialog, SupervisorLoadingScreen } from "./SupervisorUI";
import SupervisorSchoolMap from "../../components/supervisor/SupervisorSchoolMap";
import { supervisorSchoolVillageName, resolveSchoolStampLabels, invalidateSchoolStampLabelCache, type SchoolStampLabels } from "../../lib/supervisor-school-location";

function photoSrc(photo: StampedVisitPhoto) {
  return resolvePhotoSrc(photo);
}

function photoThumbSrc(photo: StampedVisitPhoto) {
  return resolvePhotoThumbnailSrc(photo);
}

type VisitPhotoLightboxState = {
  thumbSrc: string;
  src: string;
  alt: string;
  caption?: string;
};

export default function SupervisorVisitPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang } = useSupervisorI18n();
  const navigate = useNavigate();
  const [school, setSchool] = useState<SchoolWork | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [schoolLoadFailed, setSchoolLoadFailed] = useState(false);
  const [lastVisitInfo, setLastVisitInfo] = useState<SchoolVisitCooldownInfo | null>(null);
  const visitDate = todayIsoInKolkata();
  const currentSupervisorName = localStorage.getItem("hrms_supervisor_name") || "";

  const resolvePlaceName = async (lat: number, lng: number): Promise<string> => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
      });
      if (schoolId?.trim()) {
        params.set("schoolWorkId", schoolId.trim());
      }
      const res = await supervisorFetch(
        `/api/school-visits/supervisor/reverse-geocode?${params.toString()}`,
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
  const [lightbox, setLightbox] = useState<VisitPhotoLightboxState | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const leaveConfirmedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const [gpsPlaceName, setGpsPlaceName] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [locationResolveFailed, setLocationResolveFailed] = useState(false);
  const [stampLabels, setStampLabels] = useState<SchoolStampLabels | null>(null);

  const villageName = useMemo(
    () => (school ? supervisorSchoolVillageName(school) : ""),
    [school],
  );

  const schoolPinInvalid = useMemo(
    () =>
      !!school?.locationVerified &&
      isValidGpsCoord(Number(school?.lat), Number(school?.lng)) &&
      isUnsafeSchoolPin(school),
    [school],
  );

  const schoolPinReady = useMemo(
    () =>
      !!school?.locationVerified &&
      isValidGpsCoord(Number(school?.lat), Number(school?.lng)) &&
      !isUnsafeSchoolPin(school),
    [school],
  );

  const distanceToSchoolM = useMemo(() => {
    if (!gpsCoords || !school) return null;
    const schoolLat = Number(school.lat);
    const schoolLng = Number(school.lng);
    if (!isValidGpsCoord(schoolLat, schoolLng)) return null;
    return Math.round(
      distanceMeters(gpsCoords.lat, gpsCoords.lng, schoolLat, schoolLng),
    );
  }, [gpsCoords, school]);

  const geofenceRadiusM = useMemo(() => {
    if (!school) return 100;
    return schoolGeofenceRadiusM(school);
  }, [school]);

  const geofenceArea = useMemo(
    () => geofenceAreaLabel(school?.locationConfidence),
    [school?.locationConfidence],
  );

  const withinSchoolGeofence =
    distanceToSchoolM != null ? distanceToSchoolM <= geofenceRadiusM : false;

  const stampPhotoLabels = useMemo(
    () => ({
      school: t("stampSchool"),
      village: t("stampVillage"),
      required: t("stampRequired"),
      place: t("stampPlace"),
      date: t("stampDate"),
      time: t("stampTime"),
      latLng: t("stampLatLng"),
      location: t("stampLocation"),
    }),
    [t],
  );

  useEffect(() => {
    if (!school?.id) {
      setStampLabels(null);
      return;
    }
    let cancelled = false;
    invalidateSchoolStampLabelCache(String(school.id));
    void resolveSchoolStampLabels(school, supervisorFetch).then((labels) => {
      if (!cancelled) setStampLabels(labels);
    });
    return () => {
      cancelled = true;
    };
  }, [
    school?.id,
    school?.locationVerified,
    school?.matchedPlaceName,
    school?.lat,
    school?.lng,
    school?.schoolName,
    school?.block,
    school?.district,
    supervisorFetch,
  ]);

  const refreshGps = async () => {
    setGpsRefreshing(true);
    try {
      const location = await probeGpsLocation(resolvePlaceName);
      setGpsReady(hasValidVisitGps(location));
      setGpsPlaceName(location.placeName || null);
      setGpsCoords({ lat: location.lat, lng: location.lng });
      setGpsError(null);
    } catch (err: unknown) {
      setGpsReady(false);
      setGpsPlaceName(null);
      setGpsCoords(null);
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
    let cancelled = false;
    void (async () => {
      try {
        const res = await supervisorFetch("/api/school-visits/supervisor/maps-config");
        if (!res.ok) return;
        const data = (await res.json()) as { configured?: boolean; mapsApiKey?: string };
        if (!cancelled && data.configured && data.mapsApiKey) {
          setMapsApiKey(String(data.mapsApiKey));
        }
      } catch {
        /* map optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supervisorFetch]);

  useEffect(() => {
    if (!schoolId || !school || schoolPinReady || schoolPinInvalid) return;

    let cancelled = false;
    setResolvingLocation(true);
    setLocationResolveFailed(false);

    void (async () => {
      try {
        const res = await supervisorFetch(
          `/api/school-visits/supervisor/schools/${encodeURIComponent(schoolId)}/ensure-location`,
          { method: "POST" },
        );
        const data = (await res.json()) as {
          school?: SchoolWork;
          status?: string;
        };
        if (!cancelled && data.school) {
          setSchool(data.school);
          if (data.status !== "ready") setLocationResolveFailed(true);
        } else if (!cancelled) {
          setLocationResolveFailed(true);
        }
      } catch {
        if (!cancelled) setLocationResolveFailed(true);
      } finally {
        if (!cancelled) setResolvingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, school?.id, schoolPinReady, schoolPinInvalid, supervisorFetch]);

  useEffect(() => {
    return registerVisitOutboxSync(async (draft: PendingVisitDraft) => {
      const res = await supervisorFetch("/api/school-visits/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolWorkId: draft.schoolWorkId,
          visitDate: draft.visitDate,
          notes: draft.notes,
          materialsGiven: draft.materialsGiven,
          photos: draft.photos,
          gpsLocation: draft.gpsLocation,
        }),
      });
      if (!res.ok) throw await parseApiError(res, t("requestSubmitFailed"));
    });
  }, [supervisorFetch, t]);

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
        const [directRes, lastVisitRes] = await Promise.all([
          supervisorFetch(`/api/school-visits/supervisor/schools/${encodeURIComponent(schoolId)}`),
          supervisorFetch(
            `/api/school-visits/supervisor/schools/${encodeURIComponent(schoolId)}/last-visit`,
          ),
        ]);
        if (directRes.ok) {
          const data = (await directRes.json()) as SchoolWork;
          if (!cancelled) setSchool(data);
        } else {
          const schools = await fetchSupervisorSchools(supervisorFetch);
          const found = schools.find((entry) => String(entry.id) === String(schoolId)) || null;
          if (!cancelled) {
            setSchool(found);
            if (!found) setSchoolLoadFailed(true);
          }
        }
        if (!cancelled && lastVisitRes.ok) {
          const data = (await lastVisitRes.json()) as SchoolVisitCooldownInfo & {
            lastVisitDate?: string | null;
          };
          setLastVisitInfo({
            schoolWorkId: schoolId,
            lastVisitDate: data.lastVisitDate ?? null,
            lastVisitBySupervisorId: data.lastVisitBySupervisorId ?? null,
            lastVisitBySupervisorName: data.lastVisitBySupervisorName ?? null,
            blockSharedCooldown: !!data.blockSharedCooldown,
          });
        }
      } catch {
        if (!cancelled) {
          setSchool(null);
          setSchoolLoadFailed(true);
        }
      } finally {
        if (!cancelled) setSchoolLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, supervisorFetch]);

  const lastVisitDate = lastVisitInfo?.lastVisitDate ?? null;
  const visitBlocked = useMemo(
    () => !canVisitSchoolAgain(lastVisitDate),
    [lastVisitDate],
  );
  const daysUntilAllowed = lastVisitDate ? daysUntilSchoolVisitAllowed(lastVisitDate) : 0;
  const cooldownHint = formatVisitCooldownHint(t, {
    days: daysUntilAllowed,
    blockSharedCooldown: lastVisitInfo?.blockSharedCooldown,
    lastVisitBySupervisorName: lastVisitInfo?.lastVisitBySupervisorName,
    currentSupervisorName,
  });

  const changeMaterial = (item: string) => {
    setMaterials((prev) => {
      if (prev.some((m) => m.item === item)) {
        return prev.filter((m) => m.item !== item);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const hasUnsavedData =
    !success && (notes.trim().length > 0 || materials.length > 0 || photos.length > 0);

  const promptLeaveConfirm = useCallback(() => {
    setLeaveConfirmOpen(true);
  }, []);

  const navigationBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedData &&
      !leaveConfirmedRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (navigationBlocker.state !== "blocked") return;
    promptLeaveConfirm();
  }, [navigationBlocker.state, promptLeaveConfirm]);

  useSupervisorUnsavedBackGuard(hasUnsavedData && !leaveConfirmOpen, promptLeaveConfirm);

  useSupervisorOverlayBack(success, () => setSuccess(false));

  const confirmLeave = useCallback(() => {
    leaveConfirmedRef.current = true;
    setLeaveConfirmOpen(false);
    photosRef.current.forEach(revokeStampedVisitPhotoUrls);
    if (navigationBlocker.state === "blocked") {
      navigationBlocker.proceed?.();
      return;
    }
    navigate("/supervisor");
  }, [navigate, navigationBlocker]);

  const cancelLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
    if (navigationBlocker.state === "blocked") {
      navigationBlocker.reset?.();
    }
  }, [navigationBlocker]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach(revokeStampedVisitPhotoUrls);
    };
  }, []);

  const handleBackToSchools = (e: React.MouseEvent) => {
    if (!hasUnsavedData) return;
    e.preventDefault();
    promptLeaveConfirm();
  };

  const openPhotoLightbox = (photo: StampedVisitPhoto) => {
    setLightbox({
      thumbSrc: photoThumbSrc(photo),
      src: photoSrc(photo),
      alt: photo.caption,
      caption: photo.locationLabel,
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) revokeStampedVisitPhotoUrls(photo);
      return prev.filter((_, i) => i !== index);
    });
    setLightbox(null);
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
        villageName: stampLabels?.village || villageName,
        requiredPlaceName: stampLabels?.requiredPlace,
        index: photos.length + 1,
        labels: stampPhotoLabels,
      });
      setPhotos((prev) => [...prev, stamped]);
      setGpsPlaceName(location.placeName);
      setGpsCoords({ lat: location.lat, lng: location.lng });
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
    const payload = {
      schoolWorkId: schoolId,
      visitDate,
      notes,
      materialsGiven: materials,
      photos: photos.map(({ previewUrl: _previewUrl, thumbPreviewUrl: _thumbPreviewUrl, ...photo }) => photo),
      gpsLocation: photos[0]
        ? {
            lat: photos[0].lat,
            lng: photos[0].lng,
            locationLabel: photos[0].locationLabel,
            accuracyMeters: photos[0].accuracyMeters,
            isMock: photos[0].isMock,
            capturedAt: photos[0].takenAt,
          }
        : undefined,
    };
    try {
      const res = await supervisorFetch("/api/school-visits/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await parseApiError(res, t("requestSubmitFailed"));
      setEarnedXp(pointsForVisit(photos.length));
      photos.forEach(revokeStampedVisitPhotoUrls);
      setSuccess(true);
      setNotes("");
      setMaterials([]);
      setPhotos([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      if (!navigator.onLine) {
        await queueVisitDraft({
          schoolWorkId: schoolId,
          visitDate,
          notes,
          materialsGiven: materials,
          photos: payload.photos,
          gpsLocation: payload.gpsLocation,
        });
        setSuccess(true);
        setError(null);
        photos.forEach(revokeStampedVisitPhotoUrls);
        setNotes("");
        setMaterials([]);
        setPhotos([]);
        return;
      }
      setError(err instanceof Error ? err.message : t("requestSubmitFailed"));
    } finally {
      setSaving(false);
    }
  };

  const materialsCount = materials.length;
  const canSubmit =
    photos.length > 0 &&
    !saving &&
    !capturingPhoto &&
    !visitBlocked &&
    gpsReady === true;

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
      <SupervisorConfirmDialog
        open={leaveConfirmOpen}
        title={t("unsavedLeaveTitle")}
        message={t("unsavedLeaveMessage")}
        confirmLabel={t("leavePage")}
        cancelLabel={t("stayOnPage")}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

      {success &&
        createPortal(
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-success-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={36} className="text-emerald-600" />
              </div>
              <h2 id="visit-success-title" className="text-lg font-black text-slate-900">
                {t("visitSubmittedPopup")}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t("visitSubmitted")}</p>
              <p className="mt-3 text-sm font-bold text-[#ff791a]">
                {t("visitXpEarned").replace("{points}", String(earnedXp))}
              </p>
              <SupervisorActionButton
                type="button"
                onClick={() => navigate("/supervisor")}
                fullWidth
                className="mt-6 py-3.5"
              >
                {t("backToSchools")}
              </SupervisorActionButton>
            </div>
          </div>,
          document.body,
        )}

      {lightbox && (
        <SupervisorPhotoLightbox
          thumbSrc={lightbox.thumbSrc}
          src={lightbox.src}
          alt={lightbox.alt}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}

      <Link
        to="/supervisor"
        onClick={handleBackToSchools}
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
            {villageName && <>{villageName} · </>}
            {school.block}
            {school.district ? `, ${school.district}` : ""} · UDISE {school.udise}
          </span>
        </p>
      </div>

      {visitBlocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">{t("visitCooldownTitle")}</p>
          <p className="mt-1 text-xs">
            {cooldownHint}
          </p>
        </div>
      )}

      {!schoolPinReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">
            {schoolPinInvalid
              ? "School pin needs correction (admin)"
              : resolvingLocation
                ? t("findingSchoolLocation")
                : "School pin not verified — you can still submit"}
          </p>
          <p className="mt-1 text-xs">
            {schoolPinInvalid
              ? `${school.schoolName}${villageName ? ` (${villageName})` : ""}: saved pin looks wrong. Your visit photo GPS will be recorded for admin review.`
              : resolvingLocation
                ? `${school.schoolName}${villageName ? ` — ${villageName}` : ""}, UDISE ${school.udise}: looking up location…`
                : locationResolveFailed
                  ? `${school.schoolName}${villageName ? ` — ${villageName}` : ""}: auto lookup failed. Submit anyway — your current GPS on the photo is what counts.`
                  : `${school.schoolName}${villageName ? ` — ${villageName}` : ""}, UDISE ${school.udise}: no verified school pin yet. Submit with your current location — admin will review.`}
          </p>
        </div>
      )}

      {gpsReady && gpsCoords && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-bold flex items-center gap-1.5">
            <MapPin size={14} className="text-[#ff791a]" />
            Your current location (stamped on photo)
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {gpsPlaceName || "Resolving place name…"}
          </p>
          <p className="mt-0.5 text-[11px] font-mono text-slate-500">
            {formatLatLngDecimal(gpsCoords.lat, gpsCoords.lng)}
          </p>
          {distanceToSchoolM != null && schoolPinReady && (
            <p className={`mt-1 text-xs font-semibold ${withinSchoolGeofence ? "text-emerald-700" : "text-amber-800"}`}>
              {withinSchoolGeofence
                ? `Within school area (${distanceToSchoolM} m from pin)`
                : `${distanceToSchoolM} m from school pin — visit will be flagged for admin review`}
            </p>
          )}
          {distanceToSchoolM != null && !schoolPinReady && (
            <p className="mt-1 text-xs text-slate-500">
              {distanceToSchoolM} m from saved draft pin (if any)
            </p>
          )}
        </div>
      )}

      {schoolPinReady && mapsApiKey && (
        <section className="space-y-2">
          {school.matchedPlaceName && (
            <p className="text-xs text-slate-600 px-1">
              {t("googleFoundPlace")}:{" "}
              <span className="font-semibold text-slate-800">{school.matchedPlaceName}</span>
              {school.locationConfidence === "exact" ? ` · ${t("geofenceExact")}` : ` · ${t("geofenceVillage")}`}
            </p>
          )}
          <SupervisorSchoolMap
            mapsApiKey={mapsApiKey}
            schoolLat={Number(school.lat)}
            schoolLng={Number(school.lng)}
            geofenceRadiusM={geofenceRadiusM}
            schoolLabel={villageName || school.schoolName}
            matchedPlaceName={String(school.matchedPlaceName || "")}
            userLat={gpsCoords?.lat}
            userLng={gpsCoords?.lng}
            withinGeofence={withinSchoolGeofence}
            openInMapsLabel={t("openInGoogleMaps")}
            googleMapsUrl={school.googleMapsUrl}
            onLoadError={(message) => setMapLoadError(message)}
          />
          {mapLoadError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t("mapLoadFailed")}
            </p>
          )}
        </section>
      )}

      {schoolPinReady && gpsReady === true && distanceToSchoolM != null && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            withinSchoolGeofence
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <p className="font-semibold">
            {withinSchoolGeofence
              ? t("atSchoolArea")
                  .replace("{area}", villageName || geofenceArea)
                  .replace("{distance}", String(distanceToSchoolM))
                  .replace("{radius}", String(geofenceRadiusM))
              : t("tooFarFromSchool")
                  .replace("{area}", villageName || geofenceArea)
                  .replace("{distance}", String(distanceToSchoolM))
                  .replace("{radius}", String(geofenceRadiusM))}
          </p>
          {gpsPlaceName && (
            <p className="text-xs mt-1 opacity-90">
              Your GPS: {gpsPlaceName}
              {villageName ? ` · Required village: ${villageName}` : ""}
            </p>
          )}
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
          {gpsReady === true && gpsCoords && (
            <p className="text-[11px] mt-1 font-mono opacity-90">
              {formatLatLngDecimal(gpsCoords.lat, gpsCoords.lng)}
            </p>
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
          <div className="grid grid-cols-2 gap-2">
            {SCHOOL_MATERIAL_ITEMS.map((item) => {
              const selected = materials.some((m) => m.item === item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeMaterial(item)}
                  className={`rounded-xl px-3 py-2.5 border text-left text-sm font-semibold transition cursor-pointer ${
                    selected
                      ? "bg-orange-50 border-orange-300 text-[#ff791a]"
                      : "bg-slate-50 border-slate-100 text-slate-800"
                  }`}
                >
                  {getMaterialLabel(item, t)}
                </button>
              );
            })}
          </div>
          {materialsCount > 0 && (
            <p className="text-xs font-semibold text-[#ff791a]">
              {materialsCount} {t("itemsGiven")}
            </p>
          )}
        </section>

        {stampLabels && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700">{t("photoStampPreview")}</p>
            {stampLabels.village && (
              <p>
                {t("stampVillage")}: <span className="font-semibold text-slate-800">{stampLabels.village}</span>
              </p>
            )}
            {stampLabels.requiredPlace && (
              <p>
                {t("requiredPlacePreview")}:{" "}
                <span className="font-semibold text-slate-800">{stampLabels.requiredPlace}</span>
              </p>
            )}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-slate-800">{t("fieldPhotos")}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{t("photoStampHint")}</p>
            </div>
            {photos.length > 0 && (
              <span className="shrink-0 rounded-full bg-[#ff791a] px-2.5 py-1 text-[10px] font-black text-white">
                {photos.length}
              </span>
            )}
          </div>

          <div className="space-y-3 p-4">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {photos.map((photo, i) => (
                  <div
                    key={`${photo.takenAt}-${i}`}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        window.setTimeout(() => openPhotoLightbox(photo), 0);
                      }}
                      className="block w-full cursor-pointer text-left"
                    >
                      <img
                        src={photoThumbSrc(photo)}
                        alt={photo.caption}
                        loading="lazy"
                        decoding="async"
                        className="w-full aspect-[4/3] object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2.5 pb-2 pt-8">
                        <p className="text-[10px] font-semibold text-white line-clamp-2">{photo.caption}</p>
                        <p className="text-[9px] text-orange-200 mt-0.5 line-clamp-2">{photo.locationLabel}</p>
                        <p className="text-[8px] text-orange-100/90 font-mono line-clamp-1">
                          {formatLatLngDecimal(photo.lat, photo.lng)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-md cursor-pointer"
                      aria-label={t("removePhoto")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-[#ff791a]">
                  <Camera size={28} />
                </div>
                <p className="text-sm font-bold text-slate-700">{t("takePhoto")}</p>
                <p className="mt-1 text-xs text-slate-500">{t("photoStampHint")}</p>
              </div>
            )}

            <SupervisorActionButton
              type="button"
              onClick={handleLiveCapture}
              disabled={capturingPhoto || visitBlocked || !gpsReady}
              loading={capturingPhoto}
              loadingText={t("stampingPhoto")}
              variant="gradient"
              fullWidth
              className="py-4 text-sm font-black"
              icon={photos.length > 0 ? <ImagePlus size={20} /> : <Camera size={20} />}
            >
              {photos.length > 0 ? t("addAnotherPhoto") : t("takePhoto")}
            </SupervisorActionButton>

            {!gpsReady && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">{t("gpsRequiredForPhoto")}</p>
              </div>
            )}

            {photos.length === 0 && gpsReady && (
              <p className="text-center text-xs font-semibold text-red-600">{t("addPhotoRequired")}</p>
            )}
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-black">
              !
            </span>
            <p className="flex-1">{error}</p>
          </div>
        )}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-4 pt-3 pb-4 safe-area-bottom bg-white border-t border-slate-200">
        <SupervisorActionButton
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={!canSubmit}
          loading={saving}
          loadingText={t("submitting")}
          fullWidth
          className="py-3.5 text-base"
          icon={<Save size={18} />}
        >
          {t("submitVisit")}
          {photos.length > 0 && !saving && <span className="text-orange-100">({photos.length})</span>}
        </SupervisorActionButton>
      </div>
    </div>
  );
}
