import React, { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { CreateRenewalInput, Renewal, RenewalCategory } from "../types";
import { uploadRenewalDocumentsBulk } from "../lib/renewals";
import { DateInput } from "./ui/DateInput";
import RenewalDocumentsPanel, {
  type RenewalDocumentsPanelHandle,
} from "./RenewalDocumentsPanel";

interface RenewalBulkUploadModalProps {
  category: RenewalCategory;
  tabLabel: string;
  renewals: Renewal[];
  subtypeLabels: Record<string, string>;
  readOnly?: boolean;
  onCreate: (payload: CreateRenewalInput) => Promise<Renewal>;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

type TargetMode = "existing" | "new";

export default function RenewalBulkUploadModal({
  category,
  tabLabel,
  renewals,
  subtypeLabels,
  readOnly = false,
  onCreate,
  onClose,
  onComplete,
}: RenewalBulkUploadModalProps) {
  const docsRef = useRef<RenewalDocumentsPanelHandle>(null);
  const [mode, setMode] = useState<TargetMode>(renewals.length > 0 ? "existing" : "new");
  const [selectedId, setSelectedId] = useState(renewals[0]?.id ?? "");
  const [recordSearch, setRecordSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstSubType = Object.keys(subtypeLabels)[0] || "";
  const [form, setForm] = useState<CreateRenewalInput>({
    category,
    subType: firstSubType,
    title: "",
    clientName: "",
    ownerType: "mine",
    amount: "",
    hasExpiry: true,
    issuedOn: "",
    expiresOn: "",
    renewalDate: "",
    expiryDate: "",
    notes: "",
    entryDate: new Date().toISOString().slice(0, 10),
    renewalPeriod: "yearly",
  });

  const filteredRecords = renewals.filter((r) => {
    const q = recordSearch.trim().toLowerCase();
    if (!q) return true;
    const label = subtypeLabels[r.subType] || r.subType;
    return `${r.title} ${r.clientName} ${label}`.toLowerCase().includes(q);
  });

  const selectedRenewal = renewals.find((r) => r.id === selectedId);
  const activeRenewalId = mode === "existing" ? selectedId : null;
  const defaultDocLabel =
    mode === "existing" && selectedRenewal
      ? subtypeLabels[selectedRenewal.subType] || selectedRenewal.subType
      : subtypeLabels[form.subType] || form.subType || tabLabel;

  const handleSave = async () => {
    const pending = docsRef.current?.getPendingUploads() ?? [];
    if (pending.length === 0) {
      setError("Add at least one file to upload.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let renewalId = activeRenewalId;
      if (mode === "new") {
        if (category === "car_papers" && !form.title.trim()) {
          setError("Vehicle registration is required for new records.");
          setSaving(false);
          return;
        }
        if (category === "it_renewals" && !form.title.trim()) {
          setError("Name is required for new records.");
          setSaving(false);
          return;
        }
        const payload: CreateRenewalInput = {
          ...form,
          issuedOn: form.issuedOn,
          expiresOn: form.hasExpiry ? form.expiresOn : "",
          renewalDate: form.issuedOn,
          expiryDate: form.hasExpiry ? form.expiresOn : "",
        };
        const created = await onCreate(payload);
        renewalId = created.id;
      } else if (!renewalId) {
        setError("Select a renewal record to upload documents to.");
        setSaving(false);
        return;
      }

      await uploadRenewalDocumentsBulk(renewalId!, pending);
      docsRef.current?.clearPending();
      await onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk upload failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-[#ff791a]" />
            <h3 className="font-bold text-slate-800">Upload — {tabLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={renewals.length === 0}
              onClick={() => setMode("existing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                mode === "existing"
                  ? "bg-orange-50 border-[#ff791a] text-[#ff791a]"
                  : "bg-white border-slate-200 text-slate-600"
              } disabled:opacity-40`}
            >
              Existing record
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                mode === "new"
                  ? "bg-orange-50 border-[#ff791a] text-[#ff791a]"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              New record + upload
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <input
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                placeholder="Filter records..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
              <label className="block text-xs font-bold text-slate-600">
                Select renewal record
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  {filteredRecords.length === 0 ? (
                    <option value="">No matching records</option>
                  ) : (
                    filteredRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {subtypeLabels[r.subType] || r.subType}
                        {r.title ? ` — ${r.title}` : ""}
                        {r.clientName ? ` (${r.clientName})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
                Type
                <select
                  value={form.subType}
                  onChange={(e) => setForm((p) => ({ ...p, subType: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {Object.entries(subtypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
                {category === "car_papers" ? "Vehicle Registration" : "Name / Details"}
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Issued On
                <DateInput
                  value={form.issuedOn}
                  onChange={(e) => setForm((p) => ({ ...p, issuedOn: e.target.value }))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Expires On
                <DateInput
                  value={form.expiresOn}
                  onChange={(e) => setForm((p) => ({ ...p, expiresOn: e.target.value }))}
                  className="mt-1 w-full"
                  disabled={!form.hasExpiry}
                />
              </label>
            </div>
          )}

          <RenewalDocumentsPanel
            key={`${mode}-${activeRenewalId ?? "new"}`}
            ref={docsRef}
            renewalId={mode === "existing" ? activeRenewalId : null}
            defaultLabel={defaultDocLabel}
            readOnly={readOnly}
            hideSaveAll
          />

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg disabled:opacity-60"
            >
              <Upload size={14} />
              {saving ? "Uploading..." : "Upload all files"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
