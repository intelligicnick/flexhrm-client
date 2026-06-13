/** Fix destructuring in extracted layout/page components. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const hookLines = fs.readFileSync(
  path.join(srcDir, "hooks/useHRMSApp.tsx"),
  "utf8"
).split("\n");

const returnStart = hookLines.findIndex((l) => /^  return \{$/.test(l));
const returnEnd = hookLines.findIndex((l, i) => i > returnStart && /^  \};$/.test(l));
const returnKeys = [
  ...new Set(
    hookLines
      .slice(returnStart + 1, returnEnd)
      .map((l) => l.match(/^\s+(\w+),/)?.[1])
      .filter(Boolean)
  ),
];

const destructure = `  const {\n${returnKeys.map((k) => `    ${k},`).join("\n")}\n  } = useHRMS();`;

function rebuild(filePath, preamble, componentName) {
  const content = fs.readFileSync(filePath, "utf8");
  const returnIdx = content.indexOf("\n  return (");
  if (returnIdx === -1) throw new Error(`No return ( in ${filePath}`);
  const body = content.slice(returnIdx + 1);
  fs.writeFileSync(
    filePath,
    `${preamble}\n\nexport default function ${componentName}() {\n${destructure}\n${body}`
  );
}

rebuild(
  path.join(srcDir, "layouts/DashboardLayout.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";
import ModuleContent from "../pages/ModuleContent";
import EmployeeFormModal from "../components/EmployeeFormModal";
import SchoolWorkFormModal from "../components/SchoolWorkFormModal";
import DialerOverlay from "../components/ui/DialerOverlay";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import { getBulkPayPreviewHeaderRowCount } from "../utils";
import {
  Users, Search, Shield, FileText, Coins, Archive, Calculator,
  CalendarOff, Clock, Contact, Cake, ChevronDown, Menu,
  LogOut, ChevronLeft, ChevronRight, UserCircle, Lock, User,
  Download, Trash2, X, FileSpreadsheet,
} from "lucide-react";`,
  "DashboardLayout"
);

rebuild(
  path.join(srcDir, "pages/ModuleContent.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";
import EmployeesPage from "./EmployeesPage";`,
  "ModuleContent"
);

rebuild(
  path.join(srcDir, "pages/EmployeesPage.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";`,
  "EmployeesPage"
);

console.log(`Rebuilt components with ${returnKeys.length} context keys.`);
