import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, FileSpreadsheet, FileText, PlusCircle, MapPin, Calendar, Save, X } from "lucide-react";
import { SchoolMonthlyBilling, SchoolPartner, SchoolWork, SchoolDistrict, SchoolBlock } from "../types";
import {
  STANDARD_MONTH_DAYS,
  buildGovtBillRows,
  filterSchoolsByBillingCategory,
  filterLineItemsByBillingCategory,
  getSchoolBillingToilets,
} from "../lib/school-work-helpers";
import {
  exportGovtInvoiceExcelCombined,
  exportGovtInvoiceExcelFromBilling,
  exportGovtInvoicePdfFromElement,
} from "../lib/govt-invoice-export";
import GovtInvoicePreview from "./GovtInvoicePreview";
import MonthlyPartnerPaymentsTab from "./MonthlyPartnerPaymentsTab";
import {
  type AxisBulkPayRowInput,
  type BulkPayPartnerSheetInput,
  type SavedBulkPayRecord,
} from "../utils";

interface MonthlyInvoiceTabProps {
  schools: SchoolWork[];
  partners?: SchoolPartner[];
  districts?: SchoolDistrict[];
  blocks?: SchoolBlock[];
  billings: SchoolMonthlyBilling[];
  selectedMonth?: string;
  monthsList?: string[];
  onMonthChange?: (monthKey: string) => void;
  onGenerate: (payload: {
    block: string;
    district?: string;
    monthKey: string;
    financialYear: string;
    cleaningDays: number;
    category: "elementary" | "secondary" | "all";
    billingId?: string;
  }) => Promise<SchoolMonthlyBilling | null>;
  onSaveWorkdays?: (payload: {
    block: string;
    district?: string;
    monthKey: string;
    defaultDays: number;
    updates: Array<{ id: string; cleaningDays: number; billingToilets?: number }>;
  }) => Promise<boolean>;
  onSavePayUpdates?: (
    updates: Array<{ id: string; changes: { partnerMonthlyPay: number; rates: number } }>,
  ) => Promise<boolean>;
  onSavePartnerDetails?: (
    updates: Array<{ id: string; changes: Partial<SchoolWork> }>,
  ) => Promise<boolean>;
  onSavePaymentStatus?: (
    updates: Array<{ id: string; paymentStatus: "Unpaid" | "Paid" | "Hold" }>,
  ) => Promise<boolean>;
  onRefreshBillings?: () => Promise<boolean | void>;
  onExportAxisBulkPay?: (payload: {
    items: AxisBulkPayRowInput[];
    partnerSheet: BulkPayPartnerSheetInput;
    partnerIds: string[];
    partnerHeaders: readonly string[];
  }) => Promise<void>;
  isExportingBulkPay?: boolean;
  lastSavedBulkPay?: SavedBulkPayRecord | null;
  onViewSavedBulkPay?: () => void;
  readOnly?: boolean;
}

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type InvoiceMode = "create" | "view" | "partnerPay";
type PreviewTab = "elementary" | "secondary";

function InvoicePreviewTabs({
  value,
  onChange,
}: {
  value: PreviewTab;
  onChange: (tab: PreviewTab) => void;
}) {
  return (
    <div className="inline-flex bg-slate-200/60 p-1 rounded-lg gap-1">
      <button
        type="button"
        onClick={() => onChange("elementary")}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
          value === "elementary"
            ? "bg-white text-slate-800 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
        }`}
      >
        Elementary
      </button>
      <button
        type="button"
        onClick={() => onChange("secondary")}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
          value === "secondary"
            ? "bg-white text-slate-800 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
        }`}
      >
        Secondary / High
      </button>
    </div>
  );
}

export default function MonthlyInvoiceTab({
  schools,
  partners = [],
  districts = [],
  blocks = [],
  billings,
  selectedMonth,
  monthsList,
  onMonthChange,
  onGenerate,
  onSaveWorkdays,
  onSavePayUpdates,
  onSavePartnerDetails,
  onSavePaymentStatus,
  onRefreshBillings,
  onExportAxisBulkPay,
  isExportingBulkPay,
  lastSavedBulkPay,
  onViewSavedBulkPay,
  readOnly = false,
}: MonthlyInvoiceTabProps) {
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const viewInvoicePreviewRef = useRef<HTMLDivElement>(null);
  const wasViewModeRef = useRef(false);
  const [mode, setMode] = useState<InvoiceMode>("create");
  const blockNames = useMemo(
    () => Array.from(new Set(schools.map((s) => s.block).filter(Boolean))).sort(),
    [schools],
  );
  const [block, setBlock] = useState(blockNames[0] || "");
  const [district, setDistrict] = useState("");
  const districtForBlock = useMemo(() => {
    if (!block) return "";
    const fromConfig = blocks.find((b) => b.name === block)?.districtName;
    if (fromConfig) return fromConfig;
    return schools.find((s) => s.block === block)?.district || "";
  }, [block, blocks, schools]);

  useEffect(() => {
    setDistrict(districtForBlock);
  }, [districtForBlock]);
  const [defaultDays, setDefaultDays] = useState(STANDARD_MONTH_DAYS);
  const lastDaysSyncKeyRef = useRef("");

  useEffect(() => {
    if (!selectedMonth) return;
    const monthBillings = billings.filter((billing) => billing.monthKey === selectedMonth);
    const syncKey = `${selectedMonth}|${block}|${monthBillings
      .map((billing) => `${billing.id}:${billing.cleaningDays}`)
      .join(",")}`;
    if (syncKey === lastDaysSyncKeyRef.current) return;
    lastDaysSyncKeyRef.current = syncKey;

    if (monthBillings.length === 0) {
      setDefaultDays(STANDARD_MONTH_DAYS);
      return;
    }
    const preferred =
      (block && monthBillings.find((billing) => billing.block === block)) ||
      monthBillings[0];
    setDefaultDays(preferred.cleaningDays || STANDARD_MONTH_DAYS);
  }, [selectedMonth, block, billings]);
  const [financialYear, setFinancialYear] = useState("2025-2026");
  const [category, setCategory] = useState<"elementary" | "secondary" | "all">("all");
  const [generating, setGenerating] = useState(false);
  const [savingWorkdays, setSavingWorkdays] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [draftDaysBySchoolId, setDraftDaysBySchoolId] = useState<Record<string, number>>({});
  const [draftToiletsBySchoolId, setDraftToiletsBySchoolId] = useState<Record<string, number>>({});
  const [manualDaysSchoolIds, setManualDaysSchoolIds] = useState<Set<string>>(() => new Set());
  const [viewBlockFilter, setViewBlockFilter] = useState("");
  const [viewCategoryFilter, setViewCategoryFilter] = useState("");
  const [viewMonthFilter, setViewMonthFilter] = useState("");
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [exportingViewPdf, setExportingViewPdf] = useState(false);
  const [refreshingBillings, setRefreshingBillings] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("elementary");
  const [viewPreviewTab, setViewPreviewTab] = useState<PreviewTab>("elementary");
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);

  const billingMonths = useMemo(
    () =>
      Array.from(new Set(billings.map((billing) => billing.monthKey).filter(Boolean))).sort(
        (a, b) => {
          const aParts = a.split(" ");
          const bParts = b.split(" ");
          const aYear = parseInt(aParts[aParts.length - 1] || "0", 10);
          const bYear = parseInt(bParts[bParts.length - 1] || "0", 10);
          if (aYear !== bYear) return bYear - aYear;
          return b.localeCompare(a);
        },
      ),
    [billings],
  );

  const billingBlocks = useMemo(
    () => Array.from(new Set(billings.map((b) => b.block).filter(Boolean))).sort(),
    [billings],
  );

  const existingBillingForSelection = useMemo(() => {
    if (!block || !selectedMonth) return null;
    return (
      billings.find(
        (billing) =>
          billing.block === block &&
          billing.monthKey === selectedMonth &&
          billing.category === category,
      ) ?? null
    );
  }, [billings, block, selectedMonth, category]);

  const canSaveInvoice =
    !readOnly &&
    !!block &&
    !!selectedMonth &&
    (!existingBillingForSelection || existingBillingForSelection.id === editingBillingId);

  const isEditingExistingInvoice =
    !!editingBillingId && existingBillingForSelection?.id === editingBillingId;

  const filteredBillings = useMemo(() => {
    return billings.filter((billing) => {
      if (viewMonthFilter && billing.monthKey !== viewMonthFilter) return false;
      if (viewBlockFilter && billing.block !== viewBlockFilter) return false;
      if (viewCategoryFilter && billing.category !== viewCategoryFilter) return false;
      return true;
    });
  }, [billings, viewMonthFilter, viewBlockFilter, viewCategoryFilter]);

  useEffect(() => {
    if (!editingBillingId) return;
    const editingBilling = billings.find((billing) => billing.id === editingBillingId);
    if (
      !editingBilling ||
      editingBilling.block !== block ||
      editingBilling.monthKey !== selectedMonth ||
      editingBilling.category !== category
    ) {
      setEditingBillingId(null);
    }
  }, [block, selectedMonth, category, editingBillingId, billings]);

  useEffect(() => {
    if (mode === "view" && !wasViewModeRef.current && onRefreshBillings) {
      setRefreshingBillings(true);
      void onRefreshBillings().finally(() => setRefreshingBillings(false));
    }
    wasViewModeRef.current = mode === "view";
  }, [mode, onRefreshBillings]);

  useEffect(() => {
    if (selectedBillingId && !filteredBillings.some((billing) => billing.id === selectedBillingId)) {
      setSelectedBillingId(null);
    }
  }, [filteredBillings, selectedBillingId]);

  const selectedBilling = useMemo(
    () => filteredBillings.find((billing) => billing.id === selectedBillingId) || null,
    [filteredBillings, selectedBillingId],
  );

  const viewBillingLineItems = useMemo(() => {
    if (!selectedBilling) {
      return { elementary: [], secondary: [] };
    }
    return {
      elementary: filterLineItemsByBillingCategory(selectedBilling.schools, "elementary"),
      secondary: filterLineItemsByBillingCategory(selectedBilling.schools, "secondary"),
    };
  }, [selectedBilling]);

  const viewActiveLineItems = useMemo(() => {
    if (!selectedBilling) return [];
    if (selectedBilling.category === "all") {
      return viewPreviewTab === "elementary"
        ? viewBillingLineItems.elementary
        : viewBillingLineItems.secondary;
    }
    if (selectedBilling.category === "elementary") {
      return viewPreviewTab === "elementary" ? selectedBilling.schools : [];
    }
    return viewPreviewTab === "secondary" ? selectedBilling.schools : [];
  }, [selectedBilling, viewPreviewTab, viewBillingLineItems]);

  const blockSchools = useMemo(() => {
    let rows = schools.filter((s) => s.block === block);
    if (district) {
      rows = rows.filter(
        (s) => String(s.district || "").toLowerCase() === district.toLowerCase(),
      );
    }
    return rows;
  }, [schools, block, district]);

  const elementaryPreviewSchools = useMemo(
    () => filterSchoolsByBillingCategory(blockSchools, "elementary"),
    [blockSchools],
  );

  const secondaryPreviewSchools = useMemo(
    () => filterSchoolsByBillingCategory(blockSchools, "secondary"),
    [blockSchools],
  );

  const activePreviewSchools =
    previewTab === "elementary" ? elementaryPreviewSchools : secondaryPreviewSchools;

  const savedToiletsBySchoolId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const school of blockSchools) {
      map[school.id] = getSchoolBillingToilets(school, selectedMonth);
    }
    return map;
  }, [blockSchools, selectedMonth]);

  const daysBySchoolId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const school of blockSchools) {
      map[school.id] = draftDaysBySchoolId[school.id] ?? defaultDays;
    }
    return map;
  }, [blockSchools, draftDaysBySchoolId, defaultDays]);

  const toiletsBySchoolId = useMemo(() => {
    const merged = { ...savedToiletsBySchoolId };
    for (const [id, toilets] of Object.entries(draftToiletsBySchoolId)) {
      if (blockSchools.some((s) => s.id === id)) merged[id] = toilets;
    }
    return merged;
  }, [savedToiletsBySchoolId, draftToiletsBySchoolId, blockSchools]);

  const activeUnitRate = previewTab === "secondary" ? 100 : 50;
  const viewActiveUnitRate = viewPreviewTab === "secondary" ? 100 : 50;

  const previewTotals = useMemo(() => {
    const rows = buildGovtBillRows(
      activePreviewSchools,
      daysBySchoolId,
      selectedMonth,
      toiletsBySchoolId,
    );
    return rows.reduce(
      (acc, row) => ({
        schools: acc.schools + 1,
        toilets: acc.toilets + Number(row[5] || 0),
        cleanings: acc.cleanings + Number(row[7] || 0),
        amount: acc.amount + Number(row[9] || 0),
      }),
      { schools: 0, toilets: 0, cleanings: 0, amount: 0 },
    );
  }, [activePreviewSchools, daysBySchoolId, toiletsBySchoolId, selectedMonth]);

  const handleGenerate = async () => {
    if (!canSaveInvoice) return;
    setGenerating(true);
    await onSaveWorkdaysInternal();
    const saved = await onGenerate({
      block,
      district: district || undefined,
      monthKey: selectedMonth!,
      financialYear,
      cleaningDays: defaultDays,
      category,
      billingId: editingBillingId || undefined,
    });
    setGenerating(false);
    if (saved?.id) {
      setEditingBillingId(null);
      setViewMonthFilter(saved.monthKey);
      setViewBlockFilter("");
      setViewCategoryFilter("");
      setSelectedBillingId(saved.id);
      setMode("view");
    }
  };

  const onSaveWorkdaysInternal = async () => {
    if (!onSaveWorkdays || !block || !selectedMonth) return false;
    setSavingWorkdays(true);
    const ok = await onSaveWorkdays({
      block,
      district: district || undefined,
      monthKey: selectedMonth,
      defaultDays,
      updates: blockSchools.map((school) => ({
        id: school.id,
        cleaningDays: daysBySchoolId[school.id] ?? defaultDays,
        billingToilets: toiletsBySchoolId[school.id],
      })),
    });
    if (ok) {
      setDraftDaysBySchoolId({});
      setDraftToiletsBySchoolId({});
      setManualDaysSchoolIds(new Set());
    }
    setSavingWorkdays(false);
    return ok;
  };

  const resetInvoiceDrafts = () => {
    setDraftDaysBySchoolId({});
    setDraftToiletsBySchoolId({});
    setManualDaysSchoolIds(new Set());
  };

  const handleDefaultDaysChange = (rawValue: string) => {
    const nextDefault = Math.min(31, Math.max(1, Number(rawValue) || STANDARD_MONTH_DAYS));
    setDefaultDays(nextDefault);
    setDraftDaysBySchoolId((prev) => {
      const next = { ...prev };
      for (const school of blockSchools) {
        if (manualDaysSchoolIds.has(school.id)) continue;
        next[school.id] = nextDefault;
      }
      return next;
    });
  };

  const handleDaysChange = (schoolId: string, days: number) => {
    setManualDaysSchoolIds((prev) => new Set(prev).add(schoolId));
    setDraftDaysBySchoolId((prev) => ({ ...prev, [schoolId]: days }));
  };

  const handleToiletsChange = (schoolId: string, toilets: number) => {
    setDraftToiletsBySchoolId((prev) => ({ ...prev, [schoolId]: toilets }));
  };

  useEffect(() => {
    if (!selectedBilling) return;
    setViewPreviewTab("elementary");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedBillingId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedBilling]);

  const handleExportExcel = async () => {
    if (!selectedMonth) return;
    await exportGovtInvoiceExcelCombined({
      schools,
      block,
      district: district || undefined,
      monthKey: selectedMonth,
      financialYear,
      defaultDays,
      daysMap: daysBySchoolId,
      toiletsMap: toiletsBySchoolId,
    });
  };

  const handleExportPdf = async () => {
    if (!invoicePreviewRef.current || !selectedMonth) return;
    setExportingPdf(true);
    try {
      const catSlug = previewTab === "secondary" ? "secondary" : "elementary";
      await exportGovtInvoicePdfFromElement(
        invoicePreviewRef.current,
        `${block.toUpperCase()}_${selectedMonth.replace(/\s+/g, "_")}_${catSlug}_invoice.pdf`,
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleViewExportPdf = async () => {
    if (!viewInvoicePreviewRef.current || !selectedBilling) return;
    setExportingViewPdf(true);
    try {
      const catSlug =
        selectedBilling.category === "all" ? viewPreviewTab : selectedBilling.category;
      await exportGovtInvoicePdfFromElement(
        viewInvoicePreviewRef.current,
        `${selectedBilling.block.toUpperCase()}_${selectedBilling.monthKey.replace(/\s+/g, "_")}_${catSlug}_invoice.pdf`,
      );
    } finally {
      setExportingViewPdf(false);
    }
  };

  const openBillingInCreate = (billing: SchoolMonthlyBilling) => {
    setEditingBillingId(billing.id);
    setBlock(billing.block);
    setDistrict(billing.district || "");
    setFinancialYear(billing.financialYear);
    setCategory(billing.category);
    setDefaultDays(billing.cleaningDays || STANDARD_MONTH_DAYS);
    const daysDraft: Record<string, number> = {};
    const toiletsDraft: Record<string, number> = {};
    for (const item of billing.schools) {
      daysDraft[item.schoolWorkId] = item.cleaningDays;
      toiletsDraft[item.schoolWorkId] = item.toilets;
    }
    setDraftDaysBySchoolId(daysDraft);
    setDraftToiletsBySchoolId(toiletsDraft);
    setManualDaysSchoolIds(new Set());
    if (selectedMonth !== billing.monthKey && onMonthChange) {
      onMonthChange(billing.monthKey);
    }
    setMode("create");
  };

  const closePreviewModal = () => setSelectedBillingId(null);

  return (
    <div className="space-y-4 -mb-4 md:-mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex bg-slate-200/60 p-1 rounded-lg gap-1">
          <button
            type="button"
            onClick={() => {
              setEditingBillingId(null);
              setMode("create");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              mode === "create"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <PlusCircle size={14} /> Create Invoice
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              mode === "view"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Eye size={14} /> View Saved
            {billings.length > 0 && (
              <span className="bg-orange-100 text-[#ff791a] px-1.5 py-0.5 rounded-full text-[10px] font-black">
                {billings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMode("partnerPay")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              mode === "partnerPay"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <FileSpreadsheet size={14} /> Partner Pay
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {mode === "create"
            ? "Build invoice, set days worked, and export govt billing"
            : mode === "view"
              ? "Browse saved invoice records"
              : "Export partner bank sheet prorated by days worked"}
        </span>
      </div>

      {mode === "partnerPay" ? (
        <MonthlyPartnerPaymentsTab
          partners={partners}
          schools={schools}
          districts={districts}
          selectedMonth={selectedMonth}
          monthsList={monthsList}
          onMonthChange={onMonthChange}
          defaultDays={defaultDays}
          onSaveWorkdays={onSaveWorkdays}
          onSavePayUpdates={onSavePayUpdates}
          onSavePartnerDetails={onSavePartnerDetails}
          onSavePaymentStatus={onSavePaymentStatus}
          onExportAxisBulkPay={onExportAxisBulkPay}
          isExportingBulkPay={isExportingBulkPay}
          lastSavedBulkPay={lastSavedBulkPay}
          onViewSavedBulkPay={onViewSavedBulkPay}
          readOnly={readOnly}
        />
      ) : mode === "create" ? (
      <section className="bg-white border border-slate-200 rounded-xl px-5 pt-5 pb-0 shadow-xs">
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2 mb-4">
          <FileSpreadsheet className="text-[#ff791a]" size={18} />
          Government Invoice (Housekeeping Bill)
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Official format matching block invoice — edit no. of toilets and days per school, then
          download Excel (with formulas) or PDF
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">District</label>
            <input
              value={district || districtForBlock || "—"}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              <MapPin size={12} className="inline" /> Block
            </label>
            <select
              value={block}
              onChange={(e) => {
                setBlock(e.target.value);
                resetInvoiceDrafts();
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              {blockNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          {monthsList && selectedMonth && onMonthChange && (
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                <Calendar size={12} className="inline" /> Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  resetInvoiceDrafts();
                  onMonthChange(e.target.value);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              Default Days (full month)
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={defaultDays}
              onChange={(e) => handleDefaultDaysChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Financial Year</label>
            <input
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <option value="elementary">Elementary</option>
              <option value="secondary">Secondary / High</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {existingBillingForSelection && !canSaveInvoice && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            An invoice already exists for {block} · {selectedMonth} · {category}. Use{" "}
            <button
              type="button"
              onClick={() => openBillingInCreate(existingBillingForSelection)}
              className="font-bold underline cursor-pointer hover:text-amber-950"
            >
              View Saved → Edit
            </button>{" "}
            to update it.
          </div>
        )}

        <div className="mb-4">
          <InvoicePreviewTabs value={previewTab} onChange={setPreviewTab} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-slate-400 font-bold block">Schools</span>
            <span className="text-xl font-black">{previewTotals.schools}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-slate-400 font-bold block">Toilets</span>
            <span className="text-xl font-black">{previewTotals.toilets}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-slate-400 font-bold block">Total Cleanings</span>
            <span className="text-xl font-black">{previewTotals.cleanings}</span>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
            <span className="text-orange-600 font-bold block">Invoice Amount</span>
            <span className="text-xl font-black text-[#ff791a]">
              {formatCurrency(previewTotals.amount)}
            </span>
          </div>
        </div>

        {selectedMonth && activePreviewSchools.length > 0 ? (
          <div className="max-h-[min(520px,calc(100vh-24rem))] overflow-y-auto scrollbar-thin -mx-1 px-1">
            <GovtInvoicePreview
              ref={invoicePreviewRef}
              schools={activePreviewSchools}
              daysMap={daysBySchoolId}
              toiletsMap={toiletsBySchoolId}
              block={block}
              district={district || activePreviewSchools[0]?.district}
              monthKey={selectedMonth}
              financialYear={financialYear}
              defaultDays={defaultDays}
              unitRate={activeUnitRate}
              readOnly={readOnly}
              onDaysChange={readOnly ? undefined : handleDaysChange}
              onToiletsChange={readOnly ? undefined : handleToiletsChange}
            />
          </div>
        ) : selectedMonth ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-400">
            No {previewTab === "elementary" ? "elementary" : "secondary / high"} schools found for this block.
          </div>
        ) : null}

        <div className="sticky bottom-20 md:bottom-0 z-30 -mx-5 px-5 py-3.5 mt-4 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)] rounded-b-xl flex flex-wrap items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !canSaveInvoice}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm"
            >
              <Save size={14} />
              {generating
                ? "Saving..."
                : isEditingExistingInvoice
                  ? "Update Days, Toilets & Invoice"
                  : "Save Days, Toilets & Invoice"}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!block || !selectedMonth}
              className="flex items-center gap-1.5 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm"
            >
              <FileSpreadsheet size={14} /> Download Excel
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!block || !selectedMonth || exportingPdf}
              className="flex items-center gap-1.5 bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm"
            >
              <FileText size={14} /> {exportingPdf ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </div>

      </section>
      ) : (
        <>
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2 mb-1">
              <Eye className="text-[#ff791a]" size={18} />
              Saved Invoice Records
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {billings.length === 0
                ? "No invoices saved yet. Use Create Invoice → Save Days, Toilets & Invoice to store a billing snapshot here."
                : `${billings.length} saved record${billings.length === 1 ? "" : "s"}${filteredBillings.length !== billings.length ? ` · ${filteredBillings.length} match filters` : ""}${refreshingBillings ? " · refreshing…" : ""}`}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={viewMonthFilter}
                onChange={(e) => setViewMonthFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <option value="">All Months</option>
                {billingMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={viewBlockFilter}
                onChange={(e) => setViewBlockFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <option value="">All Blocks</option>
                {billingBlocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={viewCategoryFilter}
                onChange={(e) => setViewCategoryFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="elementary">Elementary</option>
                <option value="secondary">Secondary / High</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-2">Block</th>
                    <th className="p-2">District</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Financial Year</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 text-right">Schools</th>
                    <th className="p-2 text-right">Toilets</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBillings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        {billings.length === 0
                          ? "No saved invoice records yet. Go to Create Invoice and click Save Days, Toilets & Invoice."
                          : "No saved invoice records match this filter. Try All Months / All Blocks / All Categories."}
                      </td>
                    </tr>
                  ) : (
                    filteredBillings.map((billing) => (
                        <tr
                          key={billing.id}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="p-2 font-semibold">{billing.block}</td>
                          <td className="p-2">{billing.district || "—"}</td>
                          <td className="p-2">{billing.monthKey}</td>
                          <td className="p-2">{billing.financialYear}</td>
                          <td className="p-2 capitalize">{billing.category}</td>
                          <td className="p-2 text-right">{billing.totals?.schools ?? 0}</td>
                          <td className="p-2 text-right">{billing.totals?.toilets ?? 0}</td>
                          <td className="p-2 text-right font-bold">
                            {formatCurrency(billing.totals?.amount || 0)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedBillingId(billing.id)}
                                className="px-2 py-1 rounded text-[11px] font-bold cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200"
                              >
                                View
                              </button>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => openBillingInCreate(billing)}
                                  className="px-2 py-1 rounded text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selectedBilling &&
            createPortal(
              <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" id="invoice-preview-modal">
                <div
                  onClick={closePreviewModal}
                  className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm"
                  aria-hidden
                />
                <div className="relative flex h-full items-center justify-center p-3 sm:p-4 pointer-events-none">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pointer-events-auto flex h-full max-h-[92vh] w-full max-w-6xl min-h-0 cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  >
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm">
                          Invoice Preview — {selectedBilling.block} ({selectedBilling.monthKey})
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                          {selectedBilling.category} · {selectedBilling.financialYear} ·{" "}
                          {selectedBilling.totals?.schools ?? 0} schools ·{" "}
                          {formatCurrency(selectedBilling.totals?.amount || 0)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <InvoicePreviewTabs value={viewPreviewTab} onChange={setViewPreviewTab} />
                        <button
                          type="button"
                          onClick={() => exportGovtInvoiceExcelFromBilling(selectedBilling)}
                          className="flex items-center gap-1.5 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
                        >
                          <FileSpreadsheet size={14} /> Download Excel
                        </button>
                        <button
                          type="button"
                          onClick={handleViewExportPdf}
                          disabled={exportingViewPdf}
                          className="flex items-center gap-1.5 bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:opacity-50"
                        >
                          <FileText size={14} />
                          {exportingViewPdf ? "Generating PDF..." : "Download PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={closePreviewModal}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                          aria-label="Close preview"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-5">
                      <div ref={viewInvoicePreviewRef}>
                        {viewActiveLineItems.length > 0 ? (
                          <GovtInvoicePreview
                            lineItems={viewActiveLineItems}
                            block={selectedBilling.block}
                            district={selectedBilling.district}
                            monthKey={selectedBilling.monthKey}
                            financialYear={selectedBilling.financialYear}
                            defaultDays={selectedBilling.cleaningDays || STANDARD_MONTH_DAYS}
                            unitRate={viewActiveUnitRate}
                            readOnly
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-400">
                            No {viewPreviewTab === "elementary" ? "elementary" : "secondary / high"} schools in this saved invoice.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
}
