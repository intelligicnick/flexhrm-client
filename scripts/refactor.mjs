import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const appPath = path.join(srcDir, "App.tsx");
const content = fs.readFileSync(appPath, "utf8");
const lines = content.split("\n");

const slice = (start, end) => lines.slice(start - 1, end).join("\n");

// ── 1. Lib helpers ──────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "lib/date-helpers.ts"),
  `export const MONTH_NAME_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

${slice(94, 175)}

export const getDaysInMonthStatic = (monthStr: string) => {
  const parts = monthStr.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[1]) || 2026;
  if (monthIndex === -1) return 30;
  return new Date(year, monthIndex + 1, 0).getDate();
};
`
);

fs.writeFileSync(
  path.join(srcDir, "lib/employee-helpers.ts"),
  `import { Employee } from "../types";
import { MONTH_NAME_LIST } from "./date-helpers";

${slice(192, 288)}
`
);

fs.writeFileSync(
  path.join(srcDir, "lib/salary-columns.ts"),
  `import { Employee } from "../types";
import {
  normalizeSkillCategory,
  prorateSalaryByAttendance,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  resolveLocationPtAmount,
} from "../utils";
import { safeNumber, getDaysInMonthStatic } from "./date-helpers";
import { isEmployeeExitedOnDayStatic } from "./employee-helpers";

${slice(302, 415)}
`
);

fs.writeFileSync(
  path.join(srcDir, "lib/permissions.ts"),
  `import React from "react";

export interface SidebarItemDef {
  name: string;
  icon: React.ComponentType<any>;
  badge: string;
}

${slice(417, 431)}

export const PERMISSION_MODULES = [
  "employees", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin",
] as const;
`
);

// ── 2. UI components ────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "components/ui/DialerOverlay.tsx"),
  `import React, { useState, useEffect } from "react";

${slice(10915, 11043)}
`
);

fs.writeFileSync(
  path.join(srcDir, "components/ui/ConfettiRain.tsx"),
  `import React, { useState, useEffect } from "react";

${slice(11046, 11098)}
`
);

fs.writeFileSync(
  path.join(srcDir, "components/ui/PercentIcon.tsx"),
  `${slice(11101, 11107)}
`
);

// ── 3. Routes ─────────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "routes.ts"),
  `export const TAB_TO_PATH: Record<string, string> = {
  "Employees": "/employees",
  "Admin": "/admin",
  "Audit Logs": "/audit-logs",
  "Salary": "/salary",
  "Saved Bulk Pay": "/saved-bulk-pay",
  "Advance & Penalty": "/advance-penalty",
  "Leave": "/leave",
  "Attendance": "/attendance",
  "Directory": "/directory",
  "Birthdays": "/birthdays",
  "My Info": "/my-info",
};

export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, p]) => [p, tab])
);

export const DEFAULT_PATH = "/employees";

export function tabToPath(tab: string): string {
  return TAB_TO_PATH[tab] ?? DEFAULT_PATH;
}

export function pathToTab(pathname: string): string {
  return PATH_TO_TAB[pathname] ?? "Employees";
}

export const APP_ROUTES = [
  { path: "/employees", tab: "Employees" },
  { path: "/admin", tab: "Admin" },
  { path: "/audit-logs", tab: "Audit Logs" },
  { path: "/salary", tab: "Salary" },
  { path: "/saved-bulk-pay", tab: "Saved Bulk Pay" },
  { path: "/advance-penalty", tab: "Advance & Penalty" },
  { path: "/leave", tab: "Leave" },
  { path: "/attendance", tab: "Attendance" },
  { path: "/directory", tab: "Directory" },
  { path: "/birthdays", tab: "Birthdays" },
  { path: "/my-info", tab: "My Info" },
] as const;
`
);

// ── 4. Extract logic body (inside App function, lines 434-4264) ───────────────
const logicBody = slice(434, 4264);

// Parse state/handler names for context return
const stateNames = [];
const handlerNames = new Set();
const memoNames = new Set();

for (const line of logicBody.split("\n")) {
  const stateMatch = line.match(/const \[(\w+),/);
  if (stateMatch) stateNames.push(stateMatch[1]);

  const fnMatch = line.match(/^  const (\w+) = (?:async )?\(/);
  if (fnMatch && !fnMatch[1].startsWith("is") && fnMatch[1] !== "toggle") {
    handlerNames.add(fnMatch[1]);
  }
  const fnMatch2 = line.match(/^  const (\w+) = useCallback/);
  if (fnMatch2) handlerNames.add(fnMatch2[1]);

  const memoMatch = line.match(/^  const (\w+) = useMemo/);
  if (memoMatch) memoNames.add(memoMatch[1]);
}

// Also capture key computed values
["PERMISSION_MODULES", "sidebarItems", "filteredSidebarItems", "activeModuleKey", "isModuleAccessDenied", "SALARY_HEADERS", "REPORT_HEADERS"].forEach((n) => {
  if (logicBody.includes(n)) handlerNames.add(n);
});

const returnKeys = [...new Set([...stateNames, ...handlerNames, ...memoNames, "profileDropdownRef", "mobileProfileDropdownRef"])];
const returnStatement = returnKeys.map((k) => `    ${k},`).join("\n");

const hookImports = slice(6, 92)
  .replace('import "./index.css";\n', "")
  .replace(/from "\.\/types"/, 'from "../types"')
  .replace(/from "\.\/components/, 'from "../components')
  .replace(/from "\.\/utils"/, 'from "../utils"')
  .replace(/from "\.\/api"/, 'from "../api"');

fs.writeFileSync(
  path.join(srcDir, "hooks/useHRMSApp.ts"),
  `/**
 * Core HRMS application state and handlers (extracted from App.tsx).
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
${hookImports}
import {
  getCurrentFY, getFinancialYears, MONTH_NAME_LIST, getMonthsForFY,
  getCalendarYearFromFYRange, normalizeMonthKey, safeNumber, getDaysInMonthStatic,
} from "../lib/date-helpers";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue } from "../lib/salary-columns";
import { getModuleKey, PERMISSION_MODULES, SidebarItemDef } from "../lib/permissions";
import { tabToPath, pathToTab, DEFAULT_PATH } from "../routes";
import PercentIcon from "../components/ui/PercentIcon";

export function useHRMSApp() {
  const navigate = useNavigate();
  const location = useLocation();

${logicBody.replace(
  'const [activeSidebarTab, setActiveSidebarTab] = useState("Employees");',
  `const activeSidebarTab = pathToTab(location.pathname);
  const setActiveSidebarTab = (tab: string) => navigate(tabToPath(tab));`
)}

  return {
${returnStatement}
    activeSidebarTab,
    setActiveSidebarTab,
    navigate,
    location,
  };
}
`
);

// ── 5. Context ────────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "context/HRMSContext.tsx"),
  `import React, { createContext, useContext } from "react";
import { useHRMSApp } from "../hooks/useHRMSApp";

type HRMSContextValue = ReturnType<typeof useHRMSApp>;

const HRMSContext = createContext<HRMSContextValue | null>(null);

export function HRMSProvider({ children }: { children: React.ReactNode }) {
  const value = useHRMSApp();
  return <HRMSContext.Provider value={value}>{children}</HRMSContext.Provider>;
}

export function useHRMS(): HRMSContextValue {
  const ctx = useContext(HRMSContext);
  if (!ctx) throw new Error("useHRMS must be used within HRMSProvider");
  return ctx;
}
`
);

// ── 6. Login page ─────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "components/auth/LoginPage.tsx"),
  `import React from "react";
import PasswordInput from "../PasswordInput";
import { useHRMS } from "../../context/HRMSContext";

export default function LoginPage() {
  const ctx = useHRMS();
  const {
    loginView, loginError, usernameInput, setUsernameInput,
    passwordInput, setPasswordInput, handleLoginSubmit, openForgotPassword,
    forgotError, forgotMessage, forgotUsername, setForgotUsername,
    handleForgotPasswordSubmit, backToSignIn, resetError, resetSuccess,
    issuedResetToken, resetTokenInput, setResetTokenInput,
    resetNewPassword, setResetNewPassword, resetConfirmPassword, setResetConfirmPassword,
    handleResetPasswordSubmit, setLoginView,
  } = ctx;

  return (
${slice(4268, 4497).split("\n").map((l) => "    " + l).join("\n")}
  );
}
`
);

// ── 7. Module content (views) ─────────────────────────────────────────────────
const destructure = returnKeys.map((k) => k).join(",\n    ");

fs.writeFileSync(
  path.join(srcDir, "pages/ModuleContent.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";
import type { HRMSContextValue } from "../context/HRMSContext";

function ModuleViews({
    ${destructure},
    activeSidebarTab,
    setActiveSidebarTab,
}: HRMSContextValue) {
  return (
    <>
${slice(4862, 10814).split("\n").map((l) => "      " + l).join("\n")}
    </>
  );
}

export default function ModuleContent() {
  return <ModuleViews {...useHRMS()} />;
}
`
);

// ── 8. Dashboard layout ───────────────────────────────────────────────────────
const layoutJsx = slice(4502, 4861) + "\n          {/* ROUTE OUTLET */}\n          <ModuleContent />\n" + slice(4839, 4860).includes("viewport") ? "" : "";

// Layout: 4502-4838 (before viewport), skip 4839-10816 (viewport), 10817-10910 (modals/footer part of main)
const layoutBeforeViewport = slice(4502, 4838);
const layoutAfterViewport = slice(10817, 10910);

fs.writeFileSync(
  path.join(srcDir, "layouts/DashboardLayout.tsx"),
  `import React from "react";
import {
  Users, Search, Shield, FileText, Coins, Archive, Calculator,
  CalendarOff, Clock, Contact, Cake, ChevronDown, ChevronUp, Menu,
  Settings, Bell, LogOut, ChevronLeft, ChevronRight, UserCircle, Lock, User,
  Calendar, IndianRupee, Info, Phone, Building, BarChart4, Edit2, Check, X,
  Trash2, Gift, Filter, Download, ExternalLink, CheckCircle, Briefcase,
  Map, HelpCircle, FileSpreadsheet, Heart, RotateCw, Plus, UserPlus,
  TrendingUp, Wrench, Megaphone, Target, LayoutDashboard, CheckCircle2,
  CheckSquare, Square,
} from "lucide-react";
import EmployeeFormModal from "../components/EmployeeFormModal";
import DialerOverlay from "../components/ui/DialerOverlay";
import ConfettiRain from "../components/ui/ConfettiRain";
import { useHRMS } from "../context/HRMSContext";
import type { HRMSContextValue } from "../context/HRMSContext";
import { tabToPath } from "../routes";
import { getModuleKey } from "../lib/permissions";
import ModuleContent from "../pages/ModuleContent";

function DashboardShell({
    ${destructure},
    activeSidebarTab,
    setActiveSidebarTab,
}: HRMSContextValue) {
  const navigateToTab = (tabName: string) => {
    setActiveSidebarTab(tabName);
    triggerSuccess(\`Switched module view to: \${tabName}\`);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  return (
${layoutBeforeViewport.split("\n").map((l) => "    " + l).join("\n").replace(/setActiveSidebarTab\(([^)]+)\)/g, "navigateToTab($1)")}
          <ModuleContent />
${layoutAfterViewport.split("\n").map((l) => "    " + l).join("\n").replace(/setActiveSidebarTab\(([^)]+)\)/g, "navigateToTab($1)")}
  );
}

export default function DashboardLayout() {
  return <DashboardShell {...useHRMS()} />;
}
`
);

// ── 9. App.tsx ────────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(srcDir, "App.tsx"),
  `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { HRMSProvider, useHRMS } from "./context/HRMSContext";
import LoginPage from "./components/auth/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import { APP_ROUTES, DEFAULT_PATH } from "./routes";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useHRMS();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useHRMS();
  if (isLoggedIn) return <Navigate to={DEFAULT_PATH} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <HRMSProvider>
        <AppRoutes />
      </HRMSProvider>
    </BrowserRouter>
  );
}
`
);

// Export HRMSContextValue type
const ctxPath = path.join(srcDir, "context/HRMSContext.tsx");
let ctxContent = fs.readFileSync(ctxPath, "utf8");
ctxContent = ctxContent.replace(
  "type HRMSContextValue = ReturnType<typeof useHRMSApp>;",
  "export type HRMSContextValue = ReturnType<typeof useHRMSApp>;"
);
fs.writeFileSync(ctxPath, ctxContent);

// Backup original
fs.copyFileSync(appPath, path.join(srcDir, "App.original.tsx"));

console.log("Refactor complete. State:", stateNames.length, "Return keys:", returnKeys.length);
