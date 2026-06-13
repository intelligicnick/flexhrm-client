import { describe, expect, it, vi } from "vitest";

vi.mock("../../env", () => ({
  getIdCardVerifyBase: () =>
    "https://greenyellow-woodpecker-750354.hostingersite.com/employee",
}));

import { buildQrPayload } from "./qr";
import { getIdCardVerifyUrl, parseIdCardFromVerifyParam } from "./verify-url";

describe("getIdCardVerifyUrl", () => {
  it("uses a dedicated public verify route instead of the portal root", () => {
    expect(getIdCardVerifyUrl("IS0111")).toBe(
      "https://greenyellow-woodpecker-750354.hostingersite.com/verify/IS0111",
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
        "https://greenyellow-woodpecker-750354.hostingersite.com/verify?id=IS0111",
      ),
    ).toBe("IS0111");
  });
});

describe("buildQrPayload", () => {
  it("encodes only the verification URL", () => {
    const payload = buildQrPayload({
      idNo: "IS0111",
      name: "Jane Doe",
      employeeCode: "IS-01",
      designation: "Supervisor",
      dob: "01/01/1990",
      issueDate: "01/06/2025",
      expiryDate: "01/06/2026",
    });

    expect(payload).toBe(
      "https://greenyellow-woodpecker-750354.hostingersite.com/verify/IS0111",
    );
  });
});
