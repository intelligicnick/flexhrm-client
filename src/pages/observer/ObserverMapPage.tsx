import React, { lazy, Suspense, useState } from "react";
import { useObserverStats } from "./useObserverStats";

const SupervisorMapPanel = lazy(() => import("../../components/SupervisorMapPanel"));

function MapFallback() {
  return (
    <div className="flex items-center justify-center h-[calc(100dvh-11rem)]">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

export default function ObserverMapPage() {
  const { rawSchoolSupervisors, rawSchoolVisits, canView } = useObserverStats();
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!canView("Field Team")) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-slate-500 text-center">
          You don&apos;t have access to view the supervisor map.
        </p>
      </div>
    );
  }

  const mapPanel = (
    <Suspense fallback={<MapFallback />}>
      <SupervisorMapPanel
        supervisors={rawSchoolSupervisors}
        visits={rawSchoolVisits}
        layoutRevision={`observer-mobile-${isFullscreen ? "fs" : "std"}`}
        variant="embedded"
        mapHeightClass={
          isFullscreen ? "h-[calc(100dvh-7rem)]" : "h-[calc(100dvh-14rem)] min-h-[340px]"
        }
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
      />
    </Suspense>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-40 bg-[#f4f6f9] flex flex-col max-w-lg mx-auto w-full">
        <div className="flex-1 overflow-hidden pt-2">{mapPanel}</div>
      </div>
    );
  }

  return (
    <div className="pb-2 px-1">
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm">
        {mapPanel}
      </div>
    </div>
  );
}
