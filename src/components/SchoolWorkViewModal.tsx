import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SchoolWork } from "../types";

interface SchoolWorkViewModalProps {
  school: SchoolWork;
  onClose: () => void;
}

const FIELDS: { key: keyof SchoolWork; label: string }[] = [
  { key: "srNo", label: "SR NO" },
  { key: "schoolName", label: "School Name" },
  { key: "udise", label: "UDISE" },
  { key: "headmasterName", label: "Headmaster Name" },
  { key: "headmasterNumber", label: "Headmaster Number" },
  { key: "sweeperName", label: "Sweeper Name" },
  { key: "accountHolderName", label: "Account Holder Name" },
  { key: "accountNumber", label: "Account Number" },
  { key: "ifscCode", label: "IFSC Code" },
  { key: "noOfToilets", label: "No of Toilets" },
  { key: "rates", label: "Rates" },
  { key: "rateExplanation", label: "Explanation for Rate" },
  { key: "block", label: "Block" },
  { key: "district", label: "District" },
  { key: "materialCost", label: "Material Cost" },
  { key: "remarks", label: "Remarks" },
];

export default function SchoolWorkViewModal({ school, onClose }: SchoolWorkViewModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">{school.schoolName || "School Record"}</h3>
            <p className="text-xs text-slate-400 mt-0.5">UDISE: {school.udise}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {label}
                </span>
                <span className="font-semibold text-slate-800 break-words">
                  {String(school[key] ?? "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
