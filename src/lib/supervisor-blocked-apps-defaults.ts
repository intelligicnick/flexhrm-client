const MIN_PARTIAL_LABEL_LENGTH = 3;

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
