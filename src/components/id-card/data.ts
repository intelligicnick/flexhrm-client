import { Employee } from "../../types";
import { IdCardData } from "./types";

function formatDate(value: string | undefined): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function expiryFromIssue(issueDate: string): string {
  if (issueDate === "—") return "—";
  const [day, month, year] = issueDate.split("/").map(Number);
  if (!day || !month || !year) return "—";
  const expiry = new Date(year + 1, month - 1, day);
  if (Number.isNaN(expiry.getTime())) return "—";
  return expiry.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function issueDate(employee: Employee): string {
  const joining = formatDate(employee.pfJoiningDate);
  if (joining !== "—") return joining;
  if (employee.idCardGeneratedAt) {
    return formatDate(employee.idCardGeneratedAt);
  }
  return formatDate(new Date().toISOString());
}

export function buildCardData(
  employee: Employee,
  photoUrl: string | null,
  idCard?: string,
  qrCode: string | null = null,
): IdCardData {
  const issue = issueDate(employee);

  return {
    photo: photoUrl,
    idNumber: idCard?.trim() || employee.idCard?.trim() || "—",
    name: employee.nameAsPerAadhar?.trim() || "—",
    designation: employee.role?.trim() || "—",
    dob: formatDate(employee.dateOfBirth),
    issueDate: issue,
    expiryDate: expiryFromIssue(issue),
    qrCode,
  };
}

export function previewScale(containerWidth: number, cardWidth: number): number {
  return containerWidth / cardWidth;
}
