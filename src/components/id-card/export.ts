import html2canvas from "html2canvas";
import { CARD_SIZE } from "./constants";

const RENDER_SCALE = 2;
const PRINT_ROOT_ID = "id-card-print-root";

async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

async function toCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForImages(element);
  return html2canvas(element, {
    scale: RENDER_SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportCardPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await toCanvas(element);
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to create image."));
        return;
      }
      saveBlob(blob, filename);
      resolve();
    }, "image/png");
  });
}

export async function exportBothSidesPng(
  front: HTMLElement,
  back: HTMLElement,
  baseName: string,
): Promise<void> {
  await exportCardPng(front, `${baseName}_front.png`);
  await exportCardPng(back, `${baseName}_back.png`);
}

export async function printCards(front: HTMLElement, back: HTMLElement): Promise<void> {
  const [frontCanvas, backCanvas] = await Promise.all([toCanvas(front), toCanvas(back)]);

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.className = "id-card-print-root";
  root.setAttribute("aria-hidden", "true");

  for (const [canvas, side] of [
    [frontCanvas, "front"],
    [backCanvas, "back"],
  ] as const) {
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.alt = `${side} ID card`;
    img.setAttribute("data-card-side", side);
    root.appendChild(img);
  }

  document.body.appendChild(root);

  const cleanup = () => {
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  await waitForImages(root);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  window.print();
}
