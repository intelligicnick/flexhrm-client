import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  AgentTaskStatus,
  monitorApi,
  MonitorAgentTask,
  MonitorRecurringAgentTask,
  MonitoredEmployee,
} from "../../lib/monitor-api";

interface MonitorAgentTasksPanelProps {
  readOnly?: boolean;
  /** Hard-delete tasks and recurring templates (monitor delete or super admin). */
  canDelete?: boolean;
}

type TaskListFilter = AgentTaskStatus | "all" | "archived";
const STATUS_FILTERS: TaskListFilter[] = ["all", "pending", "done", "cancelled", "archived"];

type DeadlineFilter = "any" | "overdue" | "today" | "week" | "no_due" | "custom";
type SourceFilter = "all" | "recurring" | "manual";
type SortFilter = "created" | "due_asc" | "due_desc";
type ListViewFilter = "all" | "recurring" | "tasks";

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isTaskOverdue(task: MonitorAgentTask): boolean {
  if (task.archived || task.status !== "pending" || !task.dueDate?.trim()) return false;
  return task.dueDate.slice(0, 10) < localTodayIso();
}

function isGroupTaskDescription(desc?: string): boolean {
  return Boolean(desc?.trim().toLowerCase().startsWith("group:"));
}

function taskGroupKey(task: MonitorAgentTask): string {
  return `${task.employeeId}::${(task.description || "").trim()}`;
}

function groupTaskMembers(task: MonitorAgentTask, all: MonitorAgentTask[]): MonitorAgentTask[] {
  if (!isGroupTaskDescription(task.description)) return [task];
  const key = taskGroupKey(task);
  return all.filter((t) => taskGroupKey(t) === key && t.status === task.status);
}

type AssigneeOption = { id: string; employeeCode: string; name: string; isOnline: boolean };

function taskBulletLines(text: string): string[] {
  return (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function ActionLink({
  className = "text-slate-600",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-0.5 font-semibold hover:underline whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ActionCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="p-2 align-top w-[9.5rem] min-w-[9.5rem]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 justify-items-start text-[11px] leading-snug">
        {children}
      </div>
    </td>
  );
}

function TaskDetailList({ label, lines }: { label: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <ul className="list-disc list-inside text-slate-700 text-xs space-y-0.5">
        {lines.map((line, i) => (
          <li key={`${i}-${line}`} className="whitespace-pre-wrap">{line}</li>
        ))}
      </ul>
    </div>
  );
}

export default function MonitorAgentTasksPanel({
  readOnly = false,
  canDelete = false,
}: MonitorAgentTasksPanelProps) {
  const [tasks, setTasks] = useState<MonitorAgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskListFilter>("pending");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("any");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortFilter>("created");
  const [listViewFilter, setListViewFilter] = useState<ListViewFilter>("all");
  const [viewingTask, setViewingTask] = useState<MonitorAgentTask | null>(null);
  const [viewingRecurring, setViewingRecurring] = useState<MonitorRecurringAgentTask | null>(null);
  const [recurringInstances, setRecurringInstances] = useState<MonitorAgentTask[]>([]);
  const [recurringInstancesLoading, setRecurringInstancesLoading] = useState(false);
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editingTaskGroupMode, setEditingTaskGroupMode] = useState(false);
  const [editingGroupTaskIds, setEditingGroupTaskIds] = useState<string[]>([]);
  const [editingGroupHeading, setEditingGroupHeading] = useState("");
  const [editChecklistLines, setEditChecklistLines] = useState("");
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editRecurringTitle, setEditRecurringTitle] = useState("");
  const [editRecurringDescription, setEditRecurringDescription] = useState("");
  const [editIssueDay, setEditIssueDay] = useState("1");
  const [editDueDay, setEditDueDay] = useState("28");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(
        await monitorApi.getAgentTasks({
          status:
            statusFilter === "all" || statusFilter === "archived"
              ? undefined
              : statusFilter,
          archived: statusFilter === "archived" ? "only" : "exclude",
          employeeId: employeeFilter || undefined,
          deadline:
            deadlineFilter === "any" || deadlineFilter === "custom"
              ? undefined
              : deadlineFilter,
          dueFrom: deadlineFilter === "custom" ? dueFrom || undefined : undefined,
          dueTo: deadlineFilter === "custom" ? dueTo || undefined : undefined,
          search: debouncedSearch.trim() || undefined,
          source: sourceFilter === "all" ? undefined : sourceFilter,
          sort: sortBy,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    employeeFilter,
    deadlineFilter,
    dueFrom,
    dueTo,
    debouncedSearch,
    sourceFilter,
    sortBy,
  ]);

  const hasActiveFilters =
    employeeFilter !== "" ||
    deadlineFilter !== "any" ||
    debouncedSearch.trim() !== "" ||
    sourceFilter !== "all" ||
    sortBy !== "created" ||
    statusFilter !== "pending" ||
    listViewFilter !== "all";

  const showRecurringInList = listViewFilter === "all" || listViewFilter === "recurring";
  const showTasksInList = listViewFilter === "all" || listViewFilter === "tasks";

  const filteredRecurringSchedules = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return recurringTemplates
      .filter((t) => t.active)
      .filter((t) => !employeeFilter || t.employeeIds.includes(employeeFilter))
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.title} ${t.description || ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [recurringTemplates, employeeFilter, debouncedSearch]);

  function resetFilters() {
    setListViewFilter("all");
    setStatusFilter("pending");
    setEmployeeFilter("");
    setDeadlineFilter("any");
    setDueFrom("");
    setDueTo("");
    setSearchQuery("");
    setSourceFilter("all");
    setSortBy("created");
  }

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
    void loadMonitoredEmployees();
  }, [loadMonitoredEmployees]);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of monitoredEmployees) {
      map.set(e.id, `${e.name} (${e.employeeCode})`);
    }
    return map;
  }, [monitoredEmployees]);

  function resolveEmployeeName(id: string, fallback?: string) {
    return employeeNameById.get(id) || fallback || id;
  }

  async function openRecurringView(template: MonitorRecurringAgentTask) {
    setViewingRecurring(template);
    setRecurringInstances([]);
    setRecurringInstancesLoading(true);
    try {
      setRecurringInstances(
        await monitorApi.getAgentTasks({
          recurringTemplateId: template.id,
          archived: "all",
        }),
      );
    } catch {
      setRecurringInstances([]);
    } finally {
      setRecurringInstancesLoading(false);
    }
  }

  function closeRecurringView() {
    setViewingRecurring(null);
    setRecurringInstances([]);
  }

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

  function sortGroupMembers(members: MonitorAgentTask[]) {
    return [...members].sort(
      (a, b) =>
        (a.createdAt || "").localeCompare(b.createdAt || "") || a.title.localeCompare(b.title),
    );
  }

  function startEditTask(task: MonitorAgentTask) {
    setEditingTaskId(task.id);
    const members = sortGroupMembers(groupTaskMembers(task, tasks));
    if (members.length > 1 || isGroupTaskDescription(task.description)) {
      setEditingTaskGroupMode(true);
      setEditingGroupTaskIds(members.map((m) => m.id));
      setEditingGroupHeading((task.description || "").replace(/^Group:\s*/i, "").trim());
      setEditChecklistLines(members.map((m) => m.title).join("\n"));
      setEditTitle("");
      setEditDescription("");
    } else {
      setEditingTaskGroupMode(false);
      setEditingGroupTaskIds([]);
      setEditingGroupHeading("");
      setEditChecklistLines("");
      setEditTitle(task.title);
      setEditDescription(task.description || "");
    }
    setEditDueDate(task.dueDate?.slice(0, 10) || "");
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setEditingTaskGroupMode(false);
    setEditingGroupTaskIds([]);
    setEditingGroupHeading("");
    setEditChecklistLines("");
    setEditTitle("");
    setEditDescription("");
    setEditDueDate("");
  }

  async function saveEditTask(task: MonitorAgentTask) {
    setSubmitting(true);
    try {
      if (editingTaskGroupMode) {
        const heading = editingGroupHeading.trim();
        if (!heading) {
          setError("Group heading is required.");
          return;
        }
        const lines = editChecklistLines
          .split(/\r?\n/)
          .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
          .filter(Boolean);
        if (!lines.length) {
          setError("Add at least one checklist line.");
          return;
        }
        const members = sortGroupMembers(tasks.filter((t) => editingGroupTaskIds.includes(t.id)));
        const groupDesc = `Group: ${heading}`;
        const due = editDueDate || undefined;
        for (let i = 0; i < members.length; i++) {
          const line = lines[i];
          if (line) {
            await monitorApi.patchAgentTask(members[i].id, {
              title: line,
              description: groupDesc,
              dueDate: due,
            });
          } else {
            await monitorApi.patchAgentTask(members[i].id, { status: "cancelled" });
          }
        }
        for (let i = members.length; i < lines.length; i++) {
          await monitorApi.createAgentTask({
            employeeIds: [task.employeeId],
            title: lines[i],
            description: groupDesc,
            dueDate: due,
          });
        }
      } else {
        if (!editTitle.trim()) return;
        await monitorApi.patchAgentTask(task.id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          dueDate: editDueDate || undefined,
        });
      }
      cancelEditTask();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setSubmitting(false);
    }
  }

  async function reopenTask(task: MonitorAgentTask) {
    const label =
      task.status === "done"
        ? `Reopen "${task.title}" for the employee? Their completion will be cleared.`
        : `Reopen cancelled task "${task.title}"?`;
    if (!confirm(label)) return;
    try {
      await monitorApi.patchAgentTask(task.id, { status: "pending" });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen task");
    }
  }

  async function archiveTask(task: MonitorAgentTask) {
    if (!confirm(`Archive "${task.title}"? It will be hidden from the main list.`)) return;
    try {
      await monitorApi.patchAgentTask(task.id, { archived: true });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive task");
    }
  }

  async function unarchiveTask(task: MonitorAgentTask) {
    try {
      await monitorApi.patchAgentTask(task.id, { archived: false });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore task");
    }
  }

  async function deleteTask(task: MonitorAgentTask) {
    if (!confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await monitorApi.deleteAgentTask(task.id);
      if (editingTaskId === task.id) cancelEditTask();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  function startEditRecurring(t: MonitorRecurringAgentTask) {
    setEditingRecurringId(t.id);
    setEditRecurringTitle(t.title);
    setEditRecurringDescription(t.description || "");
    setEditIssueDay(String(t.issueDay));
    setEditDueDay(String(t.dueDay));
  }

  function cancelEditRecurring() {
    setEditingRecurringId(null);
    setEditRecurringTitle("");
    setEditRecurringDescription("");
    setEditIssueDay("1");
    setEditDueDay("28");
  }

  async function saveEditRecurring(templateId: string) {
    const issue = Number(editIssueDay);
    const due = Number(editDueDay);
    if (!editRecurringTitle.trim()) return;
    if (!Number.isInteger(issue) || issue < 1 || issue > 31) {
      setError("Create-on day must be between 1 and 31.");
      return;
    }
    if (!Number.isInteger(due) || due < 1 || due > 31) {
      setError("Due day must be between 1 and 31.");
      return;
    }
    setSubmitting(true);
    try {
      await monitorApi.patchRecurringAgentTask(templateId, {
        title: editRecurringTitle.trim(),
        description: editRecurringDescription.trim(),
        issueDay: issue,
        dueDay: due,
      });
      cancelEditRecurring();
      await loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update recurring task");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecurring(template: MonitorRecurringAgentTask) {
    if (!confirm(`Delete recurring schedule "${template.title}"? Future months will not be created.`)) return;
    try {
      await monitorApi.deleteRecurringAgentTask(template.id);
      if (editingRecurringId === template.id) cancelEditRecurring();
      await loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recurring task");
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
            onClick={() => {
              void loadTasks();
              void loadRecurring();
            }}
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

      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "recurring" as const, label: "Recurring schedules" },
              { id: "tasks" as const, label: "Assigned tasks" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                listViewFilter === tab.id
                  ? "bg-[#ff791a] text-white border-[#ff791a]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => setListViewFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 min-w-[140px] flex-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Search</span>
            <input
              type="search"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full min-w-[160px]"
              placeholder="Title, details, comment…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 min-w-[140px] flex-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Employee</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              disabled={employeesLoading}
            >
              <option value="">All employees</option>
              {monitoredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label
            className={`flex flex-col gap-1 min-w-[120px] ${!showTasksInList ? "opacity-50 pointer-events-none" : ""}`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Status</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              value={statusFilter}
              disabled={!showTasksInList}
              onChange={(e) => setStatusFilter(e.target.value as TaskListFilter)}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all"
                    ? "All statuses"
                    : s === "archived"
                      ? "Archived"
                      : s}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`flex flex-col gap-1 min-w-[130px] ${!showTasksInList ? "opacity-50 pointer-events-none" : ""}`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Deadline</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              value={deadlineFilter}
              disabled={!showTasksInList}
              onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
            >
              <option value="any">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Due this week</option>
              <option value="no_due">No due date</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label
            className={`flex flex-col gap-1 min-w-[120px] ${!showTasksInList ? "opacity-50 pointer-events-none" : ""}`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Source</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              value={sourceFilter}
              disabled={!showTasksInList}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            >
              <option value="all">All tasks</option>
              <option value="manual">One-off assigned</option>
              <option value="recurring">From recurring</option>
            </select>
          </label>
          <label
            className={`flex flex-col gap-1 min-w-[120px] ${!showTasksInList ? "opacity-50 pointer-events-none" : ""}`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sort</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              value={sortBy}
              disabled={!showTasksInList}
              onChange={(e) => setSortBy(e.target.value as SortFilter)}
            >
              <option value="created">Newest first</option>
              <option value="due_asc">Due date (soonest)</option>
              <option value="due_desc">Due date (latest)</option>
            </select>
          </label>
        </div>
        {deadlineFilter === "custom" && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Due from</span>
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={dueFrom}
                onChange={(e) => setDueFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Due to</span>
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={dueTo}
                onChange={(e) => setDueTo(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {loading && showTasksInList
              ? "Loading…"
              : [
                  showRecurringInList
                    ? `${filteredRecurringSchedules.length} schedule${filteredRecurringSchedules.length === 1 ? "" : "s"}`
                    : null,
                  showTasksInList ? `${tasks.length} task${tasks.length === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "0 items"}
            {deadlineFilter === "overdue" && showTasksInList ? " · overdue pending only" : ""}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="font-semibold text-[#ff791a] hover:underline"
              onClick={resetFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

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
            placeholder={
              isRecurring
                ? "Checklist / instructions — one item per line (shown to employees each month)"
                : "Checklist items — one bullet per line (each line becomes a task in FLEX WORKSPACE)"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
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

      {loading && showTasksInList ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading tasks…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3 w-[88px]">Type</th>
                <th className="text-left p-3">Task</th>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Completed</th>
                <th className="text-left p-3">Note</th>
                <th className="text-left p-3 w-[9.5rem] min-w-[9.5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {showRecurringInList &&
                filteredRecurringSchedules.map((t) => (
                  <tr
                    key={`recurring-${t.id}`}
                    className={`border-t border-slate-100 bg-orange-50/20 ${
                      editingRecurringId === t.id ? "" : "cursor-pointer hover:bg-orange-50/45"
                    }`}
                    onClick={() => {
                      if (editingRecurringId === t.id) return;
                      void openRecurringView(t);
                    }}
                  >
                    <td className="p-3">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-[#ff791a] bg-orange-100 px-2 py-0.5 rounded">
                        Recurring
                      </span>
                    </td>
                    <td className="p-3">
                      {editingRecurringId === t.id ? (
                        <div className="space-y-2 min-w-[220px]">
                          <input
                            className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                            placeholder="Schedule heading"
                            value={editRecurringTitle}
                            onChange={(e) => setEditRecurringTitle(e.target.value)}
                          />
                          <textarea
                            className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                            placeholder="Checklist — one item per line"
                            rows={4}
                            value={editRecurringDescription}
                            onChange={(e) => setEditRecurringDescription(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min={1}
                              max={31}
                              className="border border-slate-200 rounded-md px-2 py-1 text-sm"
                              value={editIssueDay}
                              onChange={(e) => setEditIssueDay(e.target.value)}
                              aria-label="Create on day"
                            />
                            <input
                              type="number"
                              min={1}
                              max={31}
                              className="border border-slate-200 rounded-md px-2 py-1 text-sm"
                              value={editDueDay}
                              onChange={(e) => setEditDueDay(e.target.value)}
                              aria-label="Due day"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-800">{t.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Monthly · create day {t.issueDay} · due day {t.dueDay}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[160px]">
                      <span className="line-clamp-3">
                        {t.employeeIds.map((id) => resolveEmployeeName(id)).join(", ")}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      Day {t.issueDay} → {t.dueDay}
                    </td>
                    <td className="p-3 capitalize text-green-700 font-semibold">active</td>
                    <td className="p-3 text-slate-400">—</td>
                    <td className="p-3 text-slate-600 max-w-[200px]">
                      <span className="line-clamp-3 whitespace-pre-wrap">{t.description || "—"}</span>
                    </td>
                    {editingRecurringId === t.id ? (
                      <td className="p-2 align-top" onClick={(e) => e.stopPropagation()}>
                        {!readOnly && (
                          <div className="flex flex-col gap-1 text-[11px]">
                            <ActionLink
                              className="text-slate-800"
                              disabled={submitting}
                              onClick={() => void saveEditRecurring(t.id)}
                            >
                              Save
                            </ActionLink>
                            <ActionLink className="text-slate-500" onClick={cancelEditRecurring}>
                              Discard
                            </ActionLink>
                          </div>
                        )}
                      </td>
                    ) : readOnly ? (
                      <td className="p-2" />
                    ) : (
                      <ActionCell>
                        <ActionLink onClick={() => startEditRecurring(t)}>
                          <Pencil size={12} aria-hidden /> Edit
                        </ActionLink>
                        <ActionLink className="text-amber-700" onClick={() => void stopRecurring(t)}>
                          Stop
                        </ActionLink>
                        {canDelete ? (
                          <ActionLink className="text-red-700" onClick={() => void deleteRecurring(t)}>
                            <Trash2 size={12} aria-hidden /> Delete
                          </ActionLink>
                        ) : (
                          <span />
                        )}
                      </ActionCell>
                    )}
                  </tr>
                ))}
              {showTasksInList &&
                tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-t border-slate-100 ${
                    task.status === "done"
                      ? "bg-green-50/40"
                      : isTaskOverdue(task)
                        ? "bg-red-50/50"
                        : ""
                  } ${editingTaskId === task.id ? "" : "cursor-pointer hover:bg-slate-50"}`}
                  onClick={() => {
                    if (editingTaskId === task.id) return;
                    setViewingTask(task);
                  }}
                >
                  <td className="p-3">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {task.recurringTemplateId ? "Instance" : "Task"}
                    </span>
                  </td>
                  <td className="p-3">
                    {editingTaskId === task.id ? (
                      <div className="space-y-2 min-w-[220px]">
                        {editingTaskGroupMode ? (
                          <>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Group heading
                            </label>
                            <input
                              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                              value={editingGroupHeading}
                              onChange={(e) => setEditingGroupHeading(e.target.value)}
                            />
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Checklist (one line per item)
                            </label>
                            <textarea
                              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm font-mono"
                              rows={5}
                              value={editChecklistLines}
                              onChange={(e) => setEditChecklistLines(e.target.value)}
                            />
                          </>
                        ) : (
                          <>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Heading
                            </label>
                            <input
                              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Checklist & details
                            </label>
                            <textarea
                              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                              rows={5}
                              placeholder="One checklist item per line"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                          </>
                        )}
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Due date
                        </label>
                        <input
                          type="date"
                          className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-800">{task.title}</p>
                        {task.description && (
                          <p className="text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-wrap">{task.description}</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="p-3">{task.employeeName || task.employeeId}</td>
                  <td className="p-3 text-slate-600 whitespace-nowrap">
                    {task.dueDate ? (
                      <span className={isTaskOverdue(task) ? "text-red-700 font-semibold" : ""}>
                        {task.dueDate.slice(0, 10)}
                        {isTaskOverdue(task) ? " · overdue" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 capitalize">
                    {task.archived ? "archived" : task.status}
                  </td>
                  <td className="p-3 text-slate-600">
                    {task.completedAt ? new Date(task.completedAt).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="p-3 text-slate-600 max-w-[220px]">
                    <span className="line-clamp-3 whitespace-pre-wrap block">{task.completionNote || "—"}</span>
                  </td>
                  {editingTaskId === task.id ? (
                    <td className="p-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <ActionLink
                          data-no-busy
                          className="text-slate-800"
                          disabled={submitting}
                          onClick={() => void saveEditTask(task)}
                        >
                          Save
                        </ActionLink>
                        <ActionLink data-no-busy className="text-slate-500" onClick={cancelEditTask}>
                          Discard
                        </ActionLink>
                      </div>
                    </td>
                  ) : readOnly ? (
                    <td className="p-2" />
                  ) : (
                    <ActionCell>
                      {!task.archived && task.status === "pending" && (
                        <ActionLink data-no-busy onClick={() => startEditTask(task)}>
                          <Pencil size={12} aria-hidden /> Edit
                        </ActionLink>
                      )}
                      {!task.archived && task.status === "pending" && (
                        <ActionLink data-no-busy className="text-red-600" onClick={() => void cancelTask(task)}>
                          Cancel
                        </ActionLink>
                      )}
                      {!task.archived && (task.status === "done" || task.status === "cancelled") && (
                        <ActionLink
                          data-no-busy
                          className="text-[#ff791a]"
                          onClick={() => void reopenTask(task)}
                        >
                          <RotateCcw size={12} aria-hidden /> Reopen
                        </ActionLink>
                      )}
                      {!task.archived && (
                        <ActionLink data-no-busy onClick={() => void archiveTask(task)}>
                          <Archive size={12} aria-hidden /> Archive
                        </ActionLink>
                      )}
                      {task.archived && (
                        <ActionLink data-no-busy onClick={() => void unarchiveTask(task)}>
                          <RotateCcw size={12} aria-hidden /> Restore
                        </ActionLink>
                      )}
                      {canDelete && (
                        <ActionLink data-no-busy className="text-red-700" onClick={() => void deleteTask(task)}>
                          <Trash2 size={12} aria-hidden /> Delete
                        </ActionLink>
                      )}
                    </ActionCell>
                  )}
                </tr>
              ))}
              {(showRecurringInList ? filteredRecurringSchedules.length : 0) +
                (showTasksInList ? tasks.length : 0) ===
                0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    Nothing matches this view and filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {viewingTask && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setViewingTask(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-3 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-900">{viewingTask.title}</h3>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close"
                onClick={() => setViewingTask(null)}
              >
                <X size={18} />
              </button>
            </div>
            <TaskDetailList label="Checklist / details" lines={taskBulletLines(viewingTask.description || "")} />
            {viewingTask.description && taskBulletLines(viewingTask.description).length <= 1 && (
              <p className="text-slate-600 whitespace-pre-wrap text-xs">{viewingTask.description}</p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-400 font-semibold">Employee</dt>
              <dd className="text-slate-800">{viewingTask.employeeName || viewingTask.employeeId}</dd>
              <dt className="text-slate-400 font-semibold">Status</dt>
              <dd className="text-slate-800 capitalize">
                {viewingTask.archived ? "archived" : viewingTask.status}
              </dd>
              <dt className="text-slate-400 font-semibold">Due</dt>
              <dd className="text-slate-800">{viewingTask.dueDate || "—"}</dd>
              <dt className="text-slate-400 font-semibold">Created</dt>
              <dd className="text-slate-800">
                {viewingTask.createdAt
                  ? new Date(viewingTask.createdAt).toLocaleString("en-IN")
                  : "—"}
                {viewingTask.createdBy ? ` · ${viewingTask.createdBy}` : ""}
              </dd>
              <dt className="text-slate-400 font-semibold">Completed</dt>
              <dd className="text-slate-800">
                {viewingTask.completedAt
                  ? new Date(viewingTask.completedAt).toLocaleString("en-IN")
                  : "—"}
              </dd>
              <dt className="text-slate-400 font-semibold">Employee comment</dt>
              <dd className="text-slate-800 whitespace-pre-wrap text-xs leading-relaxed min-h-[1rem]">
                {viewingTask.completionNote?.trim() ? viewingTask.completionNote : "—"}
              </dd>
              {viewingTask.archivedAt && (
                <>
                  <dt className="text-slate-400 font-semibold">Archived</dt>
                  <dd className="text-slate-800">
                    {new Date(viewingTask.archivedAt).toLocaleString("en-IN")}
                  </dd>
                </>
              )}
            </dl>
            {!readOnly &&
              !viewingTask.archived &&
              (viewingTask.status === "done" || viewingTask.status === "cancelled") && (
                <button
                  type="button"
                  className="w-full mt-2 py-2 text-xs font-bold rounded-lg border border-[#ff791a] text-[#ff791a] hover:bg-orange-50"
                  onClick={() => {
                    void reopenTask(viewingTask);
                    setViewingTask(null);
                  }}
                >
                  {viewingTask.status === "done" ? "Reopen for employee" : "Reopen task"}
                </button>
              )}
          </div>
        </div>
      )}
      {viewingRecurring && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeRecurringView}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">{viewingRecurring.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Creates day {viewingRecurring.issueDay} · Due day {viewingRecurring.dueDay} · Monthly
                </p>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close"
                onClick={closeRecurringView}
              >
                <X size={18} />
              </button>
            </div>
            <TaskDetailList
              label="Checklist / instructions"
              lines={taskBulletLines(viewingRecurring.description || "")}
            />
            {viewingRecurring.description && taskBulletLines(viewingRecurring.description).length <= 1 && (
              <p className="text-slate-600 whitespace-pre-wrap text-xs">{viewingRecurring.description}</p>
            )}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Assigned employees ({viewingRecurring.employeeIds.length})
              </p>
              <ul className="text-xs text-slate-700 space-y-0.5 border border-slate-100 rounded-lg p-3 max-h-40 overflow-y-auto">
                {viewingRecurring.employeeIds.map((id) => (
                  <li key={id}>{resolveEmployeeName(id)}</li>
                ))}
              </ul>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-400 font-semibold">Created</dt>
              <dd className="text-slate-800">
                {viewingRecurring.createdAt
                  ? new Date(viewingRecurring.createdAt).toLocaleString("en-IN")
                  : "—"}
                {viewingRecurring.createdBy ? ` · ${viewingRecurring.createdBy}` : ""}
              </dd>
              <dt className="text-slate-400 font-semibold">Status</dt>
              <dd className="text-slate-800">{viewingRecurring.active ? "Active" : "Stopped"}</dd>
            </dl>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                Generated tasks & employee comments
              </p>
              {recurringInstancesLoading ? (
                <p className="text-xs text-slate-400 py-4 text-center">Loading instances…</p>
              ) : recurringInstances.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                  No instances created yet for this schedule.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase">
                      <tr>
                        <th className="text-left p-2">Period</th>
                        <th className="text-left p-2">Employee</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Completed</th>
                        <th className="text-left p-2">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringInstances.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 align-top">
                          <td className="p-2 text-slate-600">{row.recurringPeriod || row.dueDate || "—"}</td>
                          <td className="p-2">{row.employeeName || resolveEmployeeName(row.employeeId)}</td>
                          <td className="p-2 capitalize">{row.archived ? "archived" : row.status}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">
                            {row.completedAt ? new Date(row.completedAt).toLocaleString("en-IN") : "—"}
                          </td>
                          <td className="p-2 text-slate-700 whitespace-pre-wrap min-w-[140px]">
                            {row.completionNote?.trim() || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
