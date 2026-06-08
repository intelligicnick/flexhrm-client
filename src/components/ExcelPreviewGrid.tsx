/**
 * Excel-like read-only spreadsheet preview (row numbers, column letters, grid).
 */

import React, { useMemo } from "react";

function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function normalizeRows(rows: string[][]): string[][] {
  if (rows.length === 0) return [];
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    const normalized = [...row];
    while (normalized.length < maxCols) normalized.push("");
    return normalized.map((cell) => (cell == null ? "" : String(cell)));
  });
}

interface ExcelPreviewGridProps {
  rows: string[][];
  headerRowCount?: number;
  emptyMessage?: string;
}

export default function ExcelPreviewGrid({
  rows,
  headerRowCount = 1,
  emptyMessage = "This file has no readable rows.",
}: ExcelPreviewGridProps) {
  const normalizedRows = useMemo(() => normalizeRows(rows), [rows]);
  const colCount = normalizedRows[0]?.length ?? 0;
  const headerRows = normalizedRows.slice(0, Math.max(0, headerRowCount));
  const dataRows = normalizedRows.slice(Math.max(0, headerRowCount));
  const totalRows = normalizedRows.length;
  const lastColLetter = colCount > 0 ? columnIndexToLetter(colCount - 1) : "—";

  if (normalizedRows.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">{emptyMessage}</p>
    );
  }

  return (
    <div className="excel-preview-root h-full min-h-0 flex flex-col bg-[#f3f3f3] border border-[#d4d4d4] rounded-lg overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="w-max min-w-full border-collapse text-[11px] leading-tight"
          style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}
        >
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-40 w-11 min-w-11 bg-[#f3f3f3] border border-[#d4d4d4] text-[#444] font-normal text-center py-1 px-1" />
              {Array.from({ length: colCount }, (_, colIdx) => (
                <th
                  key={`letter-${colIdx}`}
                  className="min-w-[100px] bg-[#f3f3f3] border border-[#d4d4d4] text-[#444] font-normal text-center py-1 px-2 whitespace-nowrap"
                >
                  {columnIndexToLetter(colIdx)}
                </th>
              ))}
            </tr>
            {headerRows.map((headerRow, headerIdx) => (
              <tr key={`header-${headerIdx}`}>
                <th className="sticky left-0 z-40 w-11 min-w-11 bg-[#e2efda] border border-[#d4d4d4] text-[#444] font-normal text-center py-1 px-1">
                  {headerIdx + 1}
                </th>
                {headerRow.map((cell, colIdx) => (
                  <th
                    key={`header-cell-${headerIdx}-${colIdx}`}
                    className="min-w-[100px] max-w-[320px] bg-[#e2efda] border border-[#d4d4d4] text-[#1f4e2d] font-semibold text-left py-1.5 px-2 whitespace-normal align-middle"
                    title={cell}
                  >
                    {cell === "" ? "\u00a0" : cell}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => {
              const excelRowNum = rowIdx + headerRowCount + 1;
              return (
                <tr key={rowIdx}>
                  <td className="sticky left-0 z-10 w-11 min-w-11 bg-[#f3f3f3] border border-[#d4d4d4] text-[#444] text-center py-1 px-1 font-normal">
                    {excelRowNum}
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className="min-w-[100px] max-w-[320px] bg-white border border-[#d4d4d4] text-[#222] py-1 px-2 whitespace-nowrap align-middle"
                      title={cell}
                    >
                      {cell === "" ? "\u00a0" : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="shrink-0 px-3 py-1.5 border-t border-[#d4d4d4] bg-white text-[10px] text-slate-500 flex items-center justify-between gap-3">
        <span>
          {totalRows} row{totalRows === 1 ? "" : "s"} × {colCount} column{colCount === 1 ? "" : "s"} (A–{lastColLetter})
        </span>
        <span className="text-slate-400">Scroll to review all rows and columns</span>
      </div>
    </div>
  );
}
