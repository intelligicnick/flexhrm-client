import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const appPath = path.join(srcDir, "App.tsx");
const lines = fs.readFileSync(appPath, "utf8").split("\n");

const slice = (start, end) => lines.slice(start - 1, end).join("\n");

// Extract view content (ternary chain inside viewport)
const moduleContent = slice(4862, 10814);

fs.writeFileSync(
  path.join(srcDir, "pages/ModuleContent.tsx"),
  `import React from "react";
import { useHRMS } from "../context/HRMSContext";

export default function ModuleContent() {
  const ctx = useHRMS();
  const {
    isModuleAccessDenied,
    activeSidebarTab,
    setActiveSidebarTab,
    sessionUser,
    employees,
    dashboardStats,
    companyBranch,
    activePimSubTab,
  } = ctx;

  return (
    <>
${moduleContent.split("\n").map((l) => "      " + l).join("\n")}
    </>
  );
}
`
);

// Extract login JSX
const loginJsx = slice(4268, 4497);
fs.writeFileSync(
  path.join(srcDir, "components/auth/LoginPage.tsx"),
  `import React from "react";
import PasswordInput from "../PasswordInput";
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
${loginJsx.split("\n").map((l) => "    " + l).join("\n")}
  );
}
`
);

// Extract layout (main shell from line 4502 to before modals at 10827)
const layoutStart = slice(4502, 4861);
const layoutEnd = slice(10817, 10910);

fs.writeFileSync(
  path.join(srcDir, "layouts/DashboardLayout.tsx"),
  `import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Users, Search, Shield, FileText, Coins, Archive, Calculator,
  CalendarOff, Clock, Contact, Cake, ChevronDown, ChevronUp, Menu,
  Settings, Bell, LogOut, ChevronLeft, ChevronRight, UserCircle, Lock, User,
} from "lucide-react";
import EmployeeFormModal from "../components/EmployeeFormModal";
import DialerOverlay from "../components/ui/DialerOverlay";
import ConfettiRain from "../components/ui/ConfettiRain";
import { useHRMS } from "../context/HRMSContext";
import { tabToPath } from "../routes";
import { getModuleKey } from "../lib/permissions";

export default function DashboardLayout() {
  const ctx = useHRMS();
  const navigate = useNavigate();
  const {
    isSidebarCollapsed, setIsSidebarCollapsed,
    sidebarSearch, setSidebarSearch,
    filteredSidebarItems,
    activeSidebarTab,
    triggerSuccess,
    isProfileOpen, setIsProfileOpen,
    profileDropdownRef,
    isMobileProfileOpen, setIsMobileProfileOpen,
    mobileProfileDropdownRef,
    sessionUser,
    activePimSubTab,
    handlePimSubTabClick,
    handleLogout,
    errorMessage,
    successMessage,
    isFormOpen,
    currentEmployee,
    customLocations,
    basicSalaryPercentage,
    esicEligibilityLimit,
    fetchLocations,
    handleAddLocationFromConfig,
    handleAddRoleFromConfig,
    setIsFormOpen,
    setCurrentEmployee,
    setActivePimSubTab,
    handleSaveEmployee,
    activeDialerContact,
    activeDialerStatus,
    setActiveDialerStatus,
    setActiveDialerContact,
    showConfetti,
    userPermissions,
  } = ctx;

  const navigateToTab = (tabName: string) => {
    navigate(tabToPath(tabName));
    triggerSuccess(\`Switched module view to: \${tabName}\`);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  return (
${layoutStart.split("\n").map((l) => "    " + l).join("\n").replace(/setActiveSidebarTab\(item\.name\)/g, "navigateToTab(item.name)").replace(/setActiveSidebarTab\("My Info"\)/g, 'navigateToTab("My Info")').replace(/setActiveSidebarTab\("Employees"\)/g, 'navigateToTab("Employees")')}
          <Outlet />
${layoutEnd.split("\n").map((l) => "    " + l).join("\n").replace(/setActiveSidebarTab\(item\.name\)/g, "navigateToTab(item.name)")}
  );
}
`
);

console.log("Extracted ModuleContent, LoginPage, DashboardLayout");
