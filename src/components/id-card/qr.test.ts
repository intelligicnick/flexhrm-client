import { describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_FRONTEND_ORIGIN,
  PRODUCTION_ID_CARD_VERIFY_BASE,
} from "../../deploy-urls";

vi.mock("../../env", () => ({
  getIdCardVerifyBase: () => PRODUCTION_ID_CARD_VERIFY_BASE,
}));

import { buildQrPayload } from "./qr";
import {
  getIdCardVerifyUrl,
  parseIdCardFromVerifyParam,
  parseVerifyTokenFromParam,
} from "./verify-url";

const SAMPLE_TOKEN =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

describe("getIdCardVerifyUrl", () => {
  it("uses a dedicated public verify route with a secret token", () => {
    expect(getIdCardVerifyUrl("IS0111", SAMPLE_TOKEN)).toBe(
      `${PRODUCTION_FRONTEND_ORIGIN}/verify/IS0111/${encodeURIComponent(SAMPLE_TOKEN)}`,
    );
  });
});

describe("parseIdCardFromVerifyParam", () => {
  it("extracts the ID when scanners append the full QR payload to the path", () => {
    const malformed =
      "IS0111\nID:IS0111\nName:Subhash Kumar\nCode:IS-01\nRole:Supervisor";
    expect(parseIdCardFromVerifyParam(malformed)).toBe("IS0111");
  });

  it("extracts the ID from URL-encoded scanner payloads", () => {
    const encoded =
      "IS0111%0AID:IS0111%0AName:Subhash%20Kumar%0ACode:IS-01";
    expect(parseIdCardFromVerifyParam(encoded)).toBe("IS0111");
  });

  it("reads the id query param from a full verification URL", () => {
    expect(
      parseIdCardFromVerifyParam(
        `${PRODUCTION_FRONTEND_ORIGIN}/verify?id=IS0111&token=${SAMPLE_TOKEN}`,
      ),
    ).toBe("IS0111");
  });
});

describe("parseVerifyTokenFromParam", () => {
  it("reads the token from a full verification URL path", () => {
    expect(
      parseVerifyTokenFromParam(
        getIdCardVerifyUrl("IS0111", SAMPLE_TOKEN),
      ),
    ).toBe(SAMPLE_TOKEN);
  });

  it("reads the token query param from a full verification URL", () => {
    expect(
      parseVerifyTokenFromParam(
        `${PRODUCTION_FRONTEND_ORIGIN}/verify/IS0111`,
        `token=${encodeURIComponent(SAMPLE_TOKEN)}`,
      ),
    ).toBe(SAMPLE_TOKEN);
  });
});

describe("buildQrPayload", () => {
  it("encodes only the verification URL", () => {
    const payload = buildQrPayload({
      idNo: "IS0111",
      verifyToken: SAMPLE_TOKEN,
      name: "Jane Doe",
      employeeCode: "IS-01",
      designation: "Supervisor",
      dob: "01/01/1990",
      issueDate: "01/06/2025",
      expiryDate: "01/06/2026",
    });

    expect(payload).toBe(
      `${PRODUCTION_FRONTEND_ORIGIN}/verify/IS0111/${encodeURIComponent(SAMPLE_TOKEN)}`,
    );
  });
});
