import React, { forwardRef, useMemo } from "react";
import { SchoolBillingLineItem, SchoolWork } from "../types";
import {
  GOVT_BILL_HEADERS,
  buildGovtBillRows,
  buildGovtBillRowsFromLineItems,
} from "../lib/school-work-helpers";
import {
  buildGovtInvoiceHeaderLines,
  computeGovtInvoiceTotals,
} from "../lib/govt-invoice-export";

interface GovtInvoicePreviewProps {
  schools?: SchoolWork[];
  daysMap?: Record<string, number>;
  toiletsMap?: Record<string, number>;
  lineItems?: SchoolBillingLineItem[];
  block: string;
  district?: string;
  monthKey: string;
  financialYear: string;
  defaultDays?: number;
  unitRate?: number;
  readOnly?: boolean;
  onDaysChange?: (schoolId: string, days: number) => void;
  onToiletsChange?: (schoolId: string, toilets: number) => void;
}

const formatAmount = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GovtInvoicePreview = forwardRef<HTMLDivElement, GovtInvoicePreviewProps>(
  function GovtInvoicePreview(
    {
      schools = [],
      daysMap = {},
      toiletsMap = {},
      lineItems,
      block,
      district,
      monthKey,
      financialYear,
      defaultDays = 24,
      unitRate = 50,
      readOnly = true,
      onDaysChange,
      onToiletsChange,
    },
    ref,
  ) {
    const savedMode = Boolean(lineItems?.length);

    const headerLines = useMemo(
      () => buildGovtInvoiceHeaderLines({ block, district, monthKey, financialYear }),
      [block, district, monthKey, financialYear],
    );

    const dataRows = useMemo(
      () =>
        savedMode
          ? buildGovtBillRowsFromLineItems(lineItems!, block)
          : buildGovtBillRows(schools, daysMap, monthKey, toiletsMap),
      [savedMode, lineItems, block, schools, daysMap, toiletsMap, monthKey],
    );

    const totals = useMemo(() => computeGovtInvoiceTotals(dataRows), [dataRows]);

    return (
      <div
        ref={ref}
        className="govt-invoice-preview bg-white text-black p-6 rounded-lg border border-slate-300"
        style={{ fontFamily: "'Noto Sans Devanagari', 'Mangal', 'Arial', sans-serif" }}
      >
        <div className="text-center space-y-1 mb-4">
          {headerLines.map((line, idx) => (
            <p
              key={idx}
              className={`text-sm leading-snug ${idx === 0 ? "font-bold text-base" : "text-slate-800"}`}
            >
              {line}
            </p>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] min-w-[980px]">
            <thead>
              <tr className="bg-[#e2efda]">
                {GOVT_BILL_HEADERS.map((header) => (
                  <th
                    key={header}
                    className="border border-black px-1.5 py-2 text-center font-bold leading-tight whitespace-pre-line"
                  >
                    {header.replace(/ \(/g, "\n(")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIndex) => {
                const school = savedMode ? undefined : schools[rowIndex];
                const lineItem = savedMode ? lineItems![rowIndex] : undefined;
                const rowKey = lineItem?.schoolWorkId || school?.id || String(rowIndex);
                const schoolId = lineItem?.schoolWorkId || school?.id;
                const canEditDays = !readOnly && Boolean(onDaysChange && schoolId);
                const canEditToilets = !readOnly && Boolean(onToiletsChange && schoolId);
                const days = savedMode
                  ? Number(row[6]) || 0
                  : daysMap[school!.id] ?? defaultDays;
                const toilets = Number(row[5]) || 0;
                const cleanings = savedMode ? Number(row[7]) || 0 : toilets * days;
                const rate = Number(row[8]) || unitRate;
                const amount = savedMode ? Number(row[9]) || 0 : cleanings * rate;

                return (
                  <tr key={rowKey} className="hover:bg-slate-50">
                    <td className="border border-black px-1.5 py-1 text-center">{row[0]}</td>
                    <td className="border border-black px-1.5 py-1 uppercase">{row[1]}</td>
                    <td className="border border-black px-1.5 py-1">{row[2]}</td>
                    <td className="border border-black px-1.5 py-1">{row[3]}</td>
                    <td className="border border-black px-1.5 py-1">{row[4]}</td>
                    <td className="border border-black px-1.5 py-1 text-right bg-[#fff9e6]">
                      {canEditToilets ? (
                        <input
                          type="number"
                          min={0}
                          value={toilets}
                          onChange={(e) =>
                            onToiletsChange!(
                              schoolId!,
                              Math.max(0, Math.round(Number(e.target.value) || 0)),
                            )
                          }
                          className="w-12 text-center bg-transparent border-0 outline-none font-semibold"
                        />
                      ) : (
                        toilets
                      )}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center bg-[#fff9e6]">
                      {canEditDays ? (
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={days}
                          onChange={(e) =>
                            onDaysChange!(
                              schoolId!,
                              Math.min(31, Math.max(1, Number(e.target.value) || defaultDays)),
                            )
                          }
                          className="w-12 text-center bg-transparent border-0 outline-none font-semibold"
                        />
                      ) : (
                        days
                      )}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-right">{formatAmount(cleanings)}</td>
                    <td className="border border-black px-1.5 py-1 text-right">{formatAmount(rate)}</td>
                    <td className="border border-black px-1.5 py-1 text-right font-semibold">
                      {formatAmount(amount)}
                    </td>
                    <td className="border border-black px-1.5 py-1">{row[10]}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#e2efda] font-bold">
                <td className="border border-black px-1.5 py-2">TOTAL</td>
                <td className="border border-black px-1.5 py-2" colSpan={4} />
                <td className="border border-black px-1.5 py-2 text-right">{totals.toilets}</td>
                <td className="border border-black px-1.5 py-2 text-center">
                  {savedMode ? "" : defaultDays}
                </td>
                <td className="border border-black px-1.5 py-2 text-right">
                  {formatAmount(totals.cleanings)}
                </td>
                <td className="border border-black px-1.5 py-2 text-right">{formatAmount(unitRate)}</td>
                <td className="border border-black px-1.5 py-2 text-right">
                  {formatAmount(totals.amount)}
                </td>
                <td className="border border-black px-1.5 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-10 text-sm">
          <div className="border-t border-black pt-2 text-center">
            प्रदानकर्ता एजेंसी का हस्ताक्षर एवं मुहर
          </div>
          <div className="border-t border-black pt-2 text-center">हस्ताक्षर एवं मुहर</div>
        </div>
        <p className="text-center text-sm mt-6 font-semibold">प्रखंड शिक्षा पदाधिकारी</p>
      </div>
    );
  },
);

export default GovtInvoicePreview;
