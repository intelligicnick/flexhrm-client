import * as pdfjsLib from "pdfjs-dist";
import type { Employee } from "../types";
import { MONTH_NAME_LIST } from "./date-helpers";
import { extractReferenceMusterRollPageText } from "./attendance-pdf-grid-extract";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

function pdfTextItems(content: { items: PdfTextItem[] }): Array<{ str: string; x: number; y: number }> {
  const items: Array<{ str: string; x: number; y: number }> = [];
  for (const item of content.items) {
    if (!item.str?.trim() || !item.transform) continue;
    items.push({
      str: item.str,
      x: item.transform[4],
      y: Math.round(item.transform[5]),
    });
  }
  return items;
}

/** Group PDF glyphs by Y position so table rows stay intact. */
export function extractPageTextWithLines(content: { items: PdfTextItem[] }): string {
  const items = pdfTextItems(content);
  if (items.length === 0) return "";

  const lines = new Map<number, Array<{ str: string; x: number; y: number }>>();
  for (const item of items) {
    const bucket = lines.get(item.y) ?? [];
    bucket.push(item);
    lines.set(item.y, bucket);
  }

  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to render the PDF page.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export type AttendancePdfExtractResult = {
  fullText: string;
  pageCount: number;
  source: "typed-text" | "ocr";
};

let ocrWorkerPromise: Promise<import("tesseract.js").Worker> | null = null;
let ocrModulePromise: Promise<typeof import("tesseract.js")> | null = null;

async function getOcrModule(): Promise<typeof import("tesseract.js")> {
  if (!ocrModulePromise) {
    ocrModulePromise = import("tesseract.js");
  }
  return ocrModulePromise;
}

async function getOcrWorker(): Promise<import("tesseract.js").Worker> {
  if (!ocrWorkerPromise) {
    const { createWorker } = await getOcrModule();
    ocrWorkerPromise = createWorker("eng");
  }
  return ocrWorkerPromise;
}

export async function terminateAttendanceOcrWorker(): Promise<void> {
  if (ocrWorkerPromise) {
    const worker = await ocrWorkerPromise;
    await worker.terminate();
    ocrWorkerPromise = null;
  }
}

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  return data.text.trim();
}

async function ocrRegion(
  canvas: HTMLCanvasElement,
  mode: "header" | "name" | "total" | "generic",
): Promise<string> {
  const worker = await getOcrWorker();
  const { PSM } = await getOcrModule();
  if (mode === "header") {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :-/",
    });
  } else if (mode === "name") {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .'-",
    });
  } else if (mode === "total") {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_CHAR,
      tessedit_char_whitelist: "0123456789",
    });
  } else {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
  }
  const { data } = await worker.recognize(canvas);
  return data.text.trim();
}

/**
 * Extract text from an attendance PDF. Uses embedded text when available;
 * falls back to OCR on rendered pages for scanned / pen-written sheets.
 */
export async function extractAttendancePdfText(
  file: File,
  onProgress?: (message: string, percent: number) => void,
  preferredMonthKey?: string,
  employees?: Employee[],
): Promise<AttendancePdfExtractResult> {
  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const typedPages: string[] = [];

  onProgress?.("Reading typed text from PDF…", 5);
  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    typedPages.push(extractPageTextWithLines(content as { items: PdfTextItem[] }));
    onProgress?.(`Reading page ${i} of ${pageCount}…`, 5 + Math.round((i / pageCount) * 35));
  }

  const typedText = typedPages.join("\n\n").trim();
  const typedAlphaCount = (typedText.match(/[A-Za-z]/g) ?? []).length;
  const looksTyped = typedAlphaCount > 80 && /attendance|emp\s*code|location/i.test(typedText);

  if (looksTyped) {
    return { fullText: typedText, pageCount, source: "typed-text" };
  }

  onProgress?.("Low text detected — using attendance grid extraction…", 45);
  const structuredPages: string[] = [];
  let detectedMonthKey = preferredMonthKey;
  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(3.2, Math.max(2.2, 2200 / baseViewport.width));
    const canvas = await renderPageToCanvas(page, scale);
    const structured = await extractReferenceMusterRollPageText(canvas, {
      preferredMonthKey: detectedMonthKey,
      recognizeCrop: (cropCanvas, mode) => ocrRegion(cropCanvas, mode),
      employees,
    });
    if (structured) {
      structuredPages.push(structured.text);
      detectedMonthKey = structured.monthKey ?? detectedMonthKey;
      onProgress?.(`Extracted table ${i} of ${pageCount}…`, 45 + Math.round((i / pageCount) * 45));
      continue;
    }

    const pageText = await ocrRegion(canvas, "generic");
    structuredPages.push(pageText);
    onProgress?.(`OCR page ${i} of ${pageCount}…`, 45 + Math.round((i / pageCount) * 45));
  }

  const ocrText = structuredPages.join("\n\n").trim();
  if (ocrText.length > typedText.length) {
    return { fullText: ocrText, pageCount, source: "ocr" };
  }
  return {
    fullText: typedText || ocrText,
    pageCount,
    source: typedText ? "typed-text" : "ocr",
  };
}

/** Parse month key like "April 2026" from attendance sheet header text. */
export function detectMonthKeyFromText(text: string, fallback?: string): string | undefined {
  const monthPattern = MONTH_NAME_LIST.join("|");
  const match = text.match(new RegExp(`(${monthPattern})\\s+(20\\d{2})`, "i"));
  if (match) {
    const monthName =
      MONTH_NAME_LIST.find((m) => m.toLowerCase() === match[1].toLowerCase()) ?? match[1];
    return `${monthName} ${match[2]}`;
  }

  const abbrToMonth: Record<string, string> = {
    JAN: "January",
    FEB: "February",
    MAR: "March",
    APR: "April",
    MAY: "May",
    JUN: "June",
    JUL: "July",
    AUG: "August",
    SEP: "September",
    OCT: "October",
    NOV: "November",
    DEC: "December",
  };
  const rangeMatch = text.match(
    /(?:FROM\s+)?\d{1,2}\s+([A-Z]{3})\s+(20\d{2})\s+TO\s+\d{1,2}\s+([A-Z]{3})\s+(20\d{2})/i,
  );
  if (rangeMatch) {
    const monthName = abbrToMonth[rangeMatch[1].toUpperCase()];
    if (monthName) {
      return `${monthName} ${rangeMatch[2]}`;
    }
  }

  return fallback;
}
