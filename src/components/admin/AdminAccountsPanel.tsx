import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  KeyRound,
  Map,
  Search,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import PasswordInput from "../PasswordInput";
import { useHRMS } from "../../context/HRMSContext";

type WorksiteLocationPickerProps = {
  locations: string[];
  selected: string[];
  onSelectedChange: Dispatch<SetStateAction<string[]>>;
  maxHeightClass?: string;
  emptyMessage?: string;
  helperText?: string;
};

function WorksiteLocationPicker({
  locations,
  selected,
  onSelectedChange,
  maxHeightClass = "max-h-32",
  emptyMessage = "No locations registered.",
  helperText = "Leave unchecked for all locations.",
}: WorksiteLocationPickerProps) {
  const [search, setSearch] = useState("");

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => loc.toLowerCase().includes(q));
  }, [locations, search]);

  const allFilteredSelected =
    filteredLocations.length > 0 && filteredLocations.every((loc) => selected.includes(loc));
  const someFilteredSelected = filteredLocations.some((loc) => selected.includes(loc));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      onSelectedChange((prev) => prev.filter((loc) => !filteredLocations.includes(loc)));
    } else {
      onSelectedChange((prev) => Array.from(new Set([...prev, ...filteredLocations])));
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search locations…"
          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
        />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
        <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someFilteredSelected && !allFilteredSelected;
                }
              }}
              onChange={toggleSelectAllFiltered}
              disabled={filteredLocations.length === 0}
              className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer accent-orange-500 shrink-0 disabled:cursor-not-allowed"
            />
            <span className="text-[10px] font-bold text-slate-600 truncate">
              {allFilteredSelected ? "Deselect all" : "Select all"}
              {search.trim() && filteredLocations.length > 0 ? ` (${filteredLocations.length})` : ""}
            </span>
          </label>
          {selected.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
              {selected.length} selected
            </span>
          )}
        </div>

        <div className={`p-3 ${maxHeightClass} overflow-y-auto space-y-2`}>
          {filteredLocations.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">
              {search.trim() ? "No locations match your search." : emptyMessage}
            </p>
          ) : (
            filteredLocations.map((loc) => {
              const isChecked = selected.includes(loc);
              return (
                <label
                  key={loc}
                  className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        onSelectedChange((prev) => prev.filter((l) => l !== loc));
                      } else {
                        onSelectedChange((prev) => [...prev, loc]);
                      }
                    }}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer accent-orange-500"
                  />
                  <span>{loc}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {helperText && <p className="text-[10px] text-slate-400">{helperText}</p>}
    </div>
  );
}

export default function AdminAccountsPanel() {
  const {
    sessionUser,
    sessionRole,
    userPermissions,
    adminsList,
    inviteUsername,
    invitePassword,
    inviteRole,
    inviteLocations,
    editingAdminUsername,
    editAdminRole,
    editAdminLocations,
    editAdminDisabled,
    editAdminNewPassword,
    editAdminPasswordError,
    editAdminPasswordSuccess,
    isResettingAdminPassword,
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    rolesList,
    customLocations,
    rawCustomLocations,
    setInviteUsername,
    setInvitePassword,
    setInviteRole,
    setInviteLocations,
    setEditingAdminUsername,
    setEditAdminRole,
    setEditAdminLocations,
    setEditAdminDisabled,
    setEditAdminNewPassword,
    handleInviteAdminSubmit,
    handleUpdateAdminSubmit,
    handleDeleteAdmin,
    handleResetAdminPasswordSubmit,
    resetEditAdminPasswordFields,
  } = useHRMS();

  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [resetPasswordUsername, setResetPasswordUsername] = useState<string | null>(null);

  const canEditAdmin = !!userPermissions.admin?.edit;
  const canDeleteAdmin = !!userPermissions.admin?.delete;
  const isSuperAdmin =
    String(sessionRole || "").toLowerCase() === "admin" ||
    String(sessionUser || "").toLowerCase() === "admin";

  const selectedEditRolePermissions = useMemo(() => {
    if (editAdminRole === "admin") {
      return { employeesEdit: true, label: "Super-Admin (full access)" };
    }
    const matched = rolesList.find(
      (role) => String(role.name || "").toLowerCase() === String(editAdminRole || "").toLowerCase(),
    );
    const employeesEdit = !!matched?.permissions?.employees?.edit || !!matched?.permissions?.employees?.delete;
    return {
      employeesEdit,
      label: matched?.name || editAdminRole || "Unknown role",
    };
  }, [editAdminRole, rolesList]);

  const editingAdmin = useMemo(
    () => adminsList.find((adm) => adm.username === editingAdminUsername) ?? null,
    [adminsList, editingAdminUsername],
  );

  const resettingAdmin = useMemo(
    () => adminsList.find((adm) => adm.username === resetPasswordUsername) ?? null,
    [adminsList, resetPasswordUsername],
  );

  const openEditAdmin = (adm: (typeof adminsList)[number]) => {
    resetEditAdminPasswordFields();
    setEditingAdminUsername(adm.username);
    setEditAdminRole(adm.role || "admin");
    setEditAdminLocations(adm.locations || []);
    setEditAdminDisabled(!!adm.disabled);
  };

  const closeEditAdmin = () => {
    resetEditAdminPasswordFields();
    setEditingAdminUsername(null);
  };

  const openResetPassword = (adm: (typeof adminsList)[number]) => {
    resetEditAdminPasswordFields();
    setResetPasswordUsername(adm.username);
  };

  const closeResetPassword = () => {
    resetEditAdminPasswordFields();
    setResetPasswordUsername(null);
  };

  useEffect(() => {
    if ((!editingAdmin && !resettingAdmin) || !canEditAdmin) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingAdmin, resettingAdmin, canEditAdmin]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-orange-50/40 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users size={18} className="text-[#ff791a]" />
            Administrator Accounts
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Control who can sign in. Invite co-admins, assign roles, restrict locations, or reset passwords.
          </p>
        </div>
        {canEditAdmin && (
          <button
            type="button"
            onClick={() => setShowInvitePanel((open) => !open)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff791a] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#e4640c] cursor-pointer shrink-0"
          >
            <UserPlus size={14} />
            {showInvitePanel ? "Hide invite form" : "Invite administrator"}
            <ChevronDown size={14} className={`transition ${showInvitePanel ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {(inviteError || inviteSuccess) && (
        <div className="space-y-2">
          {inviteError && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-800 animate-shake">
              {inviteError}
            </div>
          )}
          {inviteSuccess && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              {inviteSuccess}
            </div>
          )}
        </div>
      )}

      {canEditAdmin && showInvitePanel && (
        <form
          onSubmit={handleInviteAdminSubmit}
          className="rounded-2xl border border-orange-200/80 bg-white p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">Invite new administrator</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Public self-signup stays disabled.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowInvitePanel(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              aria-label="Close invite form"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Username</label>
              <input
                id="invite-username"
                name="inviteUsername"
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="e.g. hr_admin"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Initial password</label>
              <PasswordInput
                id="invite-password"
                name="invitePassword"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Security role</label>
              <select
                id="invite-role"
                name="inviteRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
              >
                <option value="admin">Super-Admin (Full Access)</option>
                {rolesList.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Worksite locations</label>
              <p className="text-[10px] text-slate-400 mb-2">
                Also limits employee, salary, and contract data in Observer Admin.
              </p>
              <WorksiteLocationPicker
                key={showInvitePanel ? "invite-open" : "invite-closed"}
                locations={customLocations}
                selected={inviteLocations}
                onSelectedChange={setInviteLocations}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Grant administrator access
          </button>
        </form>
      )}

      {!canEditAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-xs text-slate-500">
          <p className="font-bold text-slate-700">View-only access</p>
          <p className="mt-1">You can review administrator accounts but cannot invite or modify them.</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Active administrators
          </h4>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            {isFetchingAdmins ? "…" : adminsList.length}
          </span>
        </div>

        {isFetchingAdmins ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            Loading administrators…
          </div>
        ) : adminsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-xs text-slate-400">
            No administrators found.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white max-h-[420px] overflow-y-auto">
            {adminsList.map((adm) => {
              const isRootAdmin = adm.username.toLowerCase() === "admin";

              return (
                <div key={adm.username} className="p-4 hover:bg-slate-50/60 flex items-start gap-3 transition text-xs">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                    {adm.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{adm.username}</span>
                          {adm.disabled ? (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                              Restricted
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                              Active
                            </span>
                          )}
                          {adm.username === sessionUser && (
                            <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Invited by {adm.invitedBy || "System"} ·{" "}
                          <span className="font-semibold text-slate-600">
                            {adm.role === "admin" ? "Super-Admin" : adm.role || "Super-Admin"}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Map size={10} className="shrink-0" />
                          {adm.locations && adm.locations.length > 0 ? adm.locations.join(", ") : "All locations"}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <p className="text-[10px] text-slate-400 font-mono">
                          {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : "Present"}
                        </p>
                        {!isRootAdmin && (canEditAdmin || canDeleteAdmin) && (
                          <div className="flex items-center gap-1.5">
                            {canEditAdmin && (
                              <button
                                type="button"
                                onClick={() => openEditAdmin(adm)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg flex items-center gap-1 border border-slate-200 font-medium transition cursor-pointer"
                              >
                                <Settings size={11} />
                                Configure
                              </button>
                            )}
                            {isSuperAdmin && canEditAdmin && (
                              <button
                                type="button"
                                onClick={() => openResetPassword(adm)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg flex items-center gap-1 border border-slate-200 font-medium transition cursor-pointer"
                              >
                                <KeyRound size={11} />
                                Reset password
                              </button>
                            )}
                            {canDeleteAdmin && adm.username !== sessionUser && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAdmin(adm.username)}
                                className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-1 border border-rose-200 font-medium transition cursor-pointer"
                              >
                                <Trash2 size={11} />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingAdmin &&
        canEditAdmin &&
        createPortal(
          <div className="fixed inset-0 z-[80] overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={closeEditAdmin}
              aria-hidden
            />
            <div className="relative flex h-full items-center justify-center p-4 pointer-events-none">
              <div
                className="pointer-events-auto relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="configure-admin-modal-title"
              >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <Settings size={18} className="text-[#ff791a] shrink-0" />
                <div className="min-w-0">
                  <h3 id="configure-admin-modal-title" className="text-sm font-extrabold text-slate-900 truncate">
                    Configure {editingAdmin.username}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Joined {editingAdmin.createdAt ? new Date(editingAdmin.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditAdmin}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Security role</label>
                <select
                  id="edit-admin-role"
                  name="editAdminRole"
                  value={editAdminRole}
                  onChange={(e) => setEditAdminRole(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#ff791a] transition"
                >
                  <option value="admin">Super-Admin (Full Access)</option>
                  {rolesList.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p
                  className={`mt-2 text-[10px] leading-relaxed rounded-lg px-2.5 py-2 border ${
                    selectedEditRolePermissions.employeesEdit
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-amber-50 border-amber-100 text-amber-800"
                  }`}
                >
                  {selectedEditRolePermissions.employeesEdit
                    ? `"${selectedEditRolePermissions.label}" can add/edit employees, office locations, and job roles.`
                    : `"${selectedEditRolePermissions.label}" is view-only for employees — cannot add office locations or edit employee records.`}
                </p>
              </div>

              {editingAdmin.username.toLowerCase() !== "admin" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Login access</label>
                  <select
                    id="editadmindisabled-disabled-active-4793"
                    name="editadmindisabled-disabled-active"
                    value={editAdminDisabled ? "disabled" : "active"}
                    onChange={(e) => setEditAdminDisabled(e.target.value === "disabled")}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#ff791a] transition"
                  >
                    <option value="active">Active — login allowed</option>
                    <option value="disabled">Restricted — block login</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Worksite locations</label>
                <p className="text-[9px] text-slate-400 mb-1.5">
                  Also limits employee, salary, and contract data in Observer Admin.
                </p>
                <WorksiteLocationPicker
                  key={editingAdminUsername ?? "edit-closed"}
                  locations={rawCustomLocations}
                  selected={editAdminLocations}
                  onSelectedChange={setEditAdminLocations}
                  maxHeightClass="max-h-40"
                />
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeEditAdmin}
                className="px-4 py-2 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateAdminSubmit(editingAdmin.username)}
                className="px-4 py-2 text-[11px] font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg transition cursor-pointer"
              >
                Save changes
              </button>
            </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {resettingAdmin &&
        canEditAdmin &&
        isSuperAdmin &&
        createPortal(
          <div className="fixed inset-0 z-[80] overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={closeResetPassword}
              aria-hidden
            />
            <div className="relative flex h-full items-center justify-center p-4 pointer-events-none">
              <div
                className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-admin-password-modal-title"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound size={18} className="text-[#ff791a] shrink-0" />
                    <div className="min-w-0">
                      <h3 id="reset-admin-password-modal-title" className="text-sm font-extrabold text-slate-900 truncate">
                        Reset password for {resettingAdmin.username}
                      </h3>
                      <p className="text-[10px] text-slate-400">Active sessions will be signed out.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeResetPassword}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  {editAdminPasswordError && (
                    <div className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-[10px] font-semibold text-rose-800">
                      {editAdminPasswordError}
                    </div>
                  )}
                  {editAdminPasswordSuccess && (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">
                      {editAdminPasswordSuccess}
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">New password</label>
                    <PasswordInput
                      id={`reset-admin-new-password-${resettingAdmin.username}`}
                      name="editAdminNewPassword"
                      value={editAdminNewPassword}
                      onChange={(e) => setEditAdminNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#ff791a] transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeResetPassword}
                    className="px-4 py-2 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isResettingAdminPassword}
                    onClick={() => handleResetAdminPasswordSubmit(resettingAdmin.username)}
                    className="px-4 py-2 text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60 rounded-lg transition cursor-pointer"
                  >
                    {isResettingAdminPassword ? "Resetting..." : "Reset password"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
