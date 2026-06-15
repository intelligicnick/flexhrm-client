import { describe, expect, it } from "vitest";
import {
  findInstalledBlockedApps,
  parseBlockedAppEntry,
  type InstalledApp,
} from "./supervisor-installed-apps";

describe("supervisor-installed-apps", () => {
  it("parses package IDs and display|package entries", () => {
    expect(parseBlockedAppEntry("com.whatsapp")).toEqual({
      label: "com.whatsapp",
      packageNames: ["com.whatsapp"],
    });
    expect(parseBlockedAppEntry("WhatsApp|com.whatsapp")).toEqual({
      label: "WhatsApp",
      packageNames: ["com.whatsapp"],
    });
    expect(parseBlockedAppEntry("WhatsApp")).toEqual({
      label: "WhatsApp",
      packageNames: ["com.whatsapp", "com.whatsapp.w4b"],
    });
  });

  it("detects installed blocked apps by package or label", () => {
    const installed: InstalledApp[] = [
      { packageName: "com.whatsapp", appName: "WhatsApp" },
      { packageName: "com.flexhrm.supervisor", appName: "Flex HRM" },
    ];

    const detected = findInstalledBlockedApps(
      ["com.whatsapp", "Telegram|org.telegram.messenger", "Instagram"],
      installed,
    );

    expect(detected).toHaveLength(1);
    expect(detected[0].packageName).toBe("com.whatsapp");
  });

  it("does not flag blocked labels that are not installed", () => {
    const installed: InstalledApp[] = [
      { packageName: "com.flexhrm.supervisor", appName: "Flex HRM Field Team" },
    ];

    const detected = findInstalledBlockedApps(
      ["WhatsApp", "Telegram", "Zoom", "AnyTo", "Fake GPS"],
      installed,
    );

    expect(detected).toHaveLength(0);
  });

  it("does not fuzzy-match partial app names", () => {
    const installed: InstalledApp[] = [
      { packageName: "com.google.android.apps.photos", appName: "Photos" },
    ];

    const detected = findInstalledBlockedApps(["To"], installed);

    expect(detected).toHaveLength(0);
  });
});
