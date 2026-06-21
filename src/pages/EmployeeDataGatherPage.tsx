import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  FileUp,
  KeyRound,
  Link2Off,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  clearGatherSession,
  fetchDataGatherForm,
  fetchDataGatherLinkStatus,
  loadGatherSession,
  saveGatherSession,
  submitDataGatherForm,
  SubmitDataGatherDocumentPayload,
  verifyDataGatherOtp,
  type DataGatherForm,
  type DataGatherLinkStatus,
} from "../lib/employee-data-gather";
import {
  compressImageDataUrl,
  isImageFile,
  isPdfFile,
  qualityFromPercent,
  readFileAsDataUrl,
  readPdfAsDataUrl,
} from "../lib/image-compress";
import { compressPdfDataUrl } from "../lib/pdf-process";

type Step = "loading" | "otp" | "form" | "success" | "dead";

async function fileToPayload(
  file: File,
  label: string,
): Promise<SubmitDataGatherDocumentPayload> {
  const originalSizeBytes = file.size;
  const defaultQuality = qualityFromPercent(75);

  if (isImageFile(file)) {
    const dataUrl = await readFileAsDataUrl(file);
    const compressed = await compressImageDataUrl(
      dataUrl,
      defaultQuality,
      1600,
      1600,
      originalSizeBytes,
    );
    const fileBase64 = compressed.dataUrl.includes(",")
      ? compressed.dataUrl.split(",")[1]!
      : compressed.dataUrl;
    return {
      label,
      fileBase64,
      mimeType: compressed.mimeType,
      originalSizeBytes: compressed.originalSizeBytes,
      storedSizeBytes: compressed.compressedSizeBytes,
    };
  }

  if (isPdfFile(file)) {
    const pdfData = await readPdfAsDataUrl(file);
    const compressed = await compressPdfDataUrl(
      pdfData.dataUrl,
      75,
      1600,
      1600,
      originalSizeBytes,
    );
    const fileBase64 = compressed.dataUrl.includes(",")
      ? compressed.dataUrl.split(",")[1]!
      : compressed.dataUrl;
    return {
      label,
      fileBase64,
      mimeType: "application/pdf",
      originalSizeBytes: compressed.originalSizeBytes,
      storedSizeBytes: compressed.compressedSizeBytes,
      quality: compressed.quality,
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const fileBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
  return {
    label,
    fileBase64,
    mimeType: file.type || "application/octet-stream",
    originalSizeBytes,
    storedSizeBytes: originalSizeBytes,
  };
}

export default function EmployeeDataGatherPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [form, setForm] = useState<DataGatherForm | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [deadLink, setDeadLink] = useState<DataGatherLinkStatus | null>(null);

  const markLinkDead = useCallback((status: DataGatherLinkStatus) => {
    clearGatherSession(token);
    setSessionToken(null);
    setDeadLink(status);
    setStep("dead");
    setError(null);
  }, [token]);

  const loadForm = useCallback(
    async (session: string) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchDataGatherForm(token, session);
        setForm(payload);
        setFieldValues({});
        setDocFiles(
          Object.fromEntries(payload.missingDocuments.map((label) => [label, null])),
        );
        setStep("form");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load form.";
        try {
          const status = await fetchDataGatherLinkStatus(token);
          if (!status.usable) {
            markLinkDead(status);
            return;
          }
        } catch {
          /* fall through to generic error */
        }
        setError(message);
        clearGatherSession(token);
        setSessionToken(null);
        setStep("otp");
      } finally {
        setLoading(false);
      }
    },
    [token, markLinkDead],
  );

  useEffect(() => {
    if (!token.trim()) {
      setDeadLink({
        usable: false,
        status: "invalid",
        message: "Invalid data collection link.",
      });
      setStep("dead");
      return;
    }

    let cancelled = false;

    const init = async () => {
      setStep("loading");
      setError(null);
      try {
        const status = await fetchDataGatherLinkStatus(token);
        if (cancelled) return;

        if (!status.usable) {
          markLinkDead(status);
          return;
        }

        const saved = loadGatherSession(token);
        if (saved) {
          setSessionToken(saved);
          await loadForm(saved);
          return;
        }

        setStep("otp");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load link.");
        setStep("otp");
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [token, loadForm, markLinkDead]);

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await verifyDataGatherOtp(token, otp.trim());
      saveGatherSession(token, result.sessionToken);
      setSessionToken(result.sessionToken);
      setOtp("");
      await loadForm(result.sessionToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed.";
      try {
        const status = await fetchDataGatherLinkStatus(token);
        if (!status.usable) {
          markLinkDead(status);
          return;
        }
      } catch {
        /* fall through */
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filledFieldCount = useMemo(
    () => Object.values(fieldValues).filter((value) => value.trim()).length,
    [fieldValues],
  );

  const uploadedDocCount = useMemo(
    () => Object.values(docFiles).filter(Boolean).length,
    [docFiles],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionToken || !form) return;

    setLoading(true);
    setError(null);
    try {
      const fieldUpdates: Record<string, string> = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value.trim()) fieldUpdates[key] = value.trim();
      }

      const documents: SubmitDataGatherDocumentPayload[] = [];
      for (const label of form.missingDocuments) {
        const file = docFiles[label];
        if (file) {
          documents.push(await fileToPayload(file, label));
        }
      }

      const result = await submitDataGatherForm(
        token,
        sessionToken,
        fieldUpdates,
        documents,
      );
      clearGatherSession(token);
      setSuccessMessage(result.message);
      setDeadLink({
        usable: false,
        status: "submitted",
        message:
          "This link has already been used and is no longer active. Contact HR if you need to update your details again.",
      });
      setStep("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed.";
      try {
        const status = await fetchDataGatherLinkStatus(token);
        if (!status.usable) {
          markLinkDead(status);
          return;
        }
      } catch {
        /* fall through */
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-orange-50 via-white to-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff791a] text-white shadow-lg">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Employee Profile Update</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete only the missing details requested by your HR team.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
              <Loader2 size={24} className="animate-spin text-[#ff791a]" />
              <p className="text-sm">Checking link…</p>
            </div>
          )}

          {error && step !== "dead" && step !== "loading" && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {step === "dead" && deadLink && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Link2Off size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Link Unavailable</h2>
              {deadLink.employeeName && (
                <p className="mt-1 text-sm text-slate-500">{deadLink.employeeName}</p>
              )}
              <p className="mt-3 text-sm text-slate-600">{deadLink.message}</p>
            </div>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3 text-sm text-amber-900">
                Enter the one-time password shared with you by HR to unlock this secure form. This
                link expires if unused within 2 days.
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <KeyRound size={12} />
                  One-Time Password
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit OTP"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg font-mono tracking-[0.35em] text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <button
                type="submit"
                disabled={loading || otp.trim().length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff791a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#e56a12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Unlock Form
              </button>
            </form>
          )}

          {step === "form" && form && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-800">{form.employeeName}</p>
                <p className="text-xs text-slate-500">Employee code: {form.employeeCode}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Link expires {new Date(form.expiresAt).toLocaleString("en-IN")}
                </p>
              </div>

              {form.fields.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Missing Profile Fields
                  </h2>
                  {form.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">
                        {field.label}
                      </span>
                      {field.inputType === "select" ? (
                        <select
                          value={fieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.inputType === "textarea" ? (
                        <textarea
                          rows={3}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                        />
                      ) : (
                        <input
                          type={field.inputType === "date" ? "date" : "text"}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                        />
                      )}
                    </label>
                  ))}
                </section>
              )}

              {form.missingDocuments.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Missing Documents
                  </h2>
                  {form.missingDocuments.map((label) => (
                    <label
                      key={label}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 transition hover:border-[#ff791a]/40 hover:bg-orange-50/30"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-500">
                          {docFiles[label]?.name ?? "Tap to upload image or PDF"}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#ff791a] shadow-xs">
                        {docFiles[label] ? <FileUp size={16} /> : <Upload size={16} />}
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDocFiles((prev) => ({ ...prev, [label]: file }));
                        }}
                      />
                    </label>
                  ))}
                </section>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                Your submission will be reviewed by an administrator before it is posted to your
                employee profile.
              </div>

              <button
                type="submit"
                disabled={loading || (filledFieldCount === 0 && uploadedDocCount === 0)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff791a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#e56a12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Submit for Approval
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Submitted Successfully</h2>
              <p className="mt-2 text-sm text-slate-600">{successMessage}</p>
              <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                This link is now permanently closed. You cannot reopen or resubmit using the same
                URL.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
