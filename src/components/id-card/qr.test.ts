import { describe, expect, it, vi } from "vitest";

vi.mock("../../env", () => ({
  getIdCardVerifyBase: () =>
    "https://greenyellow-woodpecker-750354.hostingersite.com/employee",
}));

import { buildQrPayload } from "./qr";

describe("buildQrPayload", () => {
  it("embeds the Hostinger verification URL and employee fields", () => {
    const payload = buildQrPayload({
      idNo: "IS0111",
      name: "Jane Doe",
      employeeCode: "IS-01",
      designation: "Supervisor",
      dob: "01/01/1990",
      issueDate: "01/06/2025",
      expiryDate: "01/06/2026",
    });

    expect(payload).toContain(
      "https://greenyellow-woodpecker-750354.hostingersite.com/employee/IS0111",
    );
    expect(payload).toContain("ID:IS0111");
    expect(payload).toContain("Name:Jane Doe");
    expect(payload).toContain("Code:IS-01");
    expect(payload).toContain("Role:Supervisor");
    expect(payload).toContain("DOB:01/01/1990");
    expect(payload).toContain("Issue:01/06/2025");
    expect(payload).toContain("Expiry:01/06/2026");
  });
});
