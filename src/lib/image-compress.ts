export interface CompressResult {
  dataUrl: string;
  mimeType: string;
  compressedSizeBytes: number;
  originalSizeBytes: number;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read the selected image."));
    img.src = url;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read the selected file."));
    };
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop()! : dataUrl;
  return Math.ceil((base64.replace(/\s/g, "").length * 3) / 4);
}

async function renderCompressedJpeg(
  img: HTMLImageElement,
  quality: number,
  maxWidth = 1600,
  maxHeight = 1600,
): Promise<CompressResult> {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  let targetW = srcW;
  let targetH = srcH;
  if (srcW > maxWidth || srcH > maxHeight) {
    const scale = Math.min(maxWidth / srcW, maxHeight / srcH);
    targetW = Math.round(srcW * scale);
    targetH = Math.round(srcH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process the selected image.");

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const clampedQuality = Math.min(1, Math.max(0.1, quality));
  const dataUrl = canvas.toDataURL("image/jpeg", clampedQuality);

  return {
    dataUrl,
    mimeType: "image/jpeg",
    compressedSizeBytes: estimateDataUrlBytes(dataUrl),
    originalSizeBytes: 0,
    width: targetW,
    height: targetH,
  };
}

/**
 * Compress an image data URL with adjustable JPEG quality (0.1–1.0).
 */
export async function compressImageDataUrl(
  dataUrl: string,
  quality: number,
  maxWidth = 1600,
  maxHeight = 1600,
  originalSizeBytes = 0,
): Promise<CompressResult> {
  const img = await loadImage(dataUrl);
  const result = await renderCompressedJpeg(img, quality, maxWidth, maxHeight);
  return { ...result, originalSizeBytes: originalSizeBytes || result.compressedSizeBytes };
}

/**
 * Compress an image file with adjustable JPEG quality (0.1–1.0).
 * Large images are downscaled to fit within maxWidth × maxHeight.
 */
export async function compressImageFile(
  file: File,
  quality: number,
  maxWidth = 1600,
  maxHeight = 1600,
): Promise<CompressResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const result = await renderCompressedJpeg(img, quality, maxWidth, maxHeight);
    return { ...result, originalSizeBytes: file.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function readPdfAsDataUrl(file: File): Promise<CompressResult> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    dataUrl,
    mimeType: "application/pdf",
    compressedSizeBytes: file.size,
    originalSizeBytes: file.size,
    width: 0,
    height: 0,
  };
}

export function compressionPercent(quality: number): number {
  return Math.round(quality * 100);
}

export function qualityFromPercent(percent: number): number {
  return Math.min(1, Math.max(0.1, percent / 100));
}

export function savingsPercent(original: number, compressed: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}
