import React, { useMemo, useState } from "react";
import { ClipboardList, MessageSquare, Users, BookOpen } from "lucide-react";
import { SchoolSupervisor, SchoolVisit, SchoolWork, SupervisorRequest, CommitmentDiary } from "../types";
import { FieldTeamView } from "../lib/notification-navigation";
import SupervisorVisitsPanel from "./SupervisorVisitsPanel";
import SchoolSupervisorsTable from "./SchoolSupervisorsTable";
import SupervisorRequestsPanel from "./SupervisorRequestsPanel";
import CommitmentDiaryPanel from "./CommitmentDiaryPanel";
import SupervisorPwaInstallCard from "./SupervisorPwaInstallCard";
import SchoolLocationResolver from "./SchoolLocationResolver";

interface FieldTeamPanelProps {
  visits: SchoolVisit[];
  requests: SupervisorRequest[];
  commitments: CommitmentDiary[];
  supervisors: SchoolSupervisor[];
  schools: SchoolWork[];
  onAddSupervisor: () => void;
  onEditSupervisor: (supervisor: SchoolSupervisor) => void;
  onDeleteSupervisor: (id: string) => void;
  onUpdateVisitStatus: (id: string, status: "approved" | "rejected") => Promise<boolean>;
  onBulkUpdateVisitStatus?: (ids: string[], status: "approved" | "rejected") => Promise<boolean>;
  onRespondToRequest: (
    id: string,
    adminResponse: string,
    status: "responded" | "closed",
  ) => Promise<boolean>;
  onCloseRequest: (id: string, note?: string) => Promise<boolean>;
  onResolveEscalation?: (
    id: string,
    resolution: string,
    status: "responded" | "closed",
  ) => Promise<boolean>;
  onUpdateCommitment: (
    id: string,
    patch: {
      status?: CommitmentDiary["status"];
      adminNotes?: string;
      notes?: string;
    },
  ) => Promise<boolean>;
  pendingRequestCount?: number;
  readOnly?: boolean;
  isSuperAdmin?: boolean;
  view?: FieldTeamView;
  onViewChange?: (view: FieldTeamView) => void;
}

export default function FieldTeamPanel({
  visits,
  requests,
  commitments,
  supervisors,
  schools,
  onAddSupervisor,
  onEditSupervisor,
  onDeleteSupervisor,
  onUpdateVisitStatus,
  onBulkUpdateVisitStatus,
  onRespondToRequest,
  onCloseRequest,
  onResolveEscalation,
  onUpdateCommitment,
  pendingRequestCount = 0,
  readOnly = false,
  isSuperAdmin = false,
  view: controlledView,
  onViewChange,
}: FieldTeamPanelProps) {
  const [internalView, setInternalView] = useState<FieldTeamView>("visits");
  const view = controlledView ?? internalView;
  const setView = (next: FieldTeamView) => {
    onViewChange?.(next);
    if (controlledView === undefined) {
      setInternalView(next);
    }
  };

  const overdueCommitmentCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return commitments.filter(
      (c) =>
        c.status !== "cancelled" &&
        c.status !== "completed" &&
        c.toDate < today,
    ).length;
  }, [commitments]);

  const pendingVisitCount = useMemo(
    () => visits.filter((v) => v.status === "submitted").length,
    [visits],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex bg-slate-200/60 p-1 rounded-lg gap-1">
          <button
            type="button"
            onClick={() => setView("visits")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              view === "visits"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
          >
            <ClipboardList size={14} /> Visits
            {pendingVisitCount > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingVisitCount > 99 ? "99+" : pendingVisitCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView("supervisors")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              view === "supervisors"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
          >
            <Users size={14} /> Supervisors
          </button>
          <button
            type="button"
            onClick={() => setView("requests")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              view === "requests"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
          >
            <MessageSquare size={14} /> Requests
            {pendingRequestCount > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView("commitments")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              view === "commitments"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
          >
            <BookOpen size={14} /> Commitment Diary
            {overdueCommitmentCount > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {overdueCommitmentCount > 99 ? "99+" : overdueCommitmentCount}
              </span>
            )}
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {view === "visits"
            ? "Review field visit reports from the supervisor mobile portal — commitment visits fulfill diary entries; ad-hoc visits are optional"
            : view === "requests"
              ? "Supervisor messages and photos requiring admin response"
              : view === "commitments"
                ? "Daily and date-range visit commitments submitted by supervisors"
              : "Manage supervisors and their block assignments"}
        </span>
      </div>

      {view === "visits" ? (
        <SupervisorVisitsPanel
          visits={visits}
          supervisors={supervisors}
          schools={schools}
          onUpdateStatus={onUpdateVisitStatus}
          onBulkUpdateStatus={onBulkUpdateVisitStatus}
          readOnly={readOnly}
        />
      ) : view === "requests" ? (
        <SupervisorRequestsPanel
          requests={requests}
          supervisors={supervisors}
          onRespond={onRespondToRequest}
          onClose={onCloseRequest}
          onResolveEscalation={onResolveEscalation}
          readOnly={readOnly}
          isSuperAdmin={isSuperAdmin}
        />
      ) : view === "commitments" ? (
        <CommitmentDiaryPanel
          commitments={commitments}
          supervisors={supervisors}
          schools={schools}
          onUpdate={onUpdateCommitment}
          readOnly={readOnly}
        />
      ) : (
        <div className="space-y-4">
          <SchoolLocationResolver schools={schools} readOnly={readOnly} />
          <SchoolSupervisorsTable
            supervisors={supervisors}
            schools={schools}
            onAdd={onAddSupervisor}
            onEdit={onEditSupervisor}
            onDelete={onDeleteSupervisor}
            readOnly={readOnly}
          />
          <SupervisorPwaInstallCard />
        </div>
      )}
    </div>
  );
}
