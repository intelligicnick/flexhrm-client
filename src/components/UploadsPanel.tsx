import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Eye, FileSpreadsheet, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import ExcelPreviewGrid from "./ExcelPreviewGrid";
import { parseBulkPayXlsWorkbook, type BulkPayXlsWorkbookPreview } from "../utils";
import type { SchoolBlock } from "../types";
import {
  OTHER_RESOURCE_FILTER_ALL,
  OTHER_RESOURCE_PICK,
  resourceOptionValue,
  uploadsApi,
  uploadFileUrl,
  type StandaloneUpload,
} from "../lib/uploads-api";

interface UploadsPanelProps {
  selectedMonth: string;
  monthsList: string[];
  schoolBlocks: SchoolBlock[];
  officeLocations: string[];
}

type UploadExcelPreview = {
  item: StandaloneUpload;
  sheetNames: string[];
  activeSheet: string;
  sheets: Record<string, string[][]>;
  loading: boolean;
  search: string;
};

type ExcelRowHit = {
  upload: StandaloneUpload;
  sheetName: string;
  rowNumber: number;
  cells: string[];
};

type UploadFormEntry = {
  id: string;
  displayName: string;
  description: string;
  excelFiles: File[];
};

function createUploadFormEntry(): UploadFormEntry {
  return {
    id: crypto.randomUUID(),
    displayName: "",
    description: "",
    excelFiles: [],
  };
}

function stripExcelExtension(filename: string): string {
  return filename.replace(/\.(xlsx|xls)$/i, "");
}

function mergeExcelFiles(existing: File[], incoming: File[]): File[] {
  const next = [...existing];
  for (const file of incoming) {
    const duplicate = next.some(
      (f) =>
        f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    );
    if (!duplicate) next.push(file);
  }
  return next;
}

function uploadDisplayName(entry: UploadFormEntry, file: File): string {
  const base = entry.displayName.trim();
  if (entry.excelFiles.length <= 1) {
    return base || stripExcelExtension(file.name);
  }
  const stem = stripExcelExtension(file.name);
  return base ? `${base} – ${stem}` : stem;
}

function resourceValueFromUpload(item: StandaloneUpload): {
  resourceValue: string;
  otherResourceName: string;
} {
  const kind = item.resourceKind;
  const id = item.resourceId?.trim() ?? "";
  if (kind === "block" && id) {
    return { resourceValue: resourceOptionValue("block", id), otherResourceName: "" };
  }
  if (kind === "office" && id) {
    return { resourceValue: resourceOptionValue("office", id), otherResourceName: "" };
  }
  if (kind === "other") {
    return {
      resourceValue: OTHER_RESOURCE_PICK,
      otherResourceName: item.resourceLabel?.trim() || id,
    };
  }
  return { resourceValue: "", otherResourceName: "" };
}

function parseExcelSearchTokens(query: string): string[] {
  return query
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function rowMatchesExcelTokens(cells: string[], tokens: string[]): boolean {
  if (!tokens.length) return false;
  const haystack = cells.map((c) => String(c ?? "").toLowerCase()).join("\t");
  return tokens.some((token) => haystack.includes(token));
}

function findExcelRowHits(
  upload: StandaloneUpload,
  workbook: BulkPayXlsWorkbookPreview,
  tokens: string[],
): ExcelRowHit[] {
  const hits: ExcelRowHit[] = [];
  for (const sheetName of workbook.sheetNames) {
    const rows = workbook.sheets[sheetName] || [];
    rows.forEach((cells, idx) => {
      if (rowMatchesExcelTokens(cells, tokens)) {
        hits.push({
          upload,
          sheetName,
          rowNumber: idx + 1,
          cells,
        });
      }
    });
  }
  return hits;
}

function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function filterSheetBySearch(rows: string[][], search: string, headerRowCount = 1): string[][] {
  const q = search.trim().toLowerCase();
  if (!q || rows.length === 0) return rows;
  const header = rows.slice(0, headerRowCount);
  const data = rows.slice(headerRowCount);
  const filtered = data.filter((row) =>
    row.some((cell) => String(cell ?? "").toLowerCase().includes(q)),
  );
  return [...header, ...filtered];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessExcelMime(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (file.type && (file.type.includes("spreadsheet") || file.type.includes("excel"))) {
    return file.type;
  }
  return null;
}

function fileToBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",").pop()! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const EXCEL_FILE_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

function ExcelFilePickField({
  files,
  onFilesChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (list: FileList | File[] | null | undefined) => {
    if (!list?.length) return;
    const picked = Array.from(list).filter((f) => guessExcelMime(f));
    if (!picked.length) return;
    onFilesChange(mergeExcelFiles(files, picked));
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const hasFiles = files.length > 0;

  return (
    <div className="mt-1 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={EXCEL_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#ff791a]/40 ${
          dragActive
            ? "border-[#ff791a] bg-orange-50 shadow-md scale-[1.01]"
            : hasFiles
              ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400"
              : "border-slate-200 bg-white hover:border-[#ff791a]/50 hover:bg-orange-50/40 hover:shadow-sm"
        }`}
      >
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              hasFiles ? "bg-emerald-100" : "bg-orange-100"
            }`}
          >
            {hasFiles ? (
              <FileSpreadsheet size={22} className="text-emerald-600" />
            ) : (
              <Upload size={22} className="text-[#ff791a]" />
            )}
          </div>
          <p className="text-sm font-extrabold text-slate-800">
            {hasFiles ? "Add more spreadsheets" : "Choose spreadsheets or drop here"}
          </p>
          <p className="text-xs text-slate-500">
            {hasFiles
              ? `${files.length} file${files.length === 1 ? "" : "s"} selected · pick again to add more`
              : "Excel .xlsx or .xls · multiple files · up to 25 MB each"}
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#ff791a] rounded-lg px-4 py-2 shadow-sm">
            <Upload size={14} />
            Browse files
          </span>
        </div>
      </div>
      {hasFiles && (
        <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-40 overflow-y-auto">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center gap-2 px-3 py-2 text-xs"
            >
              <FileSpreadsheet size={14} className="text-[#ff791a] shrink-0" />
              <span className="flex-1 min-w-0 font-semibold text-slate-800 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="text-slate-400 shrink-0">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-slate-400 hover:text-red-600 rounded"
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasFiles && (
        <button
          type="button"
          onClick={() => onFilesChange([])}
          className="text-xs font-bold text-slate-500 hover:text-[#ff791a]"
        >
          Clear all files
        </button>
      )}
    </div>
  );
}

function parseResourceValue(value: string): {
  resourceKind: "block" | "office";
  resourceId: string;
} | null {
  const match = value.match(/^(block|office):(.+)$/);
  if (!match) return null;
  const kind = match[1] as "block" | "office";
  return { resourceKind: kind, resourceId: match[2] };
}

type ResourceOption = { value: string; label: string; group: string };

function SearchableResourceSelect({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty,
  emptyLabel,
  selectedLabelOverride,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ResourceOption[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  selectedLabelOverride?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel =
    selectedLabelOverride ?? options.find((o) => o.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.group.toLowerCase().includes(q),
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ResourceOption[]>();
    for (const opt of filtered) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative mt-1 ${open ? "z-[500]" : "z-0"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-left"
      >
        <span className={value ? "text-slate-800" : "text-slate-400"}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown size={16} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-[500] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks or offices…"
              className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5"
              autoFocus
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1 text-sm">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-600"
                  onClick={() => pick("")}
                >
                  {emptyLabel ?? "All resources"}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">No matches</li>
            ) : (
              [...grouped.entries()].map(([group, opts]) => (
                <li key={group}>
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {group}
                  </p>
                  {opts.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-orange-50 ${
                        opt.value === value ? "bg-orange-50 font-bold text-[#ff791a]" : "text-slate-700"
                      }`}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

type SimpleSelectOption = { value: string; label: string };

function SearchableFilenameSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder: string;
  emptyLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative mt-1 ${open ? "z-[500]" : "z-0"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-left font-normal"
      >
        <span className={`truncate ${value ? "text-slate-800" : "text-slate-400"}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown size={16} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-[500] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search filenames…"
              className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 font-normal"
              autoFocus
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1 text-sm">
            <li>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                  value === "" ? "bg-orange-50 font-bold text-[#ff791a]" : "text-slate-600"
                }`}
                onClick={() => pick("")}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-orange-50 truncate ${
                      opt.value === value ? "bg-orange-50 font-bold text-[#ff791a]" : "text-slate-700"
                    }`}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function UploadsPanel({
  selectedMonth,
  monthsList,
  schoolBlocks,
  officeLocations,
}: UploadsPanelProps) {
  const [items, setItems] = useState<StandaloneUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formMonth, setFormMonth] = useState(selectedMonth);
  const [resourceValue, setResourceValue] = useState("");
  const [otherResourceName, setOtherResourceName] = useState("");
  const [uploadEntries, setUploadEntries] = useState<UploadFormEntry[]>(() => [
    createUploadFormEntry(),
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [listMonth, setListMonth] = useState(selectedMonth);
  const [listResource, setListResource] = useState("");
  const [listFilenameId, setListFilenameId] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [excelPreview, setExcelPreview] = useState<UploadExcelPreview | null>(null);
  const [rowSearchHits, setRowSearchHits] = useState<ExcelRowHit[]>([]);
  const [rowSearchLoading, setRowSearchLoading] = useState(false);
  const workbookCacheRef = useRef(new Map<string, BulkPayXlsWorkbookPreview>());

  const blockOptions = useMemo(
    () =>
      [...schoolBlocks]
        .filter((b) => !b.deleted)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [schoolBlocks],
  );

  const locationOptions = useMemo(
    () =>
      [...officeLocations].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    [officeLocations],
  );

  const resourceOptions = useMemo(() => {
    const opts: { value: string; label: string; group: string }[] = [];
    for (const block of blockOptions) {
      opts.push({
        value: resourceOptionValue("block", block.id),
        label: block.name,
        group: "Blocks",
      });
    }
    for (const loc of locationOptions) {
      opts.push({
        value: resourceOptionValue("office", loc),
        label: loc,
        group: "Office locations",
      });
    }
    return opts;
  }, [blockOptions, locationOptions]);

  const formResourceOptions = useMemo(
    () => [
      ...resourceOptions,
      { value: OTHER_RESOURCE_PICK, label: "Other", group: "Other" },
    ],
    [resourceOptions],
  );

  const listResourceOptions = useMemo(
    () => [
      ...resourceOptions,
      {
        value: OTHER_RESOURCE_FILTER_ALL,
        label: "Other (custom)",
        group: "Other",
      },
    ],
    [resourceOptions],
  );

  const isOtherResource = resourceValue === OTHER_RESOURCE_PICK;

  useEffect(() => {
    setFormMonth(selectedMonth);
    setListMonth(selectedMonth);
  }, [selectedMonth]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(
        await uploadsApi.list({
          month: listMonth || undefined,
          resource: listResource || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load uploads");
    } finally {
      setLoading(false);
    }
  }, [listMonth, listResource]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    for (const key of workbookCacheRef.current.keys()) {
      if (!ids.has(key)) workbookCacheRef.current.delete(key);
    }
  }, [items]);

  useEffect(() => {
    if (listFilenameId && !items.some((i) => i.id === listFilenameId)) {
      setListFilenameId("");
    }
  }, [items, listFilenameId]);

  const filteredItems = useMemo(() => {
    if (!listFilenameId) return items;
    return items.filter((i) => i.id === listFilenameId);
  }, [items, listFilenameId]);

  const filenameOptions = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
      ),
    [items],
  );

  const filenameSelectOptions = useMemo(
    () => filenameOptions.map((item) => ({ value: item.id, label: item.displayName })),
    [filenameOptions],
  );

  const excelSearchActive = parseExcelSearchTokens(listSearch).length > 0;

  const excelSearchTable = useMemo(() => {
    if (!rowSearchHits.length) {
      return { maxCols: 0, dataLabels: [] as string[] };
    }
    const maxCols = rowSearchHits.reduce((m, h) => Math.max(m, h.cells.length), 0);
    const first = rowSearchHits[0];
    const wb = workbookCacheRef.current.get(first.upload.id);
    const headerRow = wb?.sheets[first.sheetName]?.[0];
    const uniformSource = rowSearchHits.every(
      (h) => h.upload.id === first.upload.id && h.sheetName === first.sheetName,
    );
    const dataLabels = Array.from({ length: maxCols }, (_, i) => {
      if (uniformSource && headerRow?.[i] != null && String(headerRow[i]).trim()) {
        return String(headerRow[i]).trim();
      }
      return columnIndexToLetter(i);
    });
    return { maxCols, dataLabels };
  }, [rowSearchHits]);

  useEffect(() => {
    const tokens = parseExcelSearchTokens(listSearch);
    if (!tokens.length) {
      setRowSearchHits([]);
      setRowSearchLoading(false);
      return;
    }
    if (!filteredItems.length) {
      setRowSearchHits([]);
      setRowSearchLoading(false);
      return;
    }

    let cancelled = false;
    setRowSearchLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const hits: ExcelRowHit[] = [];
        for (const item of filteredItems) {
          if (cancelled) break;
          try {
            let workbook = workbookCacheRef.current.get(item.id);
            if (!workbook) {
              const url = item.imagekitUrl || uploadFileUrl(item.id);
              const res = await fetch(url, { credentials: "include" });
              if (!res.ok) continue;
              workbook = parseBulkPayXlsWorkbook(await res.arrayBuffer());
              workbookCacheRef.current.set(item.id, workbook);
            }
            for (const hit of findExcelRowHits(item, workbook, tokens)) {
              hits.push(hit);
            }
          } catch {
            // skip unreadable files
          }
        }
        if (!cancelled) {
          setRowSearchHits(hits);
          setRowSearchLoading(false);
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [listSearch, filteredItems]);

  const resolveResourceLabel = (value: string): string => {
    const found = resourceOptions.find((o) => o.value === value);
    return found?.label ?? value;
  };

  const resetForm = () => {
    setUploadEntries([createUploadFormEntry()]);
    setResourceValue("");
    setOtherResourceName("");
    setFormMonth(selectedMonth);
  };

  const updateUploadEntry = (id: string, patch: Partial<UploadFormEntry>) => {
    setUploadEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addUploadEntry = () => {
    setUploadEntries((prev) => [...prev, createUploadFormEntry()]);
  };

  const removeUploadEntry = (id: string) => {
    setUploadEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
  };

  const openAddForm = () => {
    resetForm();
    setError(null);
    setShowAddForm(true);
  };

  const openAddFormFromItem = (item: StandaloneUpload) => {
    setError(null);
    const { resourceValue: rv, otherResourceName: other } = resourceValueFromUpload(item);
    setFormMonth(
      item.monthKey && monthsList.includes(item.monthKey) ? item.monthKey : selectedMonth,
    );
    setResourceValue(rv);
    setOtherResourceName(other);
    setUploadEntries([
      {
        ...createUploadFormEntry(),
        description: item.description ?? "",
        displayName: item.displayName.includes(" – ")
          ? item.displayName.split(" – ")[0]!
          : item.displayName,
      },
    ]);
    setShowAddForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceValue) {
      setError("Select a block, office location, or Other.");
      return;
    }

    let resourceKind: "block" | "office" | "other";
    let resourceId: string;
    let resourceLabel: string;

    if (isOtherResource) {
      const customName = otherResourceName.trim();
      if (!customName) {
        setError("Enter a name for Other.");
        return;
      }
      resourceKind = "other";
      resourceId = customName;
      resourceLabel = customName;
    } else {
      const parsed = parseResourceValue(resourceValue);
      if (!parsed) {
        setError("Invalid resource selection.");
        return;
      }
      resourceKind = parsed.resourceKind;
      resourceId = parsed.resourceId;
      resourceLabel = resolveResourceLabel(resourceValue);
    }

    for (let i = 0; i < uploadEntries.length; i++) {
      const entry = uploadEntries[i];
      if (!entry.excelFiles.length) {
        setError(`Choose at least one Excel file (group ${i + 1}).`);
        return;
      }
      if (entry.excelFiles.length === 1 && !entry.displayName.trim()) {
        setError(`File name is required when uploading one file (group ${i + 1}).`);
        return;
      }
      for (const file of entry.excelFiles) {
        if (!guessExcelMime(file)) {
          setError(`Only Excel files (.xls, .xlsx) allowed (group ${i + 1}).`);
          return;
        }
      }
    }

    setUploading(true);
    setError(null);
    try {
      for (const entry of uploadEntries) {
        for (const file of entry.excelFiles) {
          const mimeType = guessExcelMime(file)!;
          await uploadsApi.create({
            displayName: uploadDisplayName(entry, file),
            monthKey: formMonth,
            description: entry.description.trim() || undefined,
            resourceKind,
            resourceId,
            resourceLabel,
            filename: file.name,
            mimeType,
            fileBase64: await fileToBase64Payload(file),
            originalSizeBytes: file.size,
          });
        }
      }
      resetForm();
      setShowAddForm(false);
      setListMonth(formMonth);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openExcelPreview = async (
    item: StandaloneUpload,
    opts?: { sheet?: string; search?: string },
  ) => {
    const cached = workbookCacheRef.current.get(item.id);
    if (cached) {
      const activeSheet =
        opts?.sheet && cached.sheetNames.includes(opts.sheet)
          ? opts.sheet
          : cached.defaultSheet;
      setExcelPreview({
        item,
        sheetNames: cached.sheetNames,
        activeSheet,
        sheets: cached.sheets,
        loading: false,
        search: opts?.search ?? "",
      });
      return;
    }

    setExcelPreview({
      item,
      sheetNames: [],
      activeSheet: "",
      sheets: {},
      loading: true,
      search: opts?.search ?? "",
    });
    try {
      const url = item.imagekitUrl || uploadFileUrl(item.id);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load file for preview.");
      const buffer = await res.arrayBuffer();
      const workbook = parseBulkPayXlsWorkbook(buffer);
      workbookCacheRef.current.set(item.id, workbook);
      const activeSheet =
        opts?.sheet && workbook.sheetNames.includes(opts.sheet)
          ? opts.sheet
          : workbook.defaultSheet;
      setExcelPreview({
        item,
        sheetNames: workbook.sheetNames,
        activeSheet,
        sheets: workbook.sheets,
        loading: false,
        search: opts?.search ?? "",
      });
    } catch (err) {
      setExcelPreview(null);
      setError(err instanceof Error ? err.message : "Could not preview Excel file.");
    }
  };

  const openExcelPreviewFromHit = (hit: ExcelRowHit) => {
    const tokens = parseExcelSearchTokens(listSearch);
    const focus =
      hit.cells.find((c) => {
        const lower = String(c ?? "").toLowerCase();
        return tokens.some((t) => lower.includes(t));
      }) ?? hit.cells.find((c) => String(c ?? "").trim()) ?? tokens[0] ?? "";
    void openExcelPreview(hit.upload, {
      sheet: hit.sheetName,
      search: String(focus),
    });
  };

  const previewRows = useMemo(() => {
    if (!excelPreview || excelPreview.loading) return [];
    const rows = excelPreview.sheets[excelPreview.activeSheet] || [];
    return filterSheetBySearch(rows, excelPreview.search);
  }, [excelPreview]);

  const onDelete = async (item: StandaloneUpload) => {
    if (!window.confirm(`Delete "${item.displayName}"?`)) return;
    setError(null);
    try {
      await uploadsApi.delete(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {error && !showAddForm && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-4 py-2" role="alert">
          {error}
        </p>
      )}
      {showAddForm && (
        <div
          className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setShowAddForm(false);
            setError(null);
          }}
        >
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Upload Excel file</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Shared month and resource; each row is one file with its own name, tags, and spreadsheet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setError(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm sm:col-span-2">
                <span className="font-bold text-slate-700">Month</span>
                <select
                  value={monthsList.includes(formMonth) ? formMonth : monthsList[0] ?? formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
                >
                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <div className="relative z-[200] block text-sm sm:col-span-2">
                <span className="font-bold text-slate-700">Resource</span>
                <SearchableResourceSelect
                  value={resourceValue}
                  onChange={(next) => {
                    setResourceValue(next);
                    if (next !== OTHER_RESOURCE_PICK) setOtherResourceName("");
                  }}
                  options={formResourceOptions}
                  placeholder="Select block or office location…"
                  selectedLabelOverride={
                    isOtherResource ? otherResourceName.trim() || "Other" : undefined
                  }
                />
              </div>
              {isOtherResource && (
                <label className="block text-sm sm:col-span-2">
                  <span className="font-bold text-slate-700">Other resource name</span>
                  <input
                    type="text"
                    value={otherResourceName}
                    onChange={(e) => setOtherResourceName(e.target.value)}
                    placeholder="Type name and save with the file"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                    maxLength={200}
                    autoFocus
                  />
                </label>
              )}
            </div>

            <div className="space-y-3">
              {uploadEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">
                      File {index + 1}
                    </span>
                    {uploadEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeUploadEntry(entry.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">File name</span>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      {entry.excelFiles.length > 1
                        ? "Optional prefix; each file is saved as “prefix – filename”."
                        : "Required for a single file."}
                    </p>
                    <input
                      type="text"
                      value={entry.displayName}
                      onChange={(e) => updateUploadEntry(entry.id, { displayName: e.target.value })}
                      placeholder={
                        entry.excelFiles.length > 1
                          ? "e.g. Salary (optional)"
                          : "e.g. Partner reconciliation"
                      }
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      maxLength={200}
                      required={entry.excelFiles.length <= 1}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">Description (comma-separated tags to find later)</span>
                    <input
                      type="text"
                      value={entry.description}
                      onChange={(e) => updateUploadEntry(entry.id, { description: e.target.value })}
                      placeholder="e.g. billing, alamnagar, audit"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      maxLength={1000}
                    />
                  </label>
                  <div className="block text-sm">
                    <span className="font-bold text-slate-700">Excel file</span>
                    <ExcelFilePickField
                      files={entry.excelFiles}
                      onFilesChange={(excelFiles) => updateUploadEntry(entry.id, { excelFiles })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addUploadEntry}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#ff791a] border border-[#ff791a]/40 rounded-lg px-3 py-2 hover:bg-orange-50"
            >
              <Plus size={16} />
              Add more
            </button>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#ff791a] rounded-lg px-4 py-2 hover:bg-[#e66a12] disabled:opacity-50"
              >
                <Upload size={16} />
                {uploading
                  ? "Uploading…"
                  : (() => {
                      const n = uploadEntries.reduce((sum, e) => sum + e.excelFiles.length, 0);
                      return n > 1 ? `Save ${n} files` : "Save file";
                    })()}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setError(null);
                }}
                className="text-sm font-bold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            {error && showAddForm && (
              <p className="text-sm text-red-600 font-medium" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-visible">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Excel files</h3>
            <p className="text-xs text-slate-500 mt-0.5">All uploaded spreadsheets for the selected filters.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#ff791a] rounded-lg px-3 py-2 hover:bg-[#e66a12]"
            >
              <Plus size={14} />
              Add monthly file
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="relative z-[100] p-4 border-b border-slate-100 grid sm:grid-cols-2 lg:grid-cols-4 gap-2 overflow-visible">
          <label className="text-xs font-bold text-slate-600">
            Month
            <select
              value={monthsList.includes(listMonth) ? listMonth : monthsList[0] ?? listMonth}
              onChange={(e) => setListMonth(e.target.value)}
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-normal"
            >
              <option value="">All months</option>
              {monthsList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <div className="relative z-[200] text-xs font-bold text-slate-600">
            Resource
            <SearchableResourceSelect
              value={listResource}
              onChange={setListResource}
              options={listResourceOptions}
              placeholder="All resources"
              allowEmpty
              emptyLabel="All resources"
            />
          </div>
          <div className="relative z-[200] text-xs font-bold text-slate-600">
            Filename
            <SearchableFilenameSelect
              value={listFilenameId}
              onChange={setListFilenameId}
              options={filenameSelectOptions}
              placeholder="All files"
              emptyLabel="All files"
            />
          </div>
          <label className="text-xs font-bold text-slate-600">
            Search in Excel
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="name, amount, ID…"
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 font-normal"
            />
          </label>
        </div>

        {!excelSearchActive &&
          (loading && !filteredItems.length ? (
          <p className="p-6 text-sm text-slate-500 text-center">Loading…</p>
        ) : !filteredItems.length ? (
          <p className="p-6 text-sm text-slate-500 text-center">No Excel files match these filters.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/80">
                <div className="text-[#ff791a]">
                  <FileSpreadsheet size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{item.displayName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.monthKey || "—"} · {item.resourceLabel || "—"} · {formatBytes(item.storedSizeBytes)} ·{" "}
                    {item.uploadedBy} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.description && (
                    <p className="text-xs text-slate-600 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAddFormFromItem(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    Add more
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExcelPreview(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#ff791a] border border-[#ff791a]/30 rounded-lg px-2.5 py-1.5 hover:bg-orange-50"
                  >
                    <Eye size={14} />
                    View Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 border border-red-100 rounded-lg px-2.5 py-1.5 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {excelSearchActive && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col">
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Search size={18} className="text-[#ff791a] shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-slate-800">Excel search results</h2>
                <p className="text-xs text-slate-500">
                  {rowSearchLoading
                    ? "Searching spreadsheets…"
                    : `${rowSearchHits.length} row${rowSearchHits.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search in Excel…"
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-52 sm:w-80 bg-white font-normal"
                  autoFocus
                />
              </label>
              <button
                type="button"
                onClick={() => setListSearch("")}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close search results"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
            {rowSearchLoading ? (
              <p className="p-12 text-sm text-slate-500 text-center">Searching spreadsheets…</p>
            ) : rowSearchHits.length === 0 ? (
              <p className="p-12 text-sm text-slate-500 text-center">
                No rows match in the filtered Excel files.
              </p>
            ) : (
              <table className="w-full min-w-max text-left text-xs border-collapse bg-white">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 shadow-sm">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">File</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Sheet</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Row</th>
                    {excelSearchTable.dataLabels.map((label, colIdx) => (
                      <th
                        key={`fs-col-${colIdx}`}
                        className="py-2.5 px-3 font-bold whitespace-nowrap min-w-[100px]"
                        title={label}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap text-right sticky right-0 bg-slate-100">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowSearchHits.map((hit, idx) => (
                    <tr
                      key={`${hit.upload.id}-${hit.sheetName}-${hit.rowNumber}-${idx}`}
                      className="border-b border-slate-100 hover:bg-orange-50/40"
                    >
                      <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap align-top">
                        {hit.upload.displayName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap align-top">{hit.sheetName}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap tabular-nums align-top">
                        {hit.rowNumber}
                      </td>
                      {Array.from({ length: excelSearchTable.maxCols }, (_, colIdx) => {
                        const value = hit.cells[colIdx];
                        const text = value == null ? "" : String(value).trim();
                        return (
                          <td
                            key={colIdx}
                            className="py-2 px-3 text-slate-700 min-w-[100px] max-w-[320px] whitespace-normal break-words align-top"
                          >
                            {text || "—"}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right whitespace-nowrap align-top sticky right-0 bg-white">
                        <button
                          type="button"
                          onClick={() => openExcelPreviewFromHit(hit)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#ff791a] border border-[#ff791a]/30 rounded-lg px-2.5 py-1.5 hover:bg-orange-50"
                        >
                          <Eye size={14} />
                          View Excel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {excelPreview && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[210] flex items-center justify-center p-3 md:p-5"
          onClick={() => setExcelPreview(null)}
        >
          <div
            className="bg-[#f3f3f3] rounded-xl shadow-2xl border border-[#d4d4d4] w-full max-w-[96vw] h-[92vh] flex flex-col animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-[#d4d4d4] bg-white shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#ff791a] shrink-0" />
                <p
                  className="text-[11px] text-slate-600 font-mono truncate"
                  title={excelPreview.item.displayName}
                >
                  {excelPreview.item.displayName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="relative flex items-center">
                  <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="search"
                    value={excelPreview.search}
                    onChange={(e) =>
                      setExcelPreview((prev) =>
                        prev ? { ...prev, search: e.target.value } : prev,
                      )
                    }
                    placeholder="Search in sheet…"
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 sm:w-64 bg-white font-normal"
                  />
                </label>
                <a
                  href={excelPreview.item.imagekitUrl || uploadFileUrl(excelPreview.item.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#ff791a] hover:bg-[#e66a12] text-white rounded text-[10px] font-bold flex items-center gap-1"
                >
                  <Download size={11} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setExcelPreview(null)}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
              {excelPreview.loading ? (
                <p className="text-sm text-slate-500 text-center py-12">Loading Excel preview…</p>
              ) : (
                <>
                  {excelPreview.sheetNames.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      {excelPreview.sheetNames.map((sheetName) => (
                        <button
                          key={sheetName}
                          type="button"
                          onClick={() =>
                            setExcelPreview((prev) =>
                              prev ? { ...prev, activeSheet: sheetName } : prev,
                            )
                          }
                          className={`px-3 py-1 rounded-md text-[10px] font-bold border transition ${
                            excelPreview.activeSheet === sheetName
                              ? "bg-[#ff791a] text-white border-[#ff791a]"
                              : "bg-white text-slate-600 border-[#d4d4d4] hover:bg-slate-50"
                          }`}
                        >
                          {sheetName}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    <ExcelPreviewGrid
                      rows={previewRows}
                      headerRowCount={1}
                      emptyMessage={
                        excelPreview.search.trim()
                          ? "No rows match your search."
                          : "This file has no readable rows."
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
