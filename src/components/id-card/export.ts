import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const RENDER_SCALE = 2;

export interface CardSidePng {
  dataUrl: string;
  width: number;
  height: number;
}

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

function normalizeExportClone(element: HTMLElement): void {
  let node: HTMLElement | null = element;
  while (node) {
    node.style.opacity = "1";
    node.style.visibility = "visible";
    node = node.parentElement;
  }
}

async function toCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForImages(element);
  return html2canvas(element, {
    scale: RENDER_SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (_doc, clonedElement) => {
      normalizeExportClone(clonedElement);
    },
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

function pageOrientation(width: number, height: number): "portrait" | "landscape" {
  return width >= height ? "landscape" : "portrait";
}

/** Same raster capture used by Front PNG / Back PNG buttons. */
export async function captureCardSidePng(element: HTMLElement): Promise<CardSidePng> {
  const canvas = await toCanvas(element);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function captureBothSidePngs(
  front: HTMLElement,
  back: HTMLElement,
): Promise<{ front: CardSidePng; back: CardSidePng }> {
  const [frontPng, backPng] = await Promise.all([
    captureCardSidePng(front),
    captureCardSidePng(back),
  ]);
  return { front: frontPng, back: backPng };
}

/** Page 1 = front PNG, page 2 = back PNG — identical captures to the PNG buttons. */
export async function buildCardPdfBlob(
  front: HTMLElement,
  back: HTMLElement,
): Promise<Blob> {
  const { front: frontPng, back: backPng } = await captureBothSidePngs(front, back);

  const doc = new jsPDF({
    orientation: pageOrientation(frontPng.width, frontPng.height),
    unit: "px",
    format: [frontPng.width, frontPng.height],
    compress: true,
  });

  doc.addImage(frontPng.dataUrl, "PNG", 0, 0, frontPng.width, frontPng.height);
  doc.addPage(
    [backPng.width, backPng.height],
    pageOrientation(backPng.width, backPng.height),
  );
  doc.addImage(backPng.dataUrl, "PNG", 0, 0, backPng.width, backPng.height);

  return doc.output("blob");
}

export async function exportCardPng(element: HTMLElement, filename: string): Promise<void> {
  const png = await captureCardSidePng(element);
  const blob = await fetch(png.dataUrl).then((res) => res.blob());
  saveBlob(blob, filename);
}

export async function exportBothSidesPng(
  front: HTMLElement,
  back: HTMLElement,
  baseName: string,
): Promise<void> {
  await exportCardPng(front, `${baseName}_front.png`);
  await exportCardPng(back, `${baseName}_back.png`);
}

export async function exportBothSidesPdf(
  front: HTMLElement,
  back: HTMLElement,
  filename: string,
): Promise<void> {
  const blob = await buildCardPdfBlob(front, back);
  saveBlob(blob, filename);
}

function buildPrintHtml(frontPng: CardSidePng, backPng: CardSidePng): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ID Card Print</title>
    <style>
      @page {
        margin: 0;
        size: ${frontPng.width}px ${frontPng.height}px;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        margin: 0;
      }
      .page {
        width: ${frontPng.width}px;
        height: ${frontPng.height}px;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
      }
      .page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <img src="${frontPng.dataUrl}" alt="ID Card Front" />
    </div>
    <div class="page">
      <img src="${backPng.dataUrl}" alt="ID Card Back" />
    </div>
  </body>
</html>`;
}

/** Print front PNG then back PNG — same captures as the PNG export buttons. */
export async function printCards(front: HTMLElement, back: HTMLElement): Promise<void> {
  const { front: frontPng, back: backPng } = await captureBothSidePngs(front, back);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.remove();
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    throw new Error("Unable to open print preview.");
  }

  doc.open();
  doc.write(buildPrintHtml(frontPng, backPng));
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    throw new Error("Unable to open print preview.");
  }

  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  window.setTimeout(cleanup, 60_000);
}
