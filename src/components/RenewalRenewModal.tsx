import React, { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Renewal, RenewalPeriod } from "../types";
import { computeNextExpiryDate, renewalPeriodLabel } from "../lib/renewal-helpers";
import { formatAppDate } from "../lib/date-helpers";
import { DateInput } from "./ui/DateInput";

interface RenewalRenewModalProps {
  item: Renewal;
  subtypeLabel: string;
  readOnly?: boolean;
  onClose: () => void;
  onRenew: (payload: {
    issuedOn: string;
    expiresOn: string;
    renewalPeriod: RenewalPeriod;
  }) => Promise<void>;
}

export default function RenewalRenewModal({
  item,
  subtypeLabel,
  readOnly = false,
  onClose,
  onRenew,
}: RenewalRenewModalProps) {
  const currentExpiry = item.expiresOn || item.expiryDate || "";
  const [renewalPeriod, setRenewalPeriod] = useState<RenewalPeriod>(
    item.renewalPeriod === "monthly" ? "monthly" : "yearly",
  );
  const [nextExpiry, setNextExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = currentExpiry || new Date().toISOString().slice(0, 10);
    setNextExpiry(computeNextExpiryDate(base, renewalPeriod));
  }, [currentExpiry, renewalPeriod]);

  const handleAutoFill = () => {
    const base = currentExpiry || new Date().toISOString().slice(0, 10);
    setNextExpiry(computeNextExpiryDate(base, renewalPeriod));
  };

  const handleSave = async () => {
    if (!nextExpiry.trim()) {
      setError("Next expiry date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const issuedOn = currentExpiry || new Date().toISOString().slice(0, 10);
      await onRenew({ issuedOn, expiresOn: nextExpiry, renewalPeriod });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to renew.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-[#ff791a]" />
            <h3 className="font-bold text-slate-800">Renew — {subtypeLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <p className="text-slate-500">
              <span className="font-bold text-slate-700">Record:</span> {item.title || "—"}
            </p>
            <p className="text-slate-500">
              <span className="font-bold text-slate-700">Current expiry:</span>{" "}
              {currentExpiry ? formatAppDate(currentExpiry) : "—"}
            </p>
          </div>

          <label className="block text-xs font-bold text-slate-600">
            Renewal Period
            <select
              value={renewalPeriod}
              onChange={(e) => setRenewalPeriod(e.target.value as RenewalPeriod)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="monthly">Monthly Renewal</option>
              <option value="yearly">Yearly Renewal</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Next Expiry Date
            <div className="mt-1 flex gap-2">
              <DateInput
                value={nextExpiry}
                onChange={(e) => setNextExpiry(e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleAutoFill}
                className="px-3 py-2 text-[11px] font-bold text-[#ff791a] bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 shrink-0"
              >
                Auto
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-normal">
              Auto-calculated: {renewalPeriodLabel(renewalPeriod)} from current expiry. Edit if needed.
            </p>
          </label>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
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
              <RefreshCw size={14} />
              {saving ? "Saving..." : "Confirm Renewal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
