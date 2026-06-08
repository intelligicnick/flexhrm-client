import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");

// Fix date-helpers.ts
fs.writeFileSync(
  path.join(srcDir, "lib/date-helpers.ts"),
  `export const MONTH_NAME_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const getCurrentFY = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 3) {
    return \`FY \${year}-\${String(year + 1).slice(-2)}\`;
  }
  return \`FY \${year - 1}-\${String(year).slice(-2)}\`;
};

export const getFinancialYears = () => {
  const today = new Date();
  const currentFY = getCurrentFY(today);
  const currentStartYear = parseInt(currentFY.substring(3, 7));
  const list = [];
  const startYear = Math.min(2025, currentStartYear - 1);
  const endYear = currentStartYear + 1;
  for (let y = startYear; y <= endYear; y++) {
    list.push(\`FY \${y}-\${String(y + 1).slice(-2)}\`);
  }
  return list;
};

export const getMonthsForFY = (fyStr: string) => {
  const list: string[] = [];
  const trimmed = (fyStr || "").trim();
  let startYear = NaN;
  if (/^\\d{4}-\\d{4}$/.test(trimmed)) {
    startYear = parseInt(trimmed.split("-")[0], 10);
  } else {
    startYear = parseInt(trimmed.substring(3, 7), 10);
  }
  if (!Number.isFinite(startYear)) startYear = new Date().getFullYear();
  for (let m = 3; m < 12; m++) list.push(\`\${MONTH_NAME_LIST[m]} \${startYear}\`);
  for (let m = 0; m < 3; m++) list.push(\`\${MONTH_NAME_LIST[m]} \${startYear + 1}\`);
  return list;
};

export const getCalendarYearFromFYRange = (monthName: string, fyRange: string): string => {
  const years = fyRange.split("-");
  const startYear = years[0];
  const endYear = years[1] || String(parseInt(startYear) + 1);
  if (["January", "February", "March"].includes(monthName)) return endYear;
  return startYear;
};

export const normalizeMonthKey = (monthStr: string | null | undefined): string => {
  const today = new Date();
  const fallback = \`\${MONTH_NAME_LIST[today.getMonth()]} \${today.getFullYear()}\`;
  if (!monthStr || typeof monthStr !== "string") return fallback;
  const parts = monthStr.trim().split(/\\s+/);
  if (parts.length < 2) return fallback;
  const monthName = parts[0];
  const year = parseInt(parts[parts.length - 1], 10);
  if (MONTH_NAME_LIST.indexOf(monthName) === -1 || !Number.isFinite(year)) return fallback;
  return \`\${monthName} \${year}\`;
};

export const safeNumber = (val: unknown): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const getDaysInMonthStatic = (monthStr: string) => {
  const parts = monthStr.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[1]) || 2026;
  if (monthIndex === -1) return 30;
  return new Date(year, monthIndex + 1, 0).getDate();
};
`
);

// Fix exports in employee-helpers, salary-columns, permissions
for (const file of ["employee-helpers.ts", "salary-columns.ts", "permissions.ts"]) {
  let content = fs.readFileSync(path.join(srcDir, "lib", file), "utf8");
  content = content.replace(/^const (get|is)/gm, "export const $1");
  content = content.replace(/^interface /gm, "export interface ");
  fs.writeFileSync(path.join(srcDir, "lib", file), content);
}

// Fix UI component default exports
for (const [file, name] of [
  ["components/ui/DialerOverlay.tsx", "DialerOverlay"],
  ["components/ui/ConfettiRain.tsx", "ConfettiRain"],
  ["components/ui/PercentIcon.tsx", "PercentIcon"],
]) {
  let content = fs.readFileSync(path.join(srcDir, file), "utf8");
  if (!content.includes("export default")) {
    content = content.replace(
      new RegExp(`^(const ${name}|function ${name})`),
      `export default $1`
    );
    if (!content.includes("export default")) {
      content += `\nexport default ${name};\n`;
    }
  }
  fs.writeFileSync(path.join(srcDir, file), content);
}

// Fix useHRMSApp.tsx
let hook = fs.readFileSync(path.join(srcDir, "hooks/useHRMSApp.tsx"), "utf8");
hook = hook.replace(
  "import React, { useState, useEffect, useMemo, useRef, useCallback } from \"react\";\nimport { useNavigate, useLocation } from \"react-router-dom\";\nimport React, { useState, useEffect, useMemo, useRef, useCallback } from \"react\";",
  "import React, { useState, useEffect, useMemo, useRef, useCallback } from \"react\";\nimport { useNavigate, useLocation } from \"react-router-dom\";"
);
hook = hook.replace(
  'import CsvImporter from "./components/CsvImporter";\nimport EmployeeTable from "./components/EmployeeTable";\nimport EmployeeFormModal from "./components/EmployeeFormModal";',
  'import CsvImporter from "../components/CsvImporter";\nimport EmployeeTable from "../components/EmployeeTable";\nimport EmployeeFormModal from "../components/EmployeeFormModal";'
);
hook = hook.replace(/    reportRes,\n/, "");

// Parse setters and add to return
const setterMatches = [...hook.matchAll(/const \[(\w+), (set\w+)\]/g)];
const setters = setterMatches.map((m) => m[2]);
const existingReturn = hook.match(/  return \{([\s\S]*?)\n  \};\n\}/);
if (existingReturn) {
  const returnBody = existingReturn[1];
  const missingSetters = setters.filter((s) => !returnBody.includes(`${s},`));
  if (missingSetters.length) {
    const insert = missingSetters.map((s) => `    ${s},`).join("\n");
    hook = hook.replace(
      "    navigate,\n    location,\n  };",
      `${insert}\n    navigate,\n    location,\n  };`
    );
  }
  // Remove duplicate activeSidebarTab/setActiveSidebarTab if duplicated
  hook = hook.replace(/(    activeSidebarTab,\n)([\s\S]*?)(    activeSidebarTab,\n    setActiveSidebarTab,\n)/, "$2    activeSidebarTab,\n    setActiveSidebarTab,\n");
}

fs.writeFileSync(path.join(srcDir, "hooks/useHRMSApp.tsx"), hook);

// Fix DashboardLayout and ModuleContent to use spread pattern
const spreadComponent = (filePath, componentName, importExtra = "") => {
  let content = fs.readFileSync(path.join(srcDir, filePath), "utf8");
  const fnMatch = content.match(new RegExp(`function ${componentName}\\(\\{[\\s\\S]*?\\}: HRMSContextValue\\)`));
  if (fnMatch) {
    content = content.replace(
      fnMatch[0],
      `function ${componentName}(props: HRMSContextValue) {\n  const {\n    activeSidebarTab,\n    setActiveSidebarTab,\n    triggerSuccess,\n    setIsSidebarCollapsed,\n    ...rest\n  } = props;\n  const scope = { ...rest, ...props, activeSidebarTab, setActiveSidebarTab, triggerSuccess, setIsSidebarCollapsed };`
    );
    // Too complex - simpler approach: just use props spread into eval scope
  }
};
console.log("Fixed exports and hook");
