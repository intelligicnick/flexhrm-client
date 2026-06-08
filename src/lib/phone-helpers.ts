export interface DirectoryContactInfo {
  name: string;
  designation: string;
  location: string;
  phone: string;
}

const EMPTY_PHONE_LABELS = new Set(["", "not provided", "n/a", "na", "-"]);

export function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  if (EMPTY_PHONE_LABELS.has(trimmed.toLowerCase())) return false;
  return phone.replace(/\D/g, "").length >= 6;
}

/** Normalize to digits-only string suitable for tel:/sms: links. */
export function phoneToDialString(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Display format: +XX XXXXX XXXXX (Indian default when 10 digits). */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!isValidPhone(phone)) return "Not Provided";

  const digits = phone!.replace(/\D/g, "");
  let countryCode = "";
  let national = digits;

  if (digits.length === 10) {
    countryCode = "91";
    national = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    countryCode = "91";
    national = digits.slice(2);
  } else if (digits.length > 10) {
    national = digits.slice(-10);
    countryCode = digits.slice(0, -10) || "91";
  } else if (digits.length >= 6) {
    const ccLen = Math.min(3, Math.max(1, digits.length - 5));
    countryCode = digits.slice(0, ccLen);
    national = digits.slice(ccLen);
  } else {
    return phone!.trim();
  }

  if (national.length === 10) {
    return `+${countryCode} ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  if (national.length === 5) {
    return `+${countryCode} ${national}`;
  }

  const grouped = national.replace(/(\d{5})(?=\d)/g, "$1 ").trim();
  return `+${countryCode}${grouped ? ` ${grouped}` : ""}`;
}

export function buildContactShareText(contact: DirectoryContactInfo): string {
  const formattedPhone = formatPhoneDisplay(contact.phone);
  return [
    contact.name,
    `Designation: ${contact.designation || "Not Specified"}`,
    `Location: ${contact.location || "Not Specified"}`,
    `Phone: ${formattedPhone}`,
  ].join("\n");
}

export async function shareContactDetails(
  contact: DirectoryContactInfo,
  onCopied?: (message: string) => void
): Promise<void> {
  const text = buildContactShareText(contact);
  const title = `${contact.name} — Contact`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    onCopied?.("Contact details copied to clipboard.");
  } catch {
    window.prompt("Copy contact details:", text);
  }
}

export function sendContactToPhone(contact: DirectoryContactInfo): void {
  if (!isValidPhone(contact.phone)) return;
  const body = encodeURIComponent(buildContactShareText(contact));
  const dial = phoneToDialString(contact.phone);
  window.location.href = dial ? `sms:${dial}?body=${body}` : `sms:?body=${body}`;
}
