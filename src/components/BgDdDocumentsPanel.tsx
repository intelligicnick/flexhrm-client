import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eye, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { BgDdDocument } from "../types";
import { useAuthenticatedBlobUrl } from "../hooks/useAuthenticatedBlobUrl";
import {
  deleteBgDdDocument,
  fetchBgDdDocuments,
  getBgDdDocumentUrl,
  type UploadBgDdDocumentPayload,
} from "../lib/bg-dd";
import {
  compressImageDataUrl,
  formatFileSize,
  isImageFile,
  isPdfFile,
  qualityFromPercent,
  readFileAsDataUrl,
  readPdfAsDataUrl,
} from "../lib/image-compress";

export interface BgDdDocumentsPanelHandle {
  getPendingUploads: () => UploadBgDdDocumentPayload[];
  clearPending: () => void;
  hasPending: () => boolean;
}

interface BgDdDocumentsPanelProps {
  bgDdId?: string | null;
  readOnly?: boolean;
  hideSaveAll?: boolean;
  embedded?: boolean;
}

interface PendingUpload {
  id: string;
  fileName: string;
  label: string;
  previewUrl: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  quality: number;
  isCompressing: boolean;
}

function makePendingId(): string {
  return `bgddpending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dataUrlToPayloadBase64(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",").pop()!.trim() : dataUrl;
}

function SavedDocumentPreviewModal({
  bgDdId,
  document,
  onClose,
}: {
  bgDdId: string;
  document: BgDdDocument;
  onClose: () => void;
}) {
  const apiPath = getBgDdDocumentUrl(bgDdId, document.id);
  const blobUrl = useAuthenticatedBlobUrl(apiPath);
  const isPdf = document.mimeType === "application/pdf";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{document.label}</h3>
            <p className="text-[11px] text-slate-500">{formatFileSize(document.storedSizeBytes)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {!blobUrl ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Loading preview...
            </div>
          ) : isPdf ? (
            <iframe src={blobUrl} title={document.label} className="h-[70vh] w-full rounded-lg border bg-white" />
          ) : (
            <img src={blobUrl} alt={document.label} className="mx-auto max-h-[70vh] max-w-full rounded-lg border object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

const BgDdDocumentsPanel = forwardRef<BgDdDocumentsPanelHandle, BgDdDocumentsPanelProps>(
  function BgDdDocumentsPanel({ bgDdId, readOnly = false, embedded = false }, ref) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [savedDocs, setSavedDocs] = useState<BgDdDocument[]>([]);
    const [pending, setPending] = useState<PendingUpload[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<BgDdDocument | null>(null);

    const loadDocs = useCallback(async () => {
      if (!bgDdId) {
        setSavedDocs([]);
        return;
      }
      setLoading(true);
      try {
        setSavedDocs(await fetchBgDdDocuments(bgDdId));
      } catch {
        setSavedDocs([]);
      } finally {
        setLoading(false);
      }
    }, [bgDdId]);

    useEffect(() => {
      void loadDocs();
    }, [loadDocs]);

    useImperativeHandle(ref, () => ({
      getPendingUploads: () =>
        pending
          .filter((p) => !p.isCompressing)
          .map((p) => ({
            label: p.label,
            fileBase64: dataUrlToPayloadBase64(p.previewUrl),
            mimeType: p.mimeType,
            originalSizeBytes: p.originalSizeBytes,
            storedSizeBytes: p.compressedSizeBytes,
            quality: p.quality,
          })),
      clearPending: () => setPending([]),
      hasPending: () => pending.some((p) => !p.isCompressing),
    }));

    const handleFiles = async (files: FileList | null) => {
      if (!files?.length || readOnly) return;
      for (const file of Array.from(files)) {
        const id = makePendingId();
        const isImage = isImageFile(file);
        const isPdf = isPdfFile(file);
        if (!isImage && !isPdf) continue;

        setPending((prev) => [
          ...prev,
          {
            id,
            fileName: file.name,
            label: "BG Copy",
            previewUrl: "",
            mimeType: isPdf ? "application/pdf" : file.type || "image/jpeg",
            originalSizeBytes: file.size,
            compressedSizeBytes: file.size,
            quality: 0.85,
            isCompressing: true,
          },
        ]);

        try {
          let previewUrl: string;
          let mimeType: string;
          let compressedSizeBytes: number;
          let quality = 0.85;

          if (isPdf) {
            const pdfResult = await readPdfAsDataUrl(file);
            previewUrl = pdfResult.dataUrl;
            mimeType = "application/pdf";
            compressedSizeBytes = file.size;
          } else {
            const dataUrl = await readFileAsDataUrl(file);
            const compressed = await compressImageDataUrl(dataUrl, qualityFromPercent(85));
            previewUrl = compressed.dataUrl;
            mimeType = compressed.mimeType;
            compressedSizeBytes = compressed.compressedSizeBytes;
            quality = qualityFromPercent(85);
          }

          setPending((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    previewUrl,
                    mimeType,
                    compressedSizeBytes,
                    quality,
                    isCompressing: false,
                  }
                : p,
            ),
          );
        } catch {
          setPending((prev) => prev.filter((p) => p.id !== id));
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDeleteSaved = async (doc: BgDdDocument) => {
      if (!bgDdId || readOnly) return;
      if (!window.confirm(`Delete document "${doc.label}"?`)) return;
      await deleteBgDdDocument(bgDdId, doc.id);
      await loadDocs();
    };

    const containerClass = embedded
      ? "rounded-lg border border-slate-200 bg-slate-50/50 p-3"
      : "rounded-xl border border-slate-200 bg-white p-4";

    return (
      <div className={containerClass}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">BG / DD Copy</h4>
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <Upload size={12} />
                Upload
              </button>
            </>
          )}
        </div>

        {loading && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Loading documents...
          </p>
        )}

        <div className="space-y-2">
          {savedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{doc.label}</p>
                  <p className="text-[10px] text-slate-500">{formatFileSize(doc.storedSizeBytes)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {bgDdId && (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteSaved(doc)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {pending.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-orange-200 bg-orange-50/50 px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-orange-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{item.fileName}</p>
                  <p className="text-[10px] text-slate-500">
                    {item.isCompressing ? "Processing..." : "Pending upload on save"}
                  </p>
                </div>
              </div>
              {!readOnly && !item.isCompressing && (
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((p) => p.id !== item.id))}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {!loading && savedDocs.length === 0 && pending.length === 0 && (
            <p className="text-[11px] text-slate-400">No documents uploaded yet.</p>
          )}
        </div>

        {previewDoc && bgDdId && (
          <SavedDocumentPreviewModal
            bgDdId={bgDdId}
            document={previewDoc}
            onClose={() => setPreviewDoc(null)}
          />
        )}
      </div>
    );
  },
);

export default BgDdDocumentsPanel;
