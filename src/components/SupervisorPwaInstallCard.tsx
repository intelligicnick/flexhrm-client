import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, ChevronDown, Copy, Download, ExternalLink, Share2, Smartphone } from "lucide-react";
import { getSupervisorLoginUrl, getSupervisorPwaManifestUrl } from "./id-card/verify-url";
import { FIELD_TEAM_APK_DOWNLOAD_URL } from "../lib/client-downloads";

export default function SupervisorPwaInstallCard() {
  const installUrl = getSupervisorLoginUrl();
  const manifestUrl = getSupervisorPwaManifestUrl();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "manifest" | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(installUrl, {
      width: 128,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [installUrl]);

  const copyText = async (text: string, kind: "link" | "manifest") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt(kind === "link" ? "Copy supervisor app install link:" : "Copy manifest URL:", text);
    }
  };

  const shareInstallLink = async () => {
    setShareError(null);
    const shareData = {
      title: "Flex HRM Field Team App",
      text: "Install the Flex HRM supervisor app on your phone. Open this link in Chrome or Safari, then add to home screen.",
      url: installUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await copyText(installUrl, "link");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setShareError("Could not share. Copy the link instead.");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "flexhrm-supervisor-app-qr.png";
    anchor.click();
  };

  return (
    <details className="group rounded-lg border border-slate-200 bg-slate-50/80">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ff791a] text-white">
          <Smartphone size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-slate-800">Field Team Android app</span>
          <span className="ml-2 hidden text-[11px] text-slate-500 sm:inline">
            Install the APK for supervisors — visits, GPS photos, blocked-app security
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            void copyText(installUrl, "link");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
        >
          {copied === "link" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
          {copied === "link" ? "Copied" : "Copy"}
        </button>
        <ChevronDown
          size={14}
          className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={FIELD_TEAM_APK_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[#ff791a] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#e66d17]"
              >
                <Download size={11} />
                Download Field Team APK
              </a>
              <a
                href={installUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 break-all text-[11px] font-semibold text-[#ff791a] hover:underline"
              >
                Supervisor login (web)
                <ExternalLink size={11} className="shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => void shareInstallLink()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
              >
                <Share2 size={11} />
                Share
              </button>
            </div>

            <ul className="space-y-1 text-[10px] leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-slate-700">Android:</span> Download and install the Field Team APK
                (required for GPS, camera, and security checks)
              </li>
              <li>
                <span className="font-semibold text-slate-700">Browser:</span> Limited — use the native app for field work
              </li>
            </ul>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={manifestUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-semibold text-slate-500 hover:text-[#ff791a] hover:underline"
              >
                View manifest
              </a>
              <button
                type="button"
                onClick={() => void copyText(manifestUrl, "manifest")}
                className="text-[10px] font-semibold text-slate-500 hover:text-[#ff791a] cursor-pointer"
              >
                {copied === "manifest" ? "Manifest copied" : "Copy manifest URL"}
              </button>
            </div>

            {shareError && <p className="text-[10px] font-semibold text-rose-600">{shareError}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white p-2 sm:flex-col">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code for supervisor app install link"
                className="h-28 w-28 rounded border border-slate-100"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                Generating…
              </div>
            )}
            <button
              type="button"
              onClick={downloadQr}
              disabled={!qrDataUrl}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 cursor-pointer disabled:opacity-50"
            >
              <Download size={11} />
              QR
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
