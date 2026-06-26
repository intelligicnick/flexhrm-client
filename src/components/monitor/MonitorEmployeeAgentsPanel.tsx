import React, { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Search, Trash2, Users } from "lucide-react";
import {
  EmployeeAgentCredential,
  EmployeeSearchResult,
  monitorApi,
} from "../../lib/monitor-api";
import { DESKTOP_AGENT_DOWNLOAD_URL } from "../../lib/client-downloads";

interface MonitorEmployeeAgentsPanelProps {
  readOnly?: boolean;
  onCredentialsChanged?: () => void;
}

export default function MonitorEmployeeAgentsPanel({
  readOnly = false,
  onCredentialsChanged,
}: MonitorEmployeeAgentsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmployeeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const [credentials, setCredentials] = useState<EmployeeAgentCredential[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<{
    employeeName: string;
    employeeCode: string;
    key: string;
    hash: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadCredentials = useCallback(async () => {
    try {
      setCredentials(await monitorApi.getAgentCredentials());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        setSearchResults(await monitorApi.searchEmployees(searchQuery.trim()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleCreate = async () => {
    if (readOnly || !selectedEmployee) return;
    setCreating(true);
    setError("");
    try {
      const creds = await monitorApi.createAgentCredential(selectedEmployee.id);
      setCreatedCredentials({
        employeeName: creds.employeeName,
        employeeCode: creds.employeeCode,
        key: creds.key,
        hash: creds.hash,
      });
      setSelectedEmployee(null);
      setSearchQuery("");
      setSearchResults([]);
      await loadCredentials();
      onCredentialsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create credentials");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (employeeId: string, employeeName: string) => {
    if (readOnly) return;
    if (!confirm(`Revoke agent credentials for ${employeeName}? Connected devices will be revoked.`)) return;
    try {
      await monitorApi.revokeAgentCredential(employeeId);
      await loadCredentials();
      onCredentialsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke credentials");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 text-xs text-blue-900">
        <p className="font-semibold">Download Flex HRM Connect (Windows)</p>
        <p className="mt-1 text-blue-800">
          Install the desktop agent on the employee PC, then enter the Monitor Key and Hash below.
        </p>
        <a
          href={DESKTOP_AGENT_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 font-semibold text-blue-700 hover:underline"
        >
          Download latest Windows installer
        </a>
      </div>

      {!readOnly && (
        <div className="border border-slate-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-800">Create Employee Agent Credentials</h4>
          <p className="text-xs text-slate-500">
            Search for an employee, select them, then generate a unique Monitor Key and Hash for their desktop agent.
          </p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedEmployee(null);
              }}
              placeholder="Search by name or employee code..."
              className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2.5"
            />
          </div>

          {searching && <p className="text-[10px] text-slate-400">Searching...</p>}

          {searchResults.length > 0 && !selectedEmployee && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {searchResults.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setSearchQuery(`${emp.name} (${emp.employeeCode})`);
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                >
                  <div className="font-semibold text-slate-800">{emp.name}</div>
                  <div className="text-slate-400">
                    {emp.employeeCode}
                    {emp.location ? ` · ${emp.location}` : ""}
                    {emp.hasCredential ? " · credentials exist" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedEmployee && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-semibold text-slate-800">{selectedEmployee.name}</p>
                <p className="text-slate-500">{selectedEmployee.employeeCode}</p>
                {selectedEmployee.hasCredential && (
                  <p className="text-amber-600 mt-1">Existing credentials will be replaced.</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg bg-[#ff791a] text-white hover:bg-[#e66d17] disabled:opacity-50 shrink-0"
              >
                <Plus size={14} />
                {creating ? "Creating..." : "Generate Key & Hash"}
              </button>
            </div>
          )}
        </div>
      )}

      {createdCredentials && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-emerald-800">
            Credentials for {createdCredentials.employeeName} ({createdCredentials.employeeCode}) — copy now. They won&apos;t be shown again.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg border border-emerald-200 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Monitor Key</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <code className="text-xs font-mono text-slate-800 break-all">{createdCredentials.key}</code>
                <button type="button" onClick={() => copyText(createdCredentials.key)} className="text-slate-400 hover:text-slate-600">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-emerald-200 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Monitor Hash</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <code className="text-xs font-mono text-slate-800 break-all">{createdCredentials.hash}</code>
                <button type="button" onClick={() => copyText(createdCredentials.hash)} className="text-slate-400 hover:text-slate-600">
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-emerald-700">
            Install the Flex HRM desktop agent on the employee&apos;s PC and enter these credentials. The agent will automatically link to this employee.
          </p>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <h4 className="text-sm font-bold text-slate-800">Employee Agent Credentials</h4>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Employee</th>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Key</th>
              <th className="text-left px-4 py-2">Hash</th>
              <th className="text-left px-4 py-2">Devices</th>
              <th className="text-left px-4 py-2">Status</th>
              {!readOnly && <th className="text-left px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {credentials.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-800">{c.employeeName}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.employeeCode}</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{c.keyHint}</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{c.hashHint}</td>
                <td className="px-4 py-2.5">{c.deviceCount}</td>
                <td className="px-4 py-2.5 capitalize">{c.status}</td>
                {!readOnly && (
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      data-no-busy
                      onClick={() => handleRevoke(c.employeeId, c.employeeName)}
                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-[11px] font-semibold"
                      title="Delete credentials"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {credentials.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                  No employee credentials yet. Search and select an employee above to generate credentials.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
