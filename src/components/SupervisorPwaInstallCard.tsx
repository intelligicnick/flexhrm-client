import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Share2, Smartphone } from "lucide-react";
import { getSupervisorLoginUrl, getSupervisorPwaManifestUrl } from "./id-card/verify-url";

export default function SupervisorPwaInstallCard() {
  const installUrl = getSupervisorLoginUrl();
  const manifestUrl = getSupervisorPwaManifestUrl();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "manifest" | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(installUrl, {
      width: 160,
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
    <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-slate-50 p-4 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff791a] text-white shadow-sm">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Supervisor App (PWA)</h3>
              <p className="text-[11px] text-slate-500">
                Installable mobile app for supervisor login only — visits, requests, and commitments.
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-orange-100 bg-white/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Install link</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a
                href={installUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-xs font-semibold text-[#ff791a] hover:underline"
              >
                {installUrl}
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={() => void copyText(installUrl, "link")}
                className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                {copied === "link" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => void shareInstallLink()}
                className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                <Share2 size={12} />
                Share
              </button>
            </div>
          </div>

          <ol className="mt-3 space-y-1.5 text-[11px] text-slate-600">
            <li>
              <span className="font-bold text-slate-700">Android:</span> Open the link in Chrome, tap menu, then
              &quot;Install app&quot; or &quot;Add to Home screen&quot;.
            </li>
            <li>
              <span className="font-bold text-slate-700">iPhone:</span> Open in Safari, tap Share, then &quot;Add to
              Home Screen&quot;.
            </li>
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={manifestUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-semibold text-slate-500 hover:text-[#ff791a] hover:underline"
            >
              View app manifest
            </a>
            <button
              type="button"
              onClick={() => void copyText(manifestUrl, "manifest")}
              className="text-[10px] font-semibold text-slate-500 hover:text-[#ff791a] cursor-pointer"
            >
              {copied === "manifest" ? "Manifest copied" : "Copy manifest URL"}
            </button>
          </div>

          {shareError && <p className="mt-2 text-[11px] font-semibold text-rose-600">{shareError}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Scan to install</p>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code for supervisor app install link"
              className="h-40 w-40 rounded-lg border border-slate-100"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-400">
              Generating QR…
            </div>
          )}
          <button
            type="button"
            onClick={downloadQr}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <Download size={12} />
            Download QR
          </button>
        </div>
      </div>
    </section>
  );
}
