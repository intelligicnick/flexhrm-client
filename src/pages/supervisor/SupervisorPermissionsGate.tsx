import React, { useEffect, useState } from "react";
import { Camera, MapPin, ShieldCheck, Loader2 } from "lucide-react";
import {
  checkSupervisorPermissions,
  hasRequiredPermissions,
  requestAllSupervisorPermissions,
} from "../../lib/supervisor-permissions";
import { useSupervisorI18n } from "./SupervisorI18nContext";

const PERMS_KEY = "hrms_supervisor_perms_granted";

export function markPermissionsGranted(): void {
  localStorage.setItem(PERMS_KEY, "1");
}

export function clearPermissionsGranted(): void {
  localStorage.removeItem(PERMS_KEY);
}

interface SupervisorPermissionsGateProps {
  children: React.ReactNode;
  skipPermissions?: boolean;
}

export default function SupervisorPermissionsGate({
  children,
  skipPermissions = false,
}: SupervisorPermissionsGateProps) {
  const { t } = useSupervisorI18n();
  const [ready, setReady] = useState(skipPermissions);
  const [checking, setChecking] = useState(!skipPermissions);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skipPermissions) {
      setReady(true);
      setChecking(false);
      return;
    }
    (async () => {
      const perms = await checkSupervisorPermissions();
      if (hasRequiredPermissions(perms)) {
        markPermissionsGranted();
        setReady(true);
      } else {
        clearPermissionsGranted();
        setReady(false);
      }
      setChecking(false);
    })();
  }, [skipPermissions]);

  const handleAllow = async () => {
    setRequesting(true);
    setError(null);
    try {
      await requestAllSupervisorPermissions();
      const perms = await checkSupervisorPermissions();
      if (!hasRequiredPermissions(perms)) {
        throw new Error("Camera and location permissions are required.");
      }
      markPermissionsGranted();
      setReady(true);
    } catch (err: unknown) {
      clearPermissionsGranted();
      setError(err instanceof Error ? err.message : "Could not get permissions.");
    } finally {
      setRequesting(false);
    }
  };

  if (ready) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-100 flex items-center justify-center">
          <ShieldCheck className="text-[#ff791a]" size={32} />
        </div>
        <h1 className="text-lg font-black text-slate-900">{t("permissionsTitle")}</h1>
        <p className="text-xs text-slate-500 mt-2 mb-6">{t("permissionsSubtitle")}</p>

        <div className="space-y-3 text-left mb-6">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Camera className="text-[#ff791a] shrink-0" size={20} />
            <span className="text-xs font-semibold text-slate-700">{t("cameraPermission")}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <MapPin className="text-[#ff791a] shrink-0" size={20} />
            <span className="text-xs font-semibold text-slate-700">{t("locationPermission")}</span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 font-semibold mb-4">{error}</p>
        )}

        <button
          type="button"
          onClick={handleAllow}
          disabled={requesting || checking}
          className="w-full py-3.5 bg-[#ff791a] text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(requesting || checking) && <Loader2 size={18} className="animate-spin" />}
          {checking ? t("checkingPermissions") : requesting ? t("checkingPermissions") : t("allowPermissions")}
        </button>
      </div>
    </div>
  );
}
