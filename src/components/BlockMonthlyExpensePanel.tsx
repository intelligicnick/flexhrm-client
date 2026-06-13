import React, { useMemo, useState } from "react";
import { IndianRupee, MapPin, Calendar, Save } from "lucide-react";
import { SchoolWork } from "../types";
import { splitAmountEqually } from "../lib/school-work-helpers";

interface BlockMonthlyExpensePanelProps {
  schools: SchoolWork[];
  monthKey: string;
  monthsList: string[];
  onMonthChange: (monthKey: string) => void;
  onDistribute: (payload: {
    block: string;
    monthKey: string;
    materialAmount: number;
    miscellaneousAmount: number;
    materialRemark: string;
    miscellaneousRemark: string;
  }) => Promise<boolean>;
  readOnly?: boolean;
}

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function BlockMonthlyExpensePanel({
  schools,
  monthKey,
  monthsList,
  onMonthChange,
  onDistribute,
  readOnly = false,
}: BlockMonthlyExpensePanelProps) {
  const blocks = useMemo(
    () => Array.from(new Set(schools.map((s) => s.block).filter(Boolean))).sort(),
    [schools],
  );

  const [selectedBlock, setSelectedBlock] = useState("");
  const [materialAmount, setMaterialAmount] = useState("");
  const [miscellaneousAmount, setMiscellaneousAmount] = useState("");
  const [materialRemark, setMaterialRemark] = useState("");
  const [miscellaneousRemark, setMiscellaneousRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const blockSchools = useMemo(
    () => schools.filter((s) => s.block === selectedBlock),
    [schools, selectedBlock],
  );

  const materialNum = Math.max(0, Number(materialAmount) || 0);
  const miscellaneousNum = Math.max(0, Number(miscellaneousAmount) || 0);
  const materialShares = splitAmountEqually(materialNum, blockSchools.length);
  const miscShares = splitAmountEqually(miscellaneousNum, blockSchools.length);
  const perSchoolMaterial = materialShares[0] ?? 0;
  const perSchoolMisc = miscShares[0] ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !selectedBlock || blockSchools.length === 0) return;
    setSaving(true);
    const ok = await onDistribute({
      block: selectedBlock,
      monthKey,
      materialAmount: materialNum,
      miscellaneousAmount: miscellaneousNum,
      materialRemark: materialRemark.trim(),
      miscellaneousRemark: miscellaneousRemark.trim(),
    });
    setSaving(false);
    if (ok) {
      setMaterialAmount("");
      setMiscellaneousAmount("");
      setMaterialRemark("");
      setMiscellaneousRemark("");
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <IndianRupee className="text-[#ff791a]" size={18} />
          Block Monthly Expense
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Select a block and record Material / Miscellaneous expenses for a month. Amounts are split equally across all schools in that block.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
              <MapPin size={12} /> Block
            </label>
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-orange-500 cursor-pointer disabled:opacity-60"
            >
              <option value="">Select block</option>
              {blocks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
              <Calendar size={12} /> Month
            </label>
            <select
              value={monthKey}
              onChange={(e) => onMonthChange(e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-orange-500 cursor-pointer disabled:opacity-60"
            >
              {monthsList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Schools in block</label>
            <div className="px-3 py-2 border border-slate-100 rounded-lg text-xs font-bold text-slate-700 bg-slate-50">
              {selectedBlock ? `${blockSchools.length} school(s)` : "—"}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Per-school share (preview)</label>
            <div className="px-3 py-2 border border-orange-100 rounded-lg text-xs font-bold text-[#ff791a] bg-orange-50/50">
              {selectedBlock && blockSchools.length > 0
                ? `Material ${formatCurrency(perSchoolMaterial)} · Misc ${formatCurrency(perSchoolMisc)}`
                : "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Material</h3>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Total block amount (₹)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={materialAmount}
                onChange={(e) => setMaterialAmount(e.target.value)}
                disabled={readOnly}
                placeholder="Enter total material expense"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Remark</label>
              <input
                type="text"
                value={materialRemark}
                onChange={(e) => setMaterialRemark(e.target.value)}
                disabled={readOnly}
                placeholder="Material expense remark"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Miscellaneous</h3>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Total block amount (₹)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={miscellaneousAmount}
                onChange={(e) => setMiscellaneousAmount(e.target.value)}
                disabled={readOnly}
                placeholder="Enter total miscellaneous expense"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Remark</label>
              <input
                type="text"
                value={miscellaneousRemark}
                onChange={(e) => setMiscellaneousRemark(e.target.value)}
                disabled={readOnly}
                placeholder="Miscellaneous expense remark"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                saving ||
                !selectedBlock ||
                blockSchools.length === 0 ||
                (materialNum === 0 && miscellaneousNum === 0)
              }
              className="flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-40"
            >
              <Save size={14} />
              {saving ? "Saving..." : "Apply to all schools in block"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
