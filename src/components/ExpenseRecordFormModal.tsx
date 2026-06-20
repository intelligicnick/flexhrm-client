import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, RotateCw, X } from "lucide-react";
import { SchoolBlock, SchoolDistrict } from "../types";
import { splitAmountEqually } from "../lib/school-work-helpers";
import { validateNonNegativeNumberField } from "../lib/number-validation";

export type ExpenseRecordType = "material" | "trek" | "miscellaneous";

export interface ExpenseRecordFormPayload {
  district: string;
  block: string;
  monthKey: string;
  expenseType: ExpenseRecordType;
  amount: number;
  remark: string;
  date: string;
}

export interface ExpenseRecordFormInitialValues {
  district: string;
  block: string;
  monthKey: string;
  expenseType: ExpenseRecordType;
  amount: number;
  remark: string;
  date: string;
}

interface ExpenseRecordFormModalProps {
  districts: SchoolDistrict[];
  blocks: SchoolBlock[];
  schools: Array<{ block?: string; district?: string }>;
  monthsList: string[];
  defaultMonthKey: string;
  initialValues?: ExpenseRecordFormInitialValues;
  onClose: () => void;
  onSave: (payload: ExpenseRecordFormPayload) => Promise<boolean>;
}

export default function ExpenseRecordFormModal({
  districts,
  blocks,
  schools,
  monthsList,
  defaultMonthKey,
  initialValues,
  onClose,
  onSave,
}: ExpenseRecordFormModalProps) {
  const isEditing = !!initialValues;

  const [districtId, setDistrictId] = useState(() => {
    if (!initialValues) return "";
    return districts.find((d) => d.name === initialValues.district)?.id || "";
  });
  const [blockName, setBlockName] = useState(initialValues?.block || "");
  const [monthKey, setMonthKey] = useState(
    initialValues?.monthKey
      || (monthsList.includes(defaultMonthKey) ? defaultMonthKey : monthsList[0] || defaultMonthKey),
  );
  const [expenseType, setExpenseType] = useState<ExpenseRecordType>(
    initialValues?.expenseType || "material",
  );
  const [amount, setAmount] = useState(
    initialValues ? String(initialValues.amount) : "",
  );
  const [remark, setRemark] = useState(initialValues?.remark || "");
  const [date, setDate] = useState(
    initialValues?.date || new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === districtId) || null,
    [districts, districtId],
  );

  const blocksInDistrict = useMemo(() => {
    if (!districtId) return [];
    return blocks
      .filter((b) => b.districtId === districtId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks, districtId]);

  const schoolCount = useMemo(() => {
    if (!blockName || !selectedDistrict) return 0;
    const blockKey = blockName.trim().toLowerCase();
    const districtKey = selectedDistrict.name.trim().toLowerCase();
    return schools.filter((school) => {
      const schoolBlock = school.block?.trim().toLowerCase();
      const schoolDistrict = school.district?.trim().toLowerCase();
      return schoolBlock === blockKey && schoolDistrict === districtKey;
    }).length;
  }, [schools, blockName, selectedDistrict]);
  const numericAmount = Number(amount) || 0;
  const perSchoolShares = useMemo(
    () =>
      schoolCount > 0 && numericAmount > 0
        ? splitAmountEqually(numericAmount, schoolCount)
        : [],
    [numericAmount, schoolCount],
  );
  const perSchoolPreview = perSchoolShares[0] ?? 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDistrict || !blockName || !monthKey || !date) return;

    const amountError = validateNonNegativeNumberField(amount, "Amount", { required: true });
    if (amountError) {
      setFormError(amountError);
      return;
    }

    const parsedAmount = Number(amount);
    setFormError(null);
    setSaving(true);
    const ok = await onSave({
      district: selectedDistrict.name,
      block: blockName,
      monthKey,
      expenseType,
      amount: parsedAmount,
      remark: remark.trim(),
      date,
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
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-orange-50">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              {isEditing ? "Edit Block Expense" : "Set Block Expense"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Split equally across schools in the block; replaces any existing amount for that type
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-orange-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Month</label>
              <select
                value={monthKey}
                onChange={(event) => setMonthKey(event.target.value)}
                required
                disabled={isEditing}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:bg-slate-50"
              >
                {monthsList.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Expense Type</label>
              <select
                value={expenseType}
                onChange={(event) => setExpenseType(event.target.value as ExpenseRecordType)}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:bg-slate-50"
              >
                <option value="material">Material</option>
                <option value="trek">Trek / Travel</option>
                <option value="miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">District</label>
              <select
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setBlockName("");
                }}
                required
                disabled={isEditing}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:bg-slate-50"
              >
                <option value="">Select district</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Block</label>
              <select
                value={blockName}
                onChange={(event) => setBlockName(event.target.value)}
                required
                disabled={!districtId || isEditing}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:bg-slate-50"
              >
                <option value="">Select block</option>
                {blocksInDistrict.map((block) => (
                  <option key={block.id} value={block.name}>{block.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Total Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                placeholder="e.g. 12000"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Remarks</label>
              <input
                type="text"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {blockName && schoolCount > 0 && numericAmount > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-xs font-bold text-emerald-800">Split preview for {monthKey}</p>
              <p className="text-sm text-emerald-900 mt-1">
                ₹{numericAmount.toLocaleString("en-IN")} across <strong>{schoolCount}</strong> school(s) in{" "}
                <strong>{blockName}</strong>
                {selectedDistrict ? `, ${selectedDistrict.name}` : ""}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                ≈ ₹{perSchoolPreview.toLocaleString("en-IN")} per school
                {perSchoolShares.length > 1 &&
                  perSchoolShares[perSchoolShares.length - 1] !== perSchoolPreview &&
                  ` (₹${perSchoolShares[perSchoolShares.length - 1].toLocaleString("en-IN")} for remainder schools)`}
              </p>
            </div>
          )}

          {blockName && schoolCount === 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-semibold">
              No schools are registered under block &quot;{blockName}&quot;. Add schools first or check the block name.
            </div>
          )}

          {formError && (
            <p className="text-[11px] font-semibold text-red-600">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !districtId || !blockName || schoolCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              {saving ? (
                <RotateCw size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {saving ? "Saving..." : isEditing ? "Update Expense" : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
