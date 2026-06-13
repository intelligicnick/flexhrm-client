import QRCode from "qrcode";
import { getIdCardVerifyBase } from "../../env";

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
  const verifyUrl = `${getIdCardVerifyBase()}/${encodeURIComponent(payload.idNo)}`;
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

const QR_DISPLAY_PX = 38;

export async function generateEmployeeQrDataUrl(
  payload: QrEmployeePayload,
): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(payload), {
    width: QR_DISPLAY_PX,
    margin: 0,
    errorCorrectionLevel: "L",
  });
}
