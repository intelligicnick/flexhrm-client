import type { SchoolVisit, SchoolWork } from "../types";

export type EnrichedSchoolVisit = SchoolVisit & {
  district: string;
};

export function buildSchoolWorkDistrictMap(schoolWorks: SchoolWork[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const school of schoolWorks) {
    if (school.id && school.district?.trim()) {
      map.set(school.id, school.district.trim());
    }
  }
  return map;
}

export function enrichVisit(
  visit: SchoolVisit,
  districtBySchoolWorkId: Map<string, string>,
): EnrichedSchoolVisit {
  const district =
    districtBySchoolWorkId.get(visit.schoolWorkId)?.trim() ||
    visit.block?.trim() ||
    "Unassigned";
  return { ...visit, district };
}

export function enrichVisits(
  visits: SchoolVisit[],
  schoolWorks: SchoolWork[],
): EnrichedSchoolVisit[] {
  const districtMap = buildSchoolWorkDistrictMap(schoolWorks);
  return visits.map((visit) => enrichVisit(visit, districtMap));
}

export type VisitGroupMode = "list" | "supervisor" | "district" | "block";

export type VisitGroup = {
  key: string;
  label: string;
  visits: EnrichedSchoolVisit[];
  children?: VisitGroup[];
};

export function groupVisits(visits: EnrichedSchoolVisit[], mode: VisitGroupMode): VisitGroup[] {
  if (mode === "list") {
    return [{ key: "all", label: "All visits", visits }];
  }

  if (mode === "supervisor") {
    const bySupervisor = new Map<string, EnrichedSchoolVisit[]>();
    for (const visit of visits) {
      const key = visit.supervisorId || visit.supervisorName || "unknown";
      const bucket = bySupervisor.get(key) || [];
      bucket.push(visit);
      bySupervisor.set(key, bucket);
    }
    return Array.from(bySupervisor.entries())
      .map(([key, groupVisits]) => ({
        key,
        label: groupVisits[0]?.supervisorName || "Unknown supervisor",
        visits: groupVisits.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || "")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  if (mode === "district") {
    const byDistrict = new Map<string, EnrichedSchoolVisit[]>();
    for (const visit of visits) {
      const key = visit.district || "Unassigned";
      const bucket = byDistrict.get(key) || [];
      bucket.push(visit);
      byDistrict.set(key, bucket);
    }
    return Array.from(byDistrict.entries())
      .map(([key, groupVisits]) => ({
        key,
        label: key,
        visits: groupVisits.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || "")),
        children: groupVisitsByBlock(groupVisits),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const byBlock = new Map<string, EnrichedSchoolVisit[]>();
  for (const visit of visits) {
    const key = visit.block?.trim() || "Unassigned";
    const bucket = byBlock.get(key) || [];
    bucket.push(visit);
    byBlock.set(key, bucket);
  }
  return Array.from(byBlock.entries())
    .map(([key, groupVisits]) => ({
      key,
      label: key,
      visits: groupVisits.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || "")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function groupVisitsByBlock(visits: EnrichedSchoolVisit[]): VisitGroup[] {
  const byBlock = new Map<string, EnrichedSchoolVisit[]>();
  for (const visit of visits) {
    const key = visit.block?.trim() || "Unassigned";
    const bucket = byBlock.get(key) || [];
    bucket.push(visit);
    byBlock.set(key, bucket);
  }
  return Array.from(byBlock.entries())
    .map(([key, groupVisits]) => ({
      key,
      label: key,
      visits: groupVisits.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || "")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
