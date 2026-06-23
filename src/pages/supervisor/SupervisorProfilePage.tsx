import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Camera,
  Check,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Smartphone,
  User,
  Shield,
} from "lucide-react";
import { SchoolVisit } from "../../types";
import { parseApiError } from "../../api";
import { captureLivePhotoDataUrl } from "../../lib/live-camera";
import { getSupervisorDeviceId } from "../../lib/supervisor-device";
import { SupervisorLang } from "../../lib/supervisor-i18n";
import { computeGamificationStats } from "../../lib/supervisor-gamification";
import { toIsoDate } from "../../lib/supervisor-dates";
import { resolveProfilePhotoSrc, resolvePhotoSrc } from "../../lib/media-url";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import SupervisorGamificationCard from "./SupervisorGamificationCard";
import { SupervisorActionButton } from "./SupervisorUI";
interface SupervisorProfile {
  supervisorId: string;
  name: string;
  phone: string;
  assignedBlocks: string[];
  status: string;
  profilePhotoBase64: string;
  profilePhotoUrl?: string;
  registeredDeviceId: string;
  registeredDeviceName: string;
  deviceRegisteredAt: string | null;
  defaultLanguage: SupervisorLang;
  designation: string;
}

function formatDate(iso: string | null, lang: SupervisorLang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-sm font-semibold text-slate-800 break-all ${mono ? "font-mono text-xs" : ""}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function SupervisorProfilePage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const { t, lang, setLang } = useSupervisorI18n();

  const [profile, setProfile] = useState<SupervisorProfile | null>(null);
  const [preferredLang, setPreferredLang] = useState<SupervisorLang>("en");

  const [capturing, setCapturing] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [langSuccess, setLangSuccess] = useState(false);
  const [gamificationStats, setGamificationStats] = useState<ReturnType<typeof computeGamificationStats> | null>(
    null,
  );

  const localDeviceId = getSupervisorDeviceId();
  const deviceMatches = profile?.registeredDeviceId
    ? profile.registeredDeviceId === localDeviceId
    : false;

  useEffect(() => {
    (async () => {
      const profileRes = await supervisorFetch("/api/auth/supervisor/me");
      if (profileRes.ok) {
        const data = await profileRes.json();
        const loaded: SupervisorProfile = {
          supervisorId: data.supervisorId || "",
          name: data.name || "",
          phone: data.phone || "",
          assignedBlocks: data.assignedBlocks || [],
          status: data.status || "active",
          profilePhotoBase64: data.profilePhotoBase64 || "",
          profilePhotoUrl: data.profilePhotoUrl || "",
          registeredDeviceId: data.registeredDeviceId || "",
          registeredDeviceName: data.registeredDeviceName || "",
          deviceRegisteredAt: data.deviceRegisteredAt || null,
          defaultLanguage: data.defaultLanguage === "hi" ? "hi" : "en",
          designation: data.designation || "",
        };
        setProfile(loaded);
        setPreferredLang(loaded.defaultLanguage);
      }

      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const from = new Date();
      from.setDate(from.getDate() - 45);

      const [schoolsRes, weekRes, streakRes] = await Promise.all([
        supervisorFetch("/api/school-visits/supervisor/schools"),
        supervisorFetch(
          `/api/school-visits/supervisor/mine?fromDate=${toIsoDate(monday)}&toDate=${toIsoDate(sunday)}`,
        ),
        supervisorFetch(
          `/api/school-visits/supervisor/mine?fromDate=${toIsoDate(from)}&toDate=${toIsoDate(now)}`,
        ),
      ]);

      const schools = schoolsRes.ok ? await schoolsRes.json() : [];
      const weekVisits: SchoolVisit[] = weekRes.ok ? await weekRes.json() : [];
      const streakVisits: SchoolVisit[] = streakRes.ok ? await streakRes.json() : [];
      setGamificationStats(
        computeGamificationStats({
          weekVisits,
          streakVisits,
          totalSchools: Array.isArray(schools) ? schools.length : 0,
        }),
      );
    })();
  }, [supervisorFetch]);

  const handleCapture = async () => {
    setCapturing(true);
    setError(null);
    setPhotoSuccess(false);
    try {
      const dataUrl = await captureLivePhotoDataUrl();
      setProfile((prev) =>
        prev ? { ...prev, profilePhotoBase64: dataUrl, profilePhotoUrl: "" } : prev,
      );
      setSavingPhoto(true);
      const res = await supervisorFetch("/api/auth/supervisor/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataBase64: dataUrl }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save photo.");
      setPhotoSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Capture failed.");
    } finally {
      setCapturing(false);
      setSavingPhoto(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSavingLang(true);
    setError(null);
    setLangSuccess(false);
    try {
      const res = await supervisorFetch("/api/auth/supervisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLanguage: preferredLang }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save language.");
      setLang(preferredLang);
      setProfile((prev) => (prev ? { ...prev, defaultLanguage: preferredLang } : prev));
      setLangSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingLang(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        <Loader2 size={20} className="animate-spin mr-2" />
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 p-5 text-white shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.2),transparent_55%)]" />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-2xl border-2 border-orange-400/40 bg-white/10 overflow-hidden flex items-center justify-center shadow-lg">
              {resolveProfilePhotoSrc(profile) ? (
                <img src={resolveProfilePhotoSrc(profile)} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="text-white/40" size={36} />
              )}
            </div>
            <button
              type="button"
              onClick={handleCapture}
              disabled={capturing || savingPhoto}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff791a] text-white shadow-md cursor-pointer disabled:opacity-50"
              title={t("captureProfile")}
            >
              {capturing || savingPhoto ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black tracking-tight">{profile.name}</h2>
            {profile.designation && (
              <p className="text-xs text-orange-200 font-semibold mt-0.5">{profile.designation}</p>
            )}
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
              <Phone size={11} />
              {profile.phone}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                {profile.status === "active" ? t("active") : t("inactive")}
              </span>
              {(profile.assignedBlocks || []).map((block) => (
                <span
                  key={block}
                  className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200"
                >
                  {block}
                </span>
              ))}
            </div>
          </div>
        </div>
        {photoSuccess && (
          <p className="relative mt-3 text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
            <Check size={12} />
            {t("photoSaved")}
          </p>
        )}
      </div>

      {gamificationStats && <SupervisorGamificationCard stats={gamificationStats} />}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Account info */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
          <Shield size={16} className="text-[#ff791a]" />
          {t("accountInfo")}
        </h3>
        <div className="divide-y divide-slate-100">
          <InfoRow
            icon={<User size={14} />}
            label={t("supervisorId")}
            value={profile.supervisorId}
            mono
          />
          <InfoRow icon={<Phone size={14} />} label={t("mobileNumber")} value={profile.phone} />
          <InfoRow
            icon={<MapPin size={14} />}
            label={t("assignedBlocks")}
            value={
              profile.assignedBlocks.length
                ? profile.assignedBlocks.join(", ")
                : "—"
            }
          />
          <InfoRow
            icon={<Shield size={14} />}
            label={t("accountStatus")}
            value={profile.status === "active" ? t("active") : t("inactive")}
          />
        </div>
      </section>

      {/* Language preference */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-black text-slate-900">
          <Globe size={16} className="text-[#ff791a]" />
          {t("preferredLanguage")}
        </h3>
        <p className="mb-4 text-[11px] text-slate-400">{t("preferredLanguageHint")}</p>

        <div className="grid grid-cols-2 gap-2">
          {(["en", "hi"] as SupervisorLang[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setPreferredLang(code)}
              className={`rounded-xl border-2 py-3 text-sm font-bold transition cursor-pointer ${
                preferredLang === code
                  ? "border-[#ff791a] bg-orange-50 text-[#ff791a]"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {code === "en" ? t("english") : t("hindi")}
            </button>
          ))}
        </div>

        <SupervisorActionButton
          type="button"
          onClick={handleSaveLanguage}
          loading={savingLang}
          loadingText={t("savingProfile")}
          disabled={preferredLang === profile.defaultLanguage}
          variant="outline"
          fullWidth
          className="mt-3 py-2.5 text-sm"
        >
          {t("saveLanguage")}
        </SupervisorActionButton>
        {langSuccess && (
          <p className="mt-2 text-center text-[11px] font-semibold text-emerald-600 flex items-center justify-center gap-1">
            <Check size={12} />
            {t("profileSaved")}
          </p>
        )}
        {lang !== preferredLang && preferredLang === profile.defaultLanguage && (
          <p className="mt-2 text-center text-[10px] text-slate-400">
            {t("english")} / {t("hindi")} — {lang === "en" ? t("english") : t("hindi")} ({t("today")})
          </p>
        )}
      </section>

      {/* Device details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
          <Smartphone size={16} className="text-[#ff791a]" />
          {t("deviceDetails")}
        </h3>

        <div
          className={`mb-4 rounded-xl px-3 py-2.5 text-[11px] font-semibold flex items-center gap-2 ${
            !profile.registeredDeviceId
              ? "bg-slate-50 text-slate-500"
              : deviceMatches
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
          }`}
        >
          <Check size={14} />
          {!profile.registeredDeviceId
            ? t("noDeviceRegistered")
            : deviceMatches
              ? t("deviceMatch")
              : t("deviceMismatchProfile")}
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t("registeredDevice")}
          </p>
          <InfoRow
            icon={<Smartphone size={14} />}
            label={t("deviceName")}
            value={profile.registeredDeviceName || "—"}
          />
          <InfoRow
            icon={<Shield size={14} />}
            label={t("deviceId")}
            value={profile.registeredDeviceId || "—"}
            mono
          />
          <InfoRow
            icon={<Globe size={14} />}
            label={t("deviceRegisteredOn")}
            value={formatDate(profile.deviceRegisteredAt, lang)}
          />
        </div>

        <div className="mt-3 space-y-1 rounded-xl border border-dashed border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t("thisDevice")}
          </p>
          <InfoRow
            icon={<Smartphone size={14} />}
            label={t("deviceId")}
            value={localDeviceId}
            mono
          />
        </div>
      </section>
    </div>
  );
}
