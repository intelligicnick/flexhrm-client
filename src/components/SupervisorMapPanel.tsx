import FieldTrackingMap from "./FieldTrackingMap";
import type { Employee, SchoolSupervisor, SchoolVisit } from "../types";

export type SupervisorMapPanelProps = {
  supervisors: SchoolSupervisor[];
  visits: SchoolVisit[];
  employees?: Employee[];
  showEmployeeTracking?: boolean;
  onOpenFieldTeam?: () => void;
  layoutRevision?: string;
  variant?: "default" | "embedded";
  /** @deprecated Use default OpenStreetMap styling in FieldTrackingMap */
  mapVariant?: "default" | "trajectory";
  mapHeightClass?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

/** @deprecated Use FieldTrackingMap directly */
export default function SupervisorMapPanel(props: SupervisorMapPanelProps) {
  const { mapVariant: _mapVariant, ...rest } = props;
  return <FieldTrackingMap {...rest} />;
}

export { FieldTrackingMap };
