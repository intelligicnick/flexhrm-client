import QRCode from "qrcode";
import { getIdCardVerifyUrl } from "./verify-url";

export interface QrEmployeePayload {
  idNo: string;
  verifyToken: string;
  name: string;
  employeeCode: string;
  designation: string;
  dob: string;
  issueDate: string;
  expiryDate: string;
}

export function buildQrPayload(payload: QrEmployeePayload): string {
  return getIdCardVerifyUrl(payload.idNo, payload.verifyToken);
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
