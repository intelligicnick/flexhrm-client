/** Prepend useHRMSApp-style imports to extracted page components. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const hookLines = fs.readFileSync(
  path.join(srcDir, "hooks/useHRMSApp.tsx"),
  "utf8"
).split("\n");

const sharedImports = hookLines.slice(3, 122).join("\n");

function prependImports(filePath, extra = "") {
  const content = fs.readFileSync(filePath, "utf8");
  const exportIdx = content.indexOf("export default function");
  if (exportIdx === -1) throw new Error(`No export in ${filePath}`);
  const body = content.slice(exportIdx);
  fs.writeFileSync(
    filePath,
    `${sharedImports}\nimport { useHRMS } from "../context/HRMSContext";\n${extra}\n${body}`
  );
}

prependImports(
  path.join(srcDir, "pages/ModuleContent.tsx"),
  'import EmployeesPage from "./EmployeesPage";'
);
prependImports(path.join(srcDir, "pages/EmployeesPage.tsx"));

const dashPath = path.join(srcDir, "layouts/DashboardLayout.tsx");
const dash = fs.readFileSync(dashPath, "utf8");
const exportIdx = dash.indexOf("export default function");
fs.writeFileSync(
  dashPath,
  `${sharedImports}
import { useHRMS } from "../context/HRMSContext";
import ModuleContent from "../pages/ModuleContent";

${dash.slice(exportIdx)}`
);

console.log("Prepended shared imports to extracted components.");
