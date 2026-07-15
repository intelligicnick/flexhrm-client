/** Client-side mirror of backend place validation — flags Block Office / wrong-village matches. */

function normalizeToken(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_SCHOOL_WORDS = new Set([
  "kanya",
  "govt",
  "government",
  "school",
  "vidyalaya",
  "vidyalay",
  "middle",
  "primary",
  "high",
  "upgrade",
  "upgraded",
  "basic",
  "adarsh",
  "janta",
  "nps",
  "ups",
  "ums",
  "ms",
  "ps",
  "hs",
  "u",
  "m",
  "s",
  "p",
  "h",
]);

export function localityHintFromSchoolName(schoolName: string): string {
  const trimmed = schoolName.trim();
  if (!trimmed) return "";

  const afterBasicSchool = trimmed.match(/^basic\s+school\s+(.+)$/i);
  if (afterBasicSchool?.[1]) {
    const locality = afterBasicSchool[1].trim();
    if (locality.length >= 3 && locality.length <= 80) return locality;
  }

  const schoolTypeToken =
    "(?:u\\.?\\s?h\\.?\\s?s\\.?|u\\.?\\s?m\\.?\\s?s\\.?|u\\.?\\s?p\\.?\\s?s\\.?|n\\.?\\s?p\\.?\\s?s\\.?|h\\.?\\s?s\\.?|m\\.?\\s?s\\.?|p\\.?\\s?s\\.?)";
  const afterEmbeddedType = trimmed.match(
    new RegExp(`^.+\\s+${schoolTypeToken}\\s+(.+)$`, "i"),
  );
  if (afterEmbeddedType?.[1]) {
    const locality = afterEmbeddedType[1]
      .replace(
        /\s+(school|vidyalaya|vidyalay|high\s+school|middle\s+school|primary\s+school)\s*$/i,
        "",
      )
      .trim();
    if (locality.length >= 3 && locality.length <= 80) return locality;
  }

  const withoutPrefix = trimmed
    .replace(/^basic\s+school\s+/i, "")
    .replace(
      /^(govt\.?|government|raja|adarsh|janta|kanya|n\.?\s?p\.?\s?s\.?|nps|u\.?\s?p\.?\s?s\.?|ups|u\.?\s?m\.?\s?s\.?|ums|m\.?\s?s\.?|p\.?\s?s\.?|ps|primary|middle|high|senior\s+secondary|secondary|h\.?\s?s\.?|hs|es|ss|kendra|kendriya)\s+/i,
      "",
    )
    .trim();

  let candidate = withoutPrefix !== trimmed ? withoutPrefix : trimmed;
  candidate = candidate
    .replace(
      /\s+(school|vidyalaya|vidyalay|high\s+school|middle\s+school|primary\s+school)\s*$/i,
      "",
    )
    .trim();

  if (candidate.length >= 3 && candidate.length <= 80) return candidate;
  return "";
}

function extractSignificantTokens(schoolName: string, block: string, district: string): string[] {
  const village = localityHintFromSchoolName(schoolName);
  const tokens = new Set<string>();

  if (village) {
    const villageNorm = normalizeToken(village);
    if (villageNorm.length >= 3) tokens.add(villageNorm);
    villageNorm.split(" ").forEach((part) => {
      if (part.length >= 3) tokens.add(part);
    });
  }

  for (const word of normalizeToken(schoolName).split(" ")) {
    if (word.length < 4) continue;
    if (GENERIC_SCHOOL_WORDS.has(word)) continue;
    if (normalizeToken(block) === word) continue;
    if (normalizeToken(district) === word) continue;
    tokens.add(word);
  }

  return [...tokens].sort((a, b) => b.length - a.length);
}

function isAdminPlaceName(placeName: string, block?: string): boolean {
  const norm = normalizeToken(placeName);
  if (!norm) return true;
  const adminPatterns = [
    /\bblock office\b/,
    /\bbdo\b/,
    /\bpanchayat\b/,
    /\bcircle office\b/,
    /\btahsil\b/,
    /\btehsil\b/,
    /\bsub division\b/,
    /\bdistrict office\b/,
    /\bcourt\b/,
    /\bpolice station\b/,
    /\bpost office\b/,
  ];
  if (adminPatterns.some((pattern) => pattern.test(norm))) return true;
  if (block) {
    const blockNorm = normalizeToken(block);
    if (blockNorm && norm.includes(`${blockNorm} block office`)) return true;
    if (blockNorm && norm === `${blockNorm} block`) return true;
  }
  return false;
}

export function placeMatchesSchoolContext(
  schoolName: string,
  placeName: string,
  formattedAddress: string,
  block: string,
  district: string,
): boolean {
  if (isAdminPlaceName(placeName, block)) return false;

  const haystack = normalizeToken(`${placeName} ${formattedAddress}`);
  if (!haystack) return false;

  const tokens = extractSignificantTokens(schoolName, block, district);
  if (!tokens.length) return false;

  return tokens.some((token) => token.length >= 4 && haystack.includes(token));
}

export function isUnsafeSchoolPin(school: {
  schoolName?: string;
  matchedPlaceName?: string;
  block?: string;
  district?: string;
  locationConfidence?: string;
}): boolean {
  const matchedPlaceName = String(school.matchedPlaceName || "").trim();
  const schoolName = String(school.schoolName || "").trim();
  const block = String(school.block || "").trim();
  const district = String(school.district || "").trim();
  const confidence = String(school.locationConfidence || "").trim();

  if (matchedPlaceName && isAdminPlaceName(matchedPlaceName, block)) {
    return true;
  }

  if (!matchedPlaceName || !schoolName) return false;

  if (confidence === "village") {
    const village = localityHintFromSchoolName(schoolName);
    const villageNorm = normalizeToken(village);
    const matchedNorm = normalizeToken(matchedPlaceName);
    if (villageNorm && matchedNorm.includes(villageNorm)) return false;
  }

  return !placeMatchesSchoolContext(
    schoolName,
    matchedPlaceName,
    "",
    block,
    district,
  );
}

export function suspiciousPlaceMatchReason(
  schoolName: string,
  matchedPlaceName: string | undefined,
  block: string,
  district: string,
  formattedAddress = "",
): string | null {
  const placeName = String(matchedPlaceName || "").trim();
  if (!placeName) return null;

  if (isAdminPlaceName(placeName, block)) {
    return "Looks like a block/government office, not the school";
  }

  if (!placeMatchesSchoolContext(schoolName, placeName, formattedAddress, block, district)) {
    const village = localityHintFromSchoolName(schoolName);
    if (village) {
      return `Village "${village}" not found in Google match — check before saving`;
    }
    return "Google match name does not match this school — check before saving";
  }

  return null;
}
