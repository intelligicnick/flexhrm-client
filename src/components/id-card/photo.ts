import { CARD_PHOTO } from "./constants";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read the selected photo."));
    img.src = url;
  });
}

/** Cover-crops to the circular portrait slot (center-top, same as card CSS). */
function renderCoverPhoto(img: HTMLImageElement): string {
  const targetSize = CARD_PHOTO.circleSize;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const scale = Math.max(targetSize / srcW, targetSize / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (targetSize - drawW) / 2;
  const offsetY = 0;

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to process the selected photo.");
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Fits the photo for the round ID card slot on upload. */
export function prepareCardPhoto(file: File): Promise<string> {
  const { minWidth, minHeight } = CARD_PHOTO;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);

    void loadImage(objectUrl)
      .then((img) => {
        URL.revokeObjectURL(objectUrl);

        if (img.naturalWidth < minWidth || img.naturalHeight < minHeight) {
          reject(
            new Error(
              `Photo is too small. Upload a portrait image at least ${minWidth}×${minHeight} px.`,
            ),
          );
          return;
        }

        resolve(renderCoverPhoto(img));
      })
      .catch((err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err instanceof Error ? err : new Error("Unable to read the selected photo."));
      });
  });
}

/** Reframes a stored photo for round ID card display. */
export async function fitPhotoForIdCard(photoSrc: string): Promise<string> {
  const img = await loadImage(photoSrc);
  return renderCoverPhoto(img);
}
