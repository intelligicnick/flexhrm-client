const MIN_PARTIAL_LABEL_LENGTH = 3;

/** Common GPS spoofing apps to block before supervisor login (display names). */
export const RECOMMENDED_GPS_SPOOFING_BLOCKED_APPS = [
  "Fake GPS Location",
  "Fake GPS Joystick",
  "Fake GPS GO Location Spoofer",
  "GPS Emulator",
  "Fake GPS 360",
  "Fake GPS Location Professional",
  "Mock Locations",
  "Fake GPS Route",
  "Fly GPS",
  "Lockito",
  "Location Changer",
  "GPS Joystick",
  "Fake Location",
  "Fake GPS Expert",
  "Fake GPS by Lexa",
  "Fake GPS by IncorporateApps",
  "Mock GPS with Joystick",
  "Fake GPS Run",
  "Fake GPS Route Pro",
  "Fake GPS Navigation",
  "GPS JoyStick",
  "Joystick GPS",
  "Mock GPS Controller",
  "GPS Route Simulator",
  "GPS Movement Simulator",
] as const;

export function allSignificantTokensMatch(
  blockedLabelNorm: string,
  appLabelNorm: string,
  packageNorm: string,
): boolean {
  const tokens = blockedLabelNorm.split(/[^a-z0-9]+/);
  let significant = 0;
  let matched = 0;
  for (const token of tokens) {
    if (token.length < MIN_PARTIAL_LABEL_LENGTH) continue;
    significant++;
    if (appLabelNorm.includes(token) || packageNorm.includes(token)) matched++;
  }
  return significant > 0 && matched === significant;
}
