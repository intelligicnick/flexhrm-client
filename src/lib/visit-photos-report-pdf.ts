import { loadPdfExport } from "./lazy-export-deps";
import { resolvePhotoSrc } from "./media-url";
import type { EnrichedSchoolVisit } from "./visit-enrichment";
import { getDateRangeForPeriod } from "./supervisor-dates";
import type { ObserverPeriod } from "../pages/observer/ObserverPeriodTabs";
import type { SchoolVisitPhoto } from "../types";

export type VisitPhotosReportFilters = {
  period: ObserverPeriod;
  supervisorName?: string;
  district?: string;
  block?: string;
};

function formatHumanDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1] || parts[1]} ${parts[0]}`;
}

export function formatVisitPhotosPeriodLabel(period: ObserverPeriod): string {
  const range = getDateRangeForPeriod(period);
  if (period === "day") return `Daily — ${formatHumanDate(range.fromDate)}`;
  if (period === "week") {
    return `Weekly — ${formatHumanDate(range.fromDate)} – ${formatHumanDate(range.toDate)}`;
  }
  const [year, month] = (range.monthKey || "").split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return `Monthly — ${monthLabel}`;
}

function formatMaterials(visit: EnrichedSchoolVisit): string {
  if (!visit.materialsGiven?.length) return "";
  return visit.materialsGiven.map((m) => `${m.item} × ${m.qty}`).join(", ");
}

async function fetchImageDataUrl(src: string): Promise<string> {
  if (!src.trim()) throw new Error("Missing image URL");
  if (src.startsWith("data:")) return src;
  const response = await fetch(src, { credentials: "include", mode: "cors" });
  if (!response.ok) throw new Error(`Could not load image (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image data"));
    reader.readAsDataURL(blob);
  });
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.includes("image/png")) return "PNG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "JPEG";
}

async function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Could not measure image"));
    img.src = dataUrl;
  });
}

type DistrictGroup = {
  district: string;
  blocks: Map<
    string,
    {
      block: string;
      schools: Map<string, EnrichedSchoolVisit[]>;
    }
  >;
};

function groupVisitsForPdf(visits: EnrichedSchoolVisit[]): DistrictGroup[] {
  const districts = new Map<string, DistrictGroup>();

  for (const visit of visits) {
    const districtKey = visit.district || "Unassigned";
    const blockKey = visit.block?.trim() || "Unassigned";
    const schoolKey = visit.schoolName || visit.id;

    let districtGroup = districts.get(districtKey);
    if (!districtGroup) {
      districtGroup = { district: districtKey, blocks: new Map() };
      districts.set(districtKey, districtGroup);
    }

    let blockGroup = districtGroup.blocks.get(blockKey);
    if (!blockGroup) {
      blockGroup = { block: blockKey, schools: new Map() };
      districtGroup.blocks.set(blockKey, blockGroup);
    }

    const schoolVisits = blockGroup.schools.get(schoolKey) || [];
    schoolVisits.push(visit);
    blockGroup.schools.set(schoolKey, schoolVisits);
  }

  return Array.from(districts.values()).sort((a, b) => a.district.localeCompare(b.district));
}

function visitsWithPhotos(visits: EnrichedSchoolVisit[]): EnrichedSchoolVisit[] {
  return visits.filter((visit) => (visit.photos || []).some((photo) => resolvePhotoSrc(photo)));
}

export async function buildVisitPhotosReportPdf(
  visits: EnrichedSchoolVisit[],
  filters: VisitPhotosReportFilters,
  onProgress?: (message: string) => void,
): Promise<Blob> {
  const photoVisits = visitsWithPhotos(visits);
  if (photoVisits.length === 0) {
    throw new Error("No visit photos found for the selected filters.");
  }

  const { jsPDF } = await loadPdfExport();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Visit Photos Report", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(formatVisitPhotosPeriodLabel(filters.period), margin, y);
  y += 6;

  const filterLines = [
    filters.supervisorName ? `Supervisor: ${filters.supervisorName}` : "",
    filters.district ? `District: ${filters.district}` : "",
    filters.block ? `Block: ${filters.block}` : "",
  ].filter(Boolean);

  for (const line of filterLines) {
    doc.setFontSize(10);
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  const grouped = groupVisitsForPdf(photoVisits);

  for (const districtGroup of grouped) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(12, 30, 74);
    doc.text(`District: ${districtGroup.district}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    const blocks = Array.from(districtGroup.blocks.values()).sort((a, b) =>
      a.block.localeCompare(b.block),
    );

    for (const blockGroup of blocks) {
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Block: ${blockGroup.block}`, margin + 2, y);
      y += 7;

      const schools = Array.from(blockGroup.schools.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      for (const [schoolName, schoolVisits] of schools) {
        for (const visit of schoolVisits.sort((a, b) =>
          (b.visitDate || "").localeCompare(a.visitDate || ""),
        )) {
          const photos = (visit.photos || []).filter((photo) => resolvePhotoSrc(photo));
          if (photos.length === 0) continue;

          ensureSpace(14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(schoolName, margin + 4, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(
            `${visit.supervisorName || "—"} · ${formatHumanDate(visit.visitDate || "")} · ${visit.block || "—"}`,
            margin + 4,
            y,
          );
          y += 6;

          for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
            const photo = photos[photoIndex];
            onProgress?.(`Adding photo ${photoIndex + 1} of ${photos.length} for ${schoolName}…`);

            try {
              const src = resolvePhotoSrc(photo);
              const dataUrl = await fetchImageDataUrl(src);
              const format = imageFormatFromDataUrl(dataUrl);
              const { width, height } = await measureImage(dataUrl);

              const maxImageHeight = 180;
              const scale = Math.min(contentWidth / width, maxImageHeight / height, 1);
              const drawWidth = width * scale;
              const drawHeight = height * scale;

              ensureSpace(drawHeight + 18);
              doc.addImage(dataUrl, format, margin + 4, y, drawWidth, drawHeight, undefined, "FAST");
              y += drawHeight + 4;

              const captionParts = [
                photo.caption,
                photo.locationLabel,
                photo.takenAt
                  ? new Date(photo.takenAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                  : "",
              ].filter(Boolean);

              if (captionParts.length > 0) {
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                const caption = doc.splitTextToSize(captionParts.join(" · "), contentWidth - 8);
                doc.text(caption, margin + 4, y);
                y += caption.length * 3.5 + 1;
                doc.setTextColor(0, 0, 0);
              }

              const materials = formatMaterials(visit);
              if (materials) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text("Materials given:", margin + 4, y);
                y += 4;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                const materialLines = doc.splitTextToSize(materials, contentWidth - 8);
                doc.text(materialLines, margin + 4, y);
                y += materialLines.length * 4 + 4;
              } else {
                y += 3;
              }
            } catch {
              ensureSpace(8);
              doc.setFontSize(8);
              doc.setTextColor(180, 0, 0);
              doc.text("Could not load this photo.", margin + 4, y);
              doc.setTextColor(0, 0, 0);
              y += 6;
            }
          }
        }
      }
    }
  }

  return doc.output("blob");
}

export function visitPhotosReportFilename(filters: VisitPhotosReportFilters): string {
  const range = getDateRangeForPeriod(filters.period);
  const base = `visit_photos_${filters.period}_${range.fromDate}`;
  return `${base.replace(/[^\w.-]+/g, "_")}.pdf`;
}

export async function buildVisitPhotosReportFile(
  visits: EnrichedSchoolVisit[],
  filters: VisitPhotosReportFilters,
  onProgress?: (message: string) => void,
): Promise<File> {
  const blob = await buildVisitPhotosReportPdf(visits, filters, onProgress);
  return new File([blob], visitPhotosReportFilename(filters), { type: "application/pdf" });
}

export function countVisitPhotos(visits: EnrichedSchoolVisit[]): number {
  return visits.reduce((sum, visit) => {
    const photos = visit.photos || [];
    return sum + photos.filter((photo: SchoolVisitPhoto) => resolvePhotoSrc(photo)).length;
  }, 0);
}
