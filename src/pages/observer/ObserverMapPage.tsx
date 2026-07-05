import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useHRMS } from "../../context/HRMSContext";
import { registerObserverBackHandler } from "../../lib/observer-back-handler";
import FieldTrackingMap from "../../components/FieldTrackingMap";
import { useObserverStats } from "./useObserverStats";

export default function ObserverMapPage() {
  const { employees } = useHRMS();
  const { rawSchoolSupervisors, rawSchoolVisits, canViewObserverModule, canView } = useObserverStats();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    return registerObserverBackHandler(() => {
      setIsFullscreen(false);
      return true;
    });
  }, [isFullscreen]);

  if (!canViewObserverModule("map")) {
    return <Navigate to="/observer/menu" replace />;
  }

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-40 bg-[#f4f6f9] flex flex-col max-w-lg mx-auto w-full pt-2"
          : "pb-2 px-1"
      }
    >
      <div
        className={
          isFullscreen
            ? "flex-1 min-h-0 overflow-hidden"
            : "rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm"
        }
      >
        <FieldTrackingMap
          supervisors={rawSchoolSupervisors}
          visits={rawSchoolVisits}
          employees={employees}
          showEmployeeTracking={canView("Attendance")}
          variant="embedded"
          mapHeightClass={
            isFullscreen ? "h-[calc(100dvh-7rem)]" : "h-[calc(100dvh-14rem)] min-h-[340px]"
          }
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        />
      </div>
    </div>
  );
}
