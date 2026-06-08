import React from "react";
import { Phone, Share2, Smartphone, MapPin } from "lucide-react";
import {
  DirectoryContactInfo,
  formatPhoneDisplay,
  isValidPhone,
  sendContactToPhone,
  shareContactDetails,
} from "../lib/phone-helpers";

export interface DirectoryContactCardProps {
  name: string;
  designation: string;
  location: string;
  phone: string;
  badge?: string;
  badgeTone?: "orange" | "blue" | "rose" | "indigo" | "slate";
  headerAction?: React.ReactNode;
  onCall: (contact: DirectoryContactInfo) => void;
  onActionSuccess?: (message: string) => void;
}

const BADGE_TONE_CLASS: Record<NonNullable<DirectoryContactCardProps["badgeTone"]>, string> = {
  orange: "bg-orange-50 text-[#ff791a] border-orange-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DirectoryContactCard: React.FC<DirectoryContactCardProps> = ({
  name,
  designation,
  location,
  phone,
  badge,
  badgeTone = "orange",
  headerAction,
  onCall,
  onActionSuccess,
}) => {
  const contact: DirectoryContactInfo = { name, designation, location, phone };
  const formattedPhone = formatPhoneDisplay(phone);
  const hasPhone = isValidPhone(phone);
  const initials = getInitials(name) || "HR";

  const handleShare = async () => {
    await shareContactDetails(contact, onActionSuccess);
  };

  const handleSendToPhone = () => {
    sendContactToPhone(contact);
    onActionSuccess?.("Opening SMS with contact details…");
  };

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#ff791a] to-orange-400" />

      <div className="flex flex-col gap-4 p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-sm font-black text-[#ff791a] shadow-inner">
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h4 className="truncate text-sm font-extrabold tracking-tight text-slate-900" title={name}>
                {name}
              </h4>
              <p className="text-[11px] font-semibold text-slate-500">{designation || "Not Specified"}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#ff791a]">
                  <MapPin size={10} className="shrink-0" />
                  {location || "Not Specified"}
                </span>
                {badge && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${BADGE_TONE_CLASS[badgeTone]}`}
                  >
                    {badge}
                  </span>
                )}
              </div>
            </div>
          </div>
          {headerAction}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Phone Number</p>
          <p className="mt-1 font-mono text-base font-extrabold tracking-wide text-slate-800">{formattedPhone}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={!hasPhone}
            onClick={() => hasPhone && onCall(contact)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Phone size={14} className="stroke-[2.5]" />
            Call
          </button>
          <button
            type="button"
            disabled={!hasPhone}
            onClick={handleSendToPhone}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-700 shadow-xs transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#ff791a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Smartphone size={14} className="stroke-[2.5]" />
            Send to Phone
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-700 shadow-xs transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
          >
            <Share2 size={14} className="stroke-[2.5]" />
            Share
          </button>
        </div>
      </div>
    </article>
  );
};

export default DirectoryContactCard;
