import React, { useMemo, useState } from "react";
import {
  Search,
  ShieldAlert,
  DownloadCloud,
  FileSpreadsheet,
  MapPin,
  IndianRupee,
} from "lucide-react";
import { SchoolWork } from "../types";
import {
  computeSchoolLabourCost,
  computeSchoolTotalPayable,
  getSchoolMonthlyMaterial,
  getSchoolMonthlyMiscellaneous,
} from "../lib/school-work-helpers";
import { quoteCSVValue } from "../utils";

interface SchoolExpensesSalaryTabProps {
  schools: SchoolWork[];
  selectedMonth?: string;
  monthsList?: string[];
  onMonthChange?: (monthKey: string) => void;
  onExportCsv: (rows: SchoolWork[]) => void;
  onExportExcel: (rows: SchoolWork[]) => void;
}

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function SchoolExpensesSalaryTab({
  schools,
  selectedMonth,
  monthsList,
  onMonthChange,
  onExportCsv,
  onExportExcel,
}: SchoolExpensesSalaryTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");

  const districts = useMemo(
    () => Array.from(new Set(schools.map((s) => s.district).filter(Boolean))),
    [schools],
  );
  const blocks = useMemo(
    () => Array.from(new Set(schools.map((s) => s.block).filter(Boolean))),
    [schools],
  );

  const filteredSchools = useMemo(() => {
    let result = [...schools];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.schoolName?.toLowerCase().includes(q) ||
          s.udise?.toLowerCase().includes(q) ||
          s.sweeperName?.toLowerCase().includes(q) ||
          s.accountHolderName?.toLowerCase().includes(q),
      );
    }
    if (districtFilter) result = result.filter((s) => s.district === districtFilter);
    if (blockFilter) result = result.filter((s) => s.block === blockFilter);
    return result.sort((a, b) => a.srNo - b.srNo);
  }, [schools, searchTerm, districtFilter, blockFilter]);

  const totals = useMemo(() => {
    const labour = filteredSchools.reduce((sum, s) => sum + computeSchoolLabourCost(s), 0);
    const material = filteredSchools.reduce(
      (sum, s) => sum + getSchoolMonthlyMaterial(s, selectedMonth),
      0,
    );
    const miscellaneous = filteredSchools.reduce(
      (sum, s) => sum + getSchoolMonthlyMiscellaneous(s, selectedMonth),
      0,
    );
    return { labour, material, miscellaneous, payable: labour + material + miscellaneous };
  }, [filteredSchools, selectedMonth]);

  return (
    <div className="space-y-4" id="school-expenses-salary-tab">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block">Labour Cost (Rates × Toilets)</span>
          <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
            {formatCurrency(totals.labour)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block">Material{selectedMonth ? ` (${selectedMonth})` : ""}</span>
          <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
            {formatCurrency(totals.material)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-bold block">Miscellaneous{selectedMonth ? ` (${selectedMonth})` : ""}</span>
          <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
            {formatCurrency(totals.miscellaneous)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-xs bg-orange-50/40">
          <span className="text-orange-600 text-xs font-bold block">Total Payable Salary</span>
          <span className="text-2xl font-black text-[#ff791a] mt-1 inline-block">
            {formatCurrency(totals.payable)}
          </span>
        </div>
      </section>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <IndianRupee className="text-[#ff791a]" size={18} />
                School Expenses Salary Sheet
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Payable amount per school: (Rates × No. of Toilets) + Material + Miscellaneous
                {selectedMonth ? ` for ${selectedMonth}` : ""}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onExportCsv(filteredSchools)}
                disabled={filteredSchools.length === 0}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:opacity-40"
              >
                <DownloadCloud size={14} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => onExportExcel(filteredSchools)}
                disabled={filteredSchools.length === 0}
                className="flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer disabled:opacity-40"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search school, UDISE, sweeper, account holder..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {monthsList && selectedMonth && onMonthChange && (
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    {monthsList.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
                <MapPin size={16} className="text-slate-400 mr-1" />
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">All Districts</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
                <select
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                  className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[580px] w-full">
          <table className="w-full text-left border-collapse min-w-[1400px]" id="school-expenses-salary-table">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-semibold">
                <th className="p-3 w-[50px] text-center">SR</th>
                <th className="p-3 whitespace-nowrap">School Name</th>
                <th className="p-3 whitespace-nowrap">UDISE</th>
                <th className="p-3 whitespace-nowrap">Sweeper Name</th>
                <th className="p-3 text-center">Toilets</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Labour Cost</th>
                <th className="p-3 text-right">Material</th>
                <th className="p-3 text-right">Miscellaneous</th>
                <th className="p-3 text-right">Total Payable</th>
                <th className="p-3 whitespace-nowrap">Account Holder</th>
                <th className="p-3 whitespace-nowrap">Account No.</th>
                <th className="p-3 whitespace-nowrap">IFSC</th>
                <th className="p-3 whitespace-nowrap">Block</th>
                <th className="p-3 whitespace-nowrap">District</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700 text-xs bg-white">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-450">
                    <ShieldAlert className="mx-auto mb-2 text-slate-350" size={28} />
                    No school expense records matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const labour = computeSchoolLabourCost(school);
                  const material = getSchoolMonthlyMaterial(school, selectedMonth);
                  const miscellaneous = getSchoolMonthlyMiscellaneous(school, selectedMonth);
                  const total = computeSchoolTotalPayable(school, selectedMonth);
                  return (
                    <tr key={school.id} className="hover:bg-slate-50/80">
                      <td className="p-3 text-center font-bold">{school.srNo}</td>
                      <td className="p-3 font-semibold text-orange-700 max-w-[180px] truncate" title={school.schoolName}>
                        {school.schoolName}
                      </td>
                      <td className="p-3">{school.udise}</td>
                      <td className="p-3">{school.sweeperName}</td>
                      <td className="p-3 text-center">{school.noOfToilets}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(school.rates) || 0)}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(labour)}</td>
                      <td className="p-3 text-right">{formatCurrency(material)}</td>
                      <td className="p-3 text-right">{formatCurrency(miscellaneous)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(total)}</td>
                      <td className="p-3 max-w-[140px] truncate" title={school.accountHolderName}>{school.accountHolderName}</td>
                      <td className="p-3 font-mono">{school.accountNumber}</td>
                      <td className="p-3 font-mono">{school.ifscCode}</td>
                      <td className="p-3">{school.block}</td>
                      <td className="p-3">{school.district}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSchools.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs font-bold">
                  <td colSpan={6} className="p-3 text-right uppercase tracking-wider">Grand Total</td>
                  <td className="p-3 text-right">{formatCurrency(totals.labour)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.material)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.miscellaneous)}</td>
                  <td className="p-3 text-right text-yellow-300">{formatCurrency(totals.payable)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export const SCHOOL_EXPENSE_SALARY_HEADERS = [
  "SR NO",
  "School Name",
  "UDISE",
  "Sweeper Name",
  "No of Toilets",
  "Rate",
  "Labour Cost",
  "Material",
  "Miscellaneous",
  "Total Payable",
  "Account Holder Name",
  "Account Number",
  "IFSC Code",
  "Block",
  "District",
];

export function getSchoolExpenseSalaryRow(
  school: SchoolWork,
  index: number,
  selectedMonth?: string,
): (string | number)[] {
  const labour = computeSchoolLabourCost(school);
  const total = computeSchoolTotalPayable(school, selectedMonth);
  return [
    school.srNo || index + 1,
    school.schoolName || "",
    school.udise || "",
    school.sweeperName || "",
    school.noOfToilets ?? 0,
    school.rates ?? 0,
    labour,
    getSchoolMonthlyMaterial(school, selectedMonth),
    getSchoolMonthlyMiscellaneous(school, selectedMonth),
    total,
    school.accountHolderName || "",
    school.accountNumber || "",
    school.ifscCode || "",
    school.block || "",
    school.district || "",
  ];
}

export function buildSchoolExpenseSalaryCsv(rows: SchoolWork[], selectedMonth?: string): string {
  const lines = [SCHOOL_EXPENSE_SALARY_HEADERS.join(",")];
  rows.forEach((school, index) => {
    lines.push(
      getSchoolExpenseSalaryRow(school, index, selectedMonth)
        .map((v) => quoteCSVValue(String(v)))
        .join(","),
    );
  });
  return lines.join("\n");
}
