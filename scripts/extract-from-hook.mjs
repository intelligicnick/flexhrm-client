/**
 * Extracts LoginPage, DashboardLayout, ModuleContent, and EmployeesPage
 * from useHRMSApp.tsx into standalone components.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const hookPath = path.join(srcDir, "hooks/useHRMSApp.tsx");
const hookSource = fs.readFileSync(hookPath, "utf8");
const lines = hookSource.split("\n");

const slice = (start, end) => lines.slice(start - 1, end).join("\n");
const indent = (text, spaces) =>
  text
    .split("\n")
    .map((l) => (l.trim() ? " ".repeat(spaces) + l : l))
    .join("\n");

function parseReturnKeys(source) {
  const match = source.match(/return \{\n([\s\S]*?)\n  \};\n\}/);
  if (!match) throw new Error("Could not parse useHRMSApp return block");
  return [...match[1].matchAll(/^\s+(\w+),/gm)].map((m) => m[1]);
}

const returnKeys = parseReturnKeys(hookSource).filter(
  (k) => k !== "renderAuthenticatedApp" && k !== "renderLoginPage"
);

const destructureBlock = returnKeys.map((k) => `    ${k},`).join("\n");

// Line numbers (1-indexed) in useHRMSApp.tsx
const LOGIN_START = 11042;
const LOGIN_END = 11271;
const SHELL_START = 4461;
const SHELL_BEFORE_VIEWPORT = 4893;
const VIEWPORT_START = 4894;
const VIEWPORT_END = 10786;
const SHELL_AFTER_VIEWPORT = 10787;
const SHELL_END = 11038;
const EMPLOYEES_START = 9410;
const EMPLOYEES_END = 10783;

const loginJsx = slice(LOGIN_START, LOGIN_END);
const shellBefore = slice(SHELL_START, SHELL_BEFORE_VIEWPORT);
const viewportJsx = slice(VIEWPORT_START, VIEWPORT_END);
const shellAfter = slice(SHELL_AFTER_VIEWPORT, SHELL_END);
const employeesJsx = slice(EMPLOYEES_START, EMPLOYEES_END);

const moduleContentJsx = viewportJsx.replace(
  employeesJsx.trim(),
  "<EmployeesPage />"
);

fs.mkdirSync(path.join(srcDir, "pages"), { recursive: true });

fs.writeFileSync(
  path.join(srcDir, "components/auth/LoginPage.tsx"),
  `import React from "react";
import PasswordInput from "../PasswordInput";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useHRMS } from "../../context/HRMSContext";

export default function LoginPage() {
  const {
    loginView,
    loginError,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    handleLoginSubmit,
    openForgotPassword,
    forgotError,
    forgotMessage,
    forgotUsername,
    setForgotUsername,
    handleForgotPasswordSubmit,
    backToSignIn,
    resetError,
    resetSuccess,
    issuedResetToken,
    resetTokenInput,
    setResetTokenInput,
    resetNewPassword,
    setResetNewPassword,
    resetConfirmPassword,
    setResetConfirmPassword,
    handleResetPasswordSubmit,
    setLoginView,
  } = useHRMS();

  return (
${indent(loginJsx, 4)}
  );
}
`
);

fs.writeFileSync(
  path.join(srcDir, "pages/EmployeesPage.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";

export default function EmployeesPage() {
  const {
${destructureBlock}
  } = useHRMS();

  return (
    <>
${indent(employeesJsx, 6)}
    </>
  );
}
`
);

fs.writeFileSync(
  path.join(srcDir, "pages/ModuleContent.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";
import EmployeesPage from "./EmployeesPage";

export default function ModuleContent() {
  const {
${destructureBlock}
  } = useHRMS();

  return (
${indent(moduleContentJsx, 4)}
  );
}
`
);

fs.writeFileSync(
  path.join(srcDir, "layouts/DashboardLayout.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";
import ModuleContent from "../pages/ModuleContent";
import EmployeeFormModal from "../components/EmployeeFormModal";
import SchoolWorkFormModal from "../components/SchoolWorkFormModal";
import DialerOverlay from "../components/ui/DialerOverlay";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import { Download, FileSpreadsheet, Trash2, X } from "lucide-react";

export default function DashboardLayout() {
  const {
${destructureBlock}
  } = useHRMS();

  return (
${indent(shellBefore, 4)}
          <ModuleContent />
${indent(shellAfter, 4)}
  );
}
`
);

// Patch useHRMSApp: remove renderAuthenticatedApp and renderLoginPage
const beforeShell = lines.slice(0, 4459).join("\n");
const afterLogin = lines.slice(11272).join("\n");
const patched = afterLogin
  .replace(/\n\s*renderAuthenticatedApp,\n/, "\n")
  .replace(/\n\s*renderLoginPage,\n/, "\n");

fs.writeFileSync(hookPath, beforeShell + "\n" + patched);

console.log("Extracted LoginPage, DashboardLayout, ModuleContent, EmployeesPage");
console.log(`Destructured ${returnKeys.length} context keys in layout/page components`);
console.log("Removed renderAuthenticatedApp and renderLoginPage from useHRMSApp.tsx");
