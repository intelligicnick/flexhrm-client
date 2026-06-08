/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, AlertTriangle, CheckCircle, FileSpreadsheet, X } from "lucide-react";
import { parseCSV, parseSheetRows, validateEmployee, analyzeHeaders } from "../utils";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Employee, EXCEL_ROW_HEADERS } from "../types";

interface CsvImporterProps {
  onImportSuccess: (employees: any[]) => void;
  existingCodes: string[];
  availableLocations?: string[];
  availableRoles?: string[];
}

export default function CsvImporter({ onImportSuccess, existingCodes, availableLocations = [], availableRoles = [] }: CsvImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headerAnalysis, setHeaderAnalysis] = useState<{
    matched: string[];
    unmatched: string[];
    headerRowIndex: number;
    actualHeaderNames: string[];
  } | null>(null);
  const [validationResults, setValidationResults] = useState<{
    valid: any[];
    invalid: { row: any; index: number; errors: Record<string, string> }[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template empty/sample Excel XLSX with interactive dropdown validation
  const handleDownloadTemplate = async (isSample = false) => {
    const headers = EXCEL_ROW_HEADERS;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Onboarding Template");

    // Add headers row
    ws.addRow(headers);

    // Style the header row visually
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 10 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF791A" } // Iconic orange branding hex
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 25;

    if (isSample) {
      ws.addRow([
        1, // SR NO
        "EMP505", // Employees Code **
        "SURESH PRASAD SHARMA", // EMPLOYEE NAME AS PER AADHAR ***
        "Mumbai Main Office", // Location
        "Skilled", // Skill Category
        "Driver", // Job Role
        "26 Days (Sun Off)", // Working Days Cycle
        28000, // Gross Salary***
        14000, // Basic Salary***
        "No", // ESIC
        "100987654399", // UAN
        "998877665544", // AADHAR NO **
        "SURESH PRASAD SHARMA", // NAME AS PER AADHAR **
        "ABCDE1234E", // PAN NO
        "SURESH PRASAD SHARMA", // NAME AS PER PAN
        "302910243689", // BANK ACCOUNT NO **
        "PUNB0121400", // IFSC CODE **
        "SURESH PRASAD SHARMA", // EMPLOYEE NAME AS PER BANK **
        "MUKESH SHARMA", // FATHER **
        "", // HUSBAND NAME **
        "2025-06-01", // PF JOINING DATE
        "1990-10-15", // DATE OF BIRTH
        "Male", // GENDER **
        "Married", // MARITAL STATUS **
        "9876543210", // AADHAR LINK MOB.NO. **
        "", // PREVIOUS UAN NO
        "", // PREVIOUS ESIC NO***
        "Lane 5, Dwarka Sector 12, New Delhi", // Present Address**
        "Lane 5, Dwarka Sector 12, New Delhi", // Permanent Address**
        "REKHA SHARMA", // Nominee Name (ESIC)
        "1992-04-12", // Nominee DOB
        "Wife", // Nominee Relation
        "REKHA SHARMA", // Family Member Name (1)
        "1992-04-12", // Family Member DOB (1)
        "Wife", // Family Member Relation (1)
        "", // Family Member Name (2)
        "", // Family Member DOB (2)
        "", // Family Member Relation (2)
        "", // Family Member Name (3)
        "", // Family Member DOB (3)
        "", // Family Member Relation (3)
        1076.92, // Daily Wage
        "9876543211", // Employee Mobile
        "9876543212", // Nominee Mobile
        "9876543213", // Family Member Mobile (1)
        "9876543214", // Family Member Mobile (2)
        "9876543215" // Family Member Mobile (3)
      ]);
    }

    // Dynamic locations list for the dropdown registry
    const defaultPresets = [
      "Mumbai Main Office",
      "Delhi Branch Office",
      "Bangalore R&D Center",
      "Pune Tech Park",
      "Chennai Operational Hub",
      "Hyderabad Global Center",
      "Kolkata Zonal Hub"
    ];
    // Merge with dynamically added ones from the project (e.g. Munger University, etc.)
    const mergedLocations = Array.from(new Set([...defaultPresets, ...availableLocations])).filter(Boolean);
    
    // Dynamic roles list for the dropdown registry
    const defaultRoles = ["Guard", "Driver", "Supervisor", "Electrician", "Gunman", "Bouncer"];
    const mergedRoles = Array.from(new Set([...defaultRoles, ...availableRoles])).filter(Boolean);

    // Formulate list option formulas
    const locFormula = `"${mergedLocations.join(",")}"`;
    const roleFormula = `"${mergedRoles.join(",")}"`;
    const genderFormula = '"Male,Female,Other"';
    const maritalFormula = '"Single,Married,Divorced,Widowed"';
    const esicFormula = '"Yes,No"';
    const skillFormula = '"Highly Skilled,Skilled,Semi Skilled,Unskilled"';

    // Inject data validation rules to crucial columns for 200 onboarding slots
    for (let i = 2; i <= 200; i++) {
      // Column D is Work Location (4th column)
      ws.getCell(i, 4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [locFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Location Option",
        error: "Please select an office branch from the dropdown list or register a brand new location in the admin Configuration tab first!"
      };

      // Column E is Skill Category (5th column)
      ws.getCell(i, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [skillFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Skill Category",
        error: "Please select either Highly Skilled, Skilled, Semi Skilled, or Unskilled."
      };

      // Column F is Job Role (6th column)
      ws.getCell(i, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [roleFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Job Role",
        error: "Please select a registered job role from the dropdown list or register a new job role in the admin Configuration panel first!"
      };

      // Column G is Working Days Cycle (7th column)
      ws.getCell(i, 7).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"22 Days (Sat/Sun Off),26 Days (Sun Off),30/31 Days (No Off)"'],
        showErrorMessage: true,
        errorTitle: "Invalid Working Days Cycle",
        error: "Allowed values: 22 Days (Sat/Sun Off), 26 Days (Sun Off), or 30/31 Days (No Off)."
      };
      
      // Column W is Gender (23rd column)
      ws.getCell(i, 23).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [genderFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Gender Input",
        error: "Please select either Male, Female or Other as per documentation."
      };

      // Column X is Marital Status (24th column)
      ws.getCell(i, 24).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [maritalFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Marital Option",
        error: "Allowed values: Single, Married, Divorced, or Widowed."
      };

      // Column J is ESIC (10th column)
      ws.getCell(i, 10).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [esicFormula],
        showErrorMessage: true,
        errorTitle: "Invalid ESIC Answer",
        error: "Allowed answers: Yes or No."
      };
    }

    // Set nice widths for cells
    ws.columns.forEach((col, idx) => {
      // Index is 0-based in exceljs column loop
      if (idx === 2) { // Work Location
        col.width = 24;
      } else if (idx === 3 || idx === 9 || idx === 11 || idx === 14 || idx === 24 || idx === 25) { // Name cells and addresses
        col.width = 26;
      } else {
        col.width = 16;
      }
    });

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        isSample ? "employee_filled_sample.xlsx" : "employee_blank_template.xlsx"
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_TEMPLATE",
          target: isSample
            ? "Sample Excel Template: Downloaded pre-filled employee onboarding spreadsheet containing reference columns & in-cell dropdown validation rules."
            : "Blank Excel Template: Downloaded empty employee onboarding spreadsheet containing matching structure schemas & in-cell validation formulas.",
          details: { templateType: isSample ? "Sample Excel" : "Blank Excel" }
        })
      }).catch(err => console.error("Failed to log template download event", err));
    } catch (err) {
      console.error("Error creating Excel validation templates", err);
    }
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Parse and validate file (dynamic CSV and Excel formats supported)
  const processFile = (file: File) => {
    setErrorDetails(null);
    setValidationResults(null);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = file.name.endsWith(".csv") || file.type === "text/csv";

    if (!isExcel && !isCsv) {
      setErrorDetails("Only CSV and Excel formats (.csv, .xlsx, .xls) are supported.");
      return;
    }

    const handleRowsData = (rows: any[], formatName: string) => {
      if (rows.length === 0) {
        setErrorDetails(`The uploaded ${formatName} file appears empty or is formatted incorrectly.`);
        return;
      }

      // Run validation check for each parsed employee
      const valid: any[] = [];
      const invalid: { row: any; index: number; errors: Record<string, string> }[] = [];

      rows.forEach((row, i) => {
        const errors = validateEmployee(row);
        
        // Check duplicate code against DB or within sheet itself
        const isDupeInDb = existingCodes.includes(row.employeeCode || "");
        const isDupeInCsv = rows.findIndex((r) => r.employeeCode === row.employeeCode) !== i;
        
        if (isDupeInDb) {
          errors.employeeCode = `Employee Code "${row.employeeCode}" already exists in the HRMS.`;
        }
        if (isDupeInCsv && row.employeeCode) {
          errors.employeeCode = `Employee Code "${row.employeeCode}" is repeated inside this file.`;
        }

        if (Object.keys(errors).length > 0) {
          invalid.push({ row, index: i + 1, errors });
        } else {
          valid.push(row);
        }
      });

      setParsedRows(rows);
      setValidationResults({ valid, invalid });
    };

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const ab = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(new Uint8Array(ab), { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const sheetRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          
          const analysis = analyzeHeaders(sheetRows);
          setHeaderAnalysis(analysis);

          const rows = parseSheetRows(sheetRows);
          handleRowsData(rows, "Excel");
        } catch (err: any) {
          setErrorDetails("Failure parsing Excel file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          
          // Recreate identical splitting logic for robust header mapping analysis
          const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
          let delimiter = ",";
          if (lines.length > 0) {
            const first = lines[0];
            const commas = (first.match(/,/g) || []).length;
            const semicolons = (first.match(/;/g) || []).length;
            const tabs = (first.match(/\t/g) || []).length;
            if (semicolons > commas && semicolons > tabs) {
              delimiter = ";";
            } else if (tabs > commas && tabs > semicolons) {
              delimiter = "\t";
            }
          }
          const cellsMatrix = lines.map(line => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current);
            return result.map(val => val.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"'));
          });

          const analysis = analyzeHeaders(cellsMatrix);
          setHeaderAnalysis(analysis);

          const rows = parseCSV(text);
          handleRowsData(rows, "CSV");
        } catch (err: any) {
          setErrorDetails("Failure parsing CSV file: " + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const executeImport = () => {
    if (!validationResults) return;
    // Import both but database controller side can filter or save valid ones. 
    // To keep it safe, let's submit ALL valid rows.
    onImportSuccess(validationResults.valid);
    setValidationResults(null);
    setParsedRows([]);
    setHeaderAnalysis(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="csv-importer-container">
      <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-base" id="importer-title">Bulk Employee Import</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload an Excel (.xlsx, .xls) or CSV file containing all onboarding details</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => handleDownloadTemplate(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-slate-700 font-bold transition cursor-pointer shadow-xs"
            title="Download empty Excel template with required columns & in-cell dropdown validations"
            id="btn-download-blank-temp"
          >
            <Download size={14} className="text-slate-600" />
            Blank Excel Template (.xlsx)
          </button>
          <button
            onClick={() => handleDownloadTemplate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-blue-800 bg-blue-50 border border-blue-250 hover:bg-blue-100/70 rounded font-bold transition cursor-pointer shadow-xs"
            title="Download pre-filled Excel template (.xlsx) with interactive location and system dropdowns"
            id="btn-download-sample-temp"
          >
            <FileSpreadsheet size={14} className="text-blue-750 font-bold" />
            Sample Filled Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Upload Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-8 px-4 flex flex-col items-center justify-center cursor-pointer transition ${
            dragActive
              ? "border-blue-500 bg-blue-50/50"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
          }`}
          id="dropzone-area"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls"
            className="hidden"
            id="csv-file-input"
          />
          <div className="bg-blue-50 p-3 rounded-full text-blue-600 mb-3" id="icon-upload-badge">
            <Upload size={24} />
          </div>
          <span className="font-medium text-slate-700 text-sm">
            Drag and drop your CSV or Excel file here, or <span className="text-blue-600 hover:underline">browse files</span>
          </span>
          <span className="text-xs text-slate-400 mt-1.5">
            Strict layout (38 Columns including Address & Nominee) matches ESIC / EPF onboarding specs
          </span>
        </div>

        {errorDetails && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-start" id="importer-error-log">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-950">Invalid File Structure</p>
              <p className="mt-0.5">{errorDetails}</p>
            </div>
          </div>
        )}

        {/* Modal-like Dry Run Validation Preview */}
        {validationResults && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setValidationResults(null);
                setParsedRows([]);
                setHeaderAnalysis(null);
              }
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer" 
            id="dry-run-modal"
          >
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden cursor-default">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex flex-wrap items-center gap-2 text-left">
                  <span className="p-1 px-2.5 bg-blue-100 text-blue-800 text-[10px] md:text-xs font-bold rounded-full shrink-0">
                    Dry-Run Report
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm md:text-lg leading-tight">CSV Import File Verification</h3>
                </div>
                <button
                  onClick={() => {
                    setValidationResults(null);
                    setParsedRows([]);
                    setHeaderAnalysis(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  id="close-dryrun-modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-xs text-slate-500 block font-medium">Total Rows Detected</span>
                    <span className="text-2xl font-bold text-slate-800">{parsedRows.length}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start justify-between">
                    <div>
                      <span className="text-xs text-emerald-700 block font-medium">Ready to Import</span>
                      <span className="text-2xl font-bold text-emerald-800">{validationResults.valid.length}</span>
                    </div>
                    <CheckCircle className="text-emerald-500" size={20} />
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start justify-between">
                    <div>
                      <span className="text-xs text-amber-700 block font-medium">Validation Warnings / Errors</span>
                      <span className="text-2xl font-bold text-amber-800">{validationResults.invalid.length}</span>
                    </div>
                    {validationResults.invalid.length > 0 && (
                      <AlertTriangle className="text-amber-500 animate-pulse" size={20} />
                    )}
                  </div>
                </div>

                {headerAnalysis && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs" id="column-header-mapping-info">
                    <h4 className="font-semibold text-slate-750 text-xs mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <FileSpreadsheet size={15} className="text-slate-500" />
                      Dynamic File Onboarding Columns Map
                    </h4>
                    <p className="text-slate-500 mb-2.5">
                      Successfully matched <span className="font-bold text-slate-800">{headerAnalysis.matched.length}</span> out of {headerAnalysis.matched.length + headerAnalysis.unmatched.length} target fields.
                    </p>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded border border-slate-100 max-h-[140px] overflow-y-auto">
                      {headerAnalysis.matched.map(h => (
                        <span key={h} className="inline-flex items-center text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded text-[10px] font-medium font-mono whitespace-nowrap">
                          ✓ {h.replace(/[\*\s]+/g, " ").trim()}
                        </span>
                      ))}
                      {headerAnalysis.unmatched.map(h => (
                        <span key={h} className="inline-flex items-center text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded text-[10px] font-medium font-mono whitespace-nowrap opacity-60" title="Values for this column will default blank or auto-calculate">
                          ? {h.replace(/[\*\s]+/g, " ").trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {validationResults.invalid.length > 0 ? (
                  <div>
                    <h4 className="font-semibold text-slate-700 text-sm mb-3">Attention Required ({validationResults.invalid.length} Rows skipped or error-logged):</h4>
                    <div className="border border-amber-200 bg-amber-50/20 rounded-lg overflow-hidden text-xs">
                      <div className="max-h-[250px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-amber-50/60 text-slate-700 border-b border-amber-100 font-medium">
                              <th className="p-2.5 w-16 text-center">Row</th>
                              <th className="p-2.5 w-44">Code / Name</th>
                              <th className="p-2.5">Fields Blocking Onboarding Entry</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 bg-white">
                            {validationResults.invalid.map(({ row, index, errors }) => (
                              <tr key={index} className="hover:bg-amber-50/10">
                                <td className="p-2.5 text-center font-bold text-slate-500">#{index}</td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-800">
                                    {row.employeeCode || "MISSING CODE"}
                                  </div>
                                  <div className="text-slate-500 truncate max-w-[160px]">
                                    {row.nameAsPerAadhar || "Unknown"}
                                  </div>
                                </td>
                                <td className="p-2.5 py-1.5">
                                  <div className="flex flex-col gap-1">
                                    {Object.entries(errors).map(([field, errMsg]) => (
                                      <span key={field} className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] w-fit font-medium">
                                        <span className="font-bold capitalize">{field.replace(/Column/i, "")}: </span>
                                        {errMsg}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      💡 Tip: Re-download our "Sample Filled CSV" template, match your column names, verify mandatory fields marked with double asterisks are loaded, and try uploading again!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center" id="dry-run-success-card">
                    <div className="bg-emerald-100 text-emerald-800 p-3 rounded-full mb-3">
                      <CheckCircle size={32} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-base">All Rows Passed Verification perfectly!</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      There are no validation, duplicate, or missing-field issues in this sheet. You can safely complete the bulk ingestion.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setValidationResults(null);
                    setParsedRows([]);
                    setHeaderAnalysis(null);
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-700 text-sm font-medium transition cursor-pointer"
                  id="btn-cancel-dryrun"
                >
                  Discard File
                </button>
                <div className="flex gap-2">
                  {validationResults.invalid.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Action to import ONLY valid rows
                        onImportSuccess(validationResults.valid);
                        setValidationResults(null);
                        setParsedRows([]);
                        setHeaderAnalysis(null);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-lg text-white text-sm font-medium transition cursor-pointer"
                      disabled={validationResults.valid.length === 0}
                      id="btn-import-only-valid"
                    >
                      Import Only Valid ({validationResults.valid.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={executeImport}
                    disabled={validationResults.valid.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg text-white text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    id="btn-execute-all-imports"
                  >
                    Confirm & Onboard {validationResults.valid.length} Employees
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
