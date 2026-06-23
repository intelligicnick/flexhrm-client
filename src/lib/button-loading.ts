const LOADING_LABEL_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^submit\b/i, label: "Submitting..." },
  { pattern: /^save\b/i, label: "Saving..." },
  { pattern: /^delete\b/i, label: "Deleting..." },
  { pattern: /^remove\b/i, label: "Removing..." },
  { pattern: /^upload\b/i, label: "Uploading..." },
  { pattern: /^download\b/i, label: "Downloading..." },
  { pattern: /^export\b/i, label: "Exporting..." },
  { pattern: /^import\b/i, label: "Importing..." },
  { pattern: /^generate\b/i, label: "Generating..." },
  { pattern: /^send\b/i, label: "Sending..." },
  { pattern: /^approve\b/i, label: "Approving..." },
  { pattern: /^reject\b/i, label: "Rejecting..." },
  { pattern: /^confirm\b/i, label: "Confirming..." },
  { pattern: /^create\b/i, label: "Creating..." },
  { pattern: /^update\b/i, label: "Updating..." },
  { pattern: /^add\b/i, label: "Adding..." },
  { pattern: /^login\b/i, label: "Logging in..." },
  { pattern: /^sign\s*in\b/i, label: "Signing in..." },
  { pattern: /^install\b/i, label: "Installing..." },
  { pattern: /^escalat/i, label: "Escalating..." },
  { pattern: /^capture\b/i, label: "Capturing..." },
  { pattern: /^take\s+photo/i, label: "Processing..." },
  { pattern: /^verify\b/i, label: "Verifying..." },
  { pattern: /^process\b/i, label: "Processing..." },
];

export function normalizeButtonLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function inferLoadingLabel(label: string): string {
  const normalized = normalizeButtonLabel(label);
  if (!normalized) return "Processing...";

  for (const rule of LOADING_LABEL_RULES) {
    if (rule.pattern.test(normalized)) return rule.label;
  }

  if (/\.\.\.$/.test(normalized)) return normalized;
  return `${normalized.replace(/[.…]+$/, "")}...`;
}

export const busyButtonClasses =
  "bg-slate-400 hover:bg-slate-400 text-white shadow-none cursor-wait pointer-events-none";
