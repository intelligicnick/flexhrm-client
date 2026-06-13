import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { EmployeeDocument } from "../types";
import { useAuthenticatedBlobUrl } from "../hooks/useAuthenticatedBlobUrl";
import {
  DOCUMENT_LABEL_PRESETS,
  deleteEmployeeDocument,
  fetchEmployeeDocuments,
  getEmployeeDocumentUrl,
  replaceEmployeeDocument,
  uploadEmployeeDocumentsBulk,
} from "../lib/employee-documents";
import { useHRMS } from "../context/HRMSContext";
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

interface EmployeeDocumentsPanelProps {
  employeeId: string;
  readOnly?: boolean;
}

interface PendingUpload {
  id: string;
  file: File;
  fileName: string;
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
  labelPreset: string;
  customLabel: string;
  isCompressing: boolean;
}

interface AdjustingDocument {
  doc: EmployeeDocument;
  sourceDataUrl: string;
  pdfSourceUrl?: string;
  isPdf: boolean;
}

interface PendingPreviewItem {
  fileName: string;
  previewUrl: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  qualityPercent: number;
}

function makePendingId(): string {
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveLabel(preset: string, custom: string): string {
  if (preset === "Other") return custom.trim();
  return preset;
}

function PendingPreviewModal({
  item,
  onClose,
}: {
  item: PendingPreviewItem;
  onClose: () => void;
}) {
  const isPdf = item.mimeType === "application/pdf";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {isPdf ? (
            <iframe
              src={item.previewUrl}
              title={item.fileName}
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={item.previewUrl}
              alt={item.fileName}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentPreviewModal({
  employeeId,
  document,
  onClose,
}: {
  employeeId: string;
  document: EmployeeDocument;
  onClose: () => void;
}) {
  const apiPath = getEmployeeDocumentUrl(employeeId, document.id);
  const blobUrl = useAuthenticatedBlobUrl(apiPath);
  const isPdf = document.mimeType === "application/pdf";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
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
            <iframe
              src={blobUrl}
              title={document.label}
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={blobUrl}
              alt={document.label}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDocumentsPanel({
  employeeId,
  readOnly = false,
}: EmployeeDocumentsPanelProps) {
  const { confirmAction } = useHRMS();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [defaultLabelPreset, setDefaultLabelPreset] = useState<string>("PAN Card");
  const [defaultCustomLabel, setDefaultCustomLabel] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingUpload[]>([]);
  const [defaultQualityPercent, setDefaultQualityPercent] = useState(60);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [previewPending, setPreviewPending] = useState<PendingUpload | null>(null);
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
  const [adjustingDoc, setAdjustingDoc] = useState<AdjustingDocument | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editingPending = useMemo(
    () => pendingItems.find((item) => item.id === editingPendingId) ?? null,
    [pendingItems, editingPendingId],
  );

  const readyPendingCount = useMemo(
    () => pendingItems.filter((item) => resolveLabel(item.labelPreset, item.customLabel)).length,
    [pendingItems],
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEmployeeDocuments(employeeId);
      setDocuments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

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
        return;
      }

      updatePendingItem(item.id, { isCompressing: false });
    } catch (err) {
      updatePendingItem(item.id, { isCompressing: false });
      setError(err instanceof Error ? err.message : "Failed to compress document.");
    }
  };

  const buildPendingFromFile = async (file: File, displayName: string): Promise<PendingUpload> => {
    const id = makePendingId();
    const base = {
      id,
      file,
      fileName: displayName,
      labelPreset: defaultLabelPreset,
      customLabel: defaultCustomLabel,
      isCompressing: false,
    };

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
    const result = await compressImageDataUrl(
      imageSourceUrl,
      quality,
      1600,
      1600,
      file.size,
    );
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

  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setError(null);
    const validFiles: Array<{ file: File; displayName: string }> = [];
    for (const file of files) {
      if (!isImageFile(file) && !isPdfFile(file)) {
        setError(`Skipped "${file.name}" — only images and PDFs are allowed.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError(`Skipped "${file.name}" — maximum size is 15 MB.`);
        continue;
      }
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      validFiles.push({ file, displayName: relativePath || file.name });
    }

    if (validFiles.length === 0) return;

    try {
      const created = await Promise.all(
        validFiles.map((entry) => buildPendingFromFile(entry.file, entry.displayName)),
      );
      setPendingItems((prev) => [...created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read selected files.");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await processSelectedFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await processSelectedFiles(files);
  };

  const removePending = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
    if (editingPendingId === id) setEditingPendingId(null);
  };

  const clearAllPending = () => {
    setPendingItems([]);
    setEditingPendingId(null);
    setError(null);
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
      setEditingPendingId(null);
      return;
    }

    updatePendingItem(editingPending.id, {
      imageSourceUrl: result.dataUrl,
      previewUrl: result.dataUrl,
      mimeType: result.mimeType,
      compressedSizeBytes: result.compressedSizeBytes,
      quality: result.quality,
      qualityPercent: Math.round(result.quality * 100),
    });
    setEditingPendingId(null);
  };

  const handleUploadAll = async () => {
    const ready = pendingItems.filter((item) => resolveLabel(item.labelPreset, item.customLabel));
    if (ready.length === 0) {
      setError("Add files and set a label for each document before saving.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(`Saving ${ready.length} file${ready.length === 1 ? "" : "s"}...`);

    try {
      const records = await uploadEmployeeDocumentsBulk(
        employeeId,
        ready.map((item) => ({
          label: resolveLabel(item.labelPreset, item.customLabel),
          fileBase64: item.previewUrl,
          mimeType: item.mimeType,
          originalSizeBytes: item.originalSizeBytes,
          storedSizeBytes: item.compressedSizeBytes,
          quality: item.quality,
        })),
      );
      const uploadedIds = new Set(ready.map((item) => item.id));
      setDocuments((prev) => [...records, ...prev]);
      setPendingItems((prev) => prev.filter((item) => !uploadedIds.has(item.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const openAdjustSaved = async (doc: EmployeeDocument) => {
    setAdjustingId(doc.id);
    setError(null);
    try {
      const res = await fetch(getEmployeeDocumentUrl(employeeId, doc.id));
      if (!res.ok) throw new Error("Failed to load document for editing.");
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
      setError(err instanceof Error ? err.message : "Failed to open document editor.");
    } finally {
      setAdjustingId(null);
    }
  };

  const handleAdjustSaved = async (result: ImageEditorResult) => {
    if (!adjustingDoc) return;
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

      const record = await replaceEmployeeDocument(employeeId, doc.id, {
        fileBase64,
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

  const handleDelete = async (doc: EmployeeDocument) => {
    const confirmed = await confirmAction({
      title: "Delete document",
      message: `Delete "${doc.label}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    setDeletingId(doc.id);
    try {
      await deleteEmployeeDocument(employeeId, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
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
            Drop or browse for multiple files at once. Preview each file, adjust quality, and crop before saving all.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Default label for new files
              </label>
              <select
                value={defaultLabelPreset}
                onChange={(e) => setDefaultLabelPreset(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {DOCUMENT_LABEL_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            {defaultLabelPreset === "Other" ? (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Default custom label
                </label>
                <input
                  type="text"
                  value={defaultCustomLabel}
                  onChange={(e) => setDefaultCustomLabel(e.target.value)}
                  placeholder="e.g. Driving Licence"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Default quality
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
                  <span className="w-10 shrink-0 text-xs font-bold text-[#ff791a]">
                    {defaultQualityPercent}%
                  </span>
                </div>
              </div>
            )}

            {defaultLabelPreset === "Other" && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Default quality
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
                  <span className="w-10 shrink-0 text-xs font-bold text-[#ff791a]">
                    {defaultQualityPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
            }}
            onDrop={(e) => void handleDrop(e)}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition ${
              dragActive
                ? "border-[#ff791a] bg-orange-50/80"
                : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="mb-2 rounded-full bg-orange-50 p-3 text-[#ff791a]">
              <Upload size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Drop files here or <span className="text-[#ff791a]">browse</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Select many images or PDFs at once · max 15 MB each
            </p>
          </div>

          {pendingItems.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">
                  Ready to upload ({pendingItems.length} file{pendingItems.length === 1 ? "" : "s"})
                </p>
                <button
                  type="button"
                  onClick={clearAllPending}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600"
                >
                  Clear all
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {pendingItems.map((item) => {
                    const label = resolveLabel(item.labelPreset, item.customLabel);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs"
                      >
                        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-xl border-b border-slate-100 bg-slate-50">
                          {item.isCompressing ? (
                            <Loader2 size={22} className="animate-spin text-slate-400" />
                          ) : item.mimeType === "application/pdf" ? (
                            <iframe
                              src={item.previewUrl}
                              title={item.fileName}
                              className="h-full w-full border-0 bg-white"
                            />
                          ) : (
                            <img
                              src={item.previewUrl}
                              alt={item.fileName}
                              className="h-full w-full object-contain p-1"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewPending(item)}
                            className="absolute left-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500 shadow-sm hover:bg-white hover:text-[#ff791a]"
                            title="Full preview"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePending(item.id)}
                            className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-400 shadow-sm hover:bg-white hover:text-slate-700"
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="flex flex-1 flex-col gap-2 p-3">
                          <div>
                            <p className="truncate text-xs font-bold text-slate-800" title={item.fileName}>
                              {item.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              <HardDrive size={10} className="mr-0.5 inline" />
                              {formatFileSize(item.originalSizeBytes)} →{" "}
                              <span className="font-semibold text-emerald-700">
                                {formatFileSize(item.compressedSizeBytes)}
                              </span>
                            </p>
                          </div>

                          <select
                            value={item.labelPreset}
                            onChange={(e) => updatePendingItem(item.id, { labelPreset: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
                          >
                            {DOCUMENT_LABEL_PRESETS.map((preset) => (
                              <option key={preset} value={preset}>
                                {preset}
                              </option>
                            ))}
                          </select>
                          {item.labelPreset === "Other" && (
                            <input
                              type="text"
                              value={item.customLabel}
                              onChange={(e) => updatePendingItem(item.id, { customLabel: e.target.value })}
                              placeholder="Custom label"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          )}

                          {(item.isImage || item.isPdf) && (
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  <SlidersHorizontal size={10} />
                                  Quality
                                </label>
                                <span className="text-[11px] font-bold text-[#ff791a]">
                                  {item.qualityPercent}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={item.qualityPercent}
                                onChange={(e) => {
                                  const percent = Number(e.target.value);
                                  updatePendingItem(item.id, { qualityPercent: percent });
                                  void recompressPending(item, percent);
                                }}
                                className="mt-1 w-full accent-[#ff791a]"
                              />
                              {item.originalSizeBytes > 0 && (
                                <p className="mt-0.5 text-[10px] text-emerald-600">
                                  {savingsPercent(item.originalSizeBytes, item.compressedSizeBytes)}% smaller
                                </p>
                              )}
                            </div>
                          )}

                          {(item.isImage || item.isPdf) && item.imageSourceUrl && (
                            <button
                              type="button"
                              onClick={() => setEditingPendingId(item.id)}
                              className="mt-auto inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:border-[#ff791a]/40 hover:text-[#ff791a]"
                            >
                              <Crop size={12} />
                              Crop
                            </button>
                          )}

                          {!label && (
                            <span className="text-[10px] font-medium text-amber-600 mt-auto">
                              Set a label before saving
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleUploadAll()}
                  disabled={isUploading || readyPendingCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {uploadProgress ?? "Saving..."}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Save all ({readyPendingCount})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
          Saved Documents ({documents.length})
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
            <FileText size={28} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No documents uploaded yet.</p>
            {!readOnly && (
              <p className="mt-1 text-xs text-slate-400">
                Upload PAN, Aadhaar, passbook, or other proofs above.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {documents.map((doc) => {
              const isPdf = doc.mimeType === "application/pdf";
              const isImage = !isPdf;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-xs transition hover:border-orange-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#ff791a]">
                    {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{doc.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(doc.storedSizeBytes)}
                      {doc.quality != null && ` · ${compressionPercent(doc.quality)}% quality`}
                      {" · "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#ff791a]"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    {!readOnly && (isImage || isPdf) && (
                      <button
                        type="button"
                        onClick={() => void openAdjustSaved(doc)}
                        disabled={adjustingId === doc.id}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-orange-50 hover:text-[#ff791a] disabled:opacity-50"
                        title="Adjust quality or crop"
                      >
                        {adjustingId === doc.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Wand2 size={16} />
                        )}
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {previewDoc && (
        <DocumentPreviewModal
          employeeId={employeeId}
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {editingPending && editingPending.imageSourceUrl && (
        <ImageEditorModal
          title={`Edit before upload — ${editingPending.fileName}`}
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
            adjustingDoc.doc.quality != null
              ? Math.round(adjustingDoc.doc.quality * 100)
              : 60
          }
          confirmLabel="Save optimized version"
          onClose={() => setAdjustingDoc(null)}
          onSave={handleAdjustSaved}
        />
      )}
    </div>
  );
}
