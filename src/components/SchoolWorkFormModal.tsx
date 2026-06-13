import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { SchoolWork } from "../types";

interface SchoolWorkFormModalProps {
  school?: SchoolWork | null;
  onClose: () => void;
  onSave: (data: Partial<SchoolWork>) => Promise<boolean>;
}

export default function SchoolWorkFormModal({
  school,
  onClose,
  onSave,
}: SchoolWorkFormModalProps) {
  const isEdit = !!school;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<SchoolWork>>({
    udise: school?.udise || "",
    schoolName: school?.schoolName || "",
    headmasterName: school?.headmasterName || "",
    headmasterNumber: school?.headmasterNumber || "",
    sweeperName: school?.sweeperName || "",
    accountHolderName: school?.accountHolderName || "",
    accountNumber: school?.accountNumber || "",
    ifscCode: school?.ifscCode || "",
    noOfToilets: school?.noOfToilets ?? 0,
    rates: school?.rates ?? 0,
    rateExplanation: school?.rateExplanation || "",
    block: school?.block || "",
    district: school?.district || "",
    materialCost: school?.materialCost ?? 0,
    remarks: school?.remarks || "",
    ...(school?.id ? { id: school.id, srNo: school.srNo } : {}),
  });

  const update = (key: keyof SchoolWork, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(formData);
    setSaving(false);
    if (ok) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-orange-50">
          <h3 className="text-sm font-extrabold text-slate-800">
            {isEdit ? "Edit School Record" : "Add School Record"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-orange-100 text-slate-500 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(90vh-130px)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "schoolName" as const, label: "School Name", type: "text" },
              { key: "udise" as const, label: "UDISE", type: "text" },
              { key: "headmasterName" as const, label: "Headmaster Name", type: "text" },
              { key: "headmasterNumber" as const, label: "Headmaster Number", type: "text" },
              { key: "sweeperName" as const, label: "Sweeper Name", type: "text" },
              { key: "accountHolderName" as const, label: "Account Holder Name", type: "text" },
              { key: "accountNumber" as const, label: "Account Number", type: "text" },
              { key: "ifscCode" as const, label: "IFSC Code", type: "text" },
              { key: "noOfToilets" as const, label: "No of Toilets", type: "number" },
              { key: "rates" as const, label: "Rates", type: "number" },
              { key: "block" as const, label: "Block", type: "text" },
              { key: "district" as const, label: "District", type: "text" },
              { key: "materialCost" as const, label: "Material Cost", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{label}</label>
                <input
                  type={type}
                  value={formData[key] ?? (type === "number" ? 0 : "")}
                  onChange={(e) =>
                    update(key, type === "number" ? Number(e.target.value) || 0 : e.target.value)
                  }
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Explanation for Rate</label>
            <textarea
              value={formData.rateExplanation || ""}
              onChange={(e) => update("rateExplanation", e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Remarks</label>
            <textarea
              value={formData.remarks || ""}
              onChange={(e) => update("remarks", e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={14} /> {saving ? "Saving..." : isEdit ? "Save Changes" : "Add School"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
