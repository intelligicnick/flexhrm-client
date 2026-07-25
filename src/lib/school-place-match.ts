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

function tokenInHaystack(token: string, haystack: string): boolean {
  if (!token || !haystack) return false;
  if (haystack.includes(token)) return true;
  if (token.length < 5) return false;
  return haystack
    .split(" ")
    .some((word) => word.length >= 4 && editDistance(token, word) <= 1);
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function wrongBlockMentionedInAddress(
  haystack: string,
  expectedBlock: string,
  siblingBlocks: string[],
): string | null {
  const expectedNorm = normalizeToken(expectedBlock);
  for (const sibling of siblingBlocks) {
    const siblingNorm = normalizeToken(sibling);
    if (!siblingNorm || siblingNorm.length < 4) continue;
    if (siblingNorm === expectedNorm) continue;
    if (tokenInHaystack(siblingNorm, haystack)) {
      return sibling;
    }
  }
  return null;
}

export function placeInExpectedAdminArea(
  formattedAddress: string,
  block: string,
  district: string,
  siblingBlocks: string[] = [],
): boolean {
  const haystack = normalizeToken(formattedAddress);
  if (!haystack) return false;

  const districtNorm = normalizeToken(district);
  if (districtNorm && districtNorm.length >= 3) {
    if (!tokenInHaystack(districtNorm, haystack)) return false;
  }

  const blockNorm = normalizeToken(block);
  if (blockNorm && blockNorm.length >= 3) {
    if (!tokenInHaystack(blockNorm, haystack)) return false;
  }

  if (wrongBlockMentionedInAddress(haystack, block, siblingBlocks)) return false;

  return true;
}

export function adminAreaMismatchReason(
  formattedAddress: string,
  block: string,
  district: string,
  siblingBlocks: string[] = [],
): string | null {
  const haystack = normalizeToken(formattedAddress);
  if (!haystack) return null;

  const districtNorm = normalizeToken(district);
  if (districtNorm && districtNorm.length >= 3 && !tokenInHaystack(districtNorm, haystack)) {
    return `District "${district}" not in Google address — likely wrong area`;
  }

  const blockNorm = normalizeToken(block);
  if (blockNorm && blockNorm.length >= 3 && !tokenInHaystack(blockNorm, haystack)) {
    return `Block "${block}" not in Google address — likely outside this block`;
  }

  const wrongBlock = wrongBlockMentionedInAddress(haystack, block, siblingBlocks);
  if (wrongBlock) {
    return `Address mentions block "${wrongBlock}", not "${block}"`;
  }

  return null;
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

export function placeInExpectedDistrict(
  formattedAddress: string,
  district: string,
  block = "",
): boolean {
  const haystack = normalizeToken(formattedAddress);
  if (!haystack) return false;
  const wrongStates = [
    "rajasthan",
    "gujarat",
    "maharashtra",
    "uttar pradesh",
    "west bengal",
    "odisha",
    "jharkhand",
    "madhya pradesh",
    "delhi",
  ];
  if (wrongStates.some((state) => haystack.includes(state))) return false;
  if (!haystack.includes("bihar")) return false;
  const districtNorm = normalizeToken(district);
  if (!districtNorm || districtNorm.length < 3) return false;
  return tokenInHaystack(districtNorm, haystack);
}

export function coordinatesInBihar(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 24.15 && lat <= 27.85 && lng >= 83.25 && lng <= 88.15;
}

const DISTRICT_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  purnia: { minLat: 25.45, maxLat: 26.55, minLng: 86.75, maxLng: 87.95 },
  madhepura: { minLat: 25.55, maxLat: 26.45, minLng: 86.35, maxLng: 87.35 },
};

export function coordinatesInExpectedDistrict(lat: number, lng: number, district: string): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const bounds = DISTRICT_BOUNDS[normalizeToken(district)];
  if (!bounds) return true;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

export function isUnsafeSchoolPin(school: {
  schoolName?: string;
  matchedPlaceName?: string;
  formattedAddress?: string;
  block?: string;
  district?: string;
  locationConfidence?: string;
  siblingBlocks?: string[];
  lat?: number | string;
  lng?: number | string;
}): boolean {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  const matchedPlaceName = String(school.matchedPlaceName || "").trim();
  const formattedAddress = String(school.formattedAddress || "").trim();
  const schoolName = String(school.schoolName || "").trim();
  const block = String(school.block || "").trim();
  const district = String(school.district || "").trim();
  const confidence = String(school.locationConfidence || "").trim();
  const siblingBlocks = school.siblingBlocks ?? [];

  if (Number.isFinite(lat) && Number.isFinite(lng) && !coordinatesInBihar(lat, lng)) {
    return true;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && district) {
    if (!coordinatesInExpectedDistrict(lat, lng, district)) return true;
  }

  if (matchedPlaceName && isAdminPlaceName(matchedPlaceName, block)) {
    return true;
  }

  if (formattedAddress && district) {
    const confidence = String(school.locationConfidence || "").trim();
    if (confidence === "village") {
      if (!placeInExpectedDistrict(formattedAddress, district)) return true;
    } else if (block && !placeInExpectedAdminArea(formattedAddress, block, district, siblingBlocks)) {
      return true;
    }
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
  siblingBlocks: string[] = [],
): string | null {
  const placeName = String(matchedPlaceName || "").trim();
  if (!placeName) return null;

  if (isAdminPlaceName(placeName, block)) {
    return "Looks like a block/government office, not the school";
  }

  const adminReason = adminAreaMismatchReason(formattedAddress, block, district, siblingBlocks);
  if (adminReason) return adminReason;

  if (!placeMatchesSchoolContext(schoolName, placeName, formattedAddress, block, district)) {
    const village = localityHintFromSchoolName(schoolName);
    if (village) {
      return `Village "${village}" not found in Google match — check before saving`;
    }
    return "Google match name does not match this school — check before saving";
  }

  return null;
}
