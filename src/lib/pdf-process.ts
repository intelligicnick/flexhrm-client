import { pdfjsLib } from "./pdf-worker-setup";
import { jsPDF } from "jspdf";
import {
  CompressResult,
  qualityFromPercent,
} from "./image-compress";

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop()! : dataUrl;
  return Math.ceil((base64.replace(/\s/g, "").length * 3) / 4);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop()! : dataUrl;
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read the PDF page image."));
    img.src = url;
  });
}

async function loadPdfDocument(dataUrl: string) {
  const data = dataUrlToUint8Array(dataUrl);
  return pdfjsLib.getDocument({ data }).promise;
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

function pageScaleForBounds(
  pageWidth: number,
  pageHeight: number,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): number {
  const fitScale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight, 2);
  const qualityScale = 0.45 + quality * 0.55;
  return Math.max(0.35, fitScale * qualityScale);
}

/**
 * Render the first PDF page as a PNG data URL for crop/edit previews.
 */
export async function renderPdfFirstPageAsImage(
  pdfDataUrl: string,
  maxWidth = 1600,
  maxHeight = 1600,
): Promise<string> {
  const pdf = await loadPdfDocument(pdfDataUrl);
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = pageScaleForBounds(
    baseViewport.width,
    baseViewport.height,
    maxWidth,
    maxHeight,
    1,
  );
  const canvas = await renderPageToCanvas(page, scale);
  return canvas.toDataURL("image/png");
}

/**
 * Rebuild a PDF from rendered page images at the requested quality.
 */
export async function compressPdfDataUrl(
  pdfDataUrl: string,
  qualityPercent: number,
  maxWidth = 1600,
  maxHeight = 1600,
  originalSizeBytes = 0,
): Promise<CompressResult & { quality: number }> {
  const quality = qualityFromPercent(qualityPercent);
  const pdf = await loadPdfDocument(pdfDataUrl);
  const pageCount = pdf.numPages;

  const pages: Array<{ dataUrl: string; width: number; height: number }> = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = pageScaleForBounds(
      baseViewport.width,
      baseViewport.height,
      maxWidth,
      maxHeight,
      quality,
    );
    const canvas = await renderPageToCanvas(page, scale);
    pages.push({
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      width: canvas.width,
      height: canvas.height,
    });
  }

  if (pages.length === 0) {
    throw new Error("The PDF has no pages to process.");
  }

  const first = pages[0];
  const doc = new jsPDF({
    orientation: first.width >= first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
    compress: true,
  });

  doc.addImage(first.dataUrl, "JPEG", 0, 0, first.width, first.height, undefined, "FAST");
  for (let i = 1; i < pages.length; i += 1) {
    const page = pages[i];
    doc.addPage(
      [page.width, page.height],
      page.width >= page.height ? "landscape" : "portrait",
    );
    doc.addImage(page.dataUrl, "JPEG", 0, 0, page.width, page.height, undefined, "FAST");
  }

  const dataUrl = doc.output("datauristring");
  return {
    dataUrl,
    mimeType: "application/pdf",
    compressedSizeBytes: estimateDataUrlBytes(dataUrl),
    originalSizeBytes: originalSizeBytes || estimateDataUrlBytes(pdfDataUrl),
    width: first.width,
    height: first.height,
    quality,
  };
}

/**
 * Wrap a cropped/compressed image back into a single-page PDF.
 */
export async function imageDataUrlToPdf(
  imageDataUrl: string,
  qualityPercent: number,
  originalSizeBytes = 0,
): Promise<CompressResult & { quality: number }> {
  const quality = qualityFromPercent(qualityPercent);
  const img = await loadImage(imageDataUrl);

  let targetW = img.naturalWidth;
  let targetH = img.naturalHeight;
  const maxDim = 1600;
  if (targetW > maxDim || targetH > maxDim) {
    const scale = Math.min(maxDim / targetW, maxDim / targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process the cropped PDF page.");

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);

  const doc = new jsPDF({
    orientation: targetW >= targetH ? "landscape" : "portrait",
    unit: "px",
    format: [targetW, targetH],
    compress: true,
  });
  doc.addImage(jpegDataUrl, "JPEG", 0, 0, targetW, targetH, undefined, "FAST");

  const dataUrl = doc.output("datauristring");
  return {
    dataUrl,
    mimeType: "application/pdf",
    compressedSizeBytes: estimateDataUrlBytes(dataUrl),
    originalSizeBytes,
    width: targetW,
    height: targetH,
    quality,
  };
}
