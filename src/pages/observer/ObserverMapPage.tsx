import React, { lazy, Suspense } from "react";
import { useObserverStats } from "./useObserverStats";
import { ObserverSection } from "./ObserverUI";

const SupervisorMapPanel = lazy(() => import("../../components/SupervisorMapPanel"));

function MapFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

export default function ObserverMapPage() {
  const { rawSchoolSupervisors, rawSchoolVisits, canView } = useObserverStats();

  if (!canView("Field Team")) {
    return (
      <ObserverSection>
        <p className="text-sm text-slate-500 text-center py-8">You don&apos;t have access to view the supervisor map.</p>
      </ObserverSection>
    );
  }

  return (
    <div className="space-y-3 -mx-1">
      <ObserverSection title="Live Supervisor Locations">
        <p className="text-xs text-slate-500 mb-3">
          Tap pins to see supervisor details. Paths show today&apos;s movement.
        </p>
        <Suspense fallback={<MapFallback />}>
          <SupervisorMapPanel
            supervisors={rawSchoolSupervisors}
            visits={rawSchoolVisits}
            layoutRevision="observer-mobile"
          />
        </Suspense>
      </ObserverSection>
    </div>
  );
}
