import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, ShieldAlert, UserRound } from "lucide-react";
import { apiUrl } from "../api";
import { parseIdCardFromVerifyParam } from "../components/id-card/verify-url";

export interface IdCardVerifyResult {
  verified: boolean;
  idCard: string;
  employeeCode: string;
  name: string;
  designation: string;
  dob: string;
  issueDate: string;
  expiryDate: string;
  location: string;
  status: "active" | "exited";
  exitDate?: string;
  companyName: string;
  companyPhone?: string;
  hasPhoto: boolean;
}

function idCardPhotoUrl(idCard: string): string {
  return apiUrl(`/api/employees/id-card/${encodeURIComponent(idCard)}/photo`);
}

export default function EmployeeVerifyPage({ idOverride }: { idOverride?: string } = {}) {
  const { idNo: routeIdNo = "" } = useParams<{ idNo: string }>();
  const idNo = idOverride ?? parseIdCardFromVerifyParam(routeIdNo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<IdCardVerifyResult | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setRecord(null);
      setPhotoFailed(false);

      const trimmed = idNo.trim();
      if (!trimmed) {
        setError("No ID card number was provided.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          apiUrl(`/api/employees/id-card/${encodeURIComponent(trimmed)}/verify`),
        );
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "This ID card could not be verified. It may be invalid or no longer active."
              : "Unable to verify this ID card right now.",
          );
        }
        const payload = (await res.json()) as IdCardVerifyResult;
        if (!cancelled) {
          setRecord(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Verification failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [idNo]);

  const statusLabel = useMemo(() => {
    if (!record) return "";
    return record.status === "exited" ? "Exited" : "Active";
  }, [record]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full filter blur-3xl opacity-50 -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full filter blur-3xl opacity-50 -ml-20 -mb-20" />

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-10">
        <div className="p-8 border-b border-slate-100 bg-[#fbfbfb] text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff791a] to-[#ff981a] flex items-center justify-center text-white font-black text-2xl shadow-md transform rotate-12">
              F
            </div>
            <div className="text-left leading-none">
              <span className="text-slate-800 font-extrabold text-xl tracking-tight block">
                Flex <span className="text-[#ff791a]">HRM</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
                Employee ID Verification
              </span>
            </div>
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            ID Card Verification
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Scan result for ID No.{" "}
            <span className="font-mono font-semibold text-slate-600">{idNo || "—"}</span>
          </p>
        </div>

        <div className="p-8">
          {loading ? (
            <p className="text-sm text-slate-500 text-center">Verifying ID card…</p>
          ) : error ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-center">
              <ShieldAlert className="mx-auto mb-2 text-rose-500" size={28} />
              <p className="text-sm font-semibold text-rose-800">{error}</p>
            </div>
          ) : record ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <BadgeCheck className="shrink-0 text-emerald-600" size={28} />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Verified Employee</p>
                  <p className="text-xs text-emerald-700">
                    Issued by {record.companyName}
                    {record.companyPhone ? ` · ${record.companyPhone}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {record.hasPhoto && !photoFailed ? (
                    <img
                      src={idCardPhotoUrl(record.idCard)}
                      alt={record.name}
                      className="w-full h-full object-cover"
                      onError={() => setPhotoFailed(true)}
                    />
                  ) : (
                    <UserRound className="text-slate-400" size={32} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-slate-900 truncate">{record.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{record.employeeCode}</p>
                  <span
                    className={`inline-flex mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      record.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Field label="ID No." value={record.idCard} mono />
                <Field label="Designation" value={record.designation} />
                <Field label="Date of Birth" value={record.dob} />
                <Field label="Location" value={record.location} />
                <Field label="Issue Date" value={record.issueDate} />
                <Field label="Expiry Date" value={record.expiryDate} />
                {record.exitDate ? <Field label="Exit Date" value={record.exitDate} /> : null}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}
