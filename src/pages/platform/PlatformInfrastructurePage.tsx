import React from "react";
import { Database, HardDrive, Server, Clock } from "lucide-react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface InfraData {
  database: { status: string; collections: number; connections: number };
  queue: { pending: number; handlers: string[] };
  storage: { heapUsedMb: number; rssMb: number };
  uptime: number;
  redis: { configured: boolean; status: string };
  backup: { lastBackup: string | null; status: string };
}

export default function PlatformInfrastructurePage() {
  const { data, loading, error } = usePlatformApi<InfraData>("/api/platform/infrastructure");

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  return (
    <div>
      <PageHeader title="Server & Infrastructure" description="Database, queues, storage, and backup monitoring." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Database" value={data.database.status} icon={Database} color={data.database.status === "connected" ? "text-green-600" : "text-red-600"} sub={`${data.database.collections} collections`} />
        <KpiCard label="Queue Pending" value={data.queue.pending} icon={Server} sub={data.queue.handlers.join(", ") || "No handlers"} />
        <KpiCard label="Heap Memory" value={`${data.storage.heapUsedMb} MB`} icon={HardDrive} />
        <KpiCard label="Uptime" value={`${Math.round(data.uptime / 3600)}h`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-slate-800 mb-3">Background Jobs</h3>
          <div className="space-y-2 text-sm">
            {data.queue.handlers.map((h) => (
              <div key={h} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="font-mono text-xs">{h}</span>
                <span className="text-green-600 text-xs font-bold">Active</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-slate-800 mb-3">Services</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Redis</span><span className={data.redis.configured ? "text-green-600" : "text-amber-600"}>{data.redis.status}</span></div>
            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Email Queue</span><span className="text-green-600">In-process</span></div>
            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>SMS Queue</span><span className="text-amber-600">Planned</span></div>
            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>WhatsApp Queue</span><span className="text-green-600">Direct API</span></div>
            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Backup</span><span>{data.backup.status}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
