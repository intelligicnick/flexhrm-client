import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  IndianRupee, 
  Map, 
  HelpCircle, 
  FileSpreadsheet, 
  Heart, 
  RotateCw,
  Plus,
  Search,
  Shield,
  CalendarOff,
  Calendar,
  CheckCircle,
  Clock,
  Briefcase,
  UserCircle,
  Target,
  LayoutDashboard,
  Contact,
  Wrench,
  Coins,
  Calculator,
  Megaphone,
  LogOut,
  ChevronDown,
  ChevronUp,
  Menu,
  Settings,
  Bell,
  Lock,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Building,
  CheckCircle2,
  FileText,
  BarChart4,
  Edit2,
  Check,
  X,
  Trash2,
  Gift,
  Cake,
  Phone,
  Mail,
  Globe,
  Filter,
  CheckSquare,
  Square,
  Archive,
  Download,
  Eye,
  School,
} from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EXCEL_ROW_HEADERS } from "../types";
import PasswordInput from "../components/PasswordInput";
import {
  generateCSV,
  getEmployeeHeaderValue,
  normalizeSkillCategory,
  employeeMatchesSkillFilters,
  prorateSalaryByAttendance,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  quoteCSVValue,
  downloadAxisBulkPayXls,
  saveAxisBulkPayArchive,
  getAxisDebitAccountNo,
  buildAxisBulkPayFilename,
  parseMonthYear,
  parseBulkPayXlsWorkbook,
  getBulkPayPreviewHeaderRowCount,
} from "../utils";
import { formatAuditLogDetails } from "../utils/formatAuditLogDetails";
import CsvImporter from "../components/CsvImporter";
import EmployeeTable from "../components/EmployeeTable";
import BulkEmployeeEditTable from "../components/BulkEmployeeEditTable";
import EmployeeChangeRequestsPanel from "../components/EmployeeChangeRequestsPanel";
import EmployeeFormModal from "../components/EmployeeFormModal";
import { parseApiError } from "../api";
import {
  getCurrentFY, getFinancialYears, MONTH_NAME_LIST, getMonthsForFY,
  getCalendarYearFromFYRange, normalizeMonthKey, safeNumber, getDaysInMonthStatic,
  getCurrentMonthName, getTodayBirthdayLabel, getOrdinalDay, parseDateOfBirth,
  formatEmployeeBirthDate,
} from "../lib/date-helpers";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue } from "../lib/salary-columns";
import { getModuleKey, PERMISSION_MODULES, SidebarItemDef } from "../lib/permissions";
import { tabToPath, pathToTab, DEFAULT_PATH } from "../routes";
import { downloadEmployeeOnboardingTemplate } from "../lib/employee-onboarding-template";
import PercentIcon from "../components/ui/PercentIcon";
import DialerOverlay from "../components/ui/DialerOverlay";
import DirectoryContactCard from "../components/DirectoryContactCard";
import { formatPhoneDisplay, phoneToDialString } from "../lib/phone-helpers";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import BirthdaysTab from "../components/BirthdaysTab";
import ConfigurationPanel from "../components/ConfigurationPanel";
import ReportsPanel from "../components/ReportsPanel";
import { useHRMS } from "../context/HRMSContext";

export default function EmployeesPage() {
  const {
    isLoggedIn,
    sessionUser,
    sessionRole,
    sessionLocations,
    sessionPermissions,
    rolesList,
    isFetchingRoles,
    usernameInput,
    passwordInput,
    loginError,
    loginView,
    forgotUsername,
    forgotError,
    forgotMessage,
    issuedResetToken,
    resetTokenInput,
    resetNewPassword,
    resetConfirmPassword,
    resetError,
    resetSuccess,
    adminsList,
    inviteUsername,
    invitePassword,
    inviteRole,
    inviteLocations,
    editingAdminUsername,
    editAdminRole,
    editAdminLocations,
    editAdminDisabled,
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
    roleError,
    roleSuccess,
    activePimSubTab,
    employeeListRoleFilter,
    employeeListStatusFilter,
    exitEligibleEmployees,
    sidebarSearch,
    isSidebarCollapsed,
    isProfileOpen,
    isMobileProfileOpen,
    adminProfileInfo,
    isFetchingProfile,
    profileLoadingError,
    oldPassword,
    newPassword,
    confirmNewPassword,
    changePasswordError,
    changePasswordSuccess,
    rawEmployees,
    selectedIds,
    isFormOpen,
    currentEmployee,
    isLoading,
    errorMessage,
    successMessage,
    esicEligibilityLimit,
    basicSalaryPercentage,
    companyBranch,
    rawCustomLocations,
    locationCompliance,
    locationPtEnabled,
    isFetchingLocations,
    newLocCompliance,
    newLocPtEnabled,
    customRoles,
    isFetchingJobRoles,
    auditLogsList,
    isFetchingAuditLogs,
    auditSearch,
    auditFilterAdmin,
    auditFilterAction,
    expandedLogId,
    bulkPayArchives,
    isFetchingBulkPayArchives,
    isExportingBulkPay,
    lastSavedBulkPay,
    highlightedBulkPayId,
    bulkPayArchiveYearFilter,
    editingLocIndex,
    editingLocValue,
    newLocNameInput,
    selectedLocs,
    ledgerEmployeeId,
    ledgerType,
    ledgerAmount,
    selectedMonth,
    ledgerSearchQuery,
    ledgerSelectedEmployeeIds,
    ledgerLocationFilters,
    ledgerSkillFilters,
    ledgerRoleFilters,
    isLedgerLocationDropdownOpen,
    isLedgerSkillDropdownOpen,
    isLedgerRoleDropdownOpen,
    tempLedgerEntries,
    salarySearchQuery,
    salaryLocationFilter,
    salaryFilterType,
    salaryJoinStartFilter,
    salaryJoinEndFilter,
    salaryExitStartFilter,
    salaryExitEndFilter,
    salaryMinSalaryFilter,
    salaryMaxSalaryFilter,
    salaryGenderFilter,
    salaryMaritalFilter,
    salaryEsicFilter,
    salarySkillFilters,
    salaryRoleFilters,
    salaryPaymentStatusFilter,
    isSalarySkillDropdownOpen,
    isSalaryRoleDropdownOpen,
    selectedSalaryEmployeeIds,
    birthdaySearchMonth,
    showConfetti,
    simulatedBirthdayEmpIds,
    helplines,
    isFetchingHelplines,
    newHelplineName,
    newHelplinePhone,
    newHelplineRole,
    newHelplineCategory,
    newHelplineLocation,
    helplineSearchQuery,
    helplineLocationFilter,
    attendanceDb,
    isFetchingAttendance,
    attendanceLocationFilter,
    attendanceRoleFilters,
    attendanceSkillFilters,
    isAttendanceRoleDropdownOpen,
    isAttendanceSkillDropdownOpen,
    bulkWizardRoleFilters,
    bulkWizardSkillFilters,
    isBulkWizardRoleDropdownOpen,
    isBulkWizardSkillDropdownOpen,
    confirmAction,
    attendanceSearchQuery,
    bulkStartDay,
    bulkEndDay,
    bulkStatus,
    bulkWizardStep,
    isBulkWizardOpen,
    attendanceSubView,
    bulkSelLocations,
    bulkSelEmployees,
    bulkSelMonths,
    bulkCalendarMonth,
    bulkSelDates,
    bulkConfirm1,
    bulkConfirm2,
    activeDirectorySubTab,
    directorySearch,
    directoryLocation,
    directoryGender,
    activeDialerContact,
    activeDialerStatus,
    selectedSalaryColumns,
    savedReportTemplates,
    savedSalaryTemplates,
    isFetchingTemplates,
    newReportTemplateName,
    newSalaryTemplateName,
    activeReportTemplateName,
    activeSalaryTemplateName,
    editingRoleIndex,
    editingRoleValue,
    newRoleNameInput,
    selectedRoles,
    selectedReportColumns,
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportSkillFilters,
    reportRoleFilters,
    isReportLocDropdownOpen,
    isSkillDropdownOpen,
    isRoleDropdownOpen,
    reportSearchQuery,
    selectedReportEmployeeIds,
    applySessionFromAuthMe,
    fetchRoles,
    updateLocationCompliance,
    updateLocationPtEnabled,
    fetchLocations,
    fetchJobRoles,
    fetchBulkPayArchives,
    handleDownloadBulkPayArchive,
    handleDeleteBulkPayArchive,
    fetchAuditLogs,
    handleFlushAuditLogs,
    handleExportAuditPDF,
    handleExportAuditExcel,
    handleAddLocationFromConfig,
    handleEditLocationFromConfig,
    fetchHelplines,
    handleAddHelpline,
    handleDeleteHelpline,
    fetchAttendanceForMonth,
    getDaysInSelectedMonth,
    handleCellAttendanceChange,
    handleApplyBulkAttendance,
    handleApplyBulkWizardAttendance,
    downloadAttendanceExcel,
    downloadAttendancePDF,
    normalizeTemplates,
    fetchExportTemplates,
    handleSaveReportTemplate,
    handleLoadReportTemplate,
    handleDeleteReportTemplate,
    handleSaveSalaryTemplate,
    handleLoadSalaryTemplate,
    handleDeleteSalaryTemplate,
    handleDeleteLocations,
    handleAddRoleFromConfig,
    handleEditRoleFromConfig,
    handleDeleteRoles,
    handleSaveBatchLedgerRecords,
    handleSaveLedgerRecord,
    handleClearLedgerValue,
    renderClearButtonOrConfirm,
    handleUpdatePerkValue,
    handleUpdatePaymentStatus,
    handleBulkUpdatePaymentStatus,
    handleCallInitiate,
    downloadReportsCSV,
    downloadReportsExcel,
    downloadReportsPDF,
    downloadSalaryExcel,
    downloadSalaryPDF,
    fetchEmployees,
    fetchAdmins,
    fetchAdminProfile,
    handlePasswordChangeSubmit,
    triggerSuccess,
    handleLoginSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    openForgotPassword,
    backToSignIn,
    handleInviteAdminSubmit,
    handleUpdateAdminSubmit,
    handleLogout,
    handleSaveRoleSubmit,
    handleDeleteRole,
    handleSaveEmployee,
    handleMarkEmployeeExit,
    handleBulkMarkExit,
    handleBulkImport,
    handleDeleteEmployee,
    handleBulkDelete,
    bulkEditDrafts,
    employeeChangeRequests,
    pendingChangeCount,
    isFetchingChangeRequests,
    isSubmittingBulkEdit,
    fetchEmployeeChangeRequests,
    handleBulkEditDraftChange,
    handleBulkEditDraftChangeMany,
    handleBulkEditCustomFieldChange,
    handleBulkEditCustomFieldChangeMany,
    handleDiscardBulkEditDrafts,
    handleApplyBulkEmployeeChanges,
    handleApproveEmployeeChanges,
    handleRejectEmployeeChanges,
    buildAxisBulkPayItems,
    handleExportAxisBulkPay,
    handleExportSelected,
    handlePimSubTabClick,
    navigateToTab,
    toggleSidebarGroup,
    expandedSidebarGroups,
    showFlushAuditModal,
    closeFlushAuditModal,
    flushAuditPassword,
    setFlushAuditPassword,
    flushAuditError,
    isFlushingAuditLogs,
    bulkPayPreview,
    setBulkPayPreview,
    registryLocations,
    registeredJobRoles,
    reportLocationExportLabel,
    setNewPassword,
    openFlushAuditModal,
    handleViewBulkPayArchive,
    birthdayTodayList,
    birthdayMonthList,
    birthdayTodayLabel,
    isFetchingBirthdays,
    resolveEmployeePhone,
    PERMISSION_MODULES,
    sidebarItems,
    filteredSidebarItems,
    activeModuleKey,
    isModuleAccessDenied,
    SALARY_HEADERS,
    userPermissions,
    employees,
    customLocations,
    bulkPayArchiveYears,
    filteredBulkPayArchives,
    filteredAuditLogs,
    activeMonthName,
    activeCalendarYear,
    activeFYRange,
    MONTHS_LIST,
    ledgerUniqueLocations,
    ledgerUniqueSkills,
    ledgerUniqueRoles,
    filteredReportEmployees,
    dashboardStats,
    existingCodes,
    salaryUniqueLocations,
    filteredSalaryEmployees,
    profileDropdownRef,
    mobileProfileDropdownRef,
    activeSidebarTab,
    setActiveSidebarTab,
    setIsLoggedIn,
    setSessionUser,
    setSessionRole,
    setSessionLocations,
    setSessionPermissions,
    setRolesList,
    setIsFetchingRoles,
    setUsernameInput,
    setPasswordInput,
    setLoginError,
    setLoginView,
    setForgotUsername,
    setForgotError,
    setForgotMessage,
    setIssuedResetToken,
    setResetTokenInput,
    setResetNewPassword,
    setResetConfirmPassword,
    setResetError,
    setResetSuccess,
    setAdminsList,
    setInviteUsername,
    setInvitePassword,
    setInviteRole,
    setInviteLocations,
    setEditingAdminUsername,
    setEditAdminRole,
    setEditAdminLocations,
    setEditAdminDisabled,
    setInviteError,
    setInviteSuccess,
    setIsFetchingAdmins,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
    setRoleError,
    setRoleSuccess,
    setActivePimSubTab,
    setSidebarSearch,
    setIsSidebarCollapsed,
    setIsProfileOpen,
    setIsMobileProfileOpen,
    setAdminProfileInfo,
    setIsFetchingProfile,
    setProfileLoadingError,
    setOldPassword,
    setConfirmNewPassword,
    setChangePasswordError,
    setChangePasswordSuccess,
    setRawEmployees,
    setSelectedIds,
    setIsFormOpen,
    setCurrentEmployee,
    setIsLoading,
    setErrorMessage,
    setSuccessMessage,
    setEsicEligibilityLimit,
    setBasicSalaryPercentage,
    setCompanyBranch,
    setRawCustomLocations,
    setLocationCompliance,
    setLocationPtEnabled,
    setIsFetchingLocations,
    setNewLocCompliance,
    setNewLocPtEnabled,
    setCustomRoles,
    setIsFetchingJobRoles,
    setAuditLogsList,
    setIsFetchingAuditLogs,
    setAuditSearch,
    setAuditFilterAdmin,
    setAuditFilterAction,
    setExpandedLogId,
    setBulkPayArchives,
    setIsFetchingBulkPayArchives,
    setIsExportingBulkPay,
    setLastSavedBulkPay,
    setHighlightedBulkPayId,
    setBulkPayArchiveYearFilter,
    setEditingLocIndex,
    setEditingLocValue,
    setNewLocNameInput,
    setSelectedLocs,
    setLedgerEmployeeId,
    setLedgerType,
    setLedgerAmount,
    setSelectedMonth,
    setLedgerSearchQuery,
    setLedgerSelectedEmployeeIds,
    setLedgerLocationFilters,
    setLedgerSkillFilters,
    setLedgerRoleFilters,
    setIsLedgerLocationDropdownOpen,
    setIsLedgerSkillDropdownOpen,
    setIsLedgerRoleDropdownOpen,
    setTempLedgerEntries,
    setSalarySearchQuery,
    setSalaryLocationFilter,
    setSalaryFilterType,
    setSalaryJoinStartFilter,
    setSalaryJoinEndFilter,
    setSalaryExitStartFilter,
    setSalaryExitEndFilter,
    setSalaryMinSalaryFilter,
    setSalaryMaxSalaryFilter,
    setSalaryGenderFilter,
    setSalaryMaritalFilter,
    setSalaryEsicFilter,
    setSalarySkillFilters,
    setSalaryRoleFilters,
    setSalaryPaymentStatusFilter,
    setIsSalarySkillDropdownOpen,
    setIsSalaryRoleDropdownOpen,
    setSelectedSalaryEmployeeIds,
    setBirthdaySearchMonth,
    setShowConfetti,
    setSimulatedBirthdayEmpIds,
    setHelplines,
    setIsFetchingHelplines,
    setNewHelplineName,
    setNewHelplinePhone,
    setNewHelplineRole,
    setNewHelplineCategory,
    setNewHelplineLocation,
    setHelplineSearchQuery,
    setHelplineLocationFilter,
    setAttendanceDb,
    setIsFetchingAttendance,
    setAttendanceLocationFilter,
    setAttendanceRoleFilters,
    setAttendanceSkillFilters,
    setIsAttendanceRoleDropdownOpen,
    setIsAttendanceSkillDropdownOpen,
    setBulkWizardRoleFilters,
    setBulkWizardSkillFilters,
    setIsBulkWizardRoleDropdownOpen,
    setIsBulkWizardSkillDropdownOpen,
    setAttendanceSearchQuery,
    setBulkStartDay,
    setBulkEndDay,
    setBulkStatus,
    setBulkWizardStep,
    setIsBulkWizardOpen,
    setAttendanceSubView,
    setBulkSelLocations,
    setBulkSelEmployees,
    setBulkSelMonths,
    setBulkCalendarMonth,
    setBulkSelDates,
    setBulkConfirm1,
    setBulkConfirm2,
    setActiveDirectorySubTab,
    setDirectorySearch,
    setDirectoryLocation,
    setDirectoryGender,
    setActiveDialerContact,
    setActiveDialerStatus,
    setSelectedSalaryColumns,
    setSavedReportTemplates,
    setSavedSalaryTemplates,
    setIsFetchingTemplates,
    setNewReportTemplateName,
    setNewSalaryTemplateName,
    setActiveReportTemplateName,
    setActiveSalaryTemplateName,
    setEditingRoleIndex,
    setEditingRoleValue,
    setNewRoleNameInput,
    setSelectedRoles,
    setSelectedReportColumns,
    setReportLocFilters,
    setReportJoinStartFilter,
    setReportJoinEndFilter,
    setReportExitStartFilter,
    setReportExitEndFilter,
    setReportMinSalaryFilter,
    setReportMaxSalaryFilter,
    setReportGenderFilter,
    setReportMaritalFilter,
    setReportEsicFilter,
    setReportSkillFilters,
    setReportRoleFilters,
    setEmployeeListRoleFilter,
    setEmployeeListStatusFilter,
    setIsReportLocDropdownOpen,
    setIsSkillDropdownOpen,
    setIsRoleDropdownOpen,
    setReportSearchQuery,
    setSelectedReportEmployeeIds,
    navigate,
    location,
  } = useHRMS();

  const [isBulkEditMode, setIsBulkEditMode] = useState(false);

  const canReviewBulkEdits = !!userPermissions.admin?.edit;
  return (
    <>
                            <>
                              {/* Employees SUB-TAB 1: CONFIGURATION PLAYGROUND PANEL */}
                              {activePimSubTab === "Configuration" && (
                                <ConfigurationPanel />
                              )}
          
                              {/* Employees SUB-TAB 2: REPORTS DASHBOARD WITH SUMMARY DATA */}
                              {activePimSubTab === "Reports" && (
                                <ReportsPanel />
                              )}

                              {/* Employees SUB-TAB 3: CORE EMPLOYEE DIRECTORY & CSV BULK LOADER */}
                              {activePimSubTab === "Employee List" && (
                                <>
                                  {/* Executive Quick Statistics Bento Blocks */}
                                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard-grid">
                                    {/* Metric 1 */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-1">
                                      <div>
                                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Registry Record Count</span>
                                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                                          {isLoading ? "..." : `${dashboardStats.totalCount} Employees`}
                                        </span>
                                      </div>
                                      <div className="bg-orange-50 p-3 rounded-xl text-[#ff791a] shrink-0">
                                        <Users size={20} />
                                      </div>
                                    </div>
          
                                    {/* Metric 2 */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-2">
                                      <div>
                                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Total Gross Payroll</span>
                                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                                          {isLoading ? "..." : `Rs. ${dashboardStats.totalGrossPayroll.toLocaleString("en-IN")}`}
                                        </span>
                                      </div>
                                      <div className="bg-green-50/70 p-3 rounded-xl text-green-600 shrink-0">
                                        <IndianRupee size={20} />
                                      </div>
                                    </div>
          
                                    {/* Metric 3 */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-3">
                                      <div>
                                        <span className="text-slate-400 text-xs font-bold block bg-transparent">ESIC Insured Status</span>
                                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                                          {isLoading ? "..." : `${dashboardStats.esicCoveredCount} Covered`}
                                        </span>
                                      </div>
                                      <div className="bg-purple-50 p-3 rounded-xl text-purple-600 shrink-0">
                                        <Heart size={20} />
                                      </div>
                                    </div>
          
                                    {/* Metric 4 */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-4">
                                      <div>
                                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Distinct Worksites</span>
                                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                                          {isLoading ? "..." : `${dashboardStats.uniqueLocsCount} Mapping`}
                                        </span>
                                      </div>
                                      <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
                                        <Map size={20} />
                                      </div>
                                    </div>
                                  </section>

                                  {/* Bulk registry operations — CSV import & ECR spreadsheet edit */}
                                  {!!userPermissions.employees?.edit && (
                                    <section
                                      id="bulk-operations-bar"
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl"
                                    >
                                      <div>
                                        <h3 className="text-sm font-bold text-slate-800">Bulk Registry Operations</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          Import new employees from CSV or edit multiple ECR fields in spreadsheet mode
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {pendingChangeCount > 0 && (
                                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                                            {pendingChangeCount} pending approval{pendingChangeCount !== 1 ? "s" : ""}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (isBulkEditMode && Object.keys(bulkEditDrafts).length > 0) {
                                              const confirmed = await confirmAction({
                                                title: "Exit bulk edit",
                                                message: "Exit bulk edit mode? Unsaved local changes will be kept until you discard them.",
                                                confirmLabel: "Exit",
                                                variant: "warning",
                                              });
                                              if (!confirmed) return;
                                            }
                                            setIsBulkEditMode(!isBulkEditMode);
                                          }}
                                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                                            isBulkEditMode
                                              ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                                              : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                          }`}
                                        >
                                          {isBulkEditMode ? "Exit ECR Bulk Edit" : "ECR Bulk Edit"}
                                        </button>
                                      </div>
                                    </section>
                                  )}
          
                                  {/* Bulk CSV Upload Console */}
                                  {!!userPermissions.employees?.edit && !isBulkEditMode && (
                                    <section id="bulk-importer-section" className="animate-fade-in">
                                      <CsvImporter 
                                        onImportSuccess={handleBulkImport} 
                                        existingCodes={existingCodes} 
                                        availableLocations={registryLocations} 
                                        availableRoles={registeredJobRoles}
                                      />
                                    </section>
                                  )}
          
                                  {/* Master Employee Database Grid Container */}
                                  <section className="flex-1 flex flex-col min-h-[400px] bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="database-grid-section">
                                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                      <div>
                                        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                          <FileSpreadsheet className="text-slate-500" size={18} />
                                          {isBulkEditMode ? "ECR Bulk Edit — Review & Apply" : "ECR-Structured Employee Master Registry"}
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                          {isBulkEditMode
                                            ? "Edit any ECR field in the spreadsheet, then review old vs new values side-by-side and apply directly"
                                            : "Edit, delete, or bulk-export rows into statutory Indian onboarding templates"}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {!isBulkEditMode && !!userPermissions.employees?.edit && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void downloadEmployeeOnboardingTemplate({
                                                  availableLocations: registryLocations,
                                                  availableRoles: registeredJobRoles,
                                                  isSample: false,
                                                })
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
                                              title="Download blank ECR onboarding Excel template with dropdown validations"
                                              id="btn-ecr-blank-template"
                                            >
                                              <Download size={13} className="text-slate-600" />
                                              Blank Excel Template
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void downloadEmployeeOnboardingTemplate({
                                                  availableLocations: registryLocations,
                                                  availableRoles: registeredJobRoles,
                                                  isSample: true,
                                                })
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-800 shadow-xs transition hover:bg-blue-100/70 cursor-pointer"
                                              title="Download sample-filled ECR onboarding Excel with reference data"
                                              id="btn-ecr-sample-template"
                                            >
                                              <FileSpreadsheet size={13} />
                                              Sample Filled Excel
                                            </button>
                                          </>
                                        )}
                                        {!isBulkEditMode && (
                                          <span className="text-xs text-slate-400 bg-slate-50 inline-block px-2.5 py-1 rounded-full border border-slate-200/50">
                                            Checked boxes unlock bulk actions below the table grid
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {pendingChangeCount > 0 && (
                                      <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                        <EmployeeChangeRequestsPanel
                                          requests={employeeChangeRequests}
                                          isLoading={isFetchingChangeRequests}
                                          canReview={canReviewBulkEdits}
                                          onApprove={handleApproveEmployeeChanges}
                                          onReject={handleRejectEmployeeChanges}
                                          onRefresh={fetchEmployeeChangeRequests}
                                        />
                                      </div>
                                    )}
          
                                    {isLoading ? (
                                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-medium">
                                        <div className="relative w-10 h-10 mb-3 animate-spin">
                                          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                                          <div className="absolute inset-0 rounded-full border-4 border-[#ff791a] border-t-transparent"></div>
                                        </div>
                                        Loading employee directory...
                                      </div>
                                    ) : isBulkEditMode ? (
                                      <BulkEmployeeEditTable
                                        employees={employees}
                                        draftChanges={bulkEditDrafts}
                                        availableLocations={customLocations}
                                        availableRoles={registeredJobRoles}
                                        onDraftChange={handleBulkEditDraftChange}
                                        onDraftChangeMany={handleBulkEditDraftChangeMany}
                                        onCustomFieldChange={handleBulkEditCustomFieldChange}
                                        onCustomFieldChangeMany={handleBulkEditCustomFieldChangeMany}
                                        onDiscard={handleDiscardBulkEditDrafts}
                                        onApply={handleApplyBulkEmployeeChanges}
                                        isApplying={isSubmittingBulkEdit}
                                      />
                                    ) : (
                                      <EmployeeTable
                                        employees={employees}
                                        selectedIds={selectedIds}
                                        onSelectionChange={setSelectedIds}
                                        onEditClick={(emp) => {
                                          setCurrentEmployee(emp);
                                          setIsFormOpen(true);
                                        }}
                                        onDeleteClick={handleDeleteEmployee}
                                        onBulkDelete={handleBulkDelete}
                                        onBulkMarkExit={handleBulkMarkExit}
                                        onMarkExit={(emp, exitDate, exitReason) =>
                                          handleMarkEmployeeExit(emp.id, exitDate, exitReason)
                                        }
                                        onExportSelected={handleExportSelected}
                                        readOnly={!userPermissions.employees?.edit}
                                        roleFilter={employeeListRoleFilter}
                                        onRoleFilterChange={setEmployeeListRoleFilter}
                                        statusFilter={employeeListStatusFilter}
                                        onStatusFilterChange={setEmployeeListStatusFilter}
                                        exitEligibleLastPresent={Object.fromEntries(
                                          exitEligibleEmployees.map((e) => [e.employeeId, e.lastPresentDate]),
                                        )}
                                      />
                                    )}
                                  </section>
                                </>
                              )}
                            </>
    </>
  );
}
