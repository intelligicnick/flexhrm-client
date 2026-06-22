import { useMemo } from "react";
import { Edit2, Plus, Shield, Trash2 } from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import {
  ROLE_PERMISSION_MODULE_ROWS,
  createEmptyRolePermissions,
  DEFAULT_NEW_ROLE_PERMISSIONS,
} from "../../lib/permissions";
import {
  createEmptyRoleUiRestrictions,
  OBSERVER_SALARY_PRESET,
  SALARY_COLUMNS,
  SALARY_FILTER_DEFINITIONS,
} from "../../lib/role-ui-restrictions";

export default function RolesPermissionsPanel() {
  const {
    userPermissions,
    rolesList,
    isFetchingRoles,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
    roleUiInput,
    roleError,
    roleSuccess,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
    setRoleUiInput,
    handleSaveRoleSubmit,
    handleDeleteRole,
    triggerSuccess,
  } = useHRMS();

  const canEditAdmin = !!userPermissions.admin?.edit;

  const toggleRoleSalaryUiFilter = (filterKey: string) => {
    setRoleUiInput((prev) => {
      const allKeys = SALARY_FILTER_DEFINITIONS.map((f) => f.key);
      const current =
        prev.salary?.allowedFilters !== undefined ? prev.salary.allowedFilters : allKeys;
      const next = current.includes(filterKey)
        ? current.filter((k) => k !== filterKey)
        : [...current, filterKey];
      return {
        ...prev,
        salary: {
          ...prev.salary,
          allowedFilters: next.length === allKeys.length ? undefined : next,
        },
      };
    });
  };

  const toggleRoleSalaryUiColumn = (column: string) => {
    setRoleUiInput((prev) => {
      const allCols = [...SALARY_COLUMNS];
      const current =
        prev.salary?.allowedColumns !== undefined ? prev.salary.allowedColumns : allCols;
      const next = current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column];
      return {
        ...prev,
        salary: {
          ...prev.salary,
          allowedColumns: next.length === allCols.length ? undefined : next,
        },
      };
    });
  };

  const isRoleSalaryUiFilterChecked = (filterKey: string) => {
    const allowed = roleUiInput.salary?.allowedFilters;
    if (allowed === undefined) return true;
    if (allowed.length === 0) return false;
    return allowed.includes(filterKey);
  };

  const isRoleSalaryUiColumnChecked = (column: string) => {
    const allowed = roleUiInput.salary?.allowedColumns;
    if (allowed === undefined) return true;
    if (allowed.length === 0) return false;
    return allowed.includes(column);
  };

  const allRoleModulesViewSelected = ROLE_PERMISSION_MODULE_ROWS.every(
    (mod) => !!rolePermsInput[mod.key]?.view,
  );
  const allRoleModulesEditSelected = ROLE_PERMISSION_MODULE_ROWS.every(
    (mod) => !!rolePermsInput[mod.key]?.view && !!rolePermsInput[mod.key]?.edit,
  );
  const someRoleModulesViewSelected = ROLE_PERMISSION_MODULE_ROWS.some(
    (mod) => !!rolePermsInput[mod.key]?.view,
  );
  const someRoleModulesEditSelected = ROLE_PERMISSION_MODULE_ROWS.some(
    (mod) => !!rolePermsInput[mod.key]?.edit,
  );

  const setAllRoleModuleViews = (checked: boolean) => {
    setRolePermsInput((prev) => {
      const next = { ...prev };
      ROLE_PERMISSION_MODULE_ROWS.forEach((mod) => {
        next[mod.key] = {
          ...prev[mod.key],
          view: checked,
          edit: checked ? !!prev[mod.key]?.edit : false,
        };
      });
      return next;
    });
  };

  const setAllRoleModuleEdits = (checked: boolean) => {
    setRolePermsInput((prev) => {
      const next = { ...prev };
      ROLE_PERMISSION_MODULE_ROWS.forEach((mod) => {
        next[mod.key] = {
          view: checked ? true : !!prev[mod.key]?.view,
          edit: checked,
        };
      });
      return next;
    });
  };

  const grantAllRoleModuleAccess = () => {
    setRolePermsInput((prev) => {
      const next = { ...prev };
      ROLE_PERMISSION_MODULE_ROWS.forEach((mod) => {
        next[mod.key] = { view: true, edit: true };
      });
      return next;
    });
  };

  const grantAllRoleModuleViewOnly = () => {
    setRolePermsInput((prev) => {
      const next = { ...prev };
      ROLE_PERMISSION_MODULE_ROWS.forEach((mod) => {
        next[mod.key] = { view: true, edit: false };
      });
      return next;
    });
  };

  const clearAllRoleModulePermissions = () => {
    setRolePermsInput(createEmptyRolePermissions());
  };

  const selectAllRoleSalaryFilters = () => {
    setRoleUiInput((prev) => ({
      ...prev,
      salary: { ...prev.salary, allowedFilters: undefined },
    }));
  };

  const clearAllRoleSalaryFilters = () => {
    setRoleUiInput((prev) => ({
      ...prev,
      salary: { ...prev.salary, allowedFilters: [] },
    }));
  };

  const selectAllRoleSalaryColumns = () => {
    setRoleUiInput((prev) => ({
      ...prev,
      salary: { ...prev.salary, allowedColumns: undefined },
    }));
  };

  const clearAllRoleSalaryColumns = () => {
    setRoleUiInput((prev) => ({
      ...prev,
      salary: { ...prev.salary, allowedColumns: [] },
    }));
  };

  const allRoleSalaryFiltersSelected = SALARY_FILTER_DEFINITIONS.every((filter) =>
    isRoleSalaryUiFilterChecked(filter.key),
  );
  const allRoleSalaryColumnsSelected = SALARY_COLUMNS.every((column) =>
    isRoleSalaryUiColumnChecked(column),
  );

  const activeRoleCount = useMemo(
    () =>
      Object.values(rolePermsInput).filter((perm) => perm?.view || perm?.edit).length,
    [rolePermsInput],
  );

  const loadRoleIntoEditor = (role: (typeof rolesList)[number]) => {
    setRoleNameInput(role.name);
    setRoleDescInput(role.description || "");
    setRolePermsInput(role.permissions || createEmptyRolePermissions());
    setRoleUiInput(role.uiRestrictions || createEmptyRoleUiRestrictions());
    triggerSuccess(`Loaded "${role.name}" into the editor.`);
  };

  const startNewRole = () => {
    setRoleNameInput("");
    setRoleDescInput("");
    setRolePermsInput({ ...DEFAULT_NEW_ROLE_PERMISSIONS });
    setRoleUiInput(createEmptyRoleUiRestrictions());
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-violet-50/40 p-5 shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Shield size={18} className="text-[#ff791a]" />
          Roles & Permissions
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Pick a role on the left, tune module access on the right. View unlocks the menu tab; Edit allows saving changes.
        </p>
      </div>

      {(roleError || roleSuccess) && (
        <div className="space-y-2">
          {roleError && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-800 animate-shake">
              {roleError}
            </div>
          )}
          {roleSuccess && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              {roleSuccess}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,320px)_1fr] gap-5 items-start">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold text-slate-800">Role library</p>
              <p className="text-[10px] text-slate-400">{isFetchingRoles ? "…" : rolesList.length} configured</p>
            </div>
            {canEditAdmin && (
              <button
                type="button"
                onClick={startNewRole}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <Plus size={12} />
                New
              </button>
            )}
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {isFetchingRoles ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading roles…</div>
            ) : rolesList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No custom roles yet.</div>
            ) : (
              rolesList.map((role) => {
                const isActive = roleNameInput.trim().toLowerCase() === role.name.toLowerCase();
                const enabledModules = Object.entries(role.permissions || {}).filter(
                  ([, perm]: any) => perm?.view,
                ).length;

                return (
                  <div
                    key={role.name}
                    className={`p-4 transition ${isActive ? "bg-orange-50/70 border-l-4 border-l-[#ff791a]" : "hover:bg-slate-50/70"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => loadRoleIntoEditor(role)}
                        className="min-w-0 text-left flex-1 cursor-pointer"
                      >
                        <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          <Shield size={12} className="text-[#ff791a] shrink-0" />
                          {role.name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                          {role.description || "No description"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
                          {enabledModules} module{enabledModules === 1 ? "" : "s"} enabled
                        </p>
                      </button>
                      {canEditAdmin && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => loadRoleIntoEditor(role)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition cursor-pointer"
                            title="Edit role"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role.name)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete role"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(role.permissions || {}).map(([mod, perm]: any) => {
                        if (!perm.view) return null;
                        const label =
                          ROLE_PERMISSION_MODULE_ROWS.find((row) => row.key === mod)?.name ?? mod;
                        return (
                          <span
                            key={mod}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              perm.edit ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {!canEditAdmin ? (
            <div className="p-8 text-xs text-slate-500">
              <p className="font-bold text-slate-700">View-only access</p>
              <p className="mt-1">You can review configured roles but cannot create, edit, or delete them.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveRoleSubmit} className="flex flex-col min-h-[420px]">
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Role name</label>
                    <input
                      id="role-name-input"
                      name="roleNameInput"
                      type="text"
                      value={roleNameInput}
                      onChange={(e) => setRoleNameInput(e.target.value)}
                      placeholder="e.g. HR Assistant"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                    />
                  </div>
                  <div className="flex-[1.4]">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Description</label>
                    <input
                      id="role-desc-input"
                      name="roleDescInput"
                      type="text"
                      value={roleDescInput}
                      onChange={(e) => setRoleDescInput(e.target.value)}
                      placeholder="Brief role description"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Quick select
                  </span>
                  <button
                    type="button"
                    onClick={grantAllRoleModuleAccess}
                    className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    All view + edit
                  </button>
                  <button
                    type="button"
                    onClick={grantAllRoleModuleViewOnly}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    All view only
                  </button>
                  <button
                    type="button"
                    onClick={clearAllRoleModulePermissions}
                    className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Clear all
                  </button>
                  <span className="ml-auto text-[10px] font-semibold text-slate-400">
                    {activeRoleCount} modules touched
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-900 text-white font-bold">
                      <tr>
                        <th className="p-3">Module</th>
                        <th className="p-3 text-center w-24">
                          <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                            <span>View</span>
                            <input
                              type="checkbox"
                              checked={allRoleModulesViewSelected}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate =
                                    someRoleModulesViewSelected && !allRoleModulesViewSelected;
                                }
                              }}
                              onChange={(e) => setAllRoleModuleViews(e.target.checked)}
                              className="rounded text-orange-500 focus:ring-orange-500 scale-110 cursor-pointer"
                            />
                          </label>
                        </th>
                        <th className="p-3 text-center w-24">
                          <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                            <span>Edit</span>
                            <input
                              type="checkbox"
                              checked={allRoleModulesEditSelected}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate =
                                    someRoleModulesEditSelected && !allRoleModulesEditSelected;
                                }
                              }}
                              onChange={(e) => setAllRoleModuleEdits(e.target.checked)}
                              className="rounded text-orange-500 focus:ring-orange-500 scale-110 cursor-pointer"
                            />
                          </label>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {ROLE_PERMISSION_MODULE_ROWS.map((mod) => (
                        <tr key={mod.key} className="hover:bg-slate-50/60">
                          <td className="p-3">
                            <p className="font-semibold text-slate-800">{mod.name}</p>
                            <p className="mt-0.5 text-[10px] font-normal leading-snug text-slate-400">
                              {mod.includes}
                            </p>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              id={`role-perm-view-${mod.key}`}
                              name={`rolePermView_${mod.key}`}
                              type="checkbox"
                              checked={!!rolePermsInput[mod.key]?.view}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setRolePermsInput((prev) => ({
                                  ...prev,
                                  [mod.key]: {
                                    ...prev[mod.key],
                                    view: val,
                                    edit: val ? prev[mod.key]?.edit : false,
                                  },
                                }));
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500 scale-110 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              id={`role-perm-edit-${mod.key}`}
                              name={`rolePermEdit_${mod.key}`}
                              type="checkbox"
                              checked={!!rolePermsInput[mod.key]?.edit}
                              disabled={!rolePermsInput[mod.key]?.view}
                              onChange={(e) => {
                                setRolePermsInput((prev) => ({
                                  ...prev,
                                  [mod.key]: {
                                    ...prev[mod.key],
                                    edit: e.target.checked,
                                  },
                                }));
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500 scale-110 cursor-pointer disabled:opacity-40"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!!rolePermsInput.salary?.view && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="text-[11px] font-black text-violet-800 uppercase tracking-wider">
                          Salary UI limits (optional)
                        </h5>
                        <p className="text-[10px] text-violet-700 mt-1">
                          Hide filters and columns for simpler observer-style access.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setRoleUiInput((prev) => ({
                              ...prev,
                              salary: { ...OBSERVER_SALARY_PRESET },
                            }))
                          }
                          className="px-2.5 py-1 bg-white border border-violet-200 rounded-lg text-[10px] font-bold text-violet-800 hover:bg-violet-100 transition cursor-pointer"
                        >
                          Observer preset
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRoleUiInput((prev) => {
                              const next = { ...prev };
                              delete next.salary;
                              return next;
                            })
                          }
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                          Clear limits
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-[11px] font-semibold text-violet-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!roleUiInput.salary?.hideColumnPicker}
                        onChange={(e) =>
                          setRoleUiInput((prev) => ({
                            ...prev,
                            salary: {
                              ...prev.salary,
                              hideColumnPicker: e.target.checked,
                            },
                          }))
                        }
                        className="rounded text-violet-600 focus:ring-violet-500"
                      />
                      Hide column picker and template controls on Salary sheet
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-violet-100 bg-white p-3 space-y-2 max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between gap-2 sticky top-0 bg-white pb-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Visible filters
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllRoleSalaryFilters}
                              className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer"
                            >
                              All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={clearAllRoleSalaryFilters}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-violet-900 cursor-pointer border-b border-violet-50 pb-2">
                          <input
                            type="checkbox"
                            checked={allRoleSalaryFiltersSelected}
                            ref={(el) => {
                              if (el) {
                                const someSelected = SALARY_FILTER_DEFINITIONS.some((filter) =>
                                  isRoleSalaryUiFilterChecked(filter.key),
                                );
                                el.indeterminate = someSelected && !allRoleSalaryFiltersSelected;
                              }
                            }}
                            onChange={(e) =>
                              e.target.checked
                                ? selectAllRoleSalaryFilters()
                                : clearAllRoleSalaryFilters()
                            }
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          Select all filters
                        </label>
                        {SALARY_FILTER_DEFINITIONS.map((filter) => (
                          <label
                            key={filter.key}
                            className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isRoleSalaryUiFilterChecked(filter.key)}
                              onChange={() => toggleRoleSalaryUiFilter(filter.key)}
                              className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            {filter.label}
                          </label>
                        ))}
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white p-3 space-y-2 max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between gap-2 sticky top-0 bg-white pb-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Visible columns
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllRoleSalaryColumns}
                              className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer"
                            >
                              All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={clearAllRoleSalaryColumns}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-violet-900 cursor-pointer border-b border-violet-50 pb-2">
                          <input
                            type="checkbox"
                            checked={allRoleSalaryColumnsSelected}
                            ref={(el) => {
                              if (el) {
                                const someSelected = SALARY_COLUMNS.some((column) =>
                                  isRoleSalaryUiColumnChecked(column),
                                );
                                el.indeterminate = someSelected && !allRoleSalaryColumnsSelected;
                              }
                            }}
                            onChange={(e) =>
                              e.target.checked
                                ? selectAllRoleSalaryColumns()
                                : clearAllRoleSalaryColumns()
                            }
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          Select all columns
                        </label>
                        {SALARY_COLUMNS.map((column) => (
                          <label
                            key={column}
                            className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isRoleSalaryUiColumnChecked(column)}
                              onChange={() => toggleRoleSalaryUiColumn(column)}
                              className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            {column}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  Saving updates permissions for every admin assigned this role.
                </p>
                <button
                  type="submit"
                  className="ml-auto px-5 py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-[0.98] cursor-pointer"
                >
                  Save role permissions
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
