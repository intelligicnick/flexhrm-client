import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bridgeJava = readFileSync(
  join(
    root,
    "android-supervisor-app/app/src/main/java/com/flexhrm/supervisor/FlexHrmAndroidBridge.java",
  ),
  "utf8",
);

const EXPECTED_BRIDGE_METHODS = [
  "getDeviceId",
  "getBuildNumber",
  "isNativeApp",
  "getApiBase",
  "getInstalledApps",
  "uninstallApp",
  "getGpsCoordinates",
  "warmupGps",
  "capturePhoto",
  "requestFreshGps",
  "saveSupervisorSession",
  "getSupervisorSession",
  "clearSupervisorSession",
];

const TS_BRIDGE_USAGE = [
  "getGpsCoordinates",
  "requestFreshGps",
  "warmupGps",
  "capturePhoto",
  "getDeviceId",
  "getInstalledApps",
  "uninstallApp",
  "getApiBase",
  "isNativeApp",
  "saveSupervisorSession",
  "getSupervisorSession",
  "clearSupervisorSession",
];

describe("native android bridge contract", () => {
  it("exposes all documented JavascriptInterface methods in Java bridge", () => {
    for (const method of EXPECTED_BRIDGE_METHODS) {
      expect(bridgeJava).toMatch(new RegExp(`public\\s+\\w+[\\s\\w<>\\[\\],]*\\s+${method}\\s*\\(`));
    }
  });

  it("matches TypeScript bridge usage to Java bridge methods", () => {
    for (const method of TS_BRIDGE_USAGE) {
      expect(bridgeJava).toContain(`${method}(`);
    }
  });
});
