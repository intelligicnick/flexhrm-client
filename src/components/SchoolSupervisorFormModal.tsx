import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { normalizeBlockName } from "../lib/school-work-helpers";
import { SchoolBlock, SchoolSupervisor } from "../types";

interface SchoolSupervisorFormModalProps {
  supervisor?: SchoolSupervisor | null;
  blocks?: SchoolBlock[];
  onClose: () => void;
  onSave: (data: Partial<SchoolSupervisor> & { password?: string }) => Promise<boolean>;
}

export default function SchoolSupervisorFormModal({
  supervisor,
  blocks = [],
  onClose,
  onSave,
}: SchoolSupervisorFormModalProps) {
  const isEdit = !!supervisor;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: supervisor?.name || "",
    phone: supervisor?.phone || "",
    assignedBlocks: [...(supervisor?.assignedBlocks || [])],
    loginEnabled: !!supervisor?.loginEnabled,
    loginPhone: supervisor?.loginPhone || supervisor?.phone || "",
    password: "",
    status: supervisor?.status || "active",
    ...(supervisor?.id ? { id: supervisor.id } : {}),
  });

  const blockOptions = useMemo(() => {
    const configured = blocks.map((block) => block.name).filter(Boolean);
    const assigned = supervisor?.assignedBlocks || [];
    return Array.from(new Set([...configured, ...assigned])).sort((a, b) => a.localeCompare(b));
  }, [blocks, supervisor?.assignedBlocks]);

  const toggleBlock = (blockName: string) => {
    setFormData((prev) => {
      const normalized = normalizeBlockName(blockName);
      const hasBlock = prev.assignedBlocks.some((block) => normalizeBlockName(block) === normalized);
      return {
        ...prev,
        assignedBlocks: hasBlock
          ? prev.assignedBlocks.filter((block) => normalizeBlockName(block) !== normalized)
          : [...prev.assignedBlocks, blockName],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({
      ...formData,
      password: formData.password || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-orange-50">
          <h3 className="text-sm font-extrabold text-slate-800">
            {isEdit ? "Edit School Supervisor" : "Add School Supervisor"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-orange-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto max-h-[calc(90vh-130px)]">
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Name</label>
            <input
              required
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Phone</label>
            <input
              required
              value={formData.phone}
              onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Assigned Blocks</label>
            {blockOptions.length === 0 ? (
              <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                Add blocks in School Configuration first, then assign them here.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {blockOptions.map((blockName) => {
                  const checked = formData.assignedBlocks.some(
                    (block) => normalizeBlockName(block) === normalizeBlockName(blockName),
                  );
                  return (
                    <label
                      key={blockName}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBlock(blockName)}
                      />
                      {blockName}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Supervisors see all schools in their assigned blocks on the mobile portal.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={formData.loginEnabled}
              onChange={(event) => setFormData((prev) => ({ ...prev, loginEnabled: event.target.checked }))}
            />
            Enable supervisor mobile login
          </label>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Login Phone</label>
            <input
              value={formData.loginPhone}
              onChange={(event) => setFormData((prev) => ({ ...prev, loginPhone: event.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              {isEdit ? "New Password (optional)" : "Password"}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? "Saving..." : "Save Supervisor"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
