import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, Puzzle, RefreshCw, X } from "lucide-react";
import { parseApiError } from "../api";
import { getApiBase } from "../env";

const GEM_SELLER_BIDS_URL = "https://bidplus.gem.gov.in/seller-bids";

interface ConnectionCodeResponse {
  success: boolean;
  code: string;
  expiresAt: string;
  expiresInSeconds: number;
}

interface ExtensionIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  onCopied?: (message: string) => void;
}

function formatCountdown(expiresAt: string): string {
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extensionApiUrl(): string {
  return getApiBase() || window.location.origin;
}

export function ExtensionIntegrationModal({ open, onClose, onCopied }: ExtensionIntegrationModalProps) {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");
  const apiUrl = extensionApiUrl();
  const onCopiedRef = useRef(onCopied);
  onCopiedRef.current = onCopied;

  const generateCode = useCallback(async (notify = false) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("hrms_session_token");
      const response = await fetch("/api/smart-capture/connection-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ flexhrmUrl: extensionApiUrl() }),
      });
      if (!response.ok) {
        throw await parseApiError(response, "Could not generate connection code.");
      }
      const data = (await response.json()) as ConnectionCodeResponse;
      setCode(data.code);
      setExpiresAt(data.expiresAt);
      if (notify) {
        onCopiedRef.current?.("Extension connection code generated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate connection code.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setCode("");
      setExpiresAt("");
      setError("");
      return;
    }
    void generateCode();
  }, [open, generateCode]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setCountdown(formatCountdown(expiresAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      onCopiedRef.current?.("Connection code copied to clipboard.");
    } catch {
      onCopiedRef.current?.("Could not copy — select and copy the code manually.");
    }
  };

  const copyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(apiUrl);
      onCopiedRef.current?.("API URL copied to clipboard.");
    } catch {
      onCopiedRef.current?.("Could not copy — select and copy the API URL manually.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-labelledby="extension-integration-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e293b] text-[#ff791a] flex items-center justify-center font-bold text-xs">
              FH
            </div>
            <div>
              <h2 id="extension-integration-title" className="text-sm font-bold text-slate-900">
                FlexHRM Browser Extension
              </h2>
              <p className="text-[10px] text-slate-500">Connect Smart Capture to your account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm text-slate-600">
          <ol className="list-decimal pl-4 space-y-1.5 text-xs">
            <li>Install the FlexHRM Smart Capture extension in Chrome.</li>
            <li>
              Open extension Settings, paste the <strong>API URL</strong> below (not the login page URL),
              then enter your connection code.
            </li>
            <li>
              Open{" "}
              <a
                href={GEM_SELLER_BIDS_URL}
                target="_blank"
                rel="noreferrer"
                className="text-[#ff791a] font-semibold hover:underline"
              >
                GeM Seller Bids
              </a>{" "}
              to capture tenders.
            </li>
          </ol>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Extension API URL
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-800 break-all">
                {apiUrl}
              </div>
              <button
                type="button"
                onClick={() => void copyApiUrl()}
                className="shrink-0 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                title="Copy API URL"
              >
                <Copy size={16} className="text-slate-600" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Connection Code
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2.5 font-mono text-lg font-bold tracking-widest text-slate-900 text-center">
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    Generating…
                  </span>
                ) : (
                  code || "—"
                )}
              </div>
              <button
                type="button"
                onClick={() => void copyCode()}
                disabled={!code || loading}
                className="shrink-0 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
                title="Copy code"
              >
                <Copy size={16} className="text-slate-600" />
              </button>
              <button
                type="button"
                onClick={() => void generateCode(true)}
                disabled={loading}
                className="shrink-0 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
                title="Generate new code"
              >
                <RefreshCw size={16} className={`text-slate-600 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {expiresAt && !loading && (
              <p className="mt-2 text-[11px] text-slate-500">
                Expires in <span className="font-semibold text-slate-700">{countdown}</span> — one-time use
              </p>
            )}
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </div>

          <p className="text-[11px] text-slate-500">
            The extension only activates on the GeM Seller Bids page. Your session token is exchanged
            securely and stored encrypted in the extension.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExtensionProfileMenuItemProps {
  onClick: () => void;
}

export function ExtensionProfileMenuItem({ onClick }: ExtensionProfileMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
      id="extension-integration-menu-btn"
    >
      <Puzzle size={14} className="text-[#ff791a]" />
      Browser Extension
    </button>
  );
}
