type ExcelJSModule = typeof import("exceljs");

let excelPromise: Promise<ExcelJSModule> | null = null;
let pdfPromise: Promise<{
  jsPDF: typeof import("jspdf").jsPDF;
  autoTable: typeof import("jspdf-autotable").default;
}> | null = null;

export function loadExcelJS(): Promise<ExcelJSModule> {
  excelPromise ??= import("exceljs").then((module) => module.default);
  return excelPromise;
}

export function loadPdfExport() {
  pdfPromise ??= Promise.all([import("jspdf"), import("jspdf-autotable")]).then(
    ([jspdf, autotable]) => ({
      jsPDF: jspdf.jsPDF,
      autoTable: autotable.default,
    }),
  );
  return pdfPromise;
}
