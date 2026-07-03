import React, { useEffect, useState } from "react";
import { MousePointerClick, Pencil, RotateCcw, Save, Search, X } from "lucide-react";
import { SchoolPartner } from "../types";
import {
  PARTNER_PAYMENT_HEADERS,
  PARTNER_PAY_COL_ACCOUNT_HOLDER,
  PARTNER_PAY_COL_ACCOUNT_NUMBER,
  PARTNER_PAY_COL_DAYS,
  PARTNER_PAY_COL_IFSC,
  PARTNER_PAY_COL_MONTHLY,
  PARTNER_PAY_COL_PARTNER_NAME,
  PARTNER_PAY_COL_PER_TOILET,
  PARTNER_PAY_COL_SCHOOL_CATEGORY,
  PARTNER_PAY_COL_SCHOOL_NAME,
  PARTNER_PAY_COL_STATUS,
  PARTNER_PAY_COL_TOILETS,
  PARTNER_PAY_COL_TOTAL,
  PARTNER_PAY_STATUS_OPTIONS,
  PartnerPayEditableField,
  PartnerPayNumericField,
  PartnerPayStatus,
  PartnerPayTextField,
  PartnerPayTextValues,
  PartnerPayValues,
  computePartnerPayableAmount,
  isPartnerPayNumericField,
  partnerPayStatusClass,
} from "../lib/school-work-helpers";

type PartnerPayColumnField = PartnerPayEditableField | "paymentStatus";

type ColumnSelection = {
  field: PartnerPayColumnField;
  anchorPartnerId: string;
  focusPartnerId: string;
};

type EditableFieldDef = { field: PartnerPayColumnField; label: string; col: number };

interface PartnerPayBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth?: string;
  partners: SchoolPartner[];
  totalPartnerCount: number;
  paymentRows: Array<Array<string | number>>;
  changeCount: number;
  saving: boolean;
  searchTerm: string;
  districtFilter: string;
  blockFilter: string;
  categoryFilter: string;
  statusFilter: PartnerPayStatus | "";
  districtOptions: string[];
  blockOptions: string[];
  categoryOptions: string[];
  onSearchTermChange: (value: string) => void;
  onDistrictFilterChange: (value: string) => void;
  onBlockFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onStatusFilterChange: (value: PartnerPayStatus | "") => void;
  onClearFilters: () => void;
  columnSelection: ColumnSelection | null;
  selectedPartnerIds: string[];
  selectedFieldLabel?: string;
  editableFields: EditableFieldDef[];
  numericDrafts: Record<string, Partial<PartnerPayValues>>;
  textDrafts: Record<string, Partial<PartnerPayTextValues>>;
  statusDrafts: Record<string, PartnerPayStatus>;
  monthMultiplier: number;
  defaultDays: number;
  resolveValues: (partner: SchoolPartner) => PartnerPayValues;
  resolveTextValues: (partner: SchoolPartner) => PartnerPayTextValues;
  resolvePaymentStatus: (partner: SchoolPartner) => PartnerPayStatus;
  onFieldChange: (partnerId: string, field: PartnerPayColumnField, value: string) => void;
  onBulkApplyValue: (value: string) => void;
  onActivateCell: (partnerId: string, field: PartnerPayColumnField, shiftKey: boolean) => void;
  onColumnHeaderClick: (field: PartnerPayColumnField) => void;
  onClearColumnSelection: () => void;
  onDiscard: () => void;
  onSave: () => Promise<void>;
}

export default function PartnerPayBulkEditModal({
  isOpen,
  onClose,
  selectedMonth,
  partners,
  totalPartnerCount,
  paymentRows,
  changeCount,
  saving,
  searchTerm,
  districtFilter,
  blockFilter,
  categoryFilter,
  statusFilter,
  districtOptions,
  blockOptions,
  categoryOptions,
  onSearchTermChange,
  onDistrictFilterChange,
  onBlockFilterChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  onClearFilters,
  columnSelection,
  selectedPartnerIds,
  selectedFieldLabel,
  editableFields,
  numericDrafts,
  textDrafts,
  statusDrafts,
  monthMultiplier,
  defaultDays,
  resolveValues,
  resolveTextValues,
  resolvePaymentStatus,
  onFieldChange,
  onBulkApplyValue,
  onActivateCell,
  onColumnHeaderClick,
  onClearColumnSelection,
  onDiscard,
  onSave,
}: PartnerPayBulkEditModalProps) {
  const [bulkInputValue, setBulkInputValue] = useState("");

  useEffect(() => {
    setBulkInputValue("");
  }, [columnSelection?.field, columnSelection?.anchorPartnerId, columnSelection?.focusPartnerId]);

  if (!isOpen) return null;

  const selectedField = columnSelection?.field;
  const isNumericField =
    selectedField && selectedField !== "paymentStatus"
      ? isPartnerPayNumericField(selectedField)
      : false;
  const isStatusField = selectedField === "paymentStatus";
  const hasActiveFilters = Boolean(
    searchTerm || districtFilter || blockFilter || categoryFilter || statusFilter,
  );

  const handleCellMouseDown = (
    e: React.MouseEvent,
    partnerId: string,
    field: PartnerPayColumnField,
  ) => {
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
    }
    onActivateCell(partnerId, field, e.shiftKey);
  };

  const handleBulkApply = () => {
    if (!selectedField || selectedPartnerIds.length === 0) return;
    if (isStatusField) {
      if (!bulkInputValue) return;
      onBulkApplyValue(bulkInputValue);
      return;
    }
    if (bulkInputValue.trim() === "" && !isNumericField) return;
    onBulkApplyValue(bulkInputValue);
    setBulkInputValue("");
  };

  const handleClose = () => {
    if (changeCount > 0) {
      const ok = window.confirm(
        "Close bulk edit? Unsaved changes will remain — use Save or Discard on the main page.",
      );
      if (!ok) return;
    }
    onClose();
  };

  const renderNumericCell = (
    partner: SchoolPartner,
    field: PartnerPayNumericField,
    displayValue: number,
    colIndex: number,
  ) => {
    const isDirty = Boolean(numericDrafts[partner.id]?.[field]);
    const selected =
      columnSelection?.field === field && selectedPartnerIds.includes(partner.id);
    const min = field === "days" ? 1 : 0;
    const max = field === "days" ? 31 : undefined;

    return (
      <td
        key={colIndex}
        onMouseDownCapture={(e) => handleCellMouseDown(e, partner.id, field)}
        className={`p-1 border border-[#d4d4d4] text-center bg-[#fff9e6] ${
          selected ? "ring-2 ring-inset ring-blue-400 bg-blue-50/50" : ""
        }`}
      >
        <input
          type="number"
          min={min}
          max={max}
          value={displayValue}
          onChange={(e) => onFieldChange(partner.id, field, e.target.value)}
          className={`w-full text-center bg-transparent border-0 outline-none font-semibold ${
            isDirty ? "text-orange-700" : ""
          }`}
        />
      </td>
    );
  };

  const renderTextCell = (
    partner: SchoolPartner,
    field: PartnerPayTextField,
    displayValue: string,
    colIndex: number,
  ) => {
    const isDirty = Boolean(textDrafts[partner.id]?.[field]);
    const selected =
      columnSelection?.field === field && selectedPartnerIds.includes(partner.id);

    return (
      <td
        key={colIndex}
        onMouseDownCapture={(e) => handleCellMouseDown(e, partner.id, field)}
        className={`p-1 border border-[#d4d4d4] bg-[#fff9e6] ${
          selected ? "ring-2 ring-inset ring-blue-400 bg-blue-50/50" : ""
        }`}
      >
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onFieldChange(partner.id, field, e.target.value)}
          className={`w-full bg-transparent border-0 outline-none ${
            isDirty ? "text-orange-700 font-semibold" : ""
          }`}
        />
      </td>
    );
  };

  const renderStatusCell = (
    partner: SchoolPartner,
    displayStatus: PartnerPayStatus,
    colIndex: number,
  ) => {
    const isDirty = Boolean(statusDrafts[partner.id]);
    const selected =
      columnSelection?.field === "paymentStatus" && selectedPartnerIds.includes(partner.id);

    return (
      <td
        key={colIndex}
        onMouseDownCapture={(e) => handleCellMouseDown(e, partner.id, "paymentStatus")}
        className={`p-1 border border-[#d4d4d4] text-center bg-violet-50/60 ${
          selected ? "ring-2 ring-inset ring-blue-400 bg-blue-50/50" : ""
        }`}
      >
        <select
          value={displayStatus}
          onChange={(e) => onFieldChange(partner.id, "paymentStatus", e.target.value)}
          className={`w-full px-1 py-0.5 rounded text-xs font-bold border cursor-pointer focus:outline-none ${partnerPayStatusClass(displayStatus)} ${
            isDirty ? "ring-1 ring-orange-400" : ""
          }`}
        >
          {PARTNER_PAY_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[98vw] max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Pencil size={16} className="text-[#ff791a]" />
              Bulk Edit Partner Payments
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {partners.length}
              {totalPartnerCount !== partners.length ? ` of ${totalPartnerCount}` : ""} partners
              {selectedMonth ? ` · ${selectedMonth}` : ""} — edit bank details, toilets, days, and pay
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={changeCount === 0 || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw size={14} /> Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={changeCount === 0 || saving || !selectedMonth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              <Save size={14} /> {saving ? "Saving..." : `Save ${changeCount || ""} change${changeCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[240px] flex-1 max-w-sm">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  placeholder="Search school, partner, account, IFSC..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
                />
              </label>
              <select
                value={districtFilter}
                onChange={(e) => onDistrictFilterChange(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white cursor-pointer"
              >
                <option value="">All Districts</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              <select
                value={blockFilter}
                onChange={(e) => onBlockFilterChange(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white cursor-pointer disabled:opacity-60"
                disabled={blockOptions.length === 0}
              >
                <option value="">All Blocks</option>
                {blockOptions.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => onCategoryFilterChange(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white cursor-pointer"
              >
                <option value="">All Categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as PartnerPayStatus | "")}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white cursor-pointer"
              >
                <option value="">All Statuses</option>
                {PARTNER_PAY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {totalPartnerCount === partners.length
                ? `Showing all ${partners.length} partners in this bulk edit view.`
                : `Showing ${partners.length} of ${totalPartnerCount} partners in this bulk edit view.`}
            </p>
          </div>
        </div>

        {columnSelection && selectedPartnerIds.length > 0 && (
          <div className="px-4 py-3 border-b border-blue-200 bg-blue-50/70 flex flex-col gap-3 text-xs shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-blue-900">
                <MousePointerClick size={14} />
                <span>
                  <strong>{selectedPartnerIds.length}</strong> row
                  {selectedPartnerIds.length !== 1 ? "s" : ""} selected
                  {selectedFieldLabel ? ` in ${selectedFieldLabel}` : ""}
                  {selectedPartnerIds.length > 1 ? " — Shift+click to extend selection" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={onClearColumnSelection}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Clear selection
              </button>
            </div>
            {selectedPartnerIds.length > 1 && selectedField && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-md">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-800">
                    Set {selectedFieldLabel} for all selected rows
                  </span>
                  {isStatusField ? (
                    <select
                      value={bulkInputValue}
                      onChange={(e) => setBulkInputValue(e.target.value)}
                      className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-white cursor-pointer"
                    >
                      <option value="">Choose status…</option>
                      {PARTNER_PAY_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={isNumericField ? "number" : "text"}
                      min={selectedField === "days" ? 1 : isNumericField ? 0 : undefined}
                      max={selectedField === "days" ? 31 : undefined}
                      value={bulkInputValue}
                      onChange={(e) => setBulkInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleBulkApply();
                        }
                      }}
                      placeholder={`Enter ${selectedFieldLabel?.toLowerCase() || "value"}…`}
                      className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
                    />
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleBulkApply}
                  disabled={
                    isStatusField
                      ? !bulkInputValue
                      : isNumericField
                        ? bulkInputValue === ""
                        : bulkInputValue.trim() === ""
                  }
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0"
                >
                  Apply to {selectedPartnerIds.length} rows
                </button>
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-1.5 border-b border-slate-100 text-[10px] text-slate-500 shrink-0">
          Click a cell to select · <strong>Shift+click</strong> another cell in the same column to select a
          range · column header = select all · use the field above to set one value for all selected rows ·
          enter <strong>Monthly Pay</strong> to auto-update per-toilet (and vice versa)
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="overflow-x-auto border border-[#d4d4d4] rounded-lg">
            <table
              className="w-full text-xs text-left min-w-[1300px] border-collapse"
              style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}
            >
              <thead>
                <tr className="bg-[#e2efda] text-[#1f4e2d] sticky top-0 z-10">
                  {PARTNER_PAYMENT_HEADERS.map((header, index) => {
                    const editable = editableFields.find((f) => f.col === index);
                    return (
                      <th
                        key={header}
                        className={`p-2 whitespace-nowrap border border-[#d4d4d4] font-semibold ${
                          editable ? "cursor-pointer hover:bg-[#d4ead4]" : ""
                        }`}
                        title={editable ? "Click to select entire column" : undefined}
                        onClick={() => editable && onColumnHeaderClick(editable.field)}
                      >
                        {header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={PARTNER_PAYMENT_HEADERS.length}
                      className="p-8 text-center text-slate-400"
                    >
                      No partner records found for the current bulk edit filters.
                    </td>
                  </tr>
                ) : (
                  partners.map((partner, index) => {
                    const row = paymentRows[index];
                    const values = resolveValues(partner);
                    const textValues = resolveTextValues(partner);
                    const payable = computePartnerPayableAmount(values, monthMultiplier, defaultDays);
                    const rowDirty =
                      Boolean(
                        (numericDrafts[partner.id] && Object.keys(numericDrafts[partner.id]).length > 0) ||
                          (textDrafts[partner.id] && Object.keys(textDrafts[partner.id]).length > 0) ||
                          statusDrafts[partner.id],
                      );

                    return (
                      <tr
                        key={partner.id}
                        className={`border-t border-[#d4d4d4] hover:bg-slate-50 ${rowDirty ? "bg-orange-50/40" : ""}`}
                      >
                        {row.map((cell, cellIndex) => {
                          if (cellIndex === PARTNER_PAY_COL_SCHOOL_NAME) {
                            return renderTextCell(partner, "schoolName", textValues.schoolName, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_SCHOOL_CATEGORY) {
                            return renderTextCell(
                              partner,
                              "schoolCategory",
                              textValues.schoolCategory,
                              cellIndex,
                            );
                          }
                          if (cellIndex === PARTNER_PAY_COL_PARTNER_NAME) {
                            return renderTextCell(partner, "partnerName", textValues.partnerName, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_ACCOUNT_HOLDER) {
                            return renderTextCell(
                              partner,
                              "accountHolderName",
                              textValues.accountHolderName,
                              cellIndex,
                            );
                          }
                          if (cellIndex === PARTNER_PAY_COL_ACCOUNT_NUMBER) {
                            return renderTextCell(
                              partner,
                              "accountNumber",
                              textValues.accountNumber,
                              cellIndex,
                            );
                          }
                          if (cellIndex === PARTNER_PAY_COL_IFSC) {
                            return renderTextCell(partner, "ifscCode", textValues.ifscCode, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_TOILETS) {
                            return renderNumericCell(partner, "toilets", values.toilets, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_DAYS) {
                            return renderNumericCell(partner, "days", values.days, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_PER_TOILET) {
                            return renderNumericCell(partner, "perToiletPay", values.perToiletPay, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_MONTHLY) {
                            return renderNumericCell(partner, "monthlyPay", values.monthlyPay, cellIndex);
                          }
                          if (cellIndex === PARTNER_PAY_COL_TOTAL) {
                            return (
                              <td
                                key={cellIndex}
                                className="p-2 border border-[#d4d4d4] font-semibold text-right"
                              >
                                ₹{payable.toLocaleString("en-IN")}
                              </td>
                            );
                          }
                          if (cellIndex === PARTNER_PAY_COL_STATUS) {
                            return renderStatusCell(
                              partner,
                              resolvePaymentStatus(partner),
                              cellIndex,
                            );
                          }
                          return (
                            <td key={cellIndex} className="p-2 border border-[#d4d4d4]">
                              {String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
