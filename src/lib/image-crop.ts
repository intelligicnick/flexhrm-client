export interface CropRegion {
  /** 0–1 relative to natural image width */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read the image."));
    img.src = url;
  });
}

/** Map a rectangle from displayed image coords to natural image coords. */
export function displayRectToNatural(
  rect: DisplayRect,
  displayW: number,
  displayH: number,
  naturalW: number,
  naturalH: number,
): CropRegion {
  const scaleX = naturalW / displayW;
  const scaleY = naturalH / displayH;
  const x = Math.max(0, rect.x * scaleX);
  const y = Math.max(0, rect.y * scaleY);
  const width = Math.min(naturalW - x, rect.width * scaleX);
  const height = Math.min(naturalH - y, rect.height * scaleY);
  return {
    x: x / naturalW,
    y: y / naturalH,
    width: width / naturalW,
    height: height / naturalH,
  };
}

export function naturalToDisplayRect(
  region: CropRegion,
  displayW: number,
  displayH: number,
): DisplayRect {
  return {
    x: region.x * displayW,
    y: region.y * displayH,
    width: region.width * displayW,
    height: region.height * displayH,
  };
}

export const FULL_CROP_REGION: CropRegion = { x: 0, y: 0, width: 1, height: 1 };

export async function cropImageDataUrl(
  dataUrl: string,
  region: CropRegion,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const srcX = Math.round(region.x * img.naturalWidth);
  const srcY = Math.round(region.y * img.naturalHeight);
  const srcW = Math.max(1, Math.round(region.width * img.naturalWidth));
  const srcH = Math.max(1, Math.round(region.height * img.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to crop the image.");

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  return canvas.toDataURL("image/png");
}

export function clampDisplayRect(
  rect: DisplayRect,
  maxW: number,
  maxH: number,
  minSize = 24,
): DisplayRect {
  const width = Math.max(minSize, Math.min(rect.width, maxW));
  const height = Math.max(minSize, Math.min(rect.height, maxH));
  const x = Math.max(0, Math.min(rect.x, maxW - width));
  const y = Math.max(0, Math.min(rect.y, maxH - height));
  return { x, y, width, height };
}
