import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  School,
  MapPin,
  Users,
  IndianRupee,
  CreditCard,
  Notebook,
} from "lucide-react";
import { SchoolBlock, SchoolDistrict, SchoolWork, SCHOOL_CATEGORIES } from "../types";
import { defaultRatesForCategory } from "../lib/school-work-helpers";

interface SchoolWorkFormModalProps {
  school?: SchoolWork | null;
  districts?: SchoolDistrict[];
  blocks?: SchoolBlock[];
  onClose: () => void;
  onSave: (data: Partial<SchoolWork>) => Promise<boolean>;
}

type FormTab = "school" | "contacts" | "pay" | "banking" | "notes";

type SchoolWorkScalarKey = {
  [K in keyof SchoolWork]: SchoolWork[K] extends string | number ? K : never;
}[keyof SchoolWork];

const FORM_TABS: { id: FormTab; label: string; icon: React.ReactNode }[] = [
  { id: "school", label: "School & Location", icon: <School size={14} /> },
  { id: "contacts", label: "Contacts", icon: <Users size={14} /> },
  { id: "pay", label: "Rates & Pay", icon: <IndianRupee size={14} /> },
  { id: "banking", label: "Banking", icon: <CreditCard size={14} /> },
  { id: "notes", label: "Notes", icon: <Notebook size={14} /> },
];

const INPUT_CLASS =
  "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition";
const LABEL_CLASS = "text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5";

export default function SchoolWorkFormModal({
  school,
  districts = [],
  blocks = [],
  onClose,
  onSave,
}: SchoolWorkFormModalProps) {
  const isEdit = !!school;
  const [activeTab, setActiveTab] = useState<FormTab>("school");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<SchoolWork>>({
    udise: school?.udise || "",
    schoolName: school?.schoolName || "",
    schoolCategory: school?.schoolCategory || "",
    headmasterName: school?.headmasterName || "",
    headmasterNumber: school?.headmasterNumber || "",
    sweeperName: school?.sweeperName || "",
    accountHolderName: school?.accountHolderName || "",
    accountNumber: school?.accountNumber || "",
    ifscCode: school?.ifscCode || "",
    paymentMethod: school?.paymentMethod || "",
    noOfToilets: school?.noOfToilets ?? 0,
    govtUnitRate: school?.govtUnitRate ?? 0,
    partnerMonthlyPay: school?.partnerMonthlyPay ?? 0,
    rates: school?.rates ?? 0,
    rateExplanation: school?.rateExplanation || "",
    block: school?.block || "",
    district: school?.district || "",
    materialCost: school?.materialCost ?? 0,
    remarks: school?.remarks || "",
    ...(school?.id ? { id: school.id, srNo: school.srNo } : {}),
  });

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.name === formData.district) || null,
    [districts, formData.district],
  );

  const blockOptions = useMemo(() => {
    if (selectedDistrict) {
      return blocks
        .filter((b) => b.districtId === selectedDistrict.id)
        .map((b) => b.name)
        .sort();
    }
    return Array.from(new Set(blocks.map((b) => b.name))).sort();
  }, [blocks, selectedDistrict]);

  const districtOptions = useMemo(() => {
    const configured = districts.map((d) => d.name);
    if (formData.district && !configured.includes(formData.district)) {
      configured.push(formData.district);
    }
    return configured.sort();
  }, [districts, formData.district]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const update = (key: keyof SchoolWork, value: string | number) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "district") {
        next.block = "";
      }
      if (key === "schoolCategory") {
        const defaults = defaultRatesForCategory(String(value));
        if (!prev.govtUnitRate) next.govtUnitRate = defaults.govtUnitRate;
        if (!prev.partnerMonthlyPay) next.partnerMonthlyPay = defaults.partnerMonthlyPay;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const defaults = defaultRatesForCategory(formData.schoolCategory || "");
    const payload = {
      ...formData,
      govtUnitRate: Number(formData.govtUnitRate) || defaults.govtUnitRate,
      partnerMonthlyPay: Number(formData.partnerMonthlyPay) || defaults.partnerMonthlyPay,
      rates: Number(formData.partnerMonthlyPay) || Number(formData.rates) || defaults.partnerMonthlyPay,
    };
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  const renderTextInput = (
    key: SchoolWorkScalarKey,
    label: string,
    type: "text" | "number" = "text",
    placeholder?: string,
  ) => (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type={type}
        value={formData[key] ?? (type === "number" ? 0 : "")}
        onChange={(e) => update(key, type === "number" ? Number(e.target.value) || 0 : e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" id="school-work-form-modal">
      <div
        onClick={handleBackdropClick}
        className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative flex h-full items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-full max-h-[92vh] w-full max-w-4xl min-h-0 cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 px-5 pb-4 pt-5 text-white sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.18),transparent_55%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-200/90">
                  {isEdit ? "Edit school record" : "Add school record"}
                </p>
                <h2 className="mt-0.5 truncate text-lg font-extrabold tracking-tight sm:text-xl">
                  {isEdit ? formData.schoolName || school?.schoolName : "Register New School"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-300">
                  District and block are managed under Employees → Configuration
                </p>
                {isEdit && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-200">
                      {formData.udise || school?.udise}
                    </span>
                    {formData.district && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                        <MapPin size={10} />
                        {formData.district}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white shrink-0 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 sm:px-4">
            <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FORM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    activeTab === tab.id
                      ? "bg-[#ff791a] text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:p-5">
              {activeTab === "school" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderTextInput("schoolName", "School Name")}
                  {renderTextInput("udise", "UDISE")}
                  <div>
                    <label className={LABEL_CLASS}>School Category</label>
                    <select
                      value={formData.schoolCategory || ""}
                      onChange={(e) => update("schoolCategory", e.target.value)}
                      className={`${INPUT_CLASS} cursor-pointer`}
                    >
                      <option value="">Select category</option>
                      {SCHOOL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>District</label>
                    <select
                      value={formData.district || ""}
                      onChange={(e) => update("district", e.target.value)}
                      className={`${INPUT_CLASS} cursor-pointer`}
                    >
                      <option value="">Select district</option>
                      {districtOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Block</label>
                    <select
                      value={formData.block || ""}
                      onChange={(e) => update("block", e.target.value)}
                      disabled={!formData.district}
                      className={`${INPUT_CLASS} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="">Select block</option>
                      {blockOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "contacts" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderTextInput("headmasterName", "Headmaster Name")}
                  {renderTextInput("headmasterNumber", "Headmaster Number")}
                  {renderTextInput("sweeperName", "Cleaning Partner")}
                </div>
              )}

              {activeTab === "pay" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {renderTextInput("noOfToilets", "No of Toilets", "number")}
                    {renderTextInput("paymentMethod", "Payment Method")}
                    {renderTextInput("govtUnitRate", "Govt Unit Rate (₹/toilet/day)", "number")}
                    {renderTextInput("partnerMonthlyPay", "Partner Monthly Pay (₹)", "number")}
                    {renderTextInput("materialCost", "Material Cost (₹)", "number")}
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Explanation for Rate</label>
                    <textarea
                      value={formData.rateExplanation || ""}
                      onChange={(e) => update("rateExplanation", e.target.value)}
                      rows={3}
                      className={`${INPUT_CLASS} resize-none`}
                    />
                  </div>
                </div>
              )}

              {activeTab === "banking" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderTextInput("accountHolderName", "Account Holder Name")}
                  {renderTextInput("accountNumber", "Account Number")}
                  {renderTextInput("ifscCode", "IFSC Code")}
                </div>
              )}

              {activeTab === "notes" && (
                <div>
                  <label className={LABEL_CLASS}>Remarks</label>
                  <textarea
                    value={formData.remarks || ""}
                    onChange={(e) => update("remarks", e.target.value)}
                    rows={5}
                    placeholder="Any additional notes about this school..."
                    className={`${INPUT_CLASS} resize-none`}
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                Tab: {FORM_TABS.find((t) => t.id === activeTab)?.label}
              </p>
              <div className="flex justify-end gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Check size={14} /> {saving ? "Saving..." : isEdit ? "Save Changes" : "Add School"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
