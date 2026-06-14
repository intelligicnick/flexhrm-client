import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SchoolPartner } from "../types";
import { getPartnerPerToiletPay } from "../lib/school-work-helpers";

interface SchoolPartnersTableProps {
  partners: SchoolPartner[];
  readOnly?: boolean;
}

const COLUMNS: { key: keyof SchoolPartner; label: string }[] = [
  { key: "schoolName", label: "School Name" },
  { key: "partnerName", label: "Partner Name" },
  { key: "accountHolderName", label: "Account Holder" },
  { key: "accountNumber", label: "Account Number" },
  { key: "ifscCode", label: "IFSC Code" },
  { key: "monthlyPay", label: "Monthly Pay (₹)" },
  { key: "perToiletPay", label: "Per toilet pay (₹)" },
  { key: "block", label: "Block" },
  { key: "district", label: "District" },
];

export default function SchoolPartnersTable({ partners, readOnly = false }: SchoolPartnersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [blockFilter, setBlockFilter] = useState("");

  const blocks = useMemo(
    () => Array.from(new Set(partners.map((partner) => partner.block).filter(Boolean))).sort(),
    [partners],
  );

  const filtered = useMemo(() => {
    let rows = [...partners];
    if (blockFilter) rows = rows.filter((partner) => partner.block === blockFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (partner) =>
          partner.schoolName?.toLowerCase().includes(q) ||
          partner.partnerName?.toLowerCase().includes(q) ||
          partner.accountNumber?.toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [partners, blockFilter, searchTerm]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search partner or school..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
          />
        </div>
        <select
          value={blockFilter}
          onChange={(event) => setBlockFilter(event.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs cursor-pointer"
        >
          <option value="">All Blocks</option>
          {blocks.map((block) => (
            <option key={block} value={block}>
              {block}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[520px]">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-slate-100 text-slate-600 sticky top-0">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className="text-left px-3 py-2 font-bold whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-10 text-slate-400">
                  No partner records found.
                </td>
              </tr>
            ) : (
              filtered.map((partner) => (
                <tr key={partner.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-2 whitespace-nowrap">
                      {column.key === "monthlyPay"
                        ? `₹${(Number(partner.monthlyPay) || 0).toLocaleString("en-IN")}`
                        : column.key === "perToiletPay"
                          ? `₹${getPartnerPerToiletPay(partner).toLocaleString("en-IN")}`
                          : String(partner[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <p className="text-[11px] text-slate-400">
          Partner records sync from the Schools registry when schools are added or updated.
        </p>
      )}
    </div>
  );
}
