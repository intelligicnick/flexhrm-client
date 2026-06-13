import QRCode from "qrcode";

/** Public verification URL scanned from the ID card QR code. */
export const ID_CARD_VERIFY_BASE =
  "https://flexhrm.intelligic.org/employee";

export interface QrEmployeePayload {
  idNo: string;
  name: string;
  employeeCode: string;
  designation: string;
  dob: string;
  issueDate: string;
  expiryDate: string;
}

export function buildQrPayload(payload: QrEmployeePayload): string {
  const verifyUrl = `${ID_CARD_VERIFY_BASE}/${encodeURIComponent(payload.idNo)}`;
  return [
    verifyUrl,
    `ID:${payload.idNo}`,
    `Name:${payload.name}`,
    `Code:${payload.employeeCode}`,
    `Role:${payload.designation}`,
    `DOB:${payload.dob}`,
    `Issue:${payload.issueDate}`,
    `Expiry:${payload.expiryDate}`,
  ].join("\n");
}

export async function generateEmployeeQrDataUrl(
  payload: QrEmployeePayload,
): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(payload), {
    width: 120,
    margin: 0,
    errorCorrectionLevel: "L",
  });
}
