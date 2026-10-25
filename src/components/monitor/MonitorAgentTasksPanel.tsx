import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Plus, RefreshCw, X } from "lucide-react";
import {
  AgentTaskStatus,
  monitorApi,
  MonitorAgentTask,
  MonitorRecurringAgentTask,
  MonitoredEmployee,
} from "../../lib/monitor-api";

interface MonitorAgentTasksPanelProps {
  readOnly?: boolean;
}

const STATUS_FILTERS: Array<AgentTaskStatus | "all"> = ["all", "pending", "done", "cancelled"];

type AssigneeOption = { id: string; employeeCode: string; name: string; isOnline: boolean };

export default function MonitorAgentTasksPanel({ readOnly = false }: MonitorAgentTasksPanelProps) {
  const [tasks, setTasks] = useState<MonitorAgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentTaskStatus | "all">("pending");
  const [showForm, setShowForm] = useState(false);
  const [monitoredEmployees, setMonitoredEmployees] = useState<AssigneeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [issueDay, setIssueDay] = useState("1");
  const [dueDay, setDueDay] = useState("28");
  const [recurringTemplates, setRecurringTemplates] = useState<MonitorRecurringAgentTask[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(
        await monitorApi.getAgentTasks({
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadRecurring = useCallback(async () => {
    try {
      setRecurringTemplates(await monitorApi.getRecurringAgentTasks());
    } catch {
      setRecurringTemplates([]);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    void loadRecurring();
    const timer = setInterval(() => void loadTasks(), 60_000);
    return () => clearInterval(timer);
  }, [loadTasks, loadRecurring]);

  const loadMonitoredEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const rows = await monitorApi.getEmployees();
      const withAgent = rows.filter((e: MonitoredEmployee) => e.deviceCount > 0);
      setMonitoredEmployees(
        (withAgent.length ? withAgent : rows).map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          name: e.name || e.employeeCode || e.id,
          isOnline: e.isOnline,
        })),
      );
    } catch {
      setMonitoredEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showForm && !readOnly) void loadMonitoredEmployees();
  }, [showForm, readOnly, loadMonitoredEmployees]);

  useEffect(() => {
    if (!assigneeDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!assigneeDropdownRef.current?.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [assigneeDropdownOpen]);

  const filteredAssignees = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return monitoredEmployees;
    return monitoredEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [assigneeSearch, monitoredEmployees]);

  const selectedAssignees = useMemo(
    () => monitoredEmployees.filter((e) => selectedIds.has(e.id)),
    [monitoredEmployees, selectedIds],
  );

  function toggleAssignee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredAssignees) next.add(e.id);
      return next;
    });
  }

  function clearAssignees() {
    setSelectedIds(new Set());
  }

  function resetForm() {
    setShowForm(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setIsRecurring(false);
    setIssueDay("1");
    setDueDay("28");
    setSelectedIds(new Set());
    setAssigneeSearch("");
    setAssigneeDropdownOpen(false);
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0 || !title.trim()) return;
    setSubmitting(true);
    try {
      if (isRecurring) {
        const issue = Number(issueDay);
        const due = Number(dueDay);
        if (!Number.isInteger(issue) || issue < 1 || issue > 31) {
          setError("Create-on day must be between 1 and 31.");
          return;
        }
        if (!Number.isInteger(due) || due < 1 || due > 31) {
          setError("Due day must be between 1 and 31.");
          return;
        }
        await monitorApi.createRecurringAgentTask({
          employeeIds: [...selectedIds],
          title: title.trim(),
          description: description.trim() || undefined,
          issueDay: issue,
          dueDay: due,
        });
        await loadRecurring();
      } else {
        await monitorApi.createAgentTask({
          employeeIds: [...selectedIds],
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
        });
      }
      resetForm();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  async function stopRecurring(template: MonitorRecurringAgentTask) {
    if (!confirm(`Stop monthly recurrence for "${template.title}"?`)) return;
    try {
      await monitorApi.patchRecurringAgentTask(template.id, { active: false });
      await loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update recurring task");
    }
  }

  async function cancelTask(task: MonitorAgentTask) {
    if (!confirm(`Cancel task "${task.title}"?`)) return;
    try {
      await monitorApi.patchAgentTask(task.id, { status: "cancelled" });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel task");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Agent tasks</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign tasks to desktop agent users; employees mark done in Workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            data-no-busy
            onClick={() => void loadTasks()}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {!readOnly && (
            <button
              type="button"
              data-no-busy
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"
            >
              <Plus size={14} /> New task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
      )}

      <select
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as AgentTaskStatus | "all")}
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? "All statuses" : s}
          </option>
        ))}
      </select>

      {showForm && !readOnly && (
        <form onSubmit={(e) => void submitTask(e)} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Monitored employees
            </label>
            <div ref={assigneeDropdownRef} className="relative mt-1">
              <button
                type="button"
                className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm text-left bg-white"
                onClick={() => setAssigneeDropdownOpen((o) => !o)}
              >
                <span className={selectedIds.size ? "text-slate-800" : "text-slate-400"}>
                  {selectedIds.size
                    ? `${selectedIds.size} employee${selectedIds.size === 1 ? "" : "s"} selected`
                    : "Select one or more employees"}
                </span>
                <ChevronDown size={16} className="text-slate-400 shrink-0" />
              </button>
              {assigneeDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="search"
                      className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                      placeholder="Search name or code…"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#ff791a]"
                        onClick={selectAllFiltered}
                        disabled={!filteredAssignees.length}
                      >
                        Select all shown
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500"
                        onClick={clearAssignees}
                        disabled={!selectedIds.size}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <ul className="max-h-52 overflow-y-auto text-sm">
                    {employeesLoading && (
                      <li className="px-3 py-4 text-center text-slate-400 text-xs">Loading employees…</li>
                    )}
                    {!employeesLoading && filteredAssignees.length === 0 && (
                      <li className="px-3 py-4 text-center text-slate-400 text-xs">No monitored employees match</li>
                    )}
                    {filteredAssignees.map((emp) => (
                      <li key={emp.id}>
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(emp.id)}
                            onChange={() => toggleAssignee(emp.id)}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium text-slate-800">{emp.name}</span>
                            <span className="text-slate-400 ml-1">({emp.employeeCode})</span>
                          </span>
                          {emp.isOnline && (
                            <span className="text-[10px] font-bold text-green-600 uppercase">Online</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {selectedAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedAssignees.map((emp) => (
                  <span
                    key={emp.id}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-full pl-2.5 pr-1 py-0.5"
                  >
                    {emp.name}
                    <button
                      type="button"
                      className="p-0.5 rounded-full hover:bg-slate-200"
                      aria-label={`Remove ${emp.name}`}
                      onClick={() => toggleAssignee(emp.id)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Checklist items — one bullet per line (each line becomes a task in FLEX WORKSPACE)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={isRecurring}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span className="font-semibold">Recurring monthly</span>
            <span className="text-slate-400 text-xs">Auto-creates on a fixed day each month</span>
          </label>
          {isRecurring ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Create on day
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={issueDay}
                  onChange={(e) => setIssueDay(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Due by day
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || selectedIds.size === 0}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              {isRecurring
                ? selectedIds.size > 1
                  ? `Save recurring for ${selectedIds.size} employees`
                  : "Save recurring task"
                : selectedIds.size > 1
                  ? `Assign to ${selectedIds.size} employees`
                  : "Assign task"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {recurringTemplates.some((t) => t.active) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Recurring schedules</h3>
          <ul className="text-sm space-y-2">
            {recurringTemplates
              .filter((t) => t.active)
              .map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      Creates day {t.issueDay} · Due day {t.dueDay} · {t.employeeIds.length} employee
                      {t.employeeIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:underline"
                      onClick={() => void stopRecurring(t)}
                    >
                      Stop
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading tasks…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Task</th>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Completed</th>
                <th className="text-left p-3">Note</th>
                {!readOnly && <th className="text-left p-3" />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-t border-slate-100 ${task.status === "done" ? "bg-green-50/40" : ""}`}
                >
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{task.title}</p>
                    {task.description && <p className="text-slate-500 mt-0.5">{task.description}</p>}
                  </td>
                  <td className="p-3">{task.employeeName || task.employeeId}</td>
                  <td className="p-3 capitalize">{task.status}</td>
                  <td className="p-3 text-slate-600">
                    {task.completedAt ? new Date(task.completedAt).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="p-3 text-slate-600 max-w-[200px] truncate">{task.completionNote || "—"}</td>
                  {!readOnly && (
                    <td className="p-3">
                      {task.status === "pending" && (
                        <button
                          type="button"
                          data-no-busy
                          className="text-red-600 font-semibold hover:underline"
                          onClick={() => void cancelTask(task)}
                        >
                          Cancel
                        </button>
                      )}
                      {task.status === "done" && <CheckCircle2 size={16} className="text-green-600" />}
                    </td>
                  )}
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="p-6 text-center text-slate-400">
                    No tasks match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
