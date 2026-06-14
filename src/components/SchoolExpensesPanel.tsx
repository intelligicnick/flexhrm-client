import React, { useMemo, useState } from "react";
import { Edit2, Plus, Receipt, Package, Trash2 } from "lucide-react";
import { SchoolBlock, SchoolDistrict, SchoolWork } from "../types";
import {
  buildAllExpenseRecords,
  ExpenseRecordRow,
  ExpenseRecordType,
  expenseRecordTypeToForm,
  formatExpenseDate,
  getSchoolMonthlyMaterial,
  getSchoolMonthlyMiscellaneous,
  getSchoolMonthlyTrek,
} from "../lib/school-work-helpers";
import ExpenseRecordFormModal, {
  ExpenseRecordFormInitialValues,
  ExpenseRecordFormPayload,
} from "./ExpenseRecordFormModal";

type ExpenseView = "ledger" | "perSchool";

interface SchoolExpensesPanelProps {
  schools: SchoolWork[];
  districts: SchoolDistrict[];
  blocks: SchoolBlock[];
  monthsList: string[];
  monthKey: string;
  onMonthChange: (month: string) => void;
  onAddExpense: (payload: ExpenseRecordFormPayload) => Promise<boolean>;
  onDeleteExpense: (row: ExpenseRecordRow) => Promise<boolean>;
  readOnly?: boolean;
}

const EXPENSE_TYPES: ExpenseRecordType[] = ["Material", "Trek", "Miscellaneous"];

export default function SchoolExpensesPanel({
  schools,
  districts,
  blocks,
  monthsList,
  monthKey,
  onMonthChange,
  onAddExpense,
  onDeleteExpense,
  readOnly = false,
}: SchoolExpensesPanelProps) {
  const [view, setView] = useState<ExpenseView>("ledger");
  const [blockFilter, setBlockFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecordRow | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const allRecords = useMemo(() => buildAllExpenseRecords(schools), [schools]);

  const blockOptions = useMemo(
    () => Array.from(new Set(schools.map((s) => s.block).filter(Boolean))).sort(),
    [schools],
  );

  const filteredLedger = useMemo(() => {
    return allRecords.filter((row) => {
      if (row.monthKey !== monthKey) return false;
      if (blockFilter && row.block !== blockFilter) return false;
      if (typeFilter && row.type !== typeFilter) return false;
      return true;
    });
  }, [allRecords, monthKey, blockFilter, typeFilter]);

  const ledgerTotal = useMemo(
    () => filteredLedger.reduce((sum, row) => sum + row.amount, 0),
    [filteredLedger],
  );

  const perSchoolRows = useMemo(() => {
    let filtered = schools;
    if (blockFilter) filtered = filtered.filter((s) => s.block === blockFilter);
    return filtered
      .map((school) => {
        const material = getSchoolMonthlyMaterial(school, monthKey);
        const trek = getSchoolMonthlyTrek(school, monthKey);
        const miscellaneous = getSchoolMonthlyMiscellaneous(school, monthKey);
        return {
          school,
          material,
          trek,
          miscellaneous,
          total: material + trek + miscellaneous,
        };
      })
      .filter((row) => row.total > 0 || !blockFilter)
      .sort((a, b) => a.school.schoolName.localeCompare(b.school.schoolName));
  }, [schools, monthKey, blockFilter]);

  const perSchoolTotals = useMemo(
    () =>
      perSchoolRows.reduce(
        (acc, row) => ({
          material: acc.material + row.material,
          trek: acc.trek + row.trek,
          miscellaneous: acc.miscellaneous + row.miscellaneous,
          total: acc.total + row.total,
        }),
        { material: 0, trek: 0, miscellaneous: 0, total: 0 },
      ),
    [perSchoolRows],
  );

  const formInitialValues = useMemo<ExpenseRecordFormInitialValues | undefined>(() => {
    if (!editingRecord) return undefined;
    const district =
      editingRecord.district
      || blocks.find((block) => block.name === editingRecord.block)?.districtName
      || "";
    return {
      district,
      block: editingRecord.block,
      monthKey: editingRecord.monthKey,
      expenseType: expenseRecordTypeToForm(editingRecord.type),
      amount: editingRecord.amount,
      remark: editingRecord.remarks,
      date: editingRecord.date || new Date().toISOString().slice(0, 10),
    };
  }, [editingRecord, blocks]);

  const openAddForm = () => {
    setEditingRecord(null);
    setIsFormOpen(true);
  };

  const openEditForm = (row: ExpenseRecordRow) => {
    setEditingRecord(row);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const handleDelete = async (row: ExpenseRecordRow) => {
    const key = `${row.monthKey}-${row.block}-${row.type}`;
    setDeletingKey(key);
    await onDeleteExpense(row);
    setDeletingKey(null);
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Receipt className="text-[#ff791a]" size={18} />
                Expenses
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Block-level expense ledger and per-school breakdown for {monthKey}
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex shrink-0 items-center gap-1.5 self-start sm:self-center px-3 py-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                <Plus size={14} />
                Set Block Expense
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {view === "ledger" ? (
                <>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                    {filteredLedger.length} record{filteredLedger.length === 1 ? "" : "s"}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs font-bold text-[#ff791a]">
                    Total: ₹{ledgerTotal.toLocaleString("en-IN")}
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs font-bold text-[#ff791a]">
                    <Package size={12} /> Material: ₹{perSchoolTotals.material.toLocaleString("en-IN")}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs font-bold text-[#ff791a]">
                    Trek: ₹{perSchoolTotals.trek.toLocaleString("en-IN")}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs font-bold text-[#ff791a]">
                    Misc: ₹{perSchoolTotals.miscellaneous.toLocaleString("en-IN")}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                    Total: ₹{perSchoolTotals.total.toLocaleString("en-IN")}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
              <div className="inline-flex bg-slate-200/60 p-1 rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setView("ledger")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                    view === "ledger"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-600 hover:bg-white/40"
                  }`}
                >
                  Block Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setView("perSchool")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                    view === "perSchool"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-600 hover:bg-white/40"
                  }`}
                >
                  Per School
                </button>
              </div>
              <select
                value={monthKey}
                onChange={(event) => onMonthChange(event.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {monthsList.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={blockFilter}
                onChange={(event) => setBlockFilter(event.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <option value="">All Blocks</option>
                {blockOptions.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
              {view === "ledger" && (
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <option value="">All Types</option>
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {view === "ledger" ? (
          <>
            {filteredLedger.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">
                No expenses for {monthKey}. Use &quot;Set Block Expense&quot; to add one.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">Date</th>
                      <th className="text-left px-3 py-2 font-bold">Type</th>
                      <th className="text-left px-3 py-2 font-bold">Block</th>
                      <th className="text-left px-3 py-2 font-bold">Remarks</th>
                      <th className="text-right px-3 py-2 font-bold">Amount (₹)</th>
                      {!readOnly && (
                        <th className="text-right px-3 py-2 font-bold">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((row) => {
                      const rowKey = `${row.monthKey}-${row.block}-${row.type}`;
                      const isDeleting = deletingKey === rowKey;
                      return (
                      <tr
                        key={rowKey}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2 text-slate-600">{formatExpenseDate(row.date)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.type}</td>
                        <td className="px-3 py-2 text-slate-600">{row.block}</td>
                        <td className="px-3 py-2 text-slate-500">{row.remarks || "—"}</td>
                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">
                          ₹{row.amount.toLocaleString("en-IN")}
                        </td>
                        {!readOnly && (
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditForm(row)}
                                title="Edit expense"
                                className="p-1.5 rounded-md text-slate-500 hover:text-[#ff791a] hover:bg-orange-50 cursor-pointer"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                disabled={isDeleting}
                                title="Delete expense"
                                className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            {perSchoolRows.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">No schools found for this filter.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">School</th>
                      <th className="text-left px-3 py-2 font-bold">Block</th>
                      <th className="text-right px-3 py-2 font-bold">Material</th>
                      <th className="text-right px-3 py-2 font-bold">Trek</th>
                      <th className="text-right px-3 py-2 font-bold">Misc</th>
                      <th className="text-right px-3 py-2 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perSchoolRows.map(({ school, material, trek, miscellaneous, total }) => (
                      <tr key={school.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">{school.schoolName}</td>
                        <td className="px-3 py-2 text-slate-600">{school.block || "—"}</td>
                        <td className="px-3 py-2 text-right">₹{material.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right">₹{trek.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right">₹{miscellaneous.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">
                          ₹{total.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {isFormOpen && (
        <ExpenseRecordFormModal
          districts={districts}
          blocks={blocks}
          schools={schools}
          monthsList={monthsList}
          defaultMonthKey={monthKey}
          initialValues={formInitialValues}
          onClose={closeForm}
          onSave={onAddExpense}
        />
      )}
    </div>
  );
}
