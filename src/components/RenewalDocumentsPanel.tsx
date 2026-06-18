import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Upload,
  Trash2,
  FileText,
  Image as ImageIcon,
  Eye,
  X,
  Loader2,
  HardDrive,
  SlidersHorizontal,
  Crop,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import { RenewalDocument } from "../types";
import { useAuthenticatedBlobUrl } from "../hooks/useAuthenticatedBlobUrl";
import {
  deleteRenewalDocument,
  fetchRenewalDocuments,
  getRenewalDocumentUrl,
  replaceRenewalDocument,
  uploadRenewalDocumentsBulk,
  type UploadRenewalDocumentPayload,
} from "../lib/renewals";
import {
  compressImageDataUrl,
  compressionPercent,
  formatFileSize,
  isImageFile,
  isPdfFile,
  qualityFromPercent,
  readFileAsDataUrl,
  readPdfAsDataUrl,
  savingsPercent,
} from "../lib/image-compress";
import {
  compressPdfDataUrl,
  imageDataUrlToPdf,
  renderPdfFirstPageAsImage,
} from "../lib/pdf-process";
import ImageEditorModal, { type ImageEditorResult } from "./ImageEditorModal";

export interface RenewalDocumentsPanelHandle {
  getPendingUploads: () => UploadRenewalDocumentPayload[];
  clearPending: () => void;
  hasPending: () => boolean;
}

interface RenewalDocumentsPanelProps {
  renewalId?: string | null;
  defaultLabel?: string;
  readOnly?: boolean;
  /** Hide inline Save all — parent handles upload via ref */
  hideSaveAll?: boolean;
}

interface PendingUpload {
  id: string;
  fileName: string;
  label: string;
  isImage: boolean;
  isPdf: boolean;
  imageSourceUrl?: string;
  pdfSourceUrl?: string;
  previewUrl: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  quality: number;
  qualityPercent: number;
  isCompressing: boolean;
}

interface AdjustingDocument {
  doc: RenewalDocument;
  sourceDataUrl: string;
  pdfSourceUrl?: string;
  isPdf: boolean;
}

function makePendingId(): string {
  return `rpending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function labelFromFileName(name: string, fallback: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base || fallback;
}

function dataUrlToPayloadBase64(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",").pop()!.trim() : dataUrl;
}

function PendingPreviewModal({
  item,
  onClose,
}: {
  item: {
    fileName: string;
    previewUrl: string;
    mimeType: string;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    qualityPercent: number;
  };
  onClose: () => void;
}) {
  const isPdf = item.mimeType === "application/pdf";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{item.fileName}</h3>
            <p className="text-[11px] text-slate-500">
              {formatFileSize(item.originalSizeBytes)} → {formatFileSize(item.compressedSizeBytes)}
              {" · "}
              {item.qualityPercent}% quality
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {isPdf ? (
            <iframe src={item.previewUrl} title={item.fileName} className="h-[70vh] w-full rounded-lg border bg-white" />
          ) : (
            <img src={item.previewUrl} alt={item.fileName} className="mx-auto max-h-[70vh] max-w-full rounded-lg border object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

function SavedDocumentPreviewModal({
  renewalId,
  document,
  onClose,
}: {
  renewalId: string;
  document: RenewalDocument;
  onClose: () => void;
}) {
  const apiPath = getRenewalDocumentUrl(renewalId, document.id);
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
            <p className="text-[11px] text-slate-500">
              {formatFileSize(document.storedSizeBytes)}
              {document.quality != null && ` · ${compressionPercent(document.quality)}% quality`}
            </p>
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

const RenewalDocumentsPanel = forwardRef<RenewalDocumentsPanelHandle, RenewalDocumentsPanelProps>(
  function RenewalDocumentsPanel({ renewalId, defaultLabel = "Document", readOnly = false, hideSaveAll = false }, ref) {
    const [documents, setDocuments] = useState<RenewalDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<PendingUpload[]>([]);
    const [defaultQualityPercent, setDefaultQualityPercent] = useState(60);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [adjustingId, setAdjustingId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<RenewalDocument | null>(null);
    const [previewPending, setPreviewPending] = useState<PendingUpload | null>(null);
    const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
    const [adjustingDoc, setAdjustingDoc] = useState<AdjustingDocument | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const editingPending = useMemo(
      () => pendingItems.find((item) => item.id === editingPendingId) ?? null,
      [pendingItems, editingPendingId],
    );

    const loadDocuments = useCallback(async () => {
      if (!renewalId) {
        setDocuments([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setDocuments(await fetchRenewalDocuments(renewalId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      } finally {
        setLoading(false);
      }
    }, [renewalId]);

    useEffect(() => {
      void loadDocuments();
    }, [loadDocuments]);

    const pendingToPayload = useCallback(
      (items: PendingUpload[]): UploadRenewalDocumentPayload[] =>
        items.map((item) => ({
          label: item.label.trim() || defaultLabel,
          fileBase64: dataUrlToPayloadBase64(item.previewUrl),
          mimeType: item.mimeType,
          originalSizeBytes: item.originalSizeBytes,
          storedSizeBytes: item.compressedSizeBytes,
          quality: item.quality,
        })),
      [defaultLabel],
    );

    useImperativeHandle(ref, () => ({
      getPendingUploads: () => pendingToPayload(pendingItems),
      clearPending: () => setPendingItems([]),
      hasPending: () => pendingItems.length > 0,
    }));

    const updatePendingItem = (id: string, patch: Partial<PendingUpload>) => {
      setPendingItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    };

    const recompressPending = async (item: PendingUpload, percent: number) => {
      updatePendingItem(item.id, { isCompressing: true });
      try {
        if (item.isImage && item.imageSourceUrl) {
          const quality = qualityFromPercent(percent);
          const result = await compressImageDataUrl(
            item.imageSourceUrl,
            quality,
            1600,
            1600,
            item.originalSizeBytes,
          );
          updatePendingItem(item.id, {
            previewUrl: result.dataUrl,
            mimeType: result.mimeType,
            compressedSizeBytes: result.compressedSizeBytes,
            quality,
            qualityPercent: percent,
            isCompressing: false,
          });
          return;
        }
        if (item.isPdf && item.pdfSourceUrl) {
          const result = await compressPdfDataUrl(
            item.pdfSourceUrl,
            percent,
            1600,
            1600,
            item.originalSizeBytes,
          );
          const pageImage = await renderPdfFirstPageAsImage(result.dataUrl);
          updatePendingItem(item.id, {
            pdfSourceUrl: result.dataUrl,
            previewUrl: result.dataUrl,
            imageSourceUrl: pageImage,
            mimeType: result.mimeType,
            compressedSizeBytes: result.compressedSizeBytes,
            quality: result.quality,
            qualityPercent: percent,
            isCompressing: false,
          });
        }
      } catch (err) {
        updatePendingItem(item.id, { isCompressing: false });
        setError(err instanceof Error ? err.message : "Failed to compress document.");
      }
    };

    const buildPendingFromFile = async (file: File): Promise<PendingUpload> => {
      const id = makePendingId();
      const label = labelFromFileName(file.name, defaultLabel);
      const base = { id, fileName: file.name, label, isCompressing: false };

      if (isPdfFile(file)) {
        const result = await readPdfAsDataUrl(file);
        const compressed = await compressPdfDataUrl(
          result.dataUrl,
          defaultQualityPercent,
          1600,
          1600,
          result.originalSizeBytes,
        );
        const pageImage = await renderPdfFirstPageAsImage(compressed.dataUrl);
        return {
          ...base,
          isImage: false,
          isPdf: true,
          pdfSourceUrl: compressed.dataUrl,
          imageSourceUrl: pageImage,
          previewUrl: compressed.dataUrl,
          mimeType: compressed.mimeType,
          originalSizeBytes: result.originalSizeBytes,
          compressedSizeBytes: compressed.compressedSizeBytes,
          quality: compressed.quality,
          qualityPercent: defaultQualityPercent,
        };
      }

      const quality = qualityFromPercent(defaultQualityPercent);
      const imageSourceUrl = await readFileAsDataUrl(file);
      const result = await compressImageDataUrl(imageSourceUrl, quality, 1600, 1600, file.size);
      return {
        ...base,
        isImage: true,
        isPdf: false,
        imageSourceUrl,
        previewUrl: result.dataUrl,
        mimeType: result.mimeType,
        originalSizeBytes: file.size,
        compressedSizeBytes: result.compressedSizeBytes,
        quality,
        qualityPercent: defaultQualityPercent,
      };
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;

      setError(null);
      const created: PendingUpload[] = [];
      for (const file of files) {
        if (!isImageFile(file) && !isPdfFile(file)) {
          setError(`"${file.name}" is not supported — only images and PDFs are allowed.`);
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          setError(`"${file.name}" exceeds the 15 MB limit.`);
          continue;
        }
        try {
          created.push(await buildPendingFromFile(file));
        } catch (err) {
          setError(err instanceof Error ? err.message : `Failed to read "${file.name}".`);
        }
      }
      if (created.length > 0) {
        setPendingItems((prev) => [...created, ...prev]);
      }
    };

    const handleUploadAll = async () => {
      if (!renewalId || pendingItems.length === 0) return;
      setIsUploading(true);
      setError(null);
      try {
        const records = await uploadRenewalDocumentsBulk(renewalId, pendingToPayload(pendingItems));
        const uploadedIds = new Set(pendingItems.map((item) => item.id));
        setDocuments((prev) => [...records, ...prev]);
        setPendingItems((prev) => prev.filter((item) => !uploadedIds.has(item.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    };

    const handlePendingEditorSave = async (result: ImageEditorResult) => {
      if (!editingPending) return;
      if (editingPending.isPdf) {
        const percent = Math.round(result.quality * 100);
        const pdfResult = await imageDataUrlToPdf(
          result.dataUrl,
          percent,
          editingPending.originalSizeBytes,
        );
        const pageImage = await renderPdfFirstPageAsImage(pdfResult.dataUrl);
        updatePendingItem(editingPending.id, {
          pdfSourceUrl: pdfResult.dataUrl,
          previewUrl: pdfResult.dataUrl,
          imageSourceUrl: pageImage,
          mimeType: pdfResult.mimeType,
          compressedSizeBytes: pdfResult.compressedSizeBytes,
          quality: pdfResult.quality,
          qualityPercent: percent,
        });
      } else {
        updatePendingItem(editingPending.id, {
          imageSourceUrl: result.dataUrl,
          previewUrl: result.dataUrl,
          mimeType: result.mimeType,
          compressedSizeBytes: result.compressedSizeBytes,
          quality: result.quality,
          qualityPercent: Math.round(result.quality * 100),
        });
      }
      setEditingPendingId(null);
    };

    const openAdjustSaved = async (doc: RenewalDocument) => {
      if (!renewalId) return;
      setAdjustingId(doc.id);
      try {
        const res = await fetch(getRenewalDocumentUrl(renewalId, doc.id));
        if (!res.ok) throw new Error("Failed to load document.");
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Unable to read document."));
          };
          reader.onerror = () => reject(new Error("Unable to read document."));
          reader.readAsDataURL(blob);
        });
        const isPdf = doc.mimeType === "application/pdf";
        if (isPdf) {
          const pageImage = await renderPdfFirstPageAsImage(dataUrl);
          setAdjustingDoc({ doc, sourceDataUrl: pageImage, pdfSourceUrl: dataUrl, isPdf: true });
        } else {
          setAdjustingDoc({ doc, sourceDataUrl: dataUrl, isPdf: false });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open editor.");
      } finally {
        setAdjustingId(null);
      }
    };

    const handleAdjustSaved = async (result: ImageEditorResult) => {
      if (!adjustingDoc || !renewalId) return;
      const { doc } = adjustingDoc;
      try {
        let fileBase64 = result.dataUrl;
        let mimeType = result.mimeType;
        let storedSizeBytes = result.compressedSizeBytes;
        let quality = result.quality;
        if (adjustingDoc.isPdf) {
          const percent = Math.round(result.quality * 100);
          const pdfResult = await imageDataUrlToPdf(result.dataUrl, percent, doc.originalSizeBytes);
          fileBase64 = pdfResult.dataUrl;
          mimeType = pdfResult.mimeType;
          storedSizeBytes = pdfResult.compressedSizeBytes;
          quality = pdfResult.quality;
        }
        const record = await replaceRenewalDocument(renewalId, doc.id, {
          fileBase64: dataUrlToPayloadBase64(fileBase64),
          mimeType,
          storedSizeBytes,
          quality,
        });
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? record : d)));
        setAdjustingDoc(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save optimized document.");
        throw err;
      }
    };

    const handleDelete = async (doc: RenewalDocument) => {
      if (!renewalId || !window.confirm(`Delete "${doc.label}"?`)) return;
      setDeletingId(doc.id);
      try {
        await deleteRenewalDocument(renewalId, doc.id);
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        if (previewDoc?.id === doc.id) setPreviewDoc(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setDeletingId(null);
      }
    };

    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!readOnly && (
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-900">
              <Upload size={14} />
              Upload Documents
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Select one or more images/PDFs. Adjust quality, crop, then save.
              {!renewalId && " Files will upload when you save the renewal record."}
            </p>

            <div className="mt-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Default quality for new uploads
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={defaultQualityPercent}
                  onChange={(e) => setDefaultQualityPercent(Number(e.target.value))}
                  className="w-full accent-[#ff791a]"
                />
                <span className="w-10 shrink-0 text-xs font-bold text-[#ff791a]">{defaultQualityPercent}%</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => void handleFileSelect(e)}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
            >
              <Upload size={14} />
              Upload
            </button>

            {pendingItems.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-bold text-slate-700">Pending ({pendingItems.length})</p>
                {pendingItems.map((pending) => (
                  <div key={pending.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex aspect-[4/3] w-full max-w-[180px] items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
                        {pending.isCompressing ? (
                          <Loader2 size={22} className="animate-spin text-slate-400" />
                        ) : pending.mimeType === "application/pdf" ? (
                          <iframe src={pending.previewUrl} title={pending.fileName} className="h-full w-full border-0 bg-white" />
                        ) : (
                          <img src={pending.previewUrl} alt={pending.fileName} className="h-full w-full object-contain p-1" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewPending(pending)}
                          className="absolute left-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500 shadow-sm hover:text-[#ff791a]"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={pending.label}
                          onChange={(e) => updatePendingItem(pending.id, { label: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-800"
                          placeholder="Document label"
                        />
                        <p className="text-[10px] text-slate-500 truncate" title={pending.fileName}>
                          {pending.fileName}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          <HardDrive size={10} className="inline mr-0.5" />
                          {formatFileSize(pending.originalSizeBytes)} →{" "}
                          <span className="font-semibold text-emerald-700">
                            {formatFileSize(pending.compressedSizeBytes)}
                          </span>
                          {pending.originalSizeBytes > 0 && (
                            <span className="text-emerald-600">
                              {" "}
                              ({savingsPercent(pending.originalSizeBytes, pending.compressedSizeBytes)}% smaller)
                            </span>
                          )}
                        </p>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                              <SlidersHorizontal size={10} />
                              Quality
                            </label>
                            <span className="text-[11px] font-bold text-[#ff791a]">{pending.qualityPercent}%</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={pending.qualityPercent}
                            onChange={(e) => {
                              const percent = Number(e.target.value);
                              updatePendingItem(pending.id, { qualityPercent: percent });
                              void recompressPending(pending, percent);
                            }}
                            className="mt-1 w-full accent-[#ff791a]"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pending.imageSourceUrl && (
                            <button
                              type="button"
                              onClick={() => setEditingPendingId(pending.id)}
                              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:border-[#ff791a]/40 hover:text-[#ff791a]"
                            >
                              <Crop size={12} />
                              Crop
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingItems((prev) => prev.filter((p) => p.id !== pending.id))}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setPendingItems([])}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
                  >
                    Clear all pending
                  </button>
                  {renewalId && !hideSaveAll && (
                    <button
                      type="button"
                      onClick={() => void handleUploadAll()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Save all ({pendingItems.length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {renewalId && (
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
              Saved Documents ({documents.length})
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </div>
            ) : documents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {documents.map((doc) => {
                  const isPdf = doc.mimeType === "application/pdf";
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-xs"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#ff791a]">
                        {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{doc.label}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(doc.storedSizeBytes)}
                          {doc.quality != null && ` · ${compressionPercent(doc.quality)}% quality`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#ff791a]"
                        >
                          <Eye size={16} />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => void openAdjustSaved(doc)}
                              disabled={adjustingId === doc.id}
                              className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-[#ff791a] disabled:opacity-50"
                            >
                              {adjustingId === doc.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Wand2 size={16} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {previewPending && (
          <PendingPreviewModal
            item={{
              fileName: previewPending.fileName,
              previewUrl: previewPending.previewUrl,
              mimeType: previewPending.mimeType,
              originalSizeBytes: previewPending.originalSizeBytes,
              compressedSizeBytes: previewPending.compressedSizeBytes,
              qualityPercent: previewPending.qualityPercent,
            }}
            onClose={() => setPreviewPending(null)}
          />
        )}

        {previewDoc && renewalId && (
          <SavedDocumentPreviewModal
            renewalId={renewalId}
            document={previewDoc}
            onClose={() => setPreviewDoc(null)}
          />
        )}

        {editingPending?.imageSourceUrl && (
          <ImageEditorModal
            title={`Crop — ${editingPending.fileName}`}
            sourceDataUrl={editingPending.imageSourceUrl}
            originalSizeBytes={editingPending.originalSizeBytes}
            initialQualityPercent={editingPending.qualityPercent}
            confirmLabel="Use this version"
            onClose={() => setEditingPendingId(null)}
            onSave={handlePendingEditorSave}
          />
        )}

        {adjustingDoc && (
          <ImageEditorModal
            title={`Optimize — ${adjustingDoc.doc.label}`}
            sourceDataUrl={adjustingDoc.sourceDataUrl}
            originalSizeBytes={adjustingDoc.doc.originalSizeBytes}
            initialQualityPercent={
              adjustingDoc.doc.quality != null ? Math.round(adjustingDoc.doc.quality * 100) : 60
            }
            confirmLabel="Save optimized version"
            onClose={() => setAdjustingDoc(null)}
            onSave={handleAdjustSaved}
          />
        )}
      </div>
    );
  },
);

export default RenewalDocumentsPanel;
